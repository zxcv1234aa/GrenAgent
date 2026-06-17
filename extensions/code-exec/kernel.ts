import { type ChildProcessWithoutNullStreams, spawn, spawnSync } from "node:child_process";
import {
  type ExecResult,
  LineBuffer,
  encodeExec,
  encodeReset,
  parseMessage,
} from "./protocol.js";

export interface PythonInfo {
  cmd: string;
  args: string[];
}

export interface ExecOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

// 候选解释器：显式配置优先；否则按平台默认顺序（-u 关闭缓冲，保证结果即时回传）。
export function pythonCandidates(configured?: string): PythonInfo[] {
  if (configured && configured.trim()) {
    const parts = configured.trim().split(/\s+/);
    return [{ cmd: parts[0], args: [...parts.slice(1), "-u"] }];
  }
  if (process.platform === "win32") {
    return [
      { cmd: "py", args: ["-3", "-u"] },
      { cmd: "python", args: ["-u"] },
      { cmd: "python3", args: ["-u"] },
    ];
  }
  return [
    { cmd: "python3", args: ["-u"] },
    { cmd: "python", args: ["-u"] },
  ];
}

// 探测第一个可用解释器（跑 --version，status 0 即可用）。找不到返回 undefined。
export function detectPython(configured?: string): PythonInfo | undefined {
  for (const cand of pythonCandidates(configured)) {
    try {
      const probeArgs = [...cand.args.filter((a) => a !== "-u"), "--version"];
      const r = spawnSync(cand.cmd, probeArgs, { stdio: "ignore", timeout: 5000 });
      if (!r.error && r.status === 0) return cand;
    } catch {
      /* try next */
    }
  }
  return undefined;
}

let counter = 0;
const nextId = () => `e${++counter}`;

interface Pending {
  resolve: (r: ExecResult) => void;
  reject: (e: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
  onAbort?: () => void;
  signal?: AbortSignal;
}

// 常驻 Python 内核：spawn 一个 runner.py，逐条 exec，结果按 id 关联回 Promise。
// 超时/中断会重启进程（命名空间随之丢失，由上层提示）。按 cwd 各持一个实例。
export class PythonKernel {
  private child: ChildProcessWithoutNullStreams | undefined;
  private readonly pending = new Map<string, Pending>();
  private readonly outBuf = new LineBuffer();

  constructor(
    private readonly python: PythonInfo,
    private readonly runnerPath: string,
    private readonly cwd: string,
  ) {}

  private ensure(): void {
    if (this.child && !this.child.killed) return;
    const child = spawn(this.python.cmd, [...this.python.args, this.runnerPath], {
      cwd: this.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUNBUFFERED: "1" },
    }) as ChildProcessWithoutNullStreams;
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => this.onStdout(chunk));
    child.on("exit", () => this.onExit());
    child.on("error", () => this.onExit());
    this.child = child;
  }

  private onStdout(chunk: string): void {
    for (const line of this.outBuf.push(chunk)) {
      const msg = parseMessage(line);
      if (!msg || typeof msg.id !== "string" || msg.type !== "result") continue;
      const p = this.pending.get(msg.id);
      if (!p) continue;
      this.clearPending(msg.id, p);
      p.resolve(msg as ExecResult);
    }
  }

  private onExit(): void {
    this.child = undefined;
    const err = new Error("Python 内核进程已退出");
    for (const [id, p] of this.pending) {
      this.clearPending(id, p);
      p.reject(err);
    }
  }

  private clearPending(id: string, p: Pending): void {
    if (p.timer) clearTimeout(p.timer);
    if (p.onAbort && p.signal) p.signal.removeEventListener("abort", p.onAbort);
    this.pending.delete(id);
  }

  async exec(code: string, opts: ExecOptions = {}): Promise<ExecResult> {
    this.ensure();
    const id = nextId();
    const timeoutMs = opts.timeoutMs ?? 30_000;
    return new Promise<ExecResult>((resolve, reject) => {
      const p: Pending = { resolve, reject, signal: opts.signal };
      const fail = (msg: string) => {
        const cur = this.pending.get(id);
        if (cur) this.clearPending(id, cur);
        this.restart();
        reject(new Error(msg));
      };
      p.timer = setTimeout(() => fail(`执行超时（${timeoutMs}ms），已重启内核`), timeoutMs);
      if (opts.signal) {
        if (opts.signal.aborted) {
          fail("已中断");
          return;
        }
        p.onAbort = () => fail("已中断");
        opts.signal.addEventListener("abort", p.onAbort, { once: true });
      }
      this.pending.set(id, p);
      this.child?.stdin.write(encodeExec(id, code));
    });
  }

  async reset(): Promise<void> {
    this.ensure();
    const id = nextId();
    await new Promise<ExecResult>((resolve, reject) => {
      const p: Pending = { resolve, reject };
      p.timer = setTimeout(() => {
        const cur = this.pending.get(id);
        if (cur) this.clearPending(id, cur);
        reject(new Error("reset 超时"));
      }, 5000);
      this.pending.set(id, p);
      this.child?.stdin.write(encodeReset(id));
    });
  }

  restart(): void {
    this.dispose();
  }

  dispose(): void {
    const child = this.child;
    this.child = undefined;
    if (!child) return;
    try {
      child.stdin.end();
      if (process.platform === "win32" && child.pid) {
        spawn("taskkill", ["/F", "/T", "/PID", String(child.pid)], { stdio: "ignore" });
      } else {
        child.kill("SIGKILL");
      }
    } catch {
      /* already gone */
    }
  }
}

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { winToWslPath } from "./paths.js";
import { buildSrtSettings } from "./srt.js";
import type { SandboxAdapter, SandboxResult, SandboxSpec } from "./types.js";

export type RunFn = (file: string, args: string[], timeoutMs?: number) => Promise<SandboxResult>;

// 默认 run：spawn wsl.exe，收集 stdout/stderr/code，带超时 kill。
const defaultRun: RunFn = (file, args, timeoutMs) =>
  new Promise<SandboxResult>((resolve) => {
    const child = spawn(file, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = timeoutMs
      ? setTimeout(() => {
          try {
            child.kill();
          } catch {
            /* gone */
          }
          resolve({ stdout, stderr: `${stderr}\n[sandbox] timeout ${timeoutMs}ms`, code: -1 });
        }, timeoutMs)
      : undefined;
    child.stdout?.on("data", (d: Buffer) => (stdout += d.toString()));
    child.stderr?.on("data", (d: Buffer) => (stderr += d.toString()));
    child.on("error", (e) => {
      if (timer) clearTimeout(timer);
      resolve({ stdout, stderr: String(e), code: -1 });
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? -1 });
    });
  });

export interface Prepared {
  /** WSL 路径：srt settings 文件。 */
  settings: string;
  /** WSL 路径：待执行命令脚本文件（bash 读取执行，规避命令行长度上限与转义）。 */
  cmd: string;
  /** 清理临时文件（exec 结束后调用）。 */
  cleanup: () => void;
}
export type PrepareFn = (spec: SandboxSpec, wslCwd: string, command: string) => Promise<Prepared>;

// 默认 prepare：把 srt settings 与命令脚本写到宿主 temp，转成 WSL 路径返回，并给出清理函数。
// 命令落盘（而非内联 argv）：① 规避 Windows 命令行长度上限；② bash 读文件执行，无需转义/base64。
const defaultPrepare: PrepareFn = async (spec, wslCwd, command) => {
  const dir = mkdtempSync(join(tmpdir(), "pi-sbx-"));
  const settingsWin = join(dir, "srt-settings.json");
  const cmdWin = join(dir, "cmd.sh");
  writeFileSync(settingsWin, JSON.stringify(buildSrtSettings(spec, wslCwd)), "utf8");
  writeFileSync(cmdWin, command, "utf8");
  return {
    settings: winToWslPath(settingsWin),
    cmd: winToWslPath(cmdWin),
    cleanup: () => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* best-effort */
      }
    },
  };
};

export interface WslSandboxOpts {
  distro: string;
  run?: RunFn;
  prepare?: PrepareFn;
}

export class WslSandbox implements SandboxAdapter {
  private distro: string;
  private run: RunFn;
  private prepare: PrepareFn;
  constructor(opts: WslSandboxOpts) {
    this.distro = opts.distro;
    this.run = opts.run ?? defaultRun;
    this.prepare = opts.prepare ?? defaultPrepare;
  }
  async isAvailable(): Promise<boolean> {
    // 由 getSandbox() 的探测决定是否构造本类；构造出来即视为可用。
    return true;
  }
  async exec(command: string, spec: SandboxSpec): Promise<SandboxResult> {
    const wslCwd = winToWslPath(spec.cwd);
    const { settings, cmd, cleanup } = await this.prepare(spec, wslCwd, command);
    // 经登录 shell（bash -lc）执行：srt/node 常在登录 PATH 才有的目录（如自定义 node 安装），
    // 非登录 `wsl -- srt` 会 command not found。命令与 settings 均落盘，argv 只含 tmp 路径
    // （无空格，单引号兜底），既不超命令行长度，也无需对任意命令做转义。
    try {
      const script = `srt --settings '${settings}' bash '${cmd}'`;
      const args = ["-d", this.distro, "--cd", wslCwd, "--", "bash", "-lc", script];
      return await this.run("wsl.exe", args, spec.timeoutMs);
    } finally {
      cleanup();
    }
  }
}

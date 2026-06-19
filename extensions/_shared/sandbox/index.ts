import { spawn } from "node:child_process";
import { getConfig } from "../runtime-config.js";
import { parseWslDistros, pickDistro } from "./detect.js";
import { NoopSandbox } from "./noop.js";
import type { SandboxAdapter } from "./types.js";
import { WslSandbox } from "./wsl.js";

export type { SandboxAdapter, SandboxResult, SandboxSpec } from "./types.js";
export { WslSandbox } from "./wsl.js";
export { NoopSandbox } from "./noop.js";

type ProbeResult = { ok: true; distro: string } | { ok: false; reason: string };
export type Probe = () => Promise<ProbeResult>;

let cached: SandboxAdapter | undefined;
let inflight: Promise<SandboxAdapter> | undefined;

function wslExec(args: string[]): Promise<{ stdout: string; code: number }> {
  return new Promise((resolve) => {
    const c = spawn("wsl.exe", args, { windowsHide: true });
    const chunks: Buffer[] = [];
    c.stdout?.on("data", (d: Buffer) => chunks.push(d));
    c.on("error", () => resolve({ stdout: "", code: -1 }));
    c.on("close", (code) => {
      // wsl.exe 自身输出（如 -l -v）是 UTF-16LE，而子命令（-d .. -- ..）输出是 UTF-8。
      // 统一剔除 NUL 字节再按 UTF-8 解码：对前者（ASCII 间夹 NUL）与后者都成立。
      const noNul = Buffer.from(Buffer.concat(chunks).filter((b) => b !== 0));
      resolve({ stdout: noNul.toString("utf8"), code: code ?? -1 });
    });
  });
}

// 默认探测：Windows 上跑 `wsl -l -v` 选 distro，再在 distro 内确认 srt/bwrap/socat 可用。
const defaultProbe: Probe = async () => {
  if (process.platform !== "win32") return { ok: false, reason: "仅 Windows 走 WSL 后端" };
  const list = await wslExec(["-l", "-v"]);
  if (list.code !== 0) return { ok: false, reason: "未检测到 WSL" };
  const distro = pickDistro(parseWslDistros(list.stdout), getConfig("SANDBOX_DISTRO") || undefined);
  if (!distro) return { ok: false, reason: "无可用的 WSL2 发行版" };
  // srt 自身还依赖 ripgrep(rg)，缺了会在运行时报错——必须一并探测，否则会误判可用。
  const deps = await wslExec([
    "-d",
    distro.name,
    "--",
    "bash",
    "-lc",
    "command -v srt bwrap socat rg >/dev/null && echo OK",
  ]);
  if (!deps.stdout.replace(/\u0000/g, "").includes("OK")) {
    return { ok: false, reason: "WSL 内缺 srt/bwrap/socat/rg" };
  }
  return { ok: true, distro: distro.name };
};

export async function getSandbox(opts: { probe?: Probe } = {}): Promise<SandboxAdapter> {
  if (getConfig("SANDBOX_ENABLE") === "off") return new NoopSandbox();
  if (cached) return cached;
  if (inflight) return inflight;
  const probe = opts.probe ?? defaultProbe;
  inflight = (async () => {
    const r = await probe();
    cached = r.ok ? new WslSandbox({ distro: r.distro }) : new NoopSandbox();
    inflight = undefined;
    return cached;
  })();
  return inflight;
}

export function __resetForTest(): void {
  cached = undefined;
  inflight = undefined;
}

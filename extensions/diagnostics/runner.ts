import { execFile } from "node:child_process";

export interface RawCheck {
  source: string;
  stdout: string;
  stderr: string;
}

function runOne(cwd: string, cmd: string[], signal: AbortSignal | undefined, timeoutMs: number): Promise<RawCheck> {
  const [bin, ...args] = cmd;
  // `npx tsc` -> source "tsc"; plain binary -> the binary name.
  const source = bin === "npx" ? args[0] ?? bin : bin;
  // Windows npm shims (npx.cmd/tsc.cmd) require a shell to spawn. To avoid the
  // DEP0190 "args with shell" warning we pass the whole command as one string
  // with empty args. Commands come from trusted project config (.pi/settings.json
  // or hardcoded auto-detect), not arbitrary user input.
  const useShell = process.platform === "win32";
  const opts = { cwd, signal, timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 };
  return new Promise((resolve) => {
    const done = (_err: unknown, stdout: string | Buffer, stderr: string | Buffer) => {
      // Non-zero exit (tsc/eslint with findings) still yields stdout/stderr.
      resolve({ source, stdout: stdout?.toString() ?? "", stderr: stderr?.toString() ?? "" });
    };
    if (useShell) {
      execFile(cmd.join(" "), [], { ...opts, shell: true }, done);
    } else {
      execFile(bin, args, opts, done);
    }
  });
}

export function runChecks(
  cwd: string,
  commands: string[][],
  signal?: AbortSignal,
  timeoutMs = 120000,
): Promise<RawCheck[]> {
  return Promise.all(commands.map((cmd) => runOne(cwd, cmd, signal, timeoutMs)));
}

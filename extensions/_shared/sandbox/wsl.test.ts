import { describe, expect, it, vi } from "vitest";
import { WslSandbox } from "./wsl.js";

function fakeRun() {
  const calls: Array<{ file: string; args: string[] }> = [];
  const run = vi.fn(async (file: string, args: string[]) => {
    calls.push({ file, args });
    return { stdout: "ok", stderr: "", code: 0 };
  });
  return { run, calls };
}

const prepareFixed = (cleanup: () => void = () => {}) =>
  async () => ({ settings: "/tmp/s.json", cmd: "/tmp/cmd.sh", cleanup });

describe("WslSandbox.exec", () => {
  it("builds wsl + srt argv with cwd mapped and on-disk settings/cmd files", async () => {
    const { run, calls } = fakeRun();
    const sbx = new WslSandbox({ distro: "Ubuntu", run, prepare: prepareFixed() });
    const r = await sbx.exec("echo hi", { cwd: "D:\\proj" });
    expect(r).toEqual({ stdout: "ok", stderr: "", code: 0 });
    expect(calls[0].file).toBe("wsl.exe");
    expect(calls[0].args).toEqual([
      "-d",
      "Ubuntu",
      "--cd",
      "/mnt/d/proj",
      "--",
      "bash",
      "-lc",
      "srt --settings '/tmp/s.json' bash '/tmp/cmd.sh'",
    ]);
  });

  it("passes the timeout through to run", async () => {
    const { run } = fakeRun();
    const sbx = new WslSandbox({ distro: "Ubuntu", run, prepare: prepareFixed() });
    await sbx.exec("sleep 1", { cwd: "D:\\proj", timeoutMs: 5000 });
    expect(run).toHaveBeenCalledWith("wsl.exe", expect.any(Array), 5000);
  });

  it("cleans up temp files after exec", async () => {
    const { run } = fakeRun();
    const cleanup = vi.fn();
    const sbx = new WslSandbox({ distro: "Ubuntu", run, prepare: prepareFixed(cleanup) });
    await sbx.exec("echo hi", { cwd: "D:\\proj" });
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

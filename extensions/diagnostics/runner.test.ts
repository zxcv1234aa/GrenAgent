import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runChecks } from "./runner.js";

describe("runChecks", () => {
  it("captures stdout from a command", async () => {
    const dir = mkdtempSync(join(tmpdir(), "diag-"));
    const [res] = await runChecks(dir, [["node", "--version"]], undefined, 30000);
    expect(res.stdout).toMatch(/v\d+/);
  }, 30000);
});

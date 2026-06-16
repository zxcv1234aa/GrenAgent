import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveCommands } from "./config.js";

describe("resolveCommands", () => {
  it("prefers .pi/settings.json diagnostics.commands", () => {
    const dir = mkdtempSync(join(tmpdir(), "diag-"));
    mkdirSync(join(dir, ".pi"));
    writeFileSync(join(dir, ".pi", "settings.json"), JSON.stringify({ diagnostics: { commands: [["echo", "hi"]] } }));
    expect(resolveCommands(dir)).toEqual([["echo", "hi"]]);
  });
  it("auto-detects tsc when tsconfig.json present", () => {
    const dir = mkdtempSync(join(tmpdir(), "diag-"));
    writeFileSync(join(dir, "tsconfig.json"), "{}");
    expect(resolveCommands(dir).some((c) => c.includes("tsc"))).toBe(true);
  });
  it("returns [] when nothing configured or detected", () => {
    const dir = mkdtempSync(join(tmpdir(), "diag-"));
    expect(resolveCommands(dir)).toEqual([]);
  });
});

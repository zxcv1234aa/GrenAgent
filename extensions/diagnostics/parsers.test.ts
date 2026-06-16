import { describe, expect, it } from "vitest";
import { parseEslintJson, parseTsc } from "./parsers.js";

describe("parseTsc", () => {
  it("parses tsc --pretty false output", () => {
    const out = "src/a.ts(12,5): error TS2304: Cannot find name 'x'.";
    expect(parseTsc(out)).toEqual([
      { file: "src/a.ts", line: 12, col: 5, severity: "error", message: "TS2304: Cannot find name 'x'.", source: "tsc" },
    ]);
  });
  it("ignores non-matching lines", () => {
    expect(parseTsc("Compilation complete\n")).toEqual([]);
  });
});

describe("parseEslintJson", () => {
  it("parses eslint -f json", () => {
    const out = JSON.stringify([
      { filePath: "/p/a.ts", messages: [{ line: 3, column: 7, severity: 2, message: "no unused", ruleId: "no-unused-vars" }] },
    ]);
    const d = parseEslintJson(out);
    expect(d[0]).toMatchObject({ file: "/p/a.ts", line: 3, col: 7, severity: "error", source: "eslint" });
    expect(d[0].message).toContain("no-unused-vars");
  });
  it("returns [] on garbage", () => {
    expect(parseEslintJson("not json")).toEqual([]);
  });
});

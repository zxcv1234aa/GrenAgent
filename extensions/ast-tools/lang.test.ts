import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectFiles, extToLang } from "./lang.js";

describe("extToLang", () => {
  it("maps core web extensions to ast-grep lang", () => {
    expect(extToLang("a.ts")).toBe("TypeScript");
    expect(extToLang("a.mts")).toBe("TypeScript");
    expect(extToLang("a.tsx")).toBe("Tsx");
    expect(extToLang("a.js")).toBe("JavaScript");
    expect(extToLang("a.jsx")).toBe("JavaScript");
    expect(extToLang("a.mjs")).toBe("JavaScript");
    expect(extToLang("a.css")).toBe("Css");
    expect(extToLang("a.html")).toBe("Html");
  });
  it("is case-insensitive and handles paths", () => {
    expect(extToLang("/abs/Dir/File.TS")).toBe("TypeScript");
  });
  it("returns null for unsupported/unknown extensions", () => {
    expect(extToLang("a.py")).toBeNull(); // 非核心包语言，列后续增强
    expect(extToLang("a.unknownext")).toBeNull();
    expect(extToLang("noext")).toBeNull();
  });
});

describe("collectFiles", () => {
  it("collects supported files from dir, file, and glob", async () => {
    const root = mkdtempSync(join(tmpdir(), "ast-cf-"));
    mkdirSync(join(root, "sub"));
    writeFileSync(join(root, "a.ts"), "const a = 1");
    writeFileSync(join(root, "sub", "b.js"), "var x = 1");
    writeFileSync(join(root, "note.txt"), "ignored");
    writeFileSync(join(root, "skip.py"), "x = 1"); // 非核心语言，跳过

    const byDir = await collectFiles(["."], root);
    expect(byDir.map((f) => f.rel).sort()).toEqual(["a.ts", "sub/b.js"]); // txt/py 跳过

    const byFile = await collectFiles(["a.ts"], root);
    expect(byFile).toHaveLength(1);
    expect(byFile[0]).toMatchObject({ rel: "a.ts", lang: "TypeScript" });

    const byGlob = await collectFiles(["**/*.js"], root);
    expect(byGlob.map((f) => f.rel)).toEqual(["sub/b.js"]);
  });
});

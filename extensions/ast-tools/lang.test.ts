import { describe, expect, it } from "vitest";
import { extToLang } from "./lang.js";

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

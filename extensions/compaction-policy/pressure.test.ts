import { describe, expect, it } from "vitest";
import { classify } from "./pressure.js";

describe("classify", () => {
  it("null → L0 unknown", () => {
    expect(classify(null)).toEqual({ level: 0, label: "ctx —" });
  });
  it("maps percent to levels", () => {
    expect(classify(40).level).toBe(0);
    expect(classify(60).level).toBe(1);
    expect(classify(78).level).toBe(2);
    expect(classify(90).level).toBe(3);
  });
  it("clamps and labels", () => {
    expect(classify(150)).toEqual({ level: 3, label: "ctx 100% L3" });
  });
});

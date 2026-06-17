import { describe, expect, it } from "vitest";
import {
  type ExecResult,
  LineBuffer,
  encodeExec,
  encodePing,
  encodeReset,
  formatResult,
  parseMessage,
} from "./protocol.js";

describe("encode helpers", () => {
  it("encode exec/reset/ping as newline-terminated JSON", () => {
    expect(encodeExec("e1", "1+1")).toBe('{"type":"exec","id":"e1","code":"1+1"}\n');
    expect(encodeReset("e2")).toBe('{"type":"reset","id":"e2"}\n');
    expect(encodePing("e3")).toBe('{"type":"ping","id":"e3"}\n');
  });
});

describe("LineBuffer", () => {
  it("splits complete lines and keeps the remainder", () => {
    const b = new LineBuffer();
    expect(b.push("aa\nbb")).toEqual(["aa"]);
    expect(b.push("cc\n")).toEqual(["bbcc"]);
    expect(b.push("")).toEqual([]);
  });
  it("handles multiple lines in one chunk", () => {
    const b = new LineBuffer();
    expect(b.push("a\nb\nc\n")).toEqual(["a", "b", "c"]);
  });
});

describe("parseMessage", () => {
  it("parses a result line", () => {
    const m = parseMessage(
      '{"type":"result","id":"e1","stdout":"hi\\n","stderr":"","value":"2","ok":true,"error":null}',
    );
    expect(m).toMatchObject({ type: "result", id: "e1", value: "2", ok: true });
  });
  it("returns null for stray stdout / non-json / blank", () => {
    expect(parseMessage("just some print output")).toBeNull();
    expect(parseMessage("")).toBeNull();
    expect(parseMessage("{not json}")).toBeNull();
  });
});

describe("formatResult", () => {
  const base: ExecResult = {
    type: "result",
    id: "e1",
    stdout: "",
    stderr: "",
    value: null,
    ok: true,
    error: null,
  };
  it("joins stdout and value echo", () => {
    expect(formatResult({ ...base, stdout: "hello\n", value: "42" })).toBe("hello\n=> 42");
  });
  it("shows the traceback on error", () => {
    expect(formatResult({ ...base, ok: false, error: "Traceback...\n" })).toBe("Traceback...");
  });
  it("falls back to a no-output marker", () => {
    expect(formatResult(base)).toBe("(无输出)");
  });
  it("clips overly long output", () => {
    const big = "x".repeat(70 * 1024);
    const out = formatResult({ ...base, stdout: big });
    expect(out).toContain("输出过长已截断");
    expect(out.length).toBeLessThan(big.length);
  });
});

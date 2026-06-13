import { describe, expect, it } from "vitest";
import { formatResults, parseBrave, parseTavily, resolveProvider } from "./provider.js";

describe("resolveProvider", () => {
  it("defaults to tavily", () => {
    expect(resolveProvider({ TAVILY_API_KEY: "tvly-x" })).toMatchObject({
      ok: true,
      provider: "tavily",
      apiKey: "tvly-x",
    });
  });
  it("selects brave when configured", () => {
    expect(resolveProvider({ WEB_SEARCH_PROVIDER: "brave", BRAVE_API_KEY: "b-x" })).toMatchObject({
      ok: true,
      provider: "brave",
      apiKey: "b-x",
    });
  });
  it("fails when the provider key is missing", () => {
    expect(resolveProvider({}).ok).toBe(false);
    expect(resolveProvider({ WEB_SEARCH_PROVIDER: "brave" }).ok).toBe(false);
  });
});

describe("parseTavily", () => {
  it("maps content→snippet, reads answer, drops urlless rows", () => {
    const parsed = parseTavily({
      answer: "AI summary",
      results: [
        { title: "T1", url: "https://a.com", content: "snip1", score: 0.9 },
        { title: "T2", url: "", content: "x" },
      ],
    });
    expect(parsed.answer).toBe("AI summary");
    expect(parsed.results).toEqual([{ title: "T1", url: "https://a.com", snippet: "snip1" }]);
  });
  it("tolerates missing fields", () => {
    expect(parseTavily({})).toEqual({ answer: undefined, results: [] });
  });
});

describe("parseBrave", () => {
  it("maps web.results description→snippet", () => {
    const parsed = parseBrave({ web: { results: [{ title: "B1", url: "https://b.com", description: "desc1" }] } });
    expect(parsed.results).toEqual([{ title: "B1", url: "https://b.com", snippet: "desc1" }]);
  });
});

describe("formatResults", () => {
  it("renders answer + source list", () => {
    const out = formatResults("q", { answer: "A", results: [{ title: "T", url: "https://u", snippet: "s" }] });
    expect(out).toContain("A");
    expect(out).toContain("https://u");
    expect(out).toContain("T");
  });
  it("handles empty results", () => {
    expect(formatResults("q", { results: [] })).toContain("（无结果）");
  });
});

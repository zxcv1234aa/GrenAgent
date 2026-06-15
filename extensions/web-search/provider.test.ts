import { describe, expect, it } from "vitest";
import {
  formatResults,
  parseBing,
  parseBrave,
  parseDuckDuckGo,
  parseSogou,
  parseTavily,
  resolveProvider,
} from "./provider.js";

describe("resolveProvider", () => {
  it("uses tavily when its key is set", () => {
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
  it("falls back to bing when no key is set", () => {
    expect(resolveProvider({})).toEqual({ ok: true, provider: "bing" });
    expect(resolveProvider({ WEB_SEARCH_PROVIDER: "tavily" })).toEqual({ ok: true, provider: "bing" });
  });
  it("uses bing / sogou / duckduckgo / baidu / csdn / juejin when explicitly requested", () => {
    expect(resolveProvider({ WEB_SEARCH_PROVIDER: "bing" })).toEqual({ ok: true, provider: "bing" });
    expect(resolveProvider({ WEB_SEARCH_PROVIDER: "sogou" })).toEqual({ ok: true, provider: "sogou" });
    expect(resolveProvider({ WEB_SEARCH_PROVIDER: "duckduckgo" })).toEqual({ ok: true, provider: "duckduckgo" });
    expect(resolveProvider({ WEB_SEARCH_PROVIDER: "ddg" })).toEqual({ ok: true, provider: "duckduckgo" });
    expect(resolveProvider({ WEB_SEARCH_PROVIDER: "baidu" })).toEqual({ ok: true, provider: "baidu" });
    expect(resolveProvider({ WEB_SEARCH_PROVIDER: "csdn" })).toEqual({ ok: true, provider: "csdn" });
    expect(resolveProvider({ WEB_SEARCH_PROVIDER: "juejin" })).toEqual({ ok: true, provider: "juejin" });
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

describe("parseDuckDuckGo", () => {
  it("parses result links (decoding uddg) + snippets, stripping tags", () => {
    const html = `
      <div class="result">
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa&amp;rut=x">Example <b>A</b></a>
        <a class="result__snippet" href="#">Snippet <b>one</b> here</a>
      </div>
      <div class="result">
        <a rel="nofollow" class="result__a" href="https://direct.com/b">Direct B</a>
        <a class="result__snippet">Second snippet</a>
      </div>`;
    expect(parseDuckDuckGo(html)).toEqual({
      results: [
        { title: "Example A", url: "https://example.com/a", snippet: "Snippet one here" },
        { title: "Direct B", url: "https://direct.com/b", snippet: "Second snippet" },
      ],
    });
  });
  it("returns empty results for non-result html", () => {
    expect(parseDuckDuckGo("<html><body>nothing here</body></html>")).toEqual({ results: [] });
  });
});

describe("parseBing", () => {
  it("parses b_algo blocks (h2 title/url + b_lineclamp snippet), skips bing-internal urls", () => {
    const html = `
      <ol id="b_results">
        <li class="b_algo" data-id><h2><a href="https://example.com/a">Example <strong>A</strong></a></h2>
          <div class="b_caption"><p class="b_lineclamp2">Snippet <strong>one</strong> here</p></div></li>
        <li class="b_algo"><h2><a href="https://www.bing.com/aclick?ad=1">Sponsored</a></h2>
          <p class="b_lineclamp2">ad snippet</p></li>
        <li class="b_algo"><h2><a href="https://direct.com/b">Direct B</a></h2>
          <p class="b_lineclamp2">Second snippet</p></li>
      </ol>`;
    expect(parseBing(html)).toEqual({
      results: [
        { title: "Example A", url: "https://example.com/a", snippet: "Snippet one here" },
        { title: "Direct B", url: "https://direct.com/b", snippet: "Second snippet" },
      ],
    });
  });
  it("returns empty results when there are no b_algo blocks", () => {
    expect(parseBing("<html><body>no results</body></html>")).toEqual({ results: [] });
  });
});

describe("parseSogou", () => {
  it("parses vrwrap blocks, prefers data-url over /link redirect", () => {
    const html = `
      <div class="vrwrap" id="w0"><h3 class="vr-title"><a name="dttl" href="/link?url=ENC">github <em>trending</em></a></h3>
        <div class="fz-mid space-txt clamp2" id="cacheresult_summary_0">Snippet <em>one</em></div>
        <div class="r-sech" data-url="https://github.com/topics/x"></div></div>
      <div class="vrwrap"><h3 class="vr-title"><a href="/link?url=ENC2">No data-url</a></h3>
        <div class="text-layout">Second</div></div>`;
    expect(parseSogou(html)).toEqual({
      results: [
        { title: "github trending", url: "https://github.com/topics/x", snippet: "Snippet one" },
        { title: "No data-url", url: "https://www.sogou.com/link?url=ENC2", snippet: "Second" },
      ],
    });
  });
  it("returns empty results without vrwrap blocks", () => {
    expect(parseSogou("<html><body>nothing</body></html>")).toEqual({ results: [] });
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

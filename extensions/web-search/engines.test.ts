import { describe, expect, it } from "vitest";
import { parseBaidu, parseCsdn, parseEngineChain, parseJuejin } from "./engines/index.js";

describe("parseBaidu", () => {
  it("parses #content_left blocks with h3/a and cos-row snippet", () => {
    const html = `
      <div id="content_left">
        <div class="result">
          <h3><a href="https://example.com/a">Example A</a></h3>
          <div class="cos-row">Snippet one</div>
        </div>
        <div class="result">
          <h3><a href="/relative">Skip relative</a></h3>
        </div>
        <div class="result">
          <h3><a href="https://example.com/b">Example B</a></h3>
          <span class="c-font-normal c-color-text" aria-label="Aria snippet"></span>
        </div>
      </div>`;
    expect(parseBaidu(html)).toEqual([
      { title: "Example A", url: "https://example.com/a", snippet: "Snippet one" },
      { title: "Example B", url: "https://example.com/b", snippet: "Aria snippet" },
    ]);
  });
});

describe("parseCsdn", () => {
  it("maps result_vos digest→snippet", () => {
    expect(
      parseCsdn({
        result_vos: [
          { title: "T1", url_location: "https://blog.csdn.net/a", digest: "d1" },
          { title: "", url_location: "https://x.com" },
        ],
      }),
    ).toEqual([{ title: "T1", url: "https://blog.csdn.net/a", snippet: "d1" }]);
  });
});

describe("parseJuejin", () => {
  it("maps juejin API rows to post URLs", () => {
    expect(
      parseJuejin({
        err_no: 0,
        data: [
          {
            title_highlight: "Hello <em>world</em>",
            content_highlight: "Brief <em>text</em>",
            result_model: {
              article_id: "123",
              article_info: { digg_count: 1, view_count: 2 },
              author_user_info: { user_name: "dev" },
              category: { category_name: "前端" },
              tags: [{ tag_name: "js" }],
            },
          },
        ],
      }),
    ).toEqual([
      {
        title: "Hello world",
        url: "https://juejin.cn/post/123",
        snippet: "Brief text | 分类: 前端 | 标签: js | 👍 1 · 👀 2",
      },
    ]);
  });
});

describe("parseEngineChain", () => {
  it("dedupes and filters unknown engines", () => {
    expect(parseEngineChain("bing, baidu, bing, foo, csdn")).toEqual(["bing", "baidu", "csdn"]);
  });
});

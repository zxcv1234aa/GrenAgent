import * as cheerio from "cheerio";
import type { SearchResult } from "../provider.js";

// 移植自 open-webSearch src/engines/baidu/baidu.ts（cheerio 解析 #content_left）。
export function parseBaidu(html: string): SearchResult[] {
  const $ = cheerio.load(html);
  const results: SearchResult[] = [];

  $("#content_left")
    .children()
    .each((_i, element) => {
      const titleElement = $(element).find("h3");
      const linkElement = $(element).find("a");
      if (!titleElement.length || !linkElement.length) return;

      const url = linkElement.attr("href");
      if (!url?.startsWith("http")) return;

      const snippetElement = $(element).find(".c-font-normal.c-color-text").first();
      const desc =
        snippetElement.attr("aria-label")?.trim() ||
        $(element).find(".cos-row").first().text().trim() ||
        "";

      const title = titleElement.text().trim();
      if (!title) return;
      results.push({ title, url, snippet: desc });
    });

  return results;
}

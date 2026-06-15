import * as cheerio from "cheerio";

const SELECTORS = [
  ".markdown-body",
  ".article-content",
  ".content",
  "[data-v-md-editor-preview]",
  ".bytemd-preview",
  ".article-area .content",
];

// 移植自 open-webSearch fetchJuejinArticle。
export async function fetchJuejinArticle(
  url: string,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true });
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "text/html",
        "accept-language": "zh-CN,zh;q=0.9",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const $ = cheerio.load(await res.text());
    for (const selector of SELECTORS) {
      const element = $(selector).first();
      if (!element.length) continue;
      element.find("script, style, .code-block-extension, .hljs-ln-numbers").remove();
      const content = element.text().trim();
      if (content.length > 100) return content;
    }
    $("script, style, nav, header, footer, .sidebar, .comment").remove();
    const fallback = $("body").text().trim();
    if (!fallback) throw new Error("Failed to extract Juejin article content");
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

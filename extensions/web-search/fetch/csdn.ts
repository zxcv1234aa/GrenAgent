import * as cheerio from "cheerio";

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// 移植自 open-webSearch fetchCsdnArticle（仅 HTTP + cheerio，无 Playwright 回退）。
export async function fetchCsdnArticle(
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
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const $ = cheerio.load(await res.text());
    const article = $("#content_views").first();
    article.find("script, style, noscript").remove();
    const content = normalizeText(article.text());
    if (!content) throw new Error("Failed to extract readable CSDN article content");
    return content;
  } finally {
    clearTimeout(timer);
  }
}

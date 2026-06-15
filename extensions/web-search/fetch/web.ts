import * as cheerio from "cheerio";

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const CONTENT_SELECTORS = ["article", "main", "[role=main]", ".markdown-body", ".post-content", "#content"];

// 精简版 open-webSearch fetchWebContent：HTTP + cheerio 正文提取。
export async function fetchWebContent(
  url: string,
  maxChars: number,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<{ url: string; title: string; content: string; truncated: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true });
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const contentType = res.headers.get("content-type") ?? "";
    const raw = await res.text();
    if (!contentType.includes("html") && !/<html[\s>]/i.test(raw)) {
      const content = raw.length > maxChars ? `${raw.slice(0, maxChars)}…` : raw;
      return { url, title: url, content, truncated: raw.length > maxChars };
    }
    const $ = cheerio.load(raw);
    const title = $("title").first().text().trim() || url;
    let text = "";
    for (const selector of CONTENT_SELECTORS) {
      const node = $(selector).first();
      if (!node.length) continue;
      node.find("script, style, nav, header, footer, aside").remove();
      text = normalizeText(node.text());
      if (text.length > 200) break;
    }
    if (!text) {
      $("script, style, nav, header, footer, aside").remove();
      text = normalizeText($("body").text());
    }
    const truncated = text.length > maxChars;
    return { url, title, content: truncated ? `${text.slice(0, maxChars)}…` : text, truncated };
  } finally {
    clearTimeout(timer);
  }
}

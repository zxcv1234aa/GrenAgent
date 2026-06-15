function extractTopicId(url: string): string | null {
  const match = url.match(/\/topic\/(\d+)/);
  return match ? match[1] : null;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 移植自 open-webSearch fetchLinuxDoArticle（Discourse JSON API，无硬编码 Cookie）。
export async function fetchLinuxDoArticle(
  url: string,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<string> {
  const topicId = extractTopicId(url);
  if (!topicId) throw new Error("Invalid URL: cannot extract linux.do topic ID");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true });
  try {
    const res = await fetch(`https://linux.do/t/${topicId}.json`, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const json = (await res.json()) as { post_stream?: { posts?: Array<{ cooked?: string }> } };
    const cooked = json.post_stream?.posts?.[0]?.cooked ?? "";
    const content = htmlToText(cooked);
    if (!content) throw new Error("Failed to extract linux.do article content");
    return content;
  } finally {
    clearTimeout(timer);
  }
}

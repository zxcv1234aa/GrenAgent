// Pure helpers for the web_search tool: provider selection, response parsing
// (Tavily / Brave), and LLM-friendly result formatting. No network here so the
// logic stays unit-testable.

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface ParsedSearch {
  answer?: string;
  results: SearchResult[];
}

export type ProviderChoice =
  | { ok: true; provider: "tavily" | "brave"; apiKey: string }
  | { ok: true; provider: "bing" | "sogou" | "duckduckgo" | "baidu" | "csdn" | "juejin" }
  | { ok: false; reason: string };

// 选择搜索 provider。Bing / DuckDuckGo 是零配置（无 key）白嫖源，保证 web_search 开箱即用：
// 1) 显式 WEB_SEARCH_PROVIDER 指定且满足条件就用它；
// 2) 否则有 TAVILY / BRAVE key 就用对应付费源；
// 3) 都没有 → Bing 抓取（国内可达）。DuckDuckGo 在部分网络（如国内）被墙，仅在显式指定时用。
export function resolveProvider(env: Record<string, string | undefined>): ProviderChoice {
  const explicit = (env.WEB_SEARCH_PROVIDER ?? "").trim().toLowerCase();

  if (explicit === "bing") return { ok: true, provider: "bing" };
  if (explicit === "sogou") return { ok: true, provider: "sogou" };
  if (explicit === "baidu") return { ok: true, provider: "baidu" };
  if (explicit === "csdn") return { ok: true, provider: "csdn" };
  if (explicit === "juejin") return { ok: true, provider: "juejin" };
  if (explicit === "duckduckgo" || explicit === "ddg") return { ok: true, provider: "duckduckgo" };
  if (explicit === "brave" && env.BRAVE_API_KEY) return { ok: true, provider: "brave", apiKey: env.BRAVE_API_KEY };
  if (explicit === "tavily" && env.TAVILY_API_KEY) return { ok: true, provider: "tavily", apiKey: env.TAVILY_API_KEY };

  if (env.TAVILY_API_KEY) return { ok: true, provider: "tavily", apiKey: env.TAVILY_API_KEY };
  if (env.BRAVE_API_KEY) return { ok: true, provider: "brave", apiKey: env.BRAVE_API_KEY };

  return { ok: true, provider: "bing" };
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export function parseTavily(json: unknown): ParsedSearch {
  const obj = asRecord(json);
  const results: SearchResult[] = asArray(obj.results)
    .map((r) => {
      const ro = asRecord(r);
      return { title: asStr(ro.title), url: asStr(ro.url), snippet: asStr(ro.content) };
    })
    .filter((r) => r.url);
  return { answer: typeof obj.answer === "string" ? obj.answer : undefined, results };
}

export function parseBrave(json: unknown): ParsedSearch {
  const web = asRecord(asRecord(json).web);
  const results: SearchResult[] = asArray(web.results)
    .map((r) => {
      const ro = asRecord(r);
      return { title: asStr(ro.title), url: asStr(ro.url), snippet: asStr(ro.description) };
    })
    .filter((r) => r.url);
  return { results };
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;|&lt;|&gt;|&quot;|&#x27;|&#39;|&#0?183;|&ensp;|&nbsp;|&#160;|&hellip;/g, (e) =>
      e === "&amp;"
        ? "&"
        : e === "&lt;"
          ? "<"
          : e === "&gt;"
            ? ">"
            : e === "&quot;"
              ? '"'
              : e === "&hellip;"
                ? "…"
                : e === "&#x27;" || e === "&#39;"
                  ? "'"
                  : " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

// DuckDuckGo HTML 端点把目标链接包成 //duckduckgo.com/l/?uddg=<encoded>，解出真实 URL。
function decodeDdgHref(href: string): string {
  const h = href.replace(/&amp;/g, "&");
  const m = h.match(/[?&]uddg=([^&]+)/);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return "";
    }
  }
  if (h.startsWith("//")) return `https:${h}`;
  return h.startsWith("http") ? h : "";
}

// 解析 html.duckduckgo.com/html/ 结果页：result__a（标题 + 包装链接）+ result__snippet（摘要）。
export function parseDuckDuckGo(html: string): ParsedSearch {
  const linkRe = /<a\b[^>]*class="[^"]*\bresult__a\b[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRe = /<a\b[^>]*class="[^"]*\bresult__snippet\b[^"]*"[^>]*>([\s\S]*?)<\/a>/g;

  const links: Array<{ title: string; url: string }> = [];
  for (let m = linkRe.exec(html); m; m = linkRe.exec(html)) {
    const url = decodeDdgHref(m[1]);
    const title = stripTags(m[2]);
    if (url && title) links.push({ title, url });
  }

  const snippets: string[] = [];
  for (let m = snippetRe.exec(html); m; m = snippetRe.exec(html)) {
    snippets.push(stripTags(m[1]));
  }

  const results: SearchResult[] = links.map((l, i) => ({
    snippet: snippets[i] ?? "",
    title: l.title,
    url: l.url,
  }));
  return { results };
}

// 解析 cn.bing.com/search 结果页：每个 <li class="b_algo"> 块里 <h2><a href>标题</a> + <p class="b_lineclamp">摘要。
export function parseBing(html: string): ParsedSearch {
  const results: SearchResult[] = [];
  const blocks = html.split(/<li class="b_algo"/).slice(1);
  for (const raw of blocks) {
    const end = raw.indexOf("</li>");
    const block = end >= 0 ? raw.slice(0, end) : raw;
    const h2 = block.match(/<h2\b[^>]*>[\s\S]*?<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!h2) continue;
    const url = h2[1].replace(/&amp;/g, "&");
    const title = stripTags(h2[2]);
    if (!title || !/^https?:\/\//.test(url) || /^https?:\/\/(www\.|cn\.)?bing\.com/.test(url)) continue;
    const snip =
      block.match(/<p\b[^>]*class="[^"]*b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/) ||
      block.match(/<div class="b_caption"[^>]*>[\s\S]*?<p\b[^>]*>([\s\S]*?)<\/p>/);
    results.push({ snippet: snip ? stripTags(snip[1]) : "", title, url });
  }
  return { results };
}

// 解析 www.sogou.com/web 结果页：<div class="vrwrap"> 块内 <h3 class="vr-title"><a>标题；
// 真实 URL 优先取块里的 data-url（否则补全 /link 跳转），摘要取 fz-mid/space-txt 区。
export function parseSogou(html: string): ParsedSearch {
  const results: SearchResult[] = [];
  const blocks = html.split(/<div class="vrwrap"/).slice(1);
  for (const raw of blocks) {
    const a = raw.match(/<h3[^>]*class="[^"]*vr-title[^"]*"[^>]*>[\s\S]*?<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    const title = stripTags(a[2]);
    if (!title) continue;
    const dataUrl = raw.match(/data-url="(https?:\/\/[^"]+)"/);
    let url = (dataUrl ? dataUrl[1] : a[1]).replace(/&amp;/g, "&");
    if (url.startsWith("/")) url = `https://www.sogou.com${url}`;
    if (!/^https?:\/\//.test(url)) continue;
    const snip =
      raw.match(/<div[^>]*class="[^"]*(?:fz-mid|space-txt|text-layout|fz-info|fz-cont)[^"]*"[^>]*>([\s\S]*?)<\/div>/) ||
      raw.match(/<p[^>]*class="[^"]*(?:star-wiki|fz-info)[^"]*"[^>]*>([\s\S]*?)<\/p>/);
    results.push({ snippet: snip ? stripTags(snip[1]) : "", title, url });
  }
  return { results };
}

export function formatResults(query: string, parsed: ParsedSearch): string {
  const lines: string[] = [];
  if (parsed.answer) lines.push(parsed.answer, "");
  lines.push(`搜索「${query}」结果：`);
  for (const r of parsed.results) {
    lines.push(`- ${r.title || r.url}`, `  ${r.url}`);
    if (r.snippet) lines.push(`  ${r.snippet}`);
  }
  if (parsed.results.length === 0) lines.push("（无结果）");
  return lines.join("\n");
}

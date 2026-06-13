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
  | { ok: false; reason: string };

export function resolveProvider(env: Record<string, string | undefined>): ProviderChoice {
  const provider = (env.WEB_SEARCH_PROVIDER ?? "tavily").toLowerCase() === "brave" ? "brave" : "tavily";
  const apiKey = provider === "brave" ? env.BRAVE_API_KEY : env.TAVILY_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: `缺少 ${provider === "brave" ? "BRAVE_API_KEY" : "TAVILY_API_KEY"}` };
  }
  return { ok: true, provider, apiKey };
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

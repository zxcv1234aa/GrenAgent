import type { SearchResult } from "../provider.js";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

// 移植自 open-webSearch src/engines/exa/exa.ts（exa.ai 公开 search-fast API）。
export function parseExa(json: unknown): SearchResult[] {
  return asArray(asRecord(json).results)
    .map((row) => {
      const item = asRecord(row);
      const url = asStr(item.url);
      const title = asStr(item.title) || url;
      if (!url) return null;
      const author = asStr(item.author);
      const published = asStr(item.publishedDate);
      const snippet = [author ? `Author: ${author}` : "", published ? `Published: ${published}` : ""]
        .filter(Boolean)
        .join(". ");
      return { title, url, snippet };
    })
    .filter((r): r is SearchResult => r !== null);
}

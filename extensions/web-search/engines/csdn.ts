import type { SearchResult } from "../provider.js";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

// 移植自 open-webSearch src/engines/csdn/csdn.ts（so.csdn.net JSON API，无硬编码 Cookie）。
export function parseCsdn(json: unknown): SearchResult[] {
  const rows = asRecord(json).result_vos;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const r = asRecord(row);
      const url = asStr(r.url_location);
      const title = asStr(r.title);
      if (!url || !title) return null;
      return { title, url, snippet: asStr(r.digest) };
    })
    .filter((r): r is SearchResult => r !== null);
}

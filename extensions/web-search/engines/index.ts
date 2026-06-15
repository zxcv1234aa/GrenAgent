import type { ParsedSearch } from "../provider.js";

export type BuiltinEngine = "bing" | "sogou" | "duckduckgo" | "baidu" | "csdn" | "juejin" | "exa" | "linuxdo" | "zhihu";

export const SUPPORTED_SEARCH_ENGINES: BuiltinEngine[] = [
  "bing",
  "sogou",
  "duckduckgo",
  "baidu",
  "csdn",
  "juejin",
  "exa",
  "linuxdo",
  "zhihu",
];

const ENGINE_SET = new Set<string>(SUPPORTED_SEARCH_ENGINES);

export function normalizeEngineName(engine: string): BuiltinEngine | null {
  const cleaned = engine.trim().toLowerCase().replace(/[\s._-]+/g, "");
  if (cleaned === "ddg" || cleaned === "duckduckgo") return "duckduckgo";
  if (cleaned === "sougou" || cleaned === "搜狗") return "sogou";
  if (cleaned === "zhihu" || cleaned === "知乎") return "zhihu";
  if (isBuiltinEngine(cleaned)) return cleaned;
  return null;
}

export function isBuiltinEngine(name: string): name is BuiltinEngine {
  return ENGINE_SET.has(name);
}

export function parseEngineChain(raw: string | undefined): BuiltinEngine[] {
  if (!raw?.trim()) return [];
  const out: BuiltinEngine[] = [];
  for (const part of raw.split(",")) {
    const name = normalizeEngineName(part);
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

export async function runEngineChain(
  engines: BuiltinEngine[],
  query: string,
  maxResults: number,
  signal: AbortSignal | undefined,
  runBuiltin: (engine: BuiltinEngine) => Promise<ParsedSearch>,
): Promise<{ parsed: ParsedSearch; engine: BuiltinEngine | "none" }> {
  for (const engine of engines) {
    try {
      const parsed = await runBuiltin(engine);
      if (parsed.results.length > 0) return { parsed, engine };
    } catch {
      // try next engine in chain
    }
  }
  return { parsed: { results: [] }, engine: "none" };
}

export { parseBaidu } from "./baidu.js";
export { parseCsdn } from "./csdn.js";
export { parseJuejin } from "./juejin.js";
export { parseExa } from "./exa.js";
export { filterResultsByHost, siteQuery } from "./site.js";

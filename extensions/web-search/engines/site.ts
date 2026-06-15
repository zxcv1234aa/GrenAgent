import type { SearchResult } from "../provider.js";

// open-webSearch 的 linuxdo / zhihu 等「站点内搜索」：经通用引擎搜 site: 再按 hostname 过滤。
export function filterResultsByHost(results: SearchResult[], host: string | ((hostname: string) => boolean)): SearchResult[] {
  return results.filter((r) => {
    try {
      const hostname = new URL(r.url).hostname;
      return typeof host === "function" ? host(hostname) : hostname === host || hostname.endsWith(`.${host}`);
    } catch {
      return false;
    }
  });
}

export function siteQuery(site: string, query: string): string {
  return `site:${site} ${query}`.trim();
}

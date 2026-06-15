import type { SearchResult } from "./provider.js";

export type SearchEngineExecutor = (
  query: string,
  limit: number,
  signal: AbortSignal | undefined,
) => Promise<SearchResult[]>;

export type SearchExecutionFailure = {
  engine: string;
  message: string;
};

export type MultiSearchResult = {
  query: string;
  engines: string[];
  results: SearchResult[];
  partialFailures: SearchExecutionFailure[];
};

export function distributeLimit(totalLimit: number, engineCount: number): number[] {
  const base = Math.floor(totalLimit / engineCount);
  const remainder = totalLimit % engineCount;
  return Array.from({ length: engineCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

export async function executeMultiEngineSearch(
  query: string,
  engines: string[],
  limit: number,
  signal: AbortSignal | undefined,
  executors: Record<string, SearchEngineExecutor | undefined>,
): Promise<MultiSearchResult> {
  const cleanQuery = query.trim();
  if (!cleanQuery) throw new Error("Query string cannot be empty");

  const limits = distributeLimit(limit, engines.length);
  const partialFailures: SearchExecutionFailure[] = [];

  const tasks = engines.map(async (engine, index) => {
    const run = executors[engine];
    if (!run) {
      partialFailures.push({ engine, message: `Unsupported search engine: ${engine}` });
      return [] as SearchResult[];
    }
    try {
      return await run(cleanQuery, limits[index], signal);
    } catch (e) {
      partialFailures.push({ engine, message: e instanceof Error ? e.message : String(e) });
      return [];
    }
  });

  const results = (await Promise.all(tasks)).flat().slice(0, limit);
  return { query: cleanQuery, engines, results, partialFailures };
}

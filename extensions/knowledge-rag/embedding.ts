// Embedding backend for the knowledge-rag extension.
// Uses any OpenAI-compatible /embeddings endpoint. When no API key is
// configured the store transparently falls back to keyword search, so the
// extension always works out of the box.

export interface EmbeddingConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function resolveEmbeddingConfig(): EmbeddingConfig {
  const apiKey = process.env.KB_EMBED_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
  const baseUrl = (process.env.KB_EMBED_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  return {
    enabled: apiKey.length > 0,
    baseUrl,
    apiKey,
    model: process.env.KB_EMBED_MODEL ?? "text-embedding-3-small",
  };
}

export async function embedTexts(
  texts: string[],
  config: EmbeddingConfig,
  signal?: AbortSignal,
): Promise<number[][]> {
  if (!config.enabled) throw new Error("embedding disabled: no KB_EMBED_API_KEY / OPENAI_API_KEY");
  if (texts.length === 0) return [];

  const res = await fetch(`${config.baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ model: config.model, input: texts }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`embedding API ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  }

  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data.map((d) => d.embedding);
}

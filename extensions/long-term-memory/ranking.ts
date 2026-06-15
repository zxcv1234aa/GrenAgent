// Pure vector math + scoring for long-term-memory recall. No DB / no I/O so it
// is fully unit-testable. cosine = dot / (normA * normB); norms are precomputed
// and cached per memory to avoid recomputing on every recall.

export function dot(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < len; i++) s += a[i] * b[i];
  return s;
}

export function vecNorm(v: Float32Array): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s);
}

export const W_SIM = 0.7;
export const W_RECENCY = 0.2;
export const W_USAGE = 0.1;
export const TAU_MS = 30 * 24 * 3600 * 1000; // 时效半衰尺度：30 天
export const USE_CAP = 20; // 命中计数归一化上限

export interface ScoreInput {
  sim: number;
  createdAt: number;
  lastUsedAt: number | null;
  useCount: number;
  now: number;
}

// 综合排序分：相似度 + 时效衰减 + 使用度。时效以 lastUsedAt 为准，
// 从未命中则退回 createdAt；usage 用对数归一化避免热点记忆压制一切。
export function scoreMemory(i: ScoreInput): number {
  const ref = i.lastUsedAt ?? i.createdAt;
  const recency = Math.exp(-Math.max(0, i.now - ref) / TAU_MS);
  const usage = Math.log(1 + Math.max(0, i.useCount)) / Math.log(1 + USE_CAP);
  return W_SIM * i.sim + W_RECENCY * recency + W_USAGE * usage;
}

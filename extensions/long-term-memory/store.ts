// Memory store backed by node:sqlite. Each memory is a short, atomic fact
// (preference / decision / convention / fact) — unlike knowledge-rag, memories
// are NOT chunked. Dedup is by text hash so saving the same fact is idempotent.

import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "../_shared/sqlite.js";
import { type EmbeddingConfig, embedTexts } from "./embedding.js";

export interface Memory {
  id: string;
  text: string;
  category: string | null;
  createdAt: number;
  embedding?: number[];
}

export interface MemoryHit {
  memory: Memory;
  score: number;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

function keywordScore(query: string, text: string): number {
  // Match ASCII words and CJK runs so keyword search works for Chinese too
  // (plain \W+ split drops CJK characters entirely).
  const terms = (query.toLowerCase().match(/[\w\u4e00-\u9fff]+/g) ?? []).filter((t) => t.length > 1);
  if (!terms.length) return 0;
  const hay = text.toLowerCase();
  let hits = 0;
  for (const term of terms) {
    let idx = hay.indexOf(term);
    while (idx !== -1) {
      hits++;
      idx = hay.indexOf(term, idx + term.length);
    }
  }
  return hits / Math.sqrt(text.length + 1);
}

function encodeEmbedding(emb: number[] | undefined): Uint8Array | null {
  if (!emb || !emb.length) return null;
  return new Uint8Array(new Float32Array(emb).buffer);
}

function decodeEmbedding(blob: Uint8Array | null | undefined): number[] | undefined {
  if (!blob || blob.byteLength < 4) return undefined;
  const aligned = blob.slice();
  return Array.from(new Float32Array(aligned.buffer, 0, Math.floor(aligned.byteLength / 4)));
}

interface MemoryRow {
  id: string;
  text: string;
  category: string | null;
  createdAt: number;
  embedding: Uint8Array | null;
}

export class MemoryStore {
  private db: DatabaseSync | undefined;

  constructor(private readonly file: string) {}

  load(): void {
    if (this.db) return;
    mkdirSync(dirname(this.file), { recursive: true });
    this.db = new DatabaseSync(this.file);
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS memories (
         id TEXT PRIMARY KEY,
         text TEXT NOT NULL,
         category TEXT,
         createdAt INTEGER NOT NULL,
         embedding BLOB
       );
       CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(createdAt);`,
    );
  }

  close(): void {
    this.db?.close();
    this.db = undefined;
  }

  private get database(): DatabaseSync {
    if (!this.db) this.load();
    return this.db as DatabaseSync;
  }

  stats(): { count: number; categories: number } {
    const c = this.database.prepare("SELECT COUNT(*) AS n FROM memories").get() as { n: number };
    const cat = this.database.prepare("SELECT COUNT(DISTINCT category) AS n FROM memories WHERE category IS NOT NULL").get() as {
      n: number;
    };
    return { count: c.n, categories: cat.n };
  }

  clear(): void {
    this.database.exec("DELETE FROM memories;");
  }

  forget(id: string): boolean {
    const info = this.database.prepare("DELETE FROM memories WHERE id = ?").run(id);
    return Number(info.changes) > 0;
  }

  list(limit = 50): Memory[] {
    const rows = this.database
      .prepare("SELECT id, text, category, createdAt, embedding FROM memories ORDER BY createdAt DESC LIMIT ?")
      .all(limit) as unknown as MemoryRow[];
    return rows.map((r) => ({
      id: r.id,
      text: r.text,
      category: r.category,
      createdAt: r.createdAt,
      embedding: decodeEmbedding(r.embedding),
    }));
  }

  // Idempotent: same text -> same id -> replaces (keeps newest category/embedding).
  async save(
    text: string,
    category: string | null,
    config: EmbeddingConfig,
    signal?: AbortSignal,
  ): Promise<{ id: string }> {
    const clean = text.trim();
    const id = createHash("sha1").update(clean.toLowerCase()).digest("hex").slice(0, 12);

    let embedding: number[] | undefined;
    if (config.enabled) {
      [embedding] = await embedTexts([clean], config, signal);
    }

    this.database
      .prepare("INSERT OR REPLACE INTO memories(id, text, category, createdAt, embedding) VALUES(?, ?, ?, ?, ?)")
      .run(id, clean, category, Date.now(), encodeEmbedding(embedding));

    return { id };
  }

  async recall(
    query: string,
    topK: number,
    config: EmbeddingConfig,
    signal?: AbortSignal,
  ): Promise<MemoryHit[]> {
    const rows = this.database
      .prepare("SELECT id, text, category, createdAt, embedding FROM memories")
      .all() as unknown as MemoryRow[];
    if (!rows.length) return [];

    const memories: Memory[] = rows.map((r) => ({
      id: r.id,
      text: r.text,
      category: r.category,
      createdAt: r.createdAt,
      embedding: decodeEmbedding(r.embedding),
    }));

    const canUseVectors = config.enabled && memories.some((m) => m.embedding);
    let scored: MemoryHit[];

    if (canUseVectors) {
      const [q] = await embedTexts([query], config, signal);
      scored = memories.map((memory) => ({
        memory,
        score: memory.embedding ? cosine(q, memory.embedding) : 0,
      }));
    } else {
      scored = memories.map((memory) => ({
        memory,
        score: keywordScore(query, memory.text),
      }));
    }

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, topK));
  }
}

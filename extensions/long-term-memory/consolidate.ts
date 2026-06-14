// mem0-style consolidation: given a new fact, recall similar existing memories
// and let the LLM decide ADD / UPDATE / DELETE / NOOP. LLM is injected (AskFn)
// so this is fully unit-testable without a real model.

import type { EmbeddingConfig } from "./embedding.js";
import { parseJsonLoose } from "./llm.js";
import type { Memory, MemoryStore } from "./store.js";

export type AskFn = (systemPrompt: string, userPrompt: string) => Promise<string>;

export type AppliedOp =
  | { op: "ADD"; text: string }
  | { op: "UPDATE"; targetId: string; text: string }
  | { op: "DELETE"; targetId: string }
  | { op: "NOOP" };

interface Decision {
  op: "ADD" | "UPDATE" | "DELETE" | "NOOP";
  targetId?: string;
  text?: string;
  category?: string | null;
  reason?: string;
}

const RECONCILE_TOPK = 5;

const EXTRACT_SYSTEM =
  "You extract durable, atomic facts worth remembering long-term (user preferences, " +
  "decisions, project conventions). Output one fact per line, plain text, no numbering, " +
  "no commentary. If nothing is worth saving, output nothing.";

const RECONCILE_SYSTEM =
  "You maintain a user's long-term memory. Given EXISTING memories and a NEW fact, decide a single " +
  "operation as STRICT JSON (no prose). Schema: " +
  '{"op":"ADD"|"UPDATE"|"DELETE"|"NOOP","targetId":string?,"text":string?,"category":string?,"reason":string?}. ' +
  "Rules: ADD if the new fact is genuinely new; UPDATE (with targetId + merged text) if it refines/contradicts " +
  "an existing memory; DELETE (with targetId) if the new fact makes an existing memory obsolete; NOOP if it is a duplicate.";

export async function extractFacts(ask: AskFn, conversation: string): Promise<string[]> {
  const out = await ask(EXTRACT_SYSTEM, `Conversation:\n${conversation}`);
  return out
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((l) => l.length > 3 && l.length < 300);
}

function candidatesBlock(cands: Memory[]): string {
  return cands.map((m) => `- id=${m.id}${m.category ? ` [${m.category}]` : ""}: ${m.text}`).join("\n");
}

export async function consolidate(
  store: MemoryStore,
  fact: string,
  deps: { ask: AskFn; config: EmbeddingConfig; model: string | null; signal?: AbortSignal },
): Promise<AppliedOp[]> {
  const clean = fact.trim();
  if (!clean) return [];

  const candidates = await store.recall(clean, RECONCILE_TOPK, deps.config, deps.signal).catch(() => []);
  // No similar memory → just ADD (saves an LLM round-trip).
  if (candidates.length === 0) {
    await store.insert(clean, null, deps.config, "consolidate:add", deps.model, deps.signal);
    return [{ op: "ADD", text: clean }];
  }

  const userPrompt = `EXISTING memories:\n${candidatesBlock(candidates.map((h) => h.memory))}\n\nNEW fact:\n${clean}`;
  let decision: Decision | undefined;
  try {
    decision = parseJsonLoose<Decision>(await deps.ask(RECONCILE_SYSTEM, userPrompt));
  } catch {
    decision = undefined;
  }

  // Invalid/missing decision → never lose the fact: ADD.
  if (!decision || !decision.op) {
    await store.insert(clean, null, deps.config, "consolidate:add(fallback)", deps.model, deps.signal);
    return [{ op: "ADD", text: clean }];
  }

  const known = new Set(candidates.map((h) => h.memory.id));
  switch (decision.op) {
    case "UPDATE": {
      if (decision.targetId && known.has(decision.targetId)) {
        const text = (decision.text ?? clean).trim();
        await store.update(
          decision.targetId,
          { text, category: decision.category },
          deps.config,
          decision.reason ?? "consolidate:update",
          deps.model,
          deps.signal,
        );
        return [{ op: "UPDATE", targetId: decision.targetId, text }];
      }
      await store.insert(clean, decision.category ?? null, deps.config, "consolidate:add(bad-target)", deps.model, deps.signal);
      return [{ op: "ADD", text: clean }];
    }
    case "DELETE": {
      if (decision.targetId && known.has(decision.targetId)) {
        store.remove(decision.targetId, decision.reason ?? "consolidate:delete", deps.model);
        return [{ op: "DELETE", targetId: decision.targetId }];
      }
      return [{ op: "NOOP" }];
    }
    case "NOOP":
      return [{ op: "NOOP" }];
    default: {
      const text = (decision.text ?? clean).trim();
      await store.insert(text, decision.category ?? null, deps.config, decision.reason ?? "consolidate:add", deps.model, deps.signal);
      return [{ op: "ADD", text }];
    }
  }
}

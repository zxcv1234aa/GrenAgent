import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryStore } from "./store.js";
import { type AskFn, consolidate, extractFacts } from "./consolidate.js";

const OFF = { enabled: false, baseUrl: "", apiKey: "", model: "" };
const dirs: string[] = [];
const opened: MemoryStore[] = [];
function newStore(): MemoryStore {
  const dir = mkdtempSync(join(tmpdir(), "memcons-"));
  dirs.push(dir);
  const s = new MemoryStore(join(dir, "memory.db"));
  opened.push(s);
  s.load();
  return s;
}
afterEach(() => {
  for (const s of opened.splice(0)) {
    try {
      s.close();
    } catch {
      /* already closed */
    }
  }
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("consolidate", () => {
  it("ADDs when there is no similar memory (skips LLM)", async () => {
    const s = newStore();
    let called = 0;
    const ask: AskFn = async () => {
      called++;
      return "{}";
    };
    const ops = await consolidate(s, "uses pnpm", { ask, config: OFF, model: null });
    expect(ops).toEqual([{ op: "ADD", text: "uses pnpm" }]);
    expect(called).toBe(0); // no candidates → no LLM call
    expect(s.list(10).map((m) => m.text)).toContain("uses pnpm");
  });

  it("UPDATEs a contradictory existing memory", async () => {
    const s = newStore();
    const { id } = await s.insert("uses npm", "preference", OFF, "seed");
    const ask: AskFn = async () =>
      JSON.stringify({ op: "UPDATE", targetId: id, text: "uses pnpm", category: "preference", reason: "switched pkg mgr" });
    const ops = await consolidate(s, "actually I use pnpm now", { ask, config: OFF, model: null });
    expect(ops[0].op).toBe("UPDATE");
    expect(s.getById(id)?.text).toBe("uses pnpm");
  });

  it("DELETEs an obsolete memory", async () => {
    const s = newStore();
    const { id } = await s.insert("project deadline is May", null, OFF, "seed");
    const ask: AskFn = async () => JSON.stringify({ op: "DELETE", targetId: id, reason: "no longer true" });
    await consolidate(s, "the deadline was cancelled", { ask, config: OFF, model: null });
    expect(s.getById(id)).toBeUndefined();
  });

  it("NOOP when duplicate", async () => {
    const s = newStore();
    await s.insert("likes dark mode", null, OFF, "seed");
    const ask: AskFn = async () => JSON.stringify({ op: "NOOP", reason: "duplicate" });
    const ops = await consolidate(s, "prefers dark mode", { ask, config: OFF, model: null });
    expect(ops[0].op).toBe("NOOP");
    expect(s.list(10)).toHaveLength(1);
  });

  it("falls back to ADD when LLM returns invalid JSON", async () => {
    const s = newStore();
    await s.insert("seed fact one", null, OFF, "seed");
    const ask: AskFn = async () => "the model rambled with no json";
    const ops = await consolidate(s, "a brand new fact", { ask, config: OFF, model: null });
    expect(ops[0].op).toBe("ADD");
    expect(s.list(10).map((m) => m.text)).toContain("a brand new fact");
  });

  it("extractFacts parses one-per-line output", async () => {
    const ask: AskFn = async () => "- uses pnpm\n- prefers TypeScript\n\n";
    expect(await extractFacts(ask, "conversation text")).toEqual(["uses pnpm", "prefers TypeScript"]);
  });
});

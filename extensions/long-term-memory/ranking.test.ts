import { describe, expect, it } from "vitest";
import { dot, scoreMemory, vecNorm } from "./ranking.js";

describe("vecNorm", () => {
  it("computes L2 norm", () => {
    expect(vecNorm(Float32Array.from([3, 4]))).toBeCloseTo(5);
  });
  it("zero vector → 0", () => {
    expect(vecNorm(Float32Array.from([0, 0]))).toBe(0);
  });
});

describe("dot", () => {
  it("computes dot product over min length", () => {
    expect(dot(Float32Array.from([1, 2, 3]), Float32Array.from([4, 5, 6]))).toBeCloseTo(32);
  });
  it("tolerates length mismatch (uses min length)", () => {
    expect(dot(Float32Array.from([1, 2]), Float32Array.from([3, 4, 5]))).toBeCloseTo(11);
  });
});

describe("scoreMemory", () => {
  const now = 1_000_000_000_000;
  it("higher similarity → higher score", () => {
    const a = scoreMemory({ sim: 0.9, createdAt: now, lastUsedAt: null, useCount: 0, now });
    const b = scoreMemory({ sim: 0.1, createdAt: now, lastUsedAt: null, useCount: 0, now });
    expect(a).toBeGreaterThan(b);
  });
  it("recent lastUsedAt outranks stale at equal similarity", () => {
    const recent = scoreMemory({ sim: 0.5, createdAt: now, lastUsedAt: now, useCount: 0, now });
    const stale = scoreMemory({ sim: 0.5, createdAt: now, lastUsedAt: now - 60 * 24 * 3600 * 1000, useCount: 0, now });
    expect(recent).toBeGreaterThan(stale);
  });
  it("higher useCount outranks at equal similarity/recency", () => {
    const used = scoreMemory({ sim: 0.5, createdAt: now, lastUsedAt: now, useCount: 10, now });
    const fresh = scoreMemory({ sim: 0.5, createdAt: now, lastUsedAt: now, useCount: 0, now });
    expect(used).toBeGreaterThan(fresh);
  });
});

// Cross-runtime SQLite shim.
//
// The official Pi runtime is Node (>=22.5) where `node:sqlite` (DatabaseSync) is
// built in. GrenAgent compiles this extension pack into a *bun*-compiled sidecar,
// and bun does NOT implement `node:sqlite` (it ships `bun:sqlite` with a nearly
// identical API). A static `import ... from "node:sqlite"` makes `bun build
// --compile` fail with `Could not resolve "node:sqlite"`, and even a literal
// `require("node:sqlite")` is statically analyzed.
//
// So we pick the driver at runtime via a *variable* require (not statically
// analyzable), and expose a single `DatabaseSync` class with the small surface
// the stores use: exec / prepare().{get,all,run} / close.

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";
// Variable module id → bun --compile won't try to bundle/resolve "node:sqlite".
const moduleName = isBun ? "bun:sqlite" : "node:sqlite";
const driver = require(moduleName) as Record<string, unknown>;

interface RawStatement {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
}
interface RawDatabase {
  exec(sql: string): void;
  prepare(sql: string): RawStatement;
  close(): void;
}
type DatabaseCtor = new (file: string) => RawDatabase;

// node:sqlite exports `DatabaseSync`; bun:sqlite exports `Database`. Both accept a
// file path and expose exec/prepare/close with matching statement semantics.
const NativeDatabase: DatabaseCtor = isBun
  ? (driver.Database as DatabaseCtor)
  : (driver.DatabaseSync as DatabaseCtor);

export class DatabaseSync {
  private readonly db: RawDatabase;

  constructor(file: string) {
    this.db = new NativeDatabase(file);
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  prepare(sql: string): RawStatement {
    return this.db.prepare(sql);
  }

  close(): void {
    this.db.close();
  }
}

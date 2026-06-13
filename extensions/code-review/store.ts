// Review note store backed by node:sqlite. Records structured findings and
// renders a markdown report grouped by severity.

import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "../_shared/sqlite.js";

export interface ReviewNote {
  id: string;
  file: string;
  line: number | null;
  severity: string;
  message: string;
  createdAt: number;
}

const SEVERITY_ORDER = ["blocker", "major", "minor", "nit", "praise"];

export class ReviewStore {
  private db: DatabaseSync | undefined;

  constructor(private readonly file: string) {}

  load(): void {
    if (this.db) return;
    mkdirSync(dirname(this.file), { recursive: true });
    this.db = new DatabaseSync(this.file);
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS review_notes (
         id TEXT PRIMARY KEY,
         file TEXT NOT NULL,
         line INTEGER,
         severity TEXT NOT NULL,
         message TEXT NOT NULL,
         createdAt INTEGER NOT NULL
       );`,
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

  addNote(file: string, line: number | null, severity: string, message: string): string {
    const id = randomUUID().slice(0, 8);
    this.database
      .prepare("INSERT INTO review_notes(id, file, line, severity, message, createdAt) VALUES(?, ?, ?, ?, ?, ?)")
      .run(id, file, line, severity, message, Date.now());
    return id;
  }

  list(): ReviewNote[] {
    return this.database
      .prepare("SELECT id, file, line, severity, message, createdAt FROM review_notes ORDER BY createdAt")
      .all() as unknown as ReviewNote[];
  }

  clear(): void {
    this.database.exec("DELETE FROM review_notes;");
  }

  report(): string {
    const notes = this.list();
    if (!notes.length) return "No review notes recorded.";

    const bySeverity = new Map<string, ReviewNote[]>();
    for (const n of notes) {
      const arr = bySeverity.get(n.severity) ?? [];
      arr.push(n);
      bySeverity.set(n.severity, arr);
    }

    const extras = [...bySeverity.keys()].filter((s) => !SEVERITY_ORDER.includes(s));
    const order = [...SEVERITY_ORDER, ...extras];

    let out = `# Code Review (${notes.length} note${notes.length > 1 ? "s" : ""})\n`;
    for (const sev of order) {
      const arr = bySeverity.get(sev);
      if (!arr || !arr.length) continue;
      out += `\n## ${sev} (${arr.length})\n`;
      for (const n of arr) {
        out += `- \`${n.file}${n.line ? `:${n.line}` : ""}\` — ${n.message}\n`;
      }
    }
    return out;
  }
}

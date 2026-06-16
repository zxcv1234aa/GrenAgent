import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type CheckCommand = string[];

const ESLINT_CONFIGS = [
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.json",
  ".eslintrc.yml",
  ".eslintrc.yaml",
];

function readSettingsCommands(cwd: string): CheckCommand[] {
  try {
    const raw = readFileSync(join(cwd, ".pi", "settings.json"), "utf8");
    const parsed = JSON.parse(raw) as { diagnostics?: { commands?: unknown } };
    const cmds = parsed.diagnostics?.commands;
    if (Array.isArray(cmds)) {
      return cmds.filter((c): c is string[] => Array.isArray(c) && c.every((x) => typeof x === "string"));
    }
  } catch {
    // missing/invalid settings → fall through to auto-detect
  }
  return [];
}

/** Resolve check commands: .pi/settings.json `diagnostics.commands` first, else auto-detect. */
export function resolveCommands(cwd: string): CheckCommand[] {
  const fromSettings = readSettingsCommands(cwd);
  if (fromSettings.length) return fromSettings;

  const cmds: CheckCommand[] = [];
  if (existsSync(join(cwd, "tsconfig.json"))) cmds.push(["npx", "tsc", "--noEmit", "--pretty", "false"]);
  if (ESLINT_CONFIGS.some((f) => existsSync(join(cwd, f)))) cmds.push(["npx", "eslint", ".", "-f", "json"]);
  return cmds;
}

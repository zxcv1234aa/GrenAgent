export interface Diagnostic {
  file: string;
  line: number;
  col?: number;
  severity: "error" | "warning" | "info";
  message: string;
  source: string;
}

const TSC_RE = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.*)$/;

/** Parse `tsc --pretty false` output into structured diagnostics. */
export function parseTsc(output: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const raw of output.split(/\r?\n/)) {
    const m = TSC_RE.exec(raw.trim());
    if (!m) continue;
    out.push({
      file: m[1],
      line: Number(m[2]),
      col: Number(m[3]),
      severity: m[4] === "warning" ? "warning" : "error",
      message: `${m[5]}: ${m[6]}`,
      source: "tsc",
    });
  }
  return out;
}

interface EslintFile {
  filePath?: string;
  messages?: Array<{ line?: number; column?: number; severity?: number; message?: string; ruleId?: string | null }>;
}

/** Parse `eslint -f json` output into structured diagnostics. */
export function parseEslintJson(output: string): Diagnostic[] {
  let data: unknown;
  try {
    data = JSON.parse(output);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: Diagnostic[] = [];
  for (const file of data as EslintFile[]) {
    for (const msg of file.messages ?? []) {
      out.push({
        file: file.filePath ?? "",
        line: msg.line ?? 0,
        col: msg.column,
        severity: msg.severity === 2 ? "error" : msg.severity === 1 ? "warning" : "info",
        message: msg.ruleId ? `${msg.message ?? ""} (${msg.ruleId})` : msg.message ?? "",
        source: "eslint",
      });
    }
  }
  return out;
}

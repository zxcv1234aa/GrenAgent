// Git diff via node:child_process (no deps). Used by the review tools.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface DiffOptions {
  base?: string;
  staged?: boolean;
  path?: string;
}

export async function gitDiff(cwd: string, opts: DiffOptions = {}): Promise<string> {
  const args = ["diff", "--no-color"];
  if (opts.staged) args.push("--staged");
  if (opts.base) args.push(opts.base);
  if (opts.path) args.push("--", opts.path);
  const { stdout } = await execFileAsync("git", args, { cwd, maxBuffer: 16 * 1024 * 1024 });
  return stdout;
}

import { describe, expect, it } from "vitest";
import { gitWorktreeAddArgs, gitWorktreeRemoveArgs } from "./worktree.js";

describe("worktree argv", () => {
  it("add uses --detach into target dir with windows-safe flags", () => {
    const a = gitWorktreeAddArgs("/repo", "/tmp/wt");
    expect(a).toContain("worktree");
    expect(a).toContain("add");
    expect(a).toContain("--detach");
    expect(a).toContain("-C");
    expect(a).toContain("/repo");
    expect(a).toContain("core.autocrlf=false");
    expect(a[a.length - 1]).toBe("/tmp/wt");
  });
  it("remove forces removal of the dir", () => {
    const r = gitWorktreeRemoveArgs("/repo", "/tmp/wt");
    expect(r).toContain("remove");
    expect(r).toContain("--force");
    expect(r[r.length - 1]).toBe("/tmp/wt");
  });
});

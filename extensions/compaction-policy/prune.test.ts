import { describe, expect, it } from "vitest";
import { pruneMessages } from "./prune.js";

const tr = (toolName: string, text: string) => ({ role: "toolResult", toolName, content: [{ type: "text", text }] });
const user = (t: string) => ({ role: "user", content: t });
const asst = (t: string) => ({ role: "assistant", content: [{ type: "text", text: t }] });

describe("pruneMessages", () => {
  it("prunes nothing when turns <= keepRecentTurns", () => {
    const msgs = [user("a"), tr("read", "x".repeat(5000)), asst("b")];
    expect(pruneMessages(msgs, { keepRecentTurns: 6, minBodyChars: 1000 }).prunedCount).toBe(0);
  });
  it("prunes old toolResult bodies outside the protection window", () => {
    const msgs = [
      user("u1"), tr("read", "x".repeat(5000)), asst("a1"),
      user("u2"), tr("grep", "y".repeat(5000)), asst("a2"),
    ];
    const res = pruneMessages(msgs, { keepRecentTurns: 1, minBodyChars: 1000 });
    expect(res.prunedCount).toBe(1);
    expect((res.messages[1] as { content: { text: string }[] }).content[0].text).toMatch(/pruned tool output: read, 5000 chars/);
    // recent turn (u2 onward) kept verbatim
    expect((res.messages[4] as { content: { text: string }[] }).content[0].text).toBe("y".repeat(5000));
  });
  it("does not prune small bodies or non-toolResult messages", () => {
    const msgs = [user("u1"), tr("ls", "short"), asst("a1"), user("u2"), asst("a2")];
    const res = pruneMessages(msgs, { keepRecentTurns: 1, minBodyChars: 1000 });
    expect(res.prunedCount).toBe(0);
    expect(res.messages).toEqual(msgs);
  });
});

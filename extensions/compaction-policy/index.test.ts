import { describe, expect, it } from "vitest";
import factory from "./index.js";

describe("compaction-policy factory", () => {
  it("registers context/turn_end/agent_end hooks and /compaction command", () => {
    const commands: string[] = [];
    const events: string[] = [];
    factory({
      registerCommand: (n: string) => commands.push(n),
      on: (e: string) => events.push(e),
    } as never);
    expect(commands).toContain("compaction");
    expect(events).toEqual(expect.arrayContaining(["context", "turn_end", "agent_end"]));
  });
});

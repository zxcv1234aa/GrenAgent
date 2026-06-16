import { describe, expect, it } from "vitest";
import factory from "./index.js";

describe("diagnostics factory", () => {
  it("registers the diagnostics tool", () => {
    const tools: string[] = [];
    factory({
      registerTool: (t: { name: string }) => tools.push(t.name),
      registerCommand: () => {},
      on: () => {},
    } as never);
    expect(tools).toContain("diagnostics");
  });
});

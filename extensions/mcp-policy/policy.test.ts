import { describe, expect, it } from "vitest";
import { parsePolicy } from "./policy.js";

describe("parsePolicy", () => {
  it("returns defaults for empty / invalid json", () => {
    expect(parsePolicy("")).toEqual({
      version: 1,
      defaultPermission: "auto",
      tools: {},
      audit: { enabled: true },
    });
    expect(parsePolicy("not json")).toMatchObject({ defaultPermission: "auto", tools: {} });
  });

  it("parses tool permission and ordered rules", () => {
    const p = parsePolicy(
      JSON.stringify({
        tools: {
          mcp__fs__rm: {
            permission: "needs_approval",
            rules: [{ match: { path: "/etc/**" }, policy: "always" }, { policy: "never" }],
          },
        },
      }),
    );
    expect(p.tools.mcp__fs__rm.permission).toBe("needs_approval");
    expect(p.tools.mcp__fs__rm.rules).toEqual([
      { match: { path: "/etc/**" }, policy: "always" },
      { policy: "never" },
    ]);
  });

  it("drops invalid permission / policy values", () => {
    const p = parsePolicy(
      JSON.stringify({ defaultPermission: "weird", tools: { x: { permission: "nope", rules: [{ policy: "bad" }] } } }),
    );
    expect(p.defaultPermission).toBe("auto");
    expect(p.tools.x.permission).toBeUndefined();
    expect(p.tools.x.rules).toEqual([]);
  });

  it("audit defaults true; false only when explicitly disabled", () => {
    expect(parsePolicy("{}").audit.enabled).toBe(true);
    expect(parsePolicy(JSON.stringify({ audit: { enabled: false } })).audit.enabled).toBe(false);
  });
});

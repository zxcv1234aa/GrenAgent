import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./runtime-config.js", () => ({ getConfig: vi.fn() }));
vi.mock("./approval.js", () => ({ getApprovalPolicy: vi.fn() }));
vi.mock("./sandbox/index.js", () => ({ getSandbox: vi.fn() }));

import { getApprovalPolicy } from "./approval.js";
import { getConfig } from "./runtime-config.js";
import { sandboxAvailable, sandboxOn } from "./sandbox-gate.js";
import { getSandbox } from "./sandbox/index.js";

const avail = (v: boolean) => ({ isAvailable: async () => v });
beforeEach(() => vi.resetAllMocks());

describe("sandboxAvailable (policy-agnostic)", () => {
  it("false when SANDBOX_ENABLE=off (master kill)", async () => {
    vi.mocked(getConfig).mockReturnValue("off");
    vi.mocked(getSandbox).mockReturnValue(avail(true) as never);
    expect(await sandboxAvailable()).toBe(false);
  });
  it("true when not-off and available (ignores policy)", async () => {
    vi.mocked(getConfig).mockReturnValue(undefined);
    vi.mocked(getApprovalPolicy).mockReturnValue("full"); // ignored
    vi.mocked(getSandbox).mockReturnValue(avail(true) as never);
    expect(await sandboxAvailable()).toBe(true);
  });
  it("false when unavailable", async () => {
    vi.mocked(getConfig).mockReturnValue(undefined);
    vi.mocked(getSandbox).mockReturnValue(avail(false) as never);
    expect(await sandboxAvailable()).toBe(false);
  });
});

describe("sandboxOn (policy-aware)", () => {
  it("false when policy=full even if available", async () => {
    vi.mocked(getConfig).mockReturnValue(undefined);
    vi.mocked(getApprovalPolicy).mockReturnValue("full");
    vi.mocked(getSandbox).mockReturnValue(avail(true) as never);
    expect(await sandboxOn()).toBe(false);
  });
  it("true when not-off, policy!=full, and available", async () => {
    vi.mocked(getConfig).mockReturnValue(undefined);
    vi.mocked(getApprovalPolicy).mockReturnValue("auto");
    vi.mocked(getSandbox).mockReturnValue(avail(true) as never);
    expect(await sandboxOn()).toBe(true);
  });
  it("false when SANDBOX_ENABLE=off", async () => {
    vi.mocked(getConfig).mockReturnValue("off");
    vi.mocked(getApprovalPolicy).mockReturnValue("auto");
    vi.mocked(getSandbox).mockReturnValue(avail(true) as never);
    expect(await sandboxOn()).toBe(false);
  });
});

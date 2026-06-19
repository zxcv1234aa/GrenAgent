import { beforeEach, describe, expect, it } from "vitest";
import { APPROVAL_LABELS, getApprovalPolicy, parseApproval, setApprovalPolicy } from "./approval.js";

beforeEach(() => setApprovalPolicy("auto"));

describe("approval policy", () => {
  it("defaults to auto", () => {
    expect(getApprovalPolicy()).toBe("auto");
  });
  it("set/get round-trip", () => {
    setApprovalPolicy("ask");
    expect(getApprovalPolicy()).toBe("ask");
  });
  it("parse accepts known values (case-insensitive), rejects others", () => {
    expect(parseApproval("full")).toBe("full");
    expect(parseApproval("ASK")).toBe("ask");
    expect(parseApproval("  auto ")).toBe("auto");
    expect(parseApproval("xx")).toBeUndefined();
    expect(parseApproval(undefined)).toBeUndefined();
  });
  it("has zh labels for all 3", () => {
    expect(Object.keys(APPROVAL_LABELS).sort()).toEqual(["ask", "auto", "full"]);
  });
});

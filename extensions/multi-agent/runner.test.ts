import { afterEach, describe, expect, it } from "vitest";
import { buildSubagentRuntimeConfig, extractFinalText, resolvePiCommand, resolveSubagentModel } from "./runner.js";

const origPiBin = process.env.PI_BIN;
const origSubagentModel = process.env.SUBAGENT_MODEL;
const origRuntimeConfig = process.env.PI_RUNTIME_CONFIG;
afterEach(() => {
  if (origPiBin === undefined) delete process.env.PI_BIN;
  else process.env.PI_BIN = origPiBin;
  if (origSubagentModel === undefined) delete process.env.SUBAGENT_MODEL;
  else process.env.SUBAGENT_MODEL = origSubagentModel;
  if (origRuntimeConfig === undefined) delete process.env.PI_RUNTIME_CONFIG;
  else process.env.PI_RUNTIME_CONFIG = origRuntimeConfig;
});

describe("resolvePiCommand", () => {
  it("prefers PI_BIN when set", () => {
    process.env.PI_BIN = "/custom/pi";
    expect(resolvePiCommand().cmd).toBe("/custom/pi");
  });
  it("falls back to the current executable (sidecar self), not bare 'pi'", () => {
    delete process.env.PI_BIN;
    expect(resolvePiCommand().cmd).toBe(process.execPath);
  });
});

describe("resolveSubagentModel", () => {
  it("returns trimmed SUBAGENT_MODEL when set", () => {
    process.env.SUBAGENT_MODEL = "  deepseek/deepseek-chat  ";
    expect(resolveSubagentModel()).toBe("deepseek/deepseek-chat");
  });
  it("returns undefined when unset or blank", () => {
    delete process.env.SUBAGENT_MODEL;
    expect(resolveSubagentModel()).toBeUndefined();
    process.env.SUBAGENT_MODEL = "   ";
    expect(resolveSubagentModel()).toBeUndefined();
  });
});

describe("buildSubagentRuntimeConfig", () => {
  it("always denies spawn_agent so a sub-agent can't spawn its own sub-agents", () => {
    delete process.env.PI_RUNTIME_CONFIG;
    const rc = buildSubagentRuntimeConfig(false, {});
    expect(rc.env.SAFETY_DENY_TOOLS.split(",")).toContain("spawn_agent");
    rc.cleanup();
  });

  it("merges spawn_agent with a profile's existing deny list (no loss)", () => {
    delete process.env.PI_RUNTIME_CONFIG;
    const rc = buildSubagentRuntimeConfig(false, { SAFETY_DENY_TOOLS: "web_search,web_fetch" });
    const deny = rc.env.SAFETY_DENY_TOOLS.split(",");
    expect(deny).toContain("spawn_agent");
    expect(deny).toContain("web_search");
    expect(deny).toContain("web_fetch");
    rc.cleanup();
  });

  it("also denies explore_context so a sub-agent can't trigger nested exploration", () => {
    delete process.env.PI_RUNTIME_CONFIG;
    const rc = buildSubagentRuntimeConfig(false, {});
    expect(rc.env.SAFETY_DENY_TOOLS.split(",")).toContain("explore_context");
    rc.cleanup();
  });

  it("preserves profile-provided deny entries alongside the guards", () => {
    delete process.env.PI_RUNTIME_CONFIG;
    const rc = buildSubagentRuntimeConfig(false, { SAFETY_DENY_TOOLS: "bash" });
    const deny = rc.env.SAFETY_DENY_TOOLS.split(",");
    expect(deny).toContain("bash");
    expect(deny).toContain("explore_context");
    rc.cleanup();
  });
});

describe("extractFinalText", () => {
  it("returns the last assistant text from JSONL", () => {
    const jsonl = [
      JSON.stringify({ role: "assistant", content: "first" }),
      JSON.stringify({ message: { role: "assistant", content: [{ type: "text", text: "final answer" }] } }),
    ].join("\n");
    expect(extractFinalText(jsonl)).toBe("final answer");
  });
  it("falls back to a tail slice when no assistant message is present", () => {
    expect(extractFinalText("not json at all")).toBe("not json at all");
  });
});

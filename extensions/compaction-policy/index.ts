// compaction-policy: ephemeral context prune via the `context` hook + context
// pressure indicator. Pure extension; default prune OFF, pressure ON.
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getConfig } from "../_shared/runtime-config.js";
import { classify } from "./pressure.js";
import { pruneMessages } from "./prune.js";

const pruneEnabled = () => (getConfig("COMPACTION_POLICY_PRUNE") ?? "0") !== "0";
const keepTurns = () => Number(getConfig("COMPACTION_POLICY_KEEP_TURNS") ?? "6") || 6;
const minBody = () => Number(getConfig("COMPACTION_POLICY_MIN_BODY") ?? "1000") || 1000;
const pressureEnabled = () => (getConfig("COMPACTION_POLICY_PRESSURE") ?? "1") !== "0";

export default function (pi: ExtensionAPI) {
  pi.on("context", async (event) => {
    if (!pruneEnabled()) return undefined;
    const res = pruneMessages(event.messages, { keepRecentTurns: keepTurns(), minBodyChars: minBody() });
    if (res.prunedCount === 0) return undefined;
    return { messages: res.messages };
  });

  const updatePressure = (ctx: ExtensionContext) => {
    if (!pressureEnabled()) return;
    ctx.ui.setStatus("ctx", classify(ctx.getContextUsage()?.percent ?? null).label);
  };

  pi.on("turn_end", async (_event, ctx) => updatePressure(ctx));
  pi.on("agent_end", async (_event, ctx) => updatePressure(ctx));

  pi.registerCommand("compaction", {
    description: "查看上下文压力与 prune 状态",
    handler: async (_args, ctx) => {
      const usage = ctx.getContextUsage();
      const { level, label } = classify(usage?.percent ?? null);
      ctx.ui.notify(
        `上下文：${usage?.tokens ?? "?"}/${usage?.contextWindow ?? "?"} tokens（${label}，级别 ${level}）\n` +
          `prune: ${pruneEnabled() ? "开" : "关"}（保护窗口 ${keepTurns()} 轮，最小裁剪 ${minBody()} 字符）`,
        "info",
      );
    },
  });
}

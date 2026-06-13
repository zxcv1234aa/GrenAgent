// im-gateway: expose the agent over a simple HTTP webhook so IM platforms
// (Slack / Feishu / Telegram / ...) can talk to it via a thin adapter.
//
// Flow: POST /message { text, replyUrl? } -> pi.sendUserMessage(text);
// the next assistant message is POSTed back to replyUrl (if provided).
//
// Disabled by default (it opens a port). Enable with IM_GATEWAY=1.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type GatewayHandle, postReply, startGateway } from "./gateway.js";

const ENABLED = (process.env.IM_GATEWAY ?? "0") !== "0";
const PORT = Number(process.env.IM_GATEWAY_PORT ?? "8765") || 8765;
const TOKEN = process.env.IM_GATEWAY_TOKEN ?? "";

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((p): p is { type: string; text: string } => !!p && typeof p === "object" && (p as { type?: string }).type === "text")
      .map((p) => p.text)
      .join("");
  }
  return "";
}

export default function (pi: ExtensionAPI) {
  let handle: GatewayHandle | undefined;
  let pendingReplyUrl: string | undefined;

  pi.on("session_start", async (_event, ctx) => {
    if (!ENABLED || handle) return;
    try {
      handle = await startGateway({
        port: PORT,
        token: TOKEN || undefined,
        onMessage: ({ text, replyUrl }) => {
          pendingReplyUrl = replyUrl;
          try {
            pi.sendUserMessage(text);
          } catch {
            // Agent busy/streaming — queue as follow-up.
            try {
              pi.sendUserMessage(text, { deliverAs: "followUp" });
            } catch {
              /* drop */
            }
          }
        },
      });
      ctx.ui.notify(`IM gateway listening on :${handle.port}${TOKEN ? " (token required)" : ""}`, "info");
    } catch (e) {
      ctx.ui.notify(`IM gateway failed to start: ${(e as Error).message}`, "error");
    }
  });

  pi.on("message_end", async (event) => {
    if (!handle || !pendingReplyUrl) return;
    const msg = (event as { message?: { role?: string; content?: unknown } })?.message;
    if (msg?.role !== "assistant") return;
    const text = extractText(msg.content);
    if (!text) return;
    const url = pendingReplyUrl;
    pendingReplyUrl = undefined;
    await postReply(url, text);
  });

  pi.registerCommand("imgateway", {
    description: "IM gateway status: /imgateway",
    handler: async (_args, ctx) => {
      ctx.ui.notify(
        handle ? `IM gateway listening on :${handle.port}` : "IM gateway not running (set IM_GATEWAY=1 and restart)",
        "info",
      );
    },
  });
}

// web-fetch: let the agent fetch web pages over http(s) and read them as
// markdown/text. Zero dependencies (Node fetch + regex), with an SSRF guard,
// timeout and output truncation.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { extractTitle, htmlToMarkdown, htmlToText, isSafeUrl } from "./html.js";

const MAX_CHARS = Number(process.env.FETCH_MAX_CHARS ?? "20000") || 20000;
const TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS ?? "15000") || 15000;

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "fetch_url",
    label: "Fetch URL",
    description:
      "Fetch a web page over http(s) and return its main content as markdown (default) or plain text. " +
      "Use it to read documentation, articles, API references, or release notes.",
    promptSnippet: "Fetch and read a web page (http/https) as markdown.",
    parameters: Type.Object({
      url: Type.String({ description: "Absolute http(s) URL" }),
      format: Type.Optional(Type.String({ description: "'markdown' (default) or 'text'" })),
    }),
    async execute(_toolCallId, params, signal) {
      const safe = isSafeUrl(params.url);
      if (!safe.ok) throw new Error(`Refused to fetch: ${safe.reason}`);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true });

      let res: Response;
      try {
        res = await fetch(params.url, {
          signal: controller.signal,
          redirect: "follow",
          headers: { "user-agent": "pi-web-fetch/0.1", accept: "text/html,application/xhtml+xml,text/plain,*/*" },
        });
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${params.url}`);

      const contentType = res.headers.get("content-type") ?? "";
      const raw = await res.text();

      let out: string;
      if (contentType.includes("html") || /^\s*<(!doctype|html)/i.test(raw)) {
        const title = extractTitle(raw);
        const body = params.format === "text" ? htmlToText(raw) : htmlToMarkdown(raw);
        out = (title ? `# ${title}\n\n` : "") + body;
      } else {
        out = raw;
      }

      let truncated = false;
      if (out.length > MAX_CHARS) {
        out = out.slice(0, MAX_CHARS);
        truncated = true;
      }

      return {
        content: [{ type: "text", text: truncated ? `${out}\n\n[truncated to ${MAX_CHARS} chars]` : out }],
        details: { url: params.url, status: res.status, contentType, chars: out.length, truncated },
      };
    },
  });
}

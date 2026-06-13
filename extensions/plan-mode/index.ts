import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, TextContent } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { extractTodoItems, isSafeCommand, markCompletedSteps, type TodoItem } from "./utils.js";

// 进入规划模式时仅保留这些只读工具。
const PLAN_MODE_TOOLS = ["read", "grep", "find", "ls", "bash", "fetch_url"];

function isAssistantMessage(m: AgentMessage): m is AssistantMessage {
  return m.role === "assistant" && Array.isArray(m.content);
}
function getTextContent(message: AssistantMessage): string {
  return message.content
    .filter((b): b is TextContent => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

export default function (pi: ExtensionAPI) {
  let planModeEnabled = false;
  let executionMode = false;
  let todoItems: TodoItem[] = [];
  // 进入 plan 前的完整工具集，退出时还原（避免丢失 todo/kb/memory 等扩展工具）。
  let savedTools: string[] | undefined;

  const updateStatus = (ctx: ExtensionContext) => {
    if (executionMode && todoItems.length > 0) {
      const done = todoItems.filter((t) => t.completed).length;
      ctx.ui.setStatus("plan-mode", `▶ ${done}/${todoItems.length}`);
    } else if (planModeEnabled) {
      ctx.ui.setStatus("plan-mode", "📋 Plan");
    } else {
      ctx.ui.setStatus("plan-mode", undefined);
    }
  };

  const persistState = () => {
    pi.appendEntry("plan-mode", { enabled: planModeEnabled, todos: todoItems, executing: executionMode, savedTools });
  };

  const enterPlan = (ctx: ExtensionContext) => {
    savedTools = pi.getActiveTools();
    planModeEnabled = true;
    executionMode = false;
    todoItems = [];
    pi.setActiveTools(PLAN_MODE_TOOLS);
    ctx.ui.notify(`已进入规划模式（只读）：${PLAN_MODE_TOOLS.join(", ")}`, "info");
    updateStatus(ctx);
    persistState();
  };

  const restoreTools = () => {
    if (savedTools) pi.setActiveTools(savedTools);
  };

  pi.registerCommand("plan", {
    description: "切换规划模式（只读探索）",
    handler: async (_args, ctx) => {
      if (planModeEnabled) {
        planModeEnabled = false;
        restoreTools();
        ctx.ui.notify("已退出规划模式，恢复完整工具。", "info");
        updateStatus(ctx);
        persistState();
      } else {
        enterPlan(ctx);
      }
    },
  });

  pi.on("tool_call", async (event) => {
    if (!planModeEnabled) return undefined;
    if (event.toolName === "bash") {
      const command = String(event.input?.command ?? "");
      if (!isSafeCommand(command)) {
        return {
          block: true,
          reason: `规划模式：命令未在只读白名单内，已阻止。先用 /plan 退出规划模式。\n命令：${command}`,
        };
      }
      return undefined;
    }
    if (event.toolName === "write" || event.toolName === "edit") {
      return { block: true, reason: "规划模式：禁止写入/编辑。先用 /plan 退出规划模式。" };
    }
    return undefined;
  });

  pi.on("before_agent_start", async () => {
    if (planModeEnabled) {
      return {
        message: {
          customType: "plan-mode-context",
          content: `[PLAN MODE ACTIVE]
你处于只读规划模式。只能使用 read/grep/find/ls/fetch_url 与白名单只读 bash；不能 edit/write。
请勿尝试修改，仅在 "Plan:" 标题下输出编号步骤：

Plan:
1. 第一步描述
2. 第二步描述
...`,
          display: false,
        },
      };
    }
    if (executionMode && todoItems.length > 0) {
      const remaining = todoItems
        .filter((t) => !t.completed)
        .map((t) => `${t.step}. ${t.text}`)
        .join("\n");
      return {
        message: {
          customType: "plan-execution-context",
          content: `[EXECUTING PLAN - 完整工具已恢复]
剩余步骤：
${remaining}
按顺序执行；每完成一步在回复中加 [DONE:n] 标记。`,
          display: false,
        },
      };
    }
    return undefined;
  });

  pi.on("turn_end", async (event, ctx) => {
    if (!executionMode || todoItems.length === 0) return;
    if (!isAssistantMessage(event.message)) return;
    if (markCompletedSteps(getTextContent(event.message), todoItems) > 0) {
      updateStatus(ctx);
      persistState();
    }
  });

  pi.on("agent_end", async (event, ctx) => {
    if (executionMode && todoItems.length > 0) {
      if (todoItems.every((t) => t.completed)) {
        pi.sendMessage(
          { customType: "plan-complete", content: "**计划完成！** ✓", display: true },
          { triggerTurn: false },
        );
        executionMode = false;
        todoItems = [];
        restoreTools();
        updateStatus(ctx);
        persistState();
      }
      return;
    }
    if (!planModeEnabled || !ctx.hasUI) return;

    const lastAssistant = [...event.messages].reverse().find(isAssistantMessage);
    if (lastAssistant) {
      const extracted = extractTodoItems(getTextContent(lastAssistant));
      if (extracted.length > 0) todoItems = extracted;
    }
    if (todoItems.length > 0) {
      const list = todoItems.map((t, i) => `${i + 1}. ☐ ${t.text}`).join("\n");
      pi.sendMessage(
        { customType: "plan-steps", content: `**计划步骤（${todoItems.length}）：**\n\n${list}`, display: true },
        { triggerTurn: false },
      );
    }

    const choice = await ctx.ui.select("规划完成 — 下一步？", ["执行计划", "留在规划模式"]);
    if (choice === "执行计划") {
      planModeEnabled = false;
      executionMode = todoItems.length > 0;
      restoreTools();
      updateStatus(ctx);
      persistState();
      const first = todoItems[0]?.text;
      pi.sendMessage(
        {
          customType: "plan-execute",
          content: first ? `执行计划，从第一步开始：${first}` : "执行你刚制定的计划。",
          display: true,
        },
        { triggerTurn: true },
      );
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    const entries = ctx.sessionManager.getEntries() as Array<{ type: string; customType?: string; data?: unknown }>;
    const entry = entries.filter((e) => e.type === "custom" && e.customType === "plan-mode").pop();
    const data = entry?.data as
      | { enabled?: boolean; todos?: TodoItem[]; executing?: boolean; savedTools?: string[] }
      | undefined;
    if (data) {
      planModeEnabled = data.enabled ?? false;
      todoItems = data.todos ?? [];
      executionMode = data.executing ?? false;
      savedTools = data.savedTools;
    }
    if (planModeEnabled) pi.setActiveTools(PLAN_MODE_TOOLS);
    updateStatus(ctx);
  });
}

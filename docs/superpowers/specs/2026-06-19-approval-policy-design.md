# 审批策略（Approval Policy · Codex 式三级预设）设计

- 日期：2026-06-19
- 状态：设计已评审（待用户最终确认 → writing-plans）
- 主题：在 Pi 桌面端新增一个与「模式（Agent/Ask/Debug/Plan）」并列的**审批策略**选择器，对标 Codex 的三级（请求批准 / 替我审批 / 完全访问）。每级是一个**预设**，同时配置「沙箱 scope + 确认级别」，打通已落地的 safety（逐操作确认）与统一沙箱层（WSL2）。

## 1. 背景与目标

现有两条相关机制：
- **agent-mode**（`extensions/agent-mode/`）：统一模式 Agent/Ask/Debug/Plan，管「工具范围（读写）」；经 `setStatus("agent-mode")` 推前端，`ModeAction.tsx` 渲染输入框下拉，per-session 持久化。
- **safety**（`extensions/safety/`）：逐操作审批——危险命令 `ctx.ui.confirm`、受保护路径拦写、`project_trust`。配置 `SAFETY_*`。
- **统一沙箱层**（`extensions/_shared/sandbox/`，已落地）：WSL2 + srt 隔离执行，消费者 code-exec / im-platforms / multi-agent。

缺一个用户可见的「确认/权限级别」控制。Codex 把它做成三级预设（截图：请求批准 / 替我审批 / 完全访问），每级描述同时涉及「沙箱（文件/网络范围）+ 何时询问」。本设计补齐这一维度。

### 成功标准（用户确认）

1. **独立维度**：新增「审批策略」下拉，与模式选择器**并列**（模式=工具范围，审批=确认级别 + 沙箱 scope）。对标 Codex 把 sandbox 与 approval 分离呈现。
2. **三级为预设**，每级同时控「沙箱 scope + 确认级别」：
   - **请求批准**：沙箱开（可用时）；写 workspace 外 / 联网 / 危险命令 → 弹确认。
   - **替我审批（默认）**：沙箱开（可用时）；仅危险命令 → 弹确认。
   - **完全访问**：关沙箱；不确认、不限制（宿主直跑）。
3. **默认「替我审批」**，**per-session 持久化**（复刻 agent-mode），切会话/重启回读。
4. **复用现有机制**：确认走 `ctx.ui.confirm`（ExtensionUiHost 内联卡）；前端下拉复刻 `ModeAction`；状态流复刻 agent-mode。

### 关键决策（来自评审问答）

- 审批与模式**正交、并列两个下拉**（非合并、非替换）。
- 三级=预设，**耦合沙箱 + 确认**（用户明确选此，对标 Codex 的混合 UX）。
- 默认 `auto`（替我审批），per-session。
- 沙箱开关从 `SANDBOX_ENABLE==="on"` 改为「**策略 != full 且沙箱可用**」驱动；`SANDBOX_ENABLE=off` 保留为总 kill 开关。
- owner 默认（auto）即沙箱开——接受 owner code-exec 进沙箱（常驻内核退化为一次性 + 首次探测延迟）。

### 非目标（YAGNI）

- 不做 per-tool 细粒度自定义白名单 UI（先三级预设）。
- 不改 agent-mode 的 Agent/Ask/Debug/Plan 语义（仅并列新增）。
- 不做全局（跨 workspace）策略（先 per-session，与 agent-mode 一致）。
- 不在本设计内新增沙箱后端（复用已落地的 WSL2 层）。

## 2. 架构总览（复刻 agent-mode 的状态流）

```
前端 ApprovalAction.tsx（输入框下拉，复刻 ModeAction）
  └─ onChange → approvalStore 乐观更新 + pi.setApproval(workspace, level)
        └─ Tauri agent_set_approval → sidecar /approval 命令（不调 LLM）
              └─ approval 扩展：setApprovalPolicy(level) 写进程内共享态
                                + appendEntry 持久化到 session
                                + setStatus("approval-policy", level) 回推前端
前端 ExtensionUiHost 收 setStatus("approval-policy") → approvalStore.setLevel

读取方（同一 sidecar 进程内）：
  _shared/approval.ts  getApprovalPolicy(): "ask" | "auto" | "full"
   ├─ safety/index.ts        tool_call 据此决定 confirm / 放行
   └─ code-exec / im-platforms / multi-agent   据此决定是否走沙箱
```

数据流与 agent-mode 完全同构：命令 → 扩展改状态 → 持久化 + setStatus → 前端 store 回读。

## 3. 组件

### 3.1 `extensions/_shared/approval.ts`（新）
进程内共享策略单例（多扩展读同一份）。
```ts
export type ApprovalPolicy = "ask" | "auto" | "full";
export function getApprovalPolicy(): ApprovalPolicy;   // 默认 "auto"
export function setApprovalPolicy(p: ApprovalPolicy): void;
export function parseApproval(s: string | undefined): ApprovalPolicy | undefined;
export const APPROVAL_LABELS: Record<ApprovalPolicy, string>; // 请求批准/替我审批/完全访问
```

### 3.2 `extensions/approval/index.ts`（新，复刻 agent-mode 骨架）
- `pi.registerCommand("approval", …)`：`/approval ask|auto|full`，设 `setApprovalPolicy` + persist + setStatus + notify。
- `pi.on("session_start")`：从 session entry 回读（无则 default auto）→ setApprovalPolicy + `setStatus("approval-policy", level)`。
- persist：`pi.appendEntry("approval", { policy })`。

### 3.3 safety 改造（`extensions/safety/index.ts`）
`tool_call` 开头读 `getApprovalPolicy()`：
- `full`：`return undefined`（放行一切：不 readonly、不 confirm、不拦保护路径）。
- `auto`：维持现状（危险 bash confirm + 受保护路径 + 既有 deny/readonly env）。
- `ask`：在 auto 基础上，额外：
  - `write`/`edit` 目标在 `ctx.cwd` 外 → `ctx.ui.confirm("允许写工作区外文件？\n<path>")`，拒则 block。
  - 联网工具 `web_search`/`web_fetch`/`web_crawler` → `ctx.ui.confirm("允许联网？")`，拒则 block。
  - 危险 bash → confirm（同 auto）。
（`!ctx.hasUI` 时 ask/auto 的 confirm 走「无 UI 默认 block」既有逻辑。）

### 3.4 沙箱联动（code-exec / im-platforms / multi-agent）
把「是否走沙箱」的判据从 `getConfig("SANDBOX_ENABLE")==="on"` 改为：
```ts
sandboxOn = getConfig("SANDBOX_ENABLE") !== "off" && getApprovalPolicy() !== "full" && await getSandbox().isAvailable()
```
- code-exec js_run/py_run、im-platforms 无主人会话、multi-agent `isolation:"sandbox"` 统一用此判据。
- im-platforms 仍保留「无主人 + 沙箱不可用 → 纯 deny」兜底。

### 3.5 前端
- `stores/approvalStore.ts`（复刻 modeStore）：`byWorkspace: Record<ws, ApprovalPolicy>`，`setLevel(ws, p)`。
- `features/chat/input/actions/ApprovalAction.tsx`（复刻 ModeAction）：base-ui Select + lucide 图标（如 ShieldAlert/ShieldCheck/ShieldOff），onChange → store 乐观 + `pi.setApproval`。
- `lib/pi.ts`：`setApproval(ws, level) => invoke("agent_set_approval", { workspace, level })`。
- `features/extensionUi/ExtensionUiHost.tsx`：`statusKey === "approval-policy"` → `approvalStore.setLevel`。
- 输入框工具条挂上 `<ApprovalAction/>`（ModeAction 旁）。

### 3.6 Tauri（`src-tauri/src/commands/agent.rs` 或同处）
`agent_set_approval(workspace, level)`：复刻 `agent_set_mode`，向 sidecar 发 `/approval <level>`。lib.rs 注册。

## 4. 三级预设 → 行为对照

| 级别 | 沙箱（可用时） | 写 workspace 外 | 联网 | 危险命令 | 普通读写/安全命令 |
| --- | --- | --- | --- | --- | --- |
| 请求批准 ask | 开 | 确认 | 确认 | 确认 | 自动 |
| 替我审批 auto（默认） | 开 | 自动 | 自动 | 确认 | 自动 |
| 完全访问 full | 关 | 自动 | 自动 | 自动 | 自动 |

## 5. 降级 / 持久化 / 确认 UI

- 沙箱未装：ask/auto 仍生效——确认在宿主侧照常弹，只是执行无隔离；SandboxCard 引导一键安装。
- 持久化：`pi.appendEntry("approval", {policy})` + session_start 回读，默认 auto。per-session（多会话各自独立）。
- 确认 UI：复用 `ctx.ui.confirm` → `pi://ui-request`(confirm) → ExtensionUiHost → 输入框上方内联卡（已支持）。

## 6. 测试

- `_shared/approval.ts`：get/set/parse/默认 纯单测。
- safety 改造：注入 `getApprovalPolicy` + 假 ctx.ui.confirm，断言 full 放行 / auto 现状 / ask 对越界写+联网+危险命令弹确认（用 rules 的 extractPath / isDangerousBash）。
- 沙箱判据：策略=full 时不路由（单测 sandboxOn 逻辑）。
- 前端：approvalStore + ApprovalAction（复刻 ModeAction 测试）+ ExtensionUiHost 收 approval-policy 状态。
- Rust：`cargo check`。

## 7. 风险 / 待验证

- **owner 默认进沙箱**：auto 默认 → owner code-exec 进沙箱（内核退化 + 探测延迟）。已确认接受；若体验差可把默认沙箱仅对「无主人/子代理」生效（保留开关）。
- **ask 的越界判定**：`write/edit` 的路径解析要 normalize（`../`、symlink、盘符大小写），复用 safety/rules 既有 `extractPath`/路径匹配。
- **confirm 风暴**：ask 级别下密集越界操作可能频繁弹窗；可后续加「本会话记住此目录」一类记忆（YAGNI，先不做）。

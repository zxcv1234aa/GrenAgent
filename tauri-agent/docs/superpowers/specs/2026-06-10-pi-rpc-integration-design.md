# Pi RPC 集成设计

- 日期：2026-06-10
- 主题：桌面应用（Tauri + SolidJS）接入真实 pi 编码 Agent
- 状态：已评审通过，待编写实现计划

## 背景

`tauri-agent/` 是为 `pi` 编码 Agent（同仓库 `pi/` monorepo，含 `pi-coding-agent` CLI、`pi-agent-core`、`pi-ai`）构建的桌面 GUI，技术栈为 **Tauri 2 + SolidJS（前端）+ Rust（后端）**。

当前为脚手架状态：
- 前端：三栏布局（左 Sessions/Files，中 ChatView 聊天，右 Context 面板）；`ChatView` 已接 `agent_invoke` 命令并监听 `agent-event` 流式事件。
- 后端：命令模块 `agent / chat / files / git / terminal`，`session_manager` 用 SQLite 存 sessions/messages。
- 核心缺口：`commands/agent.rs` 的 `agent_invoke` 是 **mock**（仅回 `Echo: ...`），注释标注 *TODO：通过子进程接入 pi 内核*。

## 目标与范围

打通桌面应用与真实 pi 的**完整交互**能力：

- 流式文本 / 思考输出、工具调用展示、中止
- 模型切换、思考级别切换
- 工具权限弹窗（pi 的 extension UI 子协议：`select/confirm/input/editor` 等）
- 上下文压缩（compaction）、自动重试事件呈现
- 会话树 / 分叉（fork / clone）、新建 / 切换会话

非目标（后续轮次）：文件树面板、Git 面板、终端面板的功能设计（`files.rs` / `git.rs` / `terminal.rs` 本轮不动）。

## 关键决策

1. **接入机制**：Rust 后端 ↔ `pi --mode rpc` sidecar，stdin/stdout 上的 JSONL。
   - pi 提供三种程序化接口：SDK（仅 TS/Node，进程内）、RPC 模式子进程（语言无关）、JSON 模式（单发不可交互）。后端为 Rust，RPC 子进程是唯一自然契合点。
2. **进程模型**：**每个工作区（cwd）一个 pi RPC 进程**。贴合 pi 「runtime 绑定 cwd」的设计，支持多工作区并发与进程隔离。
3. **会话归属**：**pi 全权管理会话**（jsonl 会话树，唯一能表达分叉的真相源），退役 SQLite 自建的 sessions/messages 存储。
4. **会话目录**：默认使用 pi 默认目录 `~/.pi/agent/sessions`，与 pi CLI 共享会话；如需隔离再传 `--session-dir`。
5. **分发**：将 pi 用 `bun build --compile` 编译为独立可执行文件，作为 **Tauri sidecar 二进制**随应用打包，用户零配置。

## 设计

### 1. Rust 侧组件与边界

- **`PiManager`**（Tauri managed state，替代/扩展现有 `AppState`）：持有 `HashMap<WorkspaceId, PiClient>`，按工作区创建或复用客户端；负责 `open_workspace` / `close_workspace`。
- **`PiClient`**（每工作区一个）：拥有 sidecar 子进程、`stdin` 写入端、`stdout` 读取任务。对外提供 `send_command(cmd) -> Result<RpcResponse>`（用 `id` 关联），内部维护：
  - `child`（用于 kill）、`stdin: Mutex<ChildStdin>`
  - `pending: Mutex<HashMap<String, oneshot::Sender<RpcResponse>>>`（请求/响应关联）
- **stdout 读取任务**：严格按 `\n` 分帧、剥掉尾部 `\r`、逐行 `serde_json` 解析。
  - `type:"response"` 且带 `id` → 解析对应 pending
  - `type:"extension_ui_request"` → 转发前端
  - 其余（事件）→ 作为 Tauri 事件发往前端
- 每个 `PiClient` 生成时绑定 `current_dir = 工作区路径`，对应 pi 的 cwd-bound runtime。

职责单一：Rust 只做「进程管理 + JSONL 编解码 + 事件转发 + 请求关联」，不解释 pi 的业务语义。

### 2. 命令面（Tauri command ↔ RPC 命令）

删除 `agent.rs` 的 mock，全部命令带 `workspace` 参数，返回 RPC 的 `data` 或错误：

- 提问/控制：`agent_prompt`(message/images/streamingBehavior)、`agent_steer`、`agent_follow_up`、`agent_abort`
- 模型/思考：`agent_set_model`、`agent_cycle_model`、`agent_get_available_models`、`agent_set_thinking_level`、`agent_cycle_thinking_level`
- 上下文：`agent_compact`、`agent_set_auto_compaction`、`agent_abort_retry`、`agent_get_session_stats`
- 状态：`agent_get_state`、`agent_get_messages`、`agent_get_commands`
- 会话：`agent_new_session`、`agent_switch_session`、`agent_fork`、`agent_clone`、`agent_get_fork_messages`、`agent_set_session_name`
- 权限弹窗回传：`extension_ui_respond`(id, value/confirmed/cancelled) → 写 `extension_ui_response` 到 stdin
- 工作区：`open_workspace(path)`、`close_workspace(path)`

### 3. 事件桥（pi → 前端）

- Rust 发 Tauri 事件 `pi://event`，载荷 `{ workspace, event }`；前端按 workspace 路由、按 `toolCallId` 关联工具调用。
- 转发并在前端归约：`agent_start/end`、`turn_start/end`、`message_start/update/end`（含 `text_delta`/`thinking_delta`/`toolcall_*`）、`tool_execution_start/update/end`、`queue_update`、`compaction_*`、`auto_retry_*`、`extension_error`。
- 流式渲染：pi 的 `message_update` 同时给出完整 `message` 快照与 `delta`，前端**直接用快照替换当前流式消息**（最简、最稳），不必自己拼 delta。
- `extension_ui_request`：
  - 对话类 `select/confirm/input/editor` → 弹模态框，用户操作后经 `extension_ui_respond` 回传匹配 `id` 的结果（含 `cancelled`）
  - 即发类 `notify/setStatus/setWidget/setTitle/set_editor_text` → 状态栏/Toast 等轻量呈现，无需回传

### 4. 会话与状态归属

- **pi 全权管理会话**（jsonl 会话树），SQLite 退役。
- **会话目录**：默认 pi 默认目录 `~/.pi/agent/sessions`，与 pi CLI 互通；如需隔离再传 `--session-dir`。
- **会话列表**：RPC 协议无 list-sessions 命令，故由 **Rust 读取会话目录**、解析每个 `.jsonl` 首行 header（`{"type":"session","cwd":...,"id":...}`）按 cwd 过滤生成列表；选中后用 `switch_session` 加载，再 `get_messages` 取历史。
- **应用本地存储**：用一个精简的 JSON 文件 `app-state.json`（位于 app data 目录）仅存应用级元数据——最近工作区、窗口/布局状态、每工作区最后活跃会话。`state/session_manager.rs`（SQLite sessions/messages）整体删除；由于不再需要数据库，`rusqlite` 依赖可从 `Cargo.toml` 移除。

### 5. 错误处理与生命周期

- **sidecar 崩溃/退出**：读取任务检测 EOF/退出码 → 发 `pi://exit`，标记客户端失效、拒绝所有 pending；前端提示「agent 已停止」并提供重启。
- **重启**：重启后用 `switch_session` 回到上次会话文件。
- **解析错误**：单行 JSON 解析失败 → 记日志 + 诊断事件，跳过该行，不杀进程。
- **prompt 语义**：`prompt` 命令的 response 仅表示「已接受/排队」，真正完成靠事件流（与 pi 协议一致）。
- **重试/扩展错误**：`auto_retry_*` 在 UI 呈现进度，`extension_error` 弹 Toast。
- **退出清理**：应用退出时优雅关闭所有 sidecar（关 stdin → 等待 → kill）。

### 6. Sidecar 打包

- 用 pi 现成的 `build:binary`（`bun build --compile` → `dist/pi`）编译独立二进制；按 Tauri 目标三元组命名放入 `src-tauri/binaries/`（如 `pi-x86_64-pc-windows-msvc.exe`）。
- `tauri.conf.json` 增 `bundle.externalBin: ["binaries/pi"]`。
- 引入 **`tauri-plugin-shell`**（Cargo + JS），在 `capabilities/default.json` 加 sidecar 执行权限。
- 生成：`app.shell().sidecar("pi")?.args(["--mode","rpc"]).current_dir(workspace)`。
- 增加构建脚本：`tauri build` 前先编译 pi 二进制到 `binaries/`；开发模式可指向本地 `dist/pi` 或 `node dist/cli.js`。README 记录。

### 7. 代码整理

- 删除重复目录：根 `src/`、嵌套 `tauri-agent/tauri-agent/`，仅保留 `tauri-agent/src/` 为唯一前端源。
- `commands/agent.rs` mock → PiClient 实现；`chat.rs` 的会话命令 → 改为 pi 会话列表/切换；`state/session_manager.rs`（SQLite）缩减为应用元数据或移除。
- `files.rs` / `git.rs` / `terminal.rs`（文件树/Git/终端面板）**本轮不动**，保留，后续轮次再设计。

### 8. 测试

- Rust 单测：JSONL 分帧（仅 `\n`、剥 `\r`、字符串内 `U+2028` 不误分）、`id` 关联、扩展 UI 路由。
- 集成测：用一个「假 pi」脚本吐预设 JSONL，验证 `prompt→事件→complete` 全链路；或用真 pi + stub 模型。
- 前端：`message_update` 归约成消息列表、权限弹窗交互流。

## 数据流示例

### 提问往返
1. 前端 `invoke('agent_prompt', { workspace, message })`
2. Rust `PiClient` 写 `{"id":"r1","type":"prompt","message":...}` 到 stdin
3. pi 回 `{"id":"r1","type":"response","command":"prompt","success":true}` → 命令 resolve（仅表示已接受）
4. pi 持续吐事件 `agent_start → turn_start → message_update(text_delta…) → tool_execution_* → turn_end → agent_end`
5. Rust 每条事件 emit `pi://event`，前端按 workspace 归约渲染

### 工具权限弹窗
1. pi 吐 `{"type":"extension_ui_request","id":"u1","method":"confirm","title":...}`
2. Rust 转发前端 → 弹确认框
3. 用户选择 → 前端 `invoke('extension_ui_respond', { workspace, id:"u1", confirmed:true })`
4. Rust 写 `{"type":"extension_ui_response","id":"u1","confirmed":true}` 到 stdin

## 风险与待验证项

- Tauri v2 sidecar `Command` 是否支持 `.current_dir()` / `.env()`（需实测；若不支持，改用 `std::process` 直接 spawn externalBin 解析后的路径）。
- `bun build --compile` 产物在三大平台的体积与启动时间。
- pi 默认会话目录与 GUI 并发写同一会话文件时的冲突（GUI 每工作区独立进程，正常不冲突；但与 CLI 同时打开同一会话需注意）。
- 大量 `message_update` 快照的前端渲染性能（必要时节流/diff）。

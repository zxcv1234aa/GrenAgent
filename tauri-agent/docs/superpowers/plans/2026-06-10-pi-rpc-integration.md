# Pi RPC 集成 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让 Tauri 桌面应用通过 `pi --mode rpc` sidecar 接入真实 pi 编码 Agent，打通流式输出、工具调用、权限弹窗、模型/思考切换、压缩、会话树等完整交互能力。

**架构：** Rust 后端为每个工作区（cwd）拉起一个 `pi --mode rpc` sidecar；`PiClient` 负责 JSONL 编解码、请求/响应 `id` 关联与事件转发，通过依赖注入的 `PiTransport`/`EventSink` 两个 trait 实现核心逻辑与进程/Tauri 解耦以便单测；pi 全权管理会话（jsonl），应用仅用 `app-state.json` 存应用级元数据。

**技术栈：** Rust（Tauri 2、tauri-plugin-shell、tokio、serde_json、anyhow）、SolidJS + TypeScript（前端，Vitest 测试纯逻辑）、pi sidecar（`bun build --compile`）。

**规格：** `docs/superpowers/specs/2026-06-10-pi-rpc-integration-design.md`

---

## 文件结构

### Rust 后端（`src-tauri/src/`）

- `pi/mod.rs` — pi 集成模块入口，re-export。
- `pi/types.rs` — RPC 命令/响应/事件的 serde 类型；`PiOutbound`（发往 pi）、`PiInbound`（pi 发来：response / extension_ui_request / event）。
- `pi/framing.rs` — `JsonlBuffer`：按 `\n` 分帧、剥尾部 `\r`、不按 Unicode 行分隔符误分。
- `pi/transport.rs` — `PiTransport` trait + `ChannelTransport`（测试用内存实现）。
- `pi/sink.rs` — `EventSink` trait + `TauriSink`（生产）与 `CollectingSink`（测试）。
- `pi/client.rs` — `PiClient`：在 transport 之上做请求/响应关联、事件分发、extension UI 路由。
- `pi/sidecar.rs` — `spawn_sidecar`：用 shell 插件起 `pi --mode rpc`，把 `CommandChild`/事件流接到 `PiTransport`。
- `pi/manager.rs` — `PiManager`：`HashMap<WorkspaceId, Arc<PiClient>>`，`open_workspace`/`close_workspace`/`get`。
- `commands/agent.rs` — 重写：所有 `agent_*` Tauri 命令（删除 mock）。
- `commands/sessions.rs` — 新建：`list_pi_sessions`（读 jsonl header）、`extension_ui_respond`、workspace 生命周期命令。
- `state/app_state.rs` — 新建：`AppState`（`app-state.json` 读写：最近工作区、每工作区最后会话）。
- `state/mod.rs` — 改：移除 SQLite `SessionManager`，导出新 `AppState` 与 `PiManager`。
- `lib.rs` — 改：注册 shell 插件、`PiManager` 与 `AppState` 为 managed state、更新 `invoke_handler`。

删除：`state/session_manager.rs`、`commands/chat.rs`（会话职责迁移到 pi + `sessions.rs`）。`commands/files.rs`/`git.rs`/`terminal.rs` 本轮不动。

### 前端（`src/`）

- `src/lib/pi.ts` — `invoke` 包装 + 事件载荷 TS 类型（与 Rust `PiInbound` 对齐）。
- `src/stores/agent.ts` — `createAgentStore`：纯归约函数 `applyEvent(state, event)` 构建消息列表 + 会话状态。
- `src/components/chat/ChatView.tsx` — 重写：用 `agent_prompt` + 监听 `pi://event`。
- `src/components/dialogs/ExtensionUiDialog.tsx` — 新建：权限弹窗（confirm/select/input/editor）。
- `src/components/controls/ModelControls.tsx` — 新建：模型/思考级别切换、压缩按钮。
- 删除重复目录：根 `src/`（项目根下的 `src/components/chat`）、嵌套 `tauri-agent/tauri-agent/`。

### 打包

- `src-tauri/binaries/pi-<target-triple>[.exe]` — sidecar 二进制（构建产物，git 忽略）。
- `scripts/build-sidecar.mjs` — 编译 pi 并按 target triple 重命名到 `binaries/`。
- `src-tauri/capabilities/default.json` — 增 shell sidecar 执行权限。
- `src-tauri/tauri.conf.json` — 增 `plugins.shell` 与 `bundle.externalBin`。

---

## Phase 0：清理与依赖

### 任务 0：删除重复目录、添加依赖

**文件：**
- 删除：项目根 `src/`（`src/components/chat/*`）
- 删除：`tauri-agent/tauri-agent/`（嵌套重复）
- 修改：`src-tauri/Cargo.toml`
- 修改：`package.json`

- [ ] **步骤 1：删除重复目录**

```bash
# 在项目根 d:\OneDrive\Project Files\Pi 执行
git -C tauri-agent rm -r --cached --ignore-unmatch tauri-agent 2>$null
Remove-Item -Recurse -Force "src"
Remove-Item -Recurse -Force "tauri-agent/tauri-agent"
```

预期：根 `src/` 与 `tauri-agent/tauri-agent/` 不再存在；唯一前端源为 `tauri-agent/src/`。

- [ ] **步骤 2：在 `src-tauri/Cargo.toml` 调整依赖**

移除 `git2`、`portable-pty`、`rusqlite`、`notify`（本轮不需要；files/git/terminal 面板后续轮次再引），新增 shell 插件。`[dependencies]` 改为：

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
anyhow = "1"
dirs = "5"

[dev-dependencies]
tokio = { version = "1", features = ["full", "test-util"] }
```

> 注意：`commands/files.rs`、`git.rs`、`terminal.rs` 目前未用到被移除的库（均为 mock），删除依赖不会破坏编译。若编译报错，确认这些文件无残留 `use git2`/`use portable_pty`。

- [ ] **步骤 3：在 `package.json` 添加 Vitest（前端纯逻辑测试）**

```bash
cd tauri-agent
pnpm add -D vitest
```

在 `package.json` 的 `scripts` 增：`"test": "vitest --run"`。

- [ ] **步骤 4：验证编译**

运行：`cd tauri-agent/src-tauri; cargo build`
预期：编译通过（mock 命令仍在，尚未改动）。

- [ ] **步骤 5：Commit**

```bash
git -C tauri-agent add -A
git -C tauri-agent commit -m "chore: remove duplicate dirs, slim deps, add shell plugin + vitest"
```

---

## Phase 1：Rust 核心（可单测，无需真实进程）

### 任务 1：RPC 类型

**文件：**
- 创建：`src-tauri/src/pi/mod.rs`
- 创建：`src-tauri/src/pi/types.rs`
- 测试：`src-tauri/src/pi/types.rs`（`#[cfg(test)]` 内联）

- [ ] **步骤 1：创建模块入口 `pi/mod.rs`**

```rust
pub mod client;
pub mod framing;
pub mod manager;
pub mod sidecar;
pub mod sink;
pub mod transport;
pub mod types;

pub use client::PiClient;
pub use manager::PiManager;
pub use types::{PiInbound, PiOutbound};
```

- [ ] **步骤 2：编写失败的测试（序列化/反序列化）**

在 `pi/types.rs` 末尾：

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_prompt_command_with_id() {
        let cmd = PiOutbound::Prompt {
            id: Some("r1".into()),
            message: "hello".into(),
            images: None,
            streaming_behavior: None,
        };
        let json = serde_json::to_string(&cmd).unwrap();
        assert!(json.contains("\"type\":\"prompt\""));
        assert!(json.contains("\"id\":\"r1\""));
        assert!(json.contains("\"message\":\"hello\""));
        // None 字段不应出现
        assert!(!json.contains("images"));
        assert!(!json.contains("streamingBehavior"));
    }

    #[test]
    fn parses_response_inbound() {
        let line = r#"{"id":"r1","type":"response","command":"prompt","success":true}"#;
        let inbound: PiInbound = serde_json::from_str(line).unwrap();
        match inbound {
            PiInbound::Response(r) => {
                assert_eq!(r.id.as_deref(), Some("r1"));
                assert_eq!(r.command, "prompt");
                assert!(r.success);
            }
            _ => panic!("expected response"),
        }
    }

    #[test]
    fn parses_extension_ui_request_inbound() {
        let line = r#"{"type":"extension_ui_request","id":"u1","method":"confirm","title":"OK?"}"#;
        let inbound: PiInbound = serde_json::from_str(line).unwrap();
        assert!(matches!(inbound, PiInbound::ExtensionUiRequest(_)));
    }

    #[test]
    fn parses_event_inbound_as_raw() {
        let line = r#"{"type":"message_update","message":{},"assistantMessageEvent":{"type":"text_delta","delta":"hi"}}"#;
        let inbound: PiInbound = serde_json::from_str(line).unwrap();
        match inbound {
            PiInbound::Event(v) => assert_eq!(v["type"], "message_update"),
            _ => panic!("expected event"),
        }
    }
}
```

- [ ] **步骤 3：运行测试验证失败**

运行：`cd tauri-agent/src-tauri; cargo test pi::types`
预期：编译失败（类型未定义）。

- [ ] **步骤 4：编写实现 `pi/types.rs`**

```rust
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// 发往 pi（stdin）的命令。序列化为 RPC JSON，省略 None 字段。
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum PiOutbound {
    Prompt {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        images: Option<Vec<Value>>,
        #[serde(rename = "streamingBehavior", skip_serializing_if = "Option::is_none")]
        streaming_behavior: Option<String>,
    },
    Steer {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
        message: String,
    },
    FollowUp {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
        message: String,
    },
    Abort {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
    },
    NewSession {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
    },
    SwitchSession {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
        #[serde(rename = "sessionPath")]
        session_path: String,
    },
    Fork {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
        #[serde(rename = "entryId")]
        entry_id: String,
    },
    Clone {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
    },
    GetForkMessages {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
    },
    SetSessionName {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
        name: String,
    },
    GetState {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
    },
    GetMessages {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
    },
    GetSessionStats {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
    },
    GetCommands {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
    },
    GetAvailableModels {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
    },
    SetModel {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
        provider: String,
        #[serde(rename = "modelId")]
        model_id: String,
    },
    CycleModel {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
    },
    SetThinkingLevel {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
        level: String,
    },
    CycleThinkingLevel {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
    },
    Compact {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
        #[serde(rename = "customInstructions", skip_serializing_if = "Option::is_none")]
        custom_instructions: Option<String>,
    },
    SetAutoCompaction {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
        enabled: bool,
    },
    AbortRetry {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
    },
}

/// pi RPC 命令成功/失败响应。
#[derive(Debug, Clone, Deserialize)]
pub struct RpcResponse {
    #[serde(default)]
    pub id: Option<String>,
    pub command: String,
    pub success: bool,
    #[serde(default)]
    pub data: Option<Value>,
    #[serde(default)]
    pub error: Option<String>,
}

/// extension UI 请求（原样转发前端，保留所有字段）。
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ExtensionUiRequest {
    pub id: String,
    pub method: String,
    #[serde(flatten)]
    pub rest: Value,
}

/// 从 pi（stdout）读到的一行 JSON 的分类结果。
#[derive(Debug, Clone)]
pub enum PiInbound {
    Response(RpcResponse),
    ExtensionUiRequest(ExtensionUiRequest),
    /// 其余所有 agent 事件，原样转发前端。
    Event(Value),
}

impl<'de> Deserialize<'de> for PiInbound {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let value = Value::deserialize(deserializer)?;
        let ty = value.get("type").and_then(|v| v.as_str()).unwrap_or("");
        match ty {
            "response" => {
                let r: RpcResponse =
                    serde_json::from_value(value).map_err(serde::de::Error::custom)?;
                Ok(PiInbound::Response(r))
            }
            "extension_ui_request" => {
                let r: ExtensionUiRequest =
                    serde_json::from_value(value).map_err(serde::de::Error::custom)?;
                Ok(PiInbound::ExtensionUiRequest(r))
            }
            _ => Ok(PiInbound::Event(value)),
        }
    }
}
```

- [ ] **步骤 5：运行测试验证通过**

运行：`cd tauri-agent/src-tauri; cargo test pi::types`
预期：4 个测试 PASS。

- [ ] **步骤 6：Commit**

```bash
git -C tauri-agent add src-tauri/src/pi/mod.rs src-tauri/src/pi/types.rs
git -C tauri-agent commit -m "feat(pi): add RPC command/response/event types"
```

### 任务 2：JSONL 分帧

**文件：**
- 创建：`src-tauri/src/pi/framing.rs`
- 测试：`src-tauri/src/pi/framing.rs`（`#[cfg(test)]` 内联）

- [ ] **步骤 1：编写失败的测试**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_on_lf_only_and_strips_cr() {
        let mut buf = JsonlBuffer::new();
        let lines = buf.push("{\"a\":1}\r\n{\"b\":2}\n");
        assert_eq!(lines, vec!["{\"a\":1}".to_string(), "{\"b\":2}".to_string()]);
    }

    #[test]
    fn buffers_partial_line_until_newline() {
        let mut buf = JsonlBuffer::new();
        assert!(buf.push("{\"a\":").is_empty());
        let lines = buf.push("1}\n");
        assert_eq!(lines, vec!["{\"a\":1}".to_string()]);
    }

    #[test]
    fn does_not_split_on_unicode_line_separators() {
        // U+2028 (\u{2028}) 在 JSON 字符串内合法，绝不能当作换行
        let mut buf = JsonlBuffer::new();
        let lines = buf.push("{\"t\":\"a\u{2028}b\"}\n");
        assert_eq!(lines, vec!["{\"t\":\"a\u{2028}b\"}".to_string()]);
    }

    #[test]
    fn handles_empty_lines() {
        let mut buf = JsonlBuffer::new();
        let lines = buf.push("\n\n");
        assert_eq!(lines, vec!["".to_string(), "".to_string()]);
    }
}
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd tauri-agent/src-tauri; cargo test pi::framing`
预期：编译失败（`JsonlBuffer` 未定义）。

- [ ] **步骤 3：编写实现 `pi/framing.rs`**

```rust
/// 按严格 JSONL 语义把字节流切成行：仅以 `\n` 分隔，剥掉尾部 `\r`。
/// 绝不按 Unicode 行分隔符（U+2028/U+2029）切分——它们在 JSON 字符串内合法。
#[derive(Default)]
pub struct JsonlBuffer {
    buffer: String,
}

impl JsonlBuffer {
    pub fn new() -> Self {
        Self {
            buffer: String::new(),
        }
    }

    /// 追加一段文本，返回其中已完成的行（不含分隔符）。未结束的尾部保留在内部缓冲。
    pub fn push(&mut self, chunk: &str) -> Vec<String> {
        self.buffer.push_str(chunk);
        let mut out = Vec::new();
        while let Some(idx) = self.buffer.find('\n') {
            let mut line = self.buffer[..idx].to_string();
            if line.ends_with('\r') {
                line.pop();
            }
            out.push(line);
            // 丢弃到 '\n'（含）为止
            self.buffer.drain(..=idx);
        }
        out
    }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd tauri-agent/src-tauri; cargo test pi::framing`
预期：4 个测试 PASS。

- [ ] **步骤 5：Commit**

```bash
git -C tauri-agent add src-tauri/src/pi/framing.rs
git -C tauri-agent commit -m "feat(pi): add JSONL framing buffer with LF-only semantics"
```

---

### 任务 3：传输层与事件汇 trait

**文件：**
- 创建：`src-tauri/src/pi/transport.rs`
- 创建：`src-tauri/src/pi/sink.rs`

这两个 trait 让 `PiClient` 与「真实子进程」和「Tauri emit」解耦，从而可在无进程下单测。

- [ ] **步骤 1：编写 `pi/transport.rs`**

```rust
use anyhow::Result;
use async_trait::async_trait;
use tokio::sync::mpsc;

/// 与 pi 进程的双向 JSONL 传输。
#[async_trait]
pub trait PiTransport: Send + Sync + 'static {
    /// 写入一行 JSON（实现负责追加 `\n`）。
    async fn write_line(&self, line: String) -> Result<()>;
    /// 终止底层进程。
    async fn kill(&self) -> Result<()>;
}

/// 测试用内存传输：写入的行进入 `outbox`，可注入收到的行/退出。
pub struct ChannelTransport {
    pub outbox: mpsc::UnboundedSender<String>,
    killed: std::sync::atomic::AtomicBool,
}

impl ChannelTransport {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<String>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (
            Self {
                outbox: tx,
                killed: std::sync::atomic::AtomicBool::new(false),
            },
            rx,
        )
    }
}

#[async_trait]
impl PiTransport for ChannelTransport {
    async fn write_line(&self, line: String) -> Result<()> {
        self.outbox.send(line)?;
        Ok(())
    }
    async fn kill(&self) -> Result<()> {
        self.killed
            .store(true, std::sync::atomic::Ordering::SeqCst);
        Ok(())
    }
}
```

> 在 `Cargo.toml` 的 `[dependencies]` 增 `async-trait = "0.1"`。

- [ ] **步骤 2：编写 `pi/sink.rs`**

```rust
use serde_json::{json, Value};

/// PiClient 把要送到前端的内容交给 EventSink。
/// `workspace` 用于前端路由。
pub trait EventSink: Send + Sync + 'static {
    fn emit_event(&self, workspace: &str, event: &Value);
    fn emit_ui_request(&self, workspace: &str, request: &Value);
    fn emit_exit(&self, workspace: &str, code: Option<i32>);
}

/// 生产实现：通过 Tauri AppHandle 发事件。
pub struct TauriSink {
    pub app: tauri::AppHandle,
}

impl EventSink for TauriSink {
    fn emit_event(&self, workspace: &str, event: &Value) {
        use tauri::Emitter;
        let _ = self
            .app
            .emit("pi://event", json!({ "workspace": workspace, "event": event }));
    }
    fn emit_ui_request(&self, workspace: &str, request: &Value) {
        use tauri::Emitter;
        let _ = self
            .app
            .emit("pi://ui-request", json!({ "workspace": workspace, "request": request }));
    }
    fn emit_exit(&self, workspace: &str, code: Option<i32>) {
        use tauri::Emitter;
        let _ = self
            .app
            .emit("pi://exit", json!({ "workspace": workspace, "code": code }));
    }
}

/// 测试用：收集发出的内容。
#[derive(Default, Clone)]
pub struct CollectingSink {
    pub events: std::sync::Arc<std::sync::Mutex<Vec<Value>>>,
    pub ui_requests: std::sync::Arc<std::sync::Mutex<Vec<Value>>>,
    pub exits: std::sync::Arc<std::sync::Mutex<Vec<Option<i32>>>>,
}

impl EventSink for CollectingSink {
    fn emit_event(&self, _workspace: &str, event: &Value) {
        self.events.lock().unwrap().push(event.clone());
    }
    fn emit_ui_request(&self, _workspace: &str, request: &Value) {
        self.ui_requests.lock().unwrap().push(request.clone());
    }
    fn emit_exit(&self, _workspace: &str, code: Option<i32>) {
        self.exits.lock().unwrap().push(code);
    }
}
```

- [ ] **步骤 3：编译验证**

运行：`cd tauri-agent/src-tauri; cargo build`
预期：通过（`async-trait` 已加入）。

- [ ] **步骤 4：Commit**

```bash
git -C tauri-agent add src-tauri/src/pi/transport.rs src-tauri/src/pi/sink.rs src-tauri/Cargo.toml
git -C tauri-agent commit -m "feat(pi): add PiTransport and EventSink traits with test impls"
```

### 任务 4：PiClient（请求关联 + 事件分发）

**文件：**
- 创建：`src-tauri/src/pi/client.rs`
- 测试：`src-tauri/src/pi/client.rs`（`#[cfg(test)]` 内联）

- [ ] **步骤 1：编写失败的测试**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::pi::sink::CollectingSink;
    use crate::pi::transport::ChannelTransport;
    use std::sync::Arc;
    use std::time::Duration;

    #[tokio::test]
    async fn correlates_response_to_request() {
        let (transport, mut outbox) = ChannelTransport::new();
        let sink = CollectingSink::default();
        let client = Arc::new(PiClient::new("ws1".into(), Arc::new(transport), Arc::new(sink)));

        // 发命令（带自动生成的 id）
        let client2 = client.clone();
        let handle = tokio::spawn(async move {
            client2
                .send(PiOutbound::GetState { id: None })
                .await
                .unwrap()
        });

        // 读出写到 outbox 的行，取出 id
        let line = outbox.recv().await.unwrap();
        let v: serde_json::Value = serde_json::from_str(&line).unwrap();
        let id = v["id"].as_str().unwrap().to_string();
        assert_eq!(v["type"], "get_state");

        // 模拟 pi 回响应
        client
            .handle_line(&format!(
                r#"{{"id":"{id}","type":"response","command":"get_state","success":true,"data":{{"isStreaming":false}}}}"#
            ))
            .await;

        let resp = tokio::time::timeout(Duration::from_secs(1), handle)
            .await
            .unwrap()
            .unwrap();
        assert!(resp.success);
        assert_eq!(resp.data.unwrap()["isStreaming"], false);
    }

    #[tokio::test]
    async fn forwards_agent_events_to_sink() {
        let (transport, _outbox) = ChannelTransport::new();
        let sink = CollectingSink::default();
        let client = PiClient::new("ws1".into(), Arc::new(transport), Arc::new(sink.clone()));

        client
            .handle_line(r#"{"type":"agent_start"}"#)
            .await;
        client
            .handle_line(r#"{"type":"message_update","assistantMessageEvent":{"type":"text_delta","delta":"hi"}}"#)
            .await;

        let events = sink.events.lock().unwrap();
        assert_eq!(events.len(), 2);
        assert_eq!(events[0]["type"], "agent_start");
    }

    #[tokio::test]
    async fn routes_extension_ui_request_to_sink() {
        let (transport, _outbox) = ChannelTransport::new();
        let sink = CollectingSink::default();
        let client = PiClient::new("ws1".into(), Arc::new(transport), Arc::new(sink.clone()));

        client
            .handle_line(r#"{"type":"extension_ui_request","id":"u1","method":"confirm","title":"OK?"}"#)
            .await;

        let reqs = sink.ui_requests.lock().unwrap();
        assert_eq!(reqs.len(), 1);
        assert_eq!(reqs[0]["id"], "u1");
        assert_eq!(reqs[0]["method"], "confirm");
    }

    #[tokio::test]
    async fn malformed_line_is_skipped_not_fatal() {
        let (transport, _outbox) = ChannelTransport::new();
        let sink = CollectingSink::default();
        let client = PiClient::new("ws1".into(), Arc::new(transport), Arc::new(sink.clone()));

        client.handle_line("not json").await; // 不应 panic
        client.handle_line(r#"{"type":"agent_end","messages":[]}"#).await;
        assert_eq!(sink.events.lock().unwrap().len(), 1);
    }
}
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd tauri-agent/src-tauri; cargo test pi::client`
预期：编译失败（`PiClient` 未定义）。

- [ ] **步骤 3：编写实现 `pi/client.rs`**

```rust
use std::collections::HashMap;
use std::sync::Arc;

use anyhow::{anyhow, Result};
use serde_json::Value;
use tokio::sync::{oneshot, Mutex};
use uuid::Uuid;

use crate::pi::sink::EventSink;
use crate::pi::transport::PiTransport;
use crate::pi::types::{PiInbound, PiOutbound, RpcResponse};

/// 单个工作区的 pi 客户端。负责给命令分配 id、关联响应、把事件交给 sink。
pub struct PiClient {
    workspace: String,
    transport: Arc<dyn PiTransport>,
    sink: Arc<dyn EventSink>,
    pending: Mutex<HashMap<String, oneshot::Sender<RpcResponse>>>,
}

impl PiClient {
    pub fn new(
        workspace: String,
        transport: Arc<dyn PiTransport>,
        sink: Arc<dyn EventSink>,
    ) -> Self {
        Self {
            workspace,
            transport,
            sink,
            pending: Mutex::new(HashMap::new()),
        }
    }

    pub fn workspace(&self) -> &str {
        &self.workspace
    }

    /// 发送命令并等待匹配 id 的响应。若命令本身不带 id，则生成一个。
    pub async fn send(&self, mut cmd: PiOutbound) -> Result<RpcResponse> {
        let id = ensure_id(&mut cmd);
        let (tx, rx) = oneshot::channel();
        self.pending.lock().await.insert(id.clone(), tx);

        let line = serde_json::to_string(&cmd)?;
        if let Err(e) = self.transport.write_line(line).await {
            self.pending.lock().await.remove(&id);
            return Err(e);
        }

        rx.await
            .map_err(|_| anyhow!("pi client closed before response for {id}"))
    }

    /// 处理从 pi 读到的一行。非法 JSON 跳过（记录），不影响后续。
    pub async fn handle_line(&self, line: &str) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return;
        }
        match serde_json::from_str::<PiInbound>(trimmed) {
            Ok(PiInbound::Response(resp)) => {
                if let Some(id) = resp.id.clone() {
                    if let Some(tx) = self.pending.lock().await.remove(&id) {
                        let _ = tx.send(resp);
                        return;
                    }
                }
                // 无法关联：当作事件转发，便于前端观测
                self.sink.emit_event(
                    &self.workspace,
                    &serde_json::to_value(&UnmatchedResponse::from(resp)).unwrap_or(Value::Null),
                );
            }
            Ok(PiInbound::ExtensionUiRequest(req)) => {
                let v = serde_json::to_value(&req).unwrap_or(Value::Null);
                self.sink.emit_ui_request(&self.workspace, &v);
            }
            Ok(PiInbound::Event(v)) => {
                self.sink.emit_event(&self.workspace, &v);
            }
            Err(e) => {
                eprintln!("[pi:{}] skip unparsable line: {e}: {trimmed}", self.workspace);
            }
        }
    }

    /// 进程退出时调用：拒绝所有 pending，发 exit 事件。
    pub async fn handle_exit(&self, code: Option<i32>) {
        self.pending.lock().await.clear();
        self.sink.emit_exit(&self.workspace, code);
    }

    pub async fn kill(&self) -> Result<()> {
        self.transport.kill().await
    }

    /// 回传 extension UI 响应到 pi。
    pub async fn respond_ui(&self, response: Value) -> Result<()> {
        let line = serde_json::to_string(&response)?;
        self.transport.write_line(line).await
    }
}

#[derive(serde::Serialize)]
struct UnmatchedResponse {
    #[serde(rename = "type")]
    ty: &'static str,
    command: String,
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

impl From<RpcResponse> for UnmatchedResponse {
    fn from(r: RpcResponse) -> Self {
        Self {
            ty: "unmatched_response",
            command: r.command,
            success: r.success,
            error: r.error,
        }
    }
}

/// 若命令缺少 id 则注入一个并返回；否则返回已有 id。
fn ensure_id(cmd: &mut PiOutbound) -> String {
    let new_id = || Uuid::new_v4().to_string();
    macro_rules! fill {
        ($id:expr) => {{
            if $id.is_none() {
                *$id = Some(new_id());
            }
            $id.clone().unwrap()
        }};
    }
    use PiOutbound::*;
    match cmd {
        Prompt { id, .. }
        | Steer { id, .. }
        | FollowUp { id, .. }
        | Abort { id }
        | NewSession { id }
        | SwitchSession { id, .. }
        | Fork { id, .. }
        | Clone { id }
        | GetForkMessages { id }
        | SetSessionName { id, .. }
        | GetState { id }
        | GetMessages { id }
        | GetSessionStats { id }
        | GetCommands { id }
        | GetAvailableModels { id }
        | SetModel { id, .. }
        | CycleModel { id }
        | SetThinkingLevel { id, .. }
        | CycleThinkingLevel { id }
        | Compact { id, .. }
        | SetAutoCompaction { id, .. }
        | AbortRetry { id } => fill!(id),
    }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd tauri-agent/src-tauri; cargo test pi::client`
预期：4 个测试 PASS。

- [ ] **步骤 5：Commit**

```bash
git -C tauri-agent add src-tauri/src/pi/client.rs
git -C tauri-agent commit -m "feat(pi): add PiClient with id correlation and event dispatch"
```

---

## Phase 2：进程接入与状态

### 任务 5：Sidecar 传输（shell 插件）

**文件：**
- 创建：`src-tauri/src/pi/sidecar.rs`

把真实 `pi --mode rpc` 子进程包成 `PiTransport`，并把 stdout 喂给 `PiClient::handle_line`。无法脱进程单测，靠任务 13 的端到端验证。

- [ ] **步骤 1：编写 `pi/sidecar.rs`**

```rust
use std::sync::Arc;

use anyhow::{anyhow, Result};
use async_trait::async_trait;
use tauri::async_runtime;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tokio::sync::Mutex;

use crate::pi::client::PiClient;
use crate::pi::framing::JsonlBuffer;
use crate::pi::transport::PiTransport;

/// 基于 Tauri shell sidecar 的传输。
pub struct SidecarTransport {
    child: Mutex<Option<CommandChild>>,
}

#[async_trait]
impl PiTransport for SidecarTransport {
    async fn write_line(&self, mut line: String) -> Result<()> {
        line.push('\n');
        let mut guard = self.child.lock().await;
        let child = guard
            .as_mut()
            .ok_or_else(|| anyhow!("sidecar already terminated"))?;
        child.write(line.as_bytes())?;
        Ok(())
    }

    async fn kill(&self) -> Result<()> {
        if let Some(child) = self.child.lock().await.take() {
            child.kill()?;
        }
        Ok(())
    }
}

/// 起一个 pi RPC sidecar，绑定到 `cwd`，返回已接好 stdout 读取循环的 PiClient。
/// `client_factory` 由调用方提供（注入 sink/workspace），以便读取循环引用同一个 client。
pub fn spawn_pi_client(
    app: &tauri::AppHandle,
    workspace: String,
    cwd: &str,
    sink: Arc<dyn crate::pi::sink::EventSink>,
) -> Result<Arc<PiClient>> {
    let (mut rx, child) = app
        .shell()
        .sidecar("pi")
        .map_err(|e| anyhow!("sidecar lookup failed: {e}"))?
        .args(["--mode", "rpc"])
        .current_dir(cwd)
        .spawn()
        .map_err(|e| anyhow!("sidecar spawn failed: {e}"))?;

    let transport = Arc::new(SidecarTransport {
        child: Mutex::new(Some(child)),
    });
    let client = Arc::new(PiClient::new(workspace, transport, sink));

    // stdout 读取循环：分帧后逐行交给 client
    let client_for_loop = client.clone();
    async_runtime::spawn(async move {
        let mut buf = JsonlBuffer::new();
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    let chunk = String::from_utf8_lossy(&bytes);
                    for line in buf.push(&chunk) {
                        client_for_loop.handle_line(&line).await;
                    }
                }
                CommandEvent::Stderr(bytes) => {
                    eprintln!("[pi stderr] {}", String::from_utf8_lossy(&bytes));
                }
                CommandEvent::Terminated(payload) => {
                    client_for_loop.handle_exit(payload.code).await;
                    break;
                }
                CommandEvent::Error(err) => {
                    eprintln!("[pi error] {err}");
                }
                _ => {}
            }
        }
    });

    Ok(client)
}
```

> 注意：`CommandEvent` 的变体名以 `tauri-plugin-shell` 2.x 为准（`Stdout`/`Stderr`/`Terminated`/`Error`）。`Terminated` 载荷字段为 `code: Option<i32>`。若版本字段不同，按编译器提示调整。

- [ ] **步骤 2：编译验证**

运行：`cd tauri-agent/src-tauri; cargo build`
预期：通过（暂未被调用，无 dead_code 错误因为是 `pub fn`）。

- [ ] **步骤 3：Commit**

```bash
git -C tauri-agent add src-tauri/src/pi/sidecar.rs
git -C tauri-agent commit -m "feat(pi): add sidecar transport and stdout read loop"
```

### 任务 6：PiManager（每工作区一进程）

**文件：**
- 创建：`src-tauri/src/pi/manager.rs`
- 测试：`src-tauri/src/pi/manager.rs`（`#[cfg(test)]` 内联，用注入工厂避免起进程）

- [ ] **步骤 1：编写失败的测试**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::pi::sink::CollectingSink;
    use crate::pi::transport::ChannelTransport;
    use std::sync::Arc;

    fn fake_client(ws: &str) -> Arc<PiClient> {
        let (transport, _rx) = ChannelTransport::new();
        Arc::new(PiClient::new(
            ws.into(),
            Arc::new(transport),
            Arc::new(CollectingSink::default()),
        ))
    }

    #[tokio::test]
    async fn reuses_client_per_workspace() {
        let mgr = PiManager::new();
        let c1 = mgr
            .get_or_open("/ws/a", || Ok(fake_client("/ws/a")))
            .await
            .unwrap();
        let c2 = mgr
            .get_or_open("/ws/a", || panic!("should not create twice"))
            .await
            .unwrap();
        assert!(Arc::ptr_eq(&c1, &c2));
    }

    #[tokio::test]
    async fn close_removes_client() {
        let mgr = PiManager::new();
        mgr.get_or_open("/ws/a", || Ok(fake_client("/ws/a")))
            .await
            .unwrap();
        mgr.close("/ws/a").await;
        assert!(mgr.get("/ws/a").await.is_none());
    }
}
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd tauri-agent/src-tauri; cargo test pi::manager`
预期：编译失败（`PiManager` 未定义）。

- [ ] **步骤 3：编写实现 `pi/manager.rs`**

```rust
use std::collections::HashMap;
use std::sync::Arc;

use anyhow::Result;
use tokio::sync::Mutex;

use crate::pi::client::PiClient;

/// 工作区 -> 客户端 的映射。每个工作区复用同一个 pi 进程。
#[derive(Default)]
pub struct PiManager {
    clients: Mutex<HashMap<String, Arc<PiClient>>>,
}

impl PiManager {
    pub fn new() -> Self {
        Self::default()
    }

    /// 取已存在的客户端；不存在则用 `factory` 创建并缓存。
    pub async fn get_or_open<F>(&self, workspace: &str, factory: F) -> Result<Arc<PiClient>>
    where
        F: FnOnce() -> Result<Arc<PiClient>>,
    {
        let mut guard = self.clients.lock().await;
        if let Some(c) = guard.get(workspace) {
            return Ok(c.clone());
        }
        let client = factory()?;
        guard.insert(workspace.to_string(), client.clone());
        Ok(client)
    }

    pub async fn get(&self, workspace: &str) -> Option<Arc<PiClient>> {
        self.clients.lock().await.get(workspace).cloned()
    }

    pub async fn close(&self, workspace: &str) {
        if let Some(c) = self.clients.lock().await.remove(workspace) {
            let _ = c.kill().await;
        }
    }

    pub async fn close_all(&self) {
        let mut guard = self.clients.lock().await;
        for (_, c) in guard.drain() {
            let _ = c.kill().await;
        }
    }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd tauri-agent/src-tauri; cargo test pi::manager`
预期：2 个测试 PASS。

- [ ] **步骤 5：Commit**

```bash
git -C tauri-agent add src-tauri/src/pi/manager.rs
git -C tauri-agent commit -m "feat(pi): add PiManager with per-workspace client reuse"
```

### 任务 7：AppState（app-state.json）

**文件：**
- 创建：`src-tauri/src/state/app_state.rs`
- 修改：`src-tauri/src/state/mod.rs`
- 删除：`src-tauri/src/state/session_manager.rs`
- 测试：`src-tauri/src/state/app_state.rs`（`#[cfg(test)]` 内联）

- [ ] **步骤 1：编写失败的测试**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrips_recent_workspaces() {
        let dir = std::env::temp_dir().join(format!("pi-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("app-state.json");

        let mut st = AppState::load(&path);
        st.touch_workspace("/ws/a");
        st.set_last_session("/ws/a", "/sessions/a.jsonl");
        st.save(&path).unwrap();

        let reloaded = AppState::load(&path);
        assert_eq!(reloaded.recent_workspaces.first().map(|s| s.as_str()), Some("/ws/a"));
        assert_eq!(reloaded.last_session("/ws/a"), Some("/sessions/a.jsonl"));
    }

    #[test]
    fn load_missing_file_returns_default() {
        let st = AppState::load(std::path::Path::new("/nonexistent/app-state.json"));
        assert!(st.recent_workspaces.is_empty());
    }
}
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd tauri-agent/src-tauri; cargo test state::app_state`
预期：编译失败（`AppState` 未定义）。

- [ ] **步骤 3：编写实现 `state/app_state.rs`**

```rust
use std::collections::HashMap;
use std::path::Path;

use anyhow::Result;
use serde::{Deserialize, Serialize};

/// 仅存应用级元数据，会话本身由 pi 管理。
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct AppState {
    #[serde(default)]
    pub recent_workspaces: Vec<String>,
    /// workspace -> 最后活跃会话文件路径
    #[serde(default)]
    pub last_sessions: HashMap<String, String>,
    #[serde(default)]
    pub window: Option<WindowState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowState {
    pub width: f64,
    pub height: f64,
}

impl AppState {
    /// 读取；文件缺失或损坏时返回默认值。
    pub fn load(path: &Path) -> Self {
        std::fs::read_to_string(path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    pub fn save(&self, path: &Path) -> Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(path, serde_json::to_string_pretty(self)?)?;
        Ok(())
    }

    /// 把工作区移到最近列表最前（去重，最多 20 条）。
    pub fn touch_workspace(&mut self, ws: &str) {
        self.recent_workspaces.retain(|w| w != ws);
        self.recent_workspaces.insert(0, ws.to_string());
        self.recent_workspaces.truncate(20);
    }

    pub fn set_last_session(&mut self, ws: &str, session_path: &str) {
        self.last_sessions
            .insert(ws.to_string(), session_path.to_string());
    }

    pub fn last_session(&self, ws: &str) -> Option<&str> {
        self.last_sessions.get(ws).map(|s| s.as_str())
    }
}
```

- [ ] **步骤 4：更新 `state/mod.rs`，删除 SQLite**

```rust
pub mod app_state;

pub use app_state::AppState;
```

删除文件：`src-tauri/src/state/session_manager.rs`。

- [ ] **步骤 5：运行测试验证通过**

运行：`cd tauri-agent/src-tauri; cargo test state::app_state`
预期：2 个测试 PASS。

- [ ] **步骤 6：Commit**

```bash
git -C tauri-agent rm src-tauri/src/state/session_manager.rs
git -C tauri-agent add src-tauri/src/state/app_state.rs src-tauri/src/state/mod.rs
git -C tauri-agent commit -m "feat(state): replace SQLite session store with app-state.json"
```

---

## Phase 3：Tauri 命令层

### 任务 8：workspace 生命周期 + agent 命令

**文件：**
- 重写：`src-tauri/src/commands/agent.rs`
- 修改：`src-tauri/src/commands/mod.rs`
- 删除：`src-tauri/src/commands/chat.rs`

命令通过 `PiManager`（managed state）拿到工作区客户端，再调用 `PiClient::send`。`open_workspace` 用任务 5 的 `spawn_pi_client` 创建。

- [ ] **步骤 1：重写 `commands/agent.rs`**

```rust
use std::sync::Arc;

use serde_json::Value;
use tauri::State;

use crate::pi::sink::{EventSink, TauriSink};
use crate::pi::sidecar::spawn_pi_client;
use crate::pi::types::PiOutbound;
use crate::pi::{PiClient, PiManager};
use crate::state::AppStateStore;

/// 工具：取已打开工作区的 client，未打开则报错。
async fn client_for(mgr: &PiManager, workspace: &str) -> Result<Arc<PiClient>, String> {
    mgr.get(workspace)
        .await
        .ok_or_else(|| format!("workspace not open: {workspace}"))
}

/// 取响应的 data（失败时返回 error 字符串）。
fn data_or_err(resp: crate::pi::types::RpcResponse) -> Result<Value, String> {
    if resp.success {
        Ok(resp.data.unwrap_or(Value::Null))
    } else {
        Err(resp.error.unwrap_or_else(|| "command failed".into()))
    }
}

#[tauri::command]
pub async fn open_workspace(
    workspace: String,
    app: tauri::AppHandle,
    mgr: State<'_, Arc<PiManager>>,
    store: State<'_, AppStateStore>,
) -> Result<(), String> {
    let app2 = app.clone();
    let ws = workspace.clone();
    mgr.get_or_open(&workspace, move || {
        let sink: Arc<dyn EventSink> = Arc::new(TauriSink { app: app2.clone() });
        spawn_pi_client(&app2, ws.clone(), &ws, sink).map_err(|e| anyhow::anyhow!(e))
    })
    .await
    .map_err(|e| e.to_string())?;

    store.update(|st| st.touch_workspace(&workspace)).await;
    Ok(())
}

#[tauri::command]
pub async fn close_workspace(
    workspace: String,
    mgr: State<'_, Arc<PiManager>>,
) -> Result<(), String> {
    mgr.close(&workspace).await;
    Ok(())
}

#[tauri::command]
pub async fn agent_prompt(
    workspace: String,
    message: String,
    images: Option<Vec<Value>>,
    streaming_behavior: Option<String>,
    mgr: State<'_, Arc<PiManager>>,
) -> Result<Value, String> {
    let client = client_for(&mgr, &workspace).await?;
    let resp = client
        .send(PiOutbound::Prompt {
            id: None,
            message,
            images,
            streaming_behavior,
        })
        .await
        .map_err(|e| e.to_string())?;
    data_or_err(resp)
}

#[tauri::command]
pub async fn agent_abort(
    workspace: String,
    mgr: State<'_, Arc<PiManager>>,
) -> Result<Value, String> {
    let client = client_for(&mgr, &workspace).await?;
    let resp = client
        .send(PiOutbound::Abort { id: None })
        .await
        .map_err(|e| e.to_string())?;
    data_or_err(resp)
}

#[tauri::command]
pub async fn agent_set_model(
    workspace: String,
    provider: String,
    model_id: String,
    mgr: State<'_, Arc<PiManager>>,
) -> Result<Value, String> {
    let client = client_for(&mgr, &workspace).await?;
    let resp = client
        .send(PiOutbound::SetModel { id: None, provider, model_id })
        .await
        .map_err(|e| e.to_string())?;
    data_or_err(resp)
}

#[tauri::command]
pub async fn agent_set_thinking_level(
    workspace: String,
    level: String,
    mgr: State<'_, Arc<PiManager>>,
) -> Result<Value, String> {
    let client = client_for(&mgr, &workspace).await?;
    let resp = client
        .send(PiOutbound::SetThinkingLevel { id: None, level })
        .await
        .map_err(|e| e.to_string())?;
    data_or_err(resp)
}

#[tauri::command]
pub async fn agent_get_state(
    workspace: String,
    mgr: State<'_, Arc<PiManager>>,
) -> Result<Value, String> {
    let client = client_for(&mgr, &workspace).await?;
    let resp = client
        .send(PiOutbound::GetState { id: None })
        .await
        .map_err(|e| e.to_string())?;
    data_or_err(resp)
}

#[tauri::command]
pub async fn agent_get_messages(
    workspace: String,
    mgr: State<'_, Arc<PiManager>>,
) -> Result<Value, String> {
    let client = client_for(&mgr, &workspace).await?;
    let resp = client
        .send(PiOutbound::GetMessages { id: None })
        .await
        .map_err(|e| e.to_string())?;
    data_or_err(resp)
}
```

> 其余薄包装命令（`agent_steer`、`agent_follow_up`、`agent_cycle_model`、`agent_get_available_models`、`agent_cycle_thinking_level`、`agent_compact`、`agent_set_auto_compaction`、`agent_abort_retry`、`agent_get_session_stats`、`agent_get_commands`、`agent_new_session`、`agent_switch_session`、`agent_fork`、`agent_clone`、`agent_get_fork_messages`、`agent_set_session_name`）一律照搬上面 `agent_get_state` 的模式：取 `client_for`，`client.send(PiOutbound::对应变体{ id: None, ...参数 })`，`data_or_err(resp)`。每个都要写全，不留 TODO。

实现示例（逐一写出，勿省略）——以 `agent_steer` 与 `agent_switch_session` 为模板：

```rust
#[tauri::command]
pub async fn agent_steer(
    workspace: String,
    message: String,
    mgr: State<'_, Arc<PiManager>>,
) -> Result<Value, String> {
    let client = client_for(&mgr, &workspace).await?;
    let resp = client
        .send(PiOutbound::Steer { id: None, message })
        .await
        .map_err(|e| e.to_string())?;
    data_or_err(resp)
}

#[tauri::command]
pub async fn agent_switch_session(
    workspace: String,
    session_path: String,
    mgr: State<'_, Arc<PiManager>>,
    store: State<'_, AppStateStore>,
) -> Result<Value, String> {
    let client = client_for(&mgr, &workspace).await?;
    let resp = client
        .send(PiOutbound::SwitchSession { id: None, session_path: session_path.clone() })
        .await
        .map_err(|e| e.to_string())?;
    let data = data_or_err(resp)?;
    store
        .update(|st| st.set_last_session(&workspace, &session_path))
        .await;
    Ok(data)
}
```

- [ ] **步骤 2：更新 `commands/mod.rs`**

```rust
use serde::{Deserialize, Serialize};

pub mod agent;
pub mod files;
pub mod git;
pub mod sessions;
pub mod terminal;

pub use agent::*;
pub use files::*;
pub use git::*;
pub use sessions::*;
pub use terminal::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        Self { success: true, data: Some(data), error: None }
    }
    pub fn err(error: String) -> Self {
        Self { success: false, data: None, error: Some(error) }
    }
}
```

删除文件：`src-tauri/src/commands/chat.rs`。

> `files.rs`/`git.rs`/`terminal.rs` 引用了被删的 `crate::state::AppState`（旧 SQLite 版）。它们的命令本轮不接线（从 `invoke_handler` 移除），但要让它们能编译：把其中对 `State<'_, Arc<Mutex<AppState>>>` 的参数改为不依赖 state（mock 实现不需要 state），或直接给函数体保留 mock、删掉 state 参数。本步骤把这三个文件的 `state` 参数删除即可（它们都没真正用到 state）。

- [ ] **步骤 3：Commit**

```bash
git -C tauri-agent rm src-tauri/src/commands/chat.rs
git -C tauri-agent add src-tauri/src/commands/agent.rs src-tauri/src/commands/mod.rs src-tauri/src/commands/files.rs src-tauri/src/commands/git.rs src-tauri/src/commands/terminal.rs
git -C tauri-agent commit -m "feat(commands): pi-backed agent commands, drop mock and chat module"
```

### 任务 9：会话列表 + 权限回传

**文件：**
- 创建：`src-tauri/src/commands/sessions.rs`
- 创建：`src-tauri/src/state/store.rs`（`AppStateStore`：带锁的 AppState + 路径）
- 测试：`src-tauri/src/commands/sessions.rs`（`#[cfg(test)]` 内联，测 header 解析）

- [ ] **步骤 1：编写 `state/store.rs`**

```rust
use std::path::PathBuf;
use std::sync::Arc;

use tokio::sync::Mutex;

use crate::state::AppState;

/// 线程安全的 AppState 持有者 + 持久化路径。作为 Tauri managed state。
#[derive(Clone)]
pub struct AppStateStore {
    inner: Arc<Mutex<AppState>>,
    path: PathBuf,
}

impl AppStateStore {
    pub fn new(path: PathBuf) -> Self {
        let state = AppState::load(&path);
        Self { inner: Arc::new(Mutex::new(state)), path }
    }

    /// 修改并立即持久化（错误打印，不致命）。
    pub async fn update<F: FnOnce(&mut AppState)>(&self, f: F) {
        let mut guard = self.inner.lock().await;
        f(&mut guard);
        if let Err(e) = guard.save(&self.path) {
            eprintln!("[app-state] save failed: {e}");
        }
    }

    pub async fn snapshot(&self) -> AppState {
        self.inner.lock().await.clone()
    }
}
```

在 `state/mod.rs` 增 `pub mod store; pub use store::AppStateStore;`。

- [ ] **步骤 2：编写失败的测试（session header 解析）**

在 `sessions.rs`：

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_session_header_first_line() {
        let jsonl = "{\"type\":\"session\",\"version\":3,\"id\":\"abc\",\"cwd\":\"/ws/a\",\"timestamp\":\"2026-06-10T00:00:00Z\"}\n{\"type\":\"message_start\"}\n";
        let info = parse_session_header(jsonl, "/tmp/abc.jsonl").unwrap();
        assert_eq!(info.id, "abc");
        assert_eq!(info.cwd.as_deref(), Some("/ws/a"));
        assert_eq!(info.path, "/tmp/abc.jsonl");
    }

    #[test]
    fn returns_none_for_non_session_first_line() {
        assert!(parse_session_header("{\"type\":\"message_start\"}\n", "/x").is_none());
        assert!(parse_session_header("", "/x").is_none());
    }
}
```

- [ ] **步骤 3：运行测试验证失败**

运行：`cd tauri-agent/src-tauri; cargo test commands::sessions`
预期：编译失败（`parse_session_header` 未定义）。

- [ ] **步骤 4：编写实现 `commands/sessions.rs`**

```rust
use std::sync::Arc;

use serde::Serialize;
use serde_json::Value;
use tauri::State;

use crate::pi::PiManager;

#[derive(Debug, Clone, Serialize)]
pub struct SessionInfo {
    pub id: String,
    pub path: String,
    pub cwd: Option<String>,
    pub timestamp: Option<String>,
    pub name: Option<String>,
}

/// 从一个 jsonl 文件内容解析会话 header（首行）。
pub fn parse_session_header(contents: &str, path: &str) -> Option<SessionInfo> {
    let first = contents.lines().next()?;
    let v: Value = serde_json::from_str(first.trim_end_matches('\r')).ok()?;
    if v.get("type").and_then(|t| t.as_str()) != Some("session") {
        return None;
    }
    Some(SessionInfo {
        id: v.get("id").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        path: path.to_string(),
        cwd: v.get("cwd").and_then(|x| x.as_str()).map(str::to_string),
        timestamp: v.get("timestamp").and_then(|x| x.as_str()).map(str::to_string),
        name: v.get("name").and_then(|x| x.as_str()).map(str::to_string),
    })
}

/// pi 默认会话目录：~/.pi/agent/sessions
fn sessions_dir() -> Option<std::path::PathBuf> {
    dirs::home_dir().map(|h| h.join(".pi").join("agent").join("sessions"))
}

/// 列出某工作区（cwd）的会话，按 timestamp 倒序。
#[tauri::command]
pub async fn list_pi_sessions(workspace: String) -> Result<Vec<SessionInfo>, String> {
    let dir = match sessions_dir() {
        Some(d) => d,
        None => return Ok(vec![]),
    };
    let mut out = Vec::new();
    let entries = match std::fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return Ok(vec![]), // 目录不存在 = 无会话
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
            continue;
        }
        // 仅读首行，避免读大文件
        if let Ok(contents) = read_first_line(&path) {
            if let Some(info) = parse_session_header(&contents, &path.to_string_lossy()) {
                if info.cwd.as_deref() == Some(workspace.as_str()) {
                    out.push(info);
                }
            }
        }
    }
    out.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(out)
}

fn read_first_line(path: &std::path::Path) -> std::io::Result<String> {
    use std::io::{BufRead, BufReader};
    let file = std::fs::File::open(path)?;
    let mut reader = BufReader::new(file);
    let mut line = String::new();
    reader.read_line(&mut line)?;
    Ok(line)
}

/// 回传 extension UI 响应到 pi（前端在用户操作弹窗后调用）。
#[tauri::command]
pub async fn extension_ui_respond(
    workspace: String,
    response: Value,
    mgr: State<'_, Arc<PiManager>>,
) -> Result<(), String> {
    let client = mgr
        .get(&workspace)
        .await
        .ok_or_else(|| format!("workspace not open: {workspace}"))?;
    client.respond_ui(response).await.map_err(|e| e.to_string())
}
```

> `response` 由前端构造为完整的 `{"type":"extension_ui_response","id":...,"value"|"confirmed"|"cancelled":...}` 对象，后端原样转发。

- [ ] **步骤 5：运行测试验证通过**

运行：`cd tauri-agent/src-tauri; cargo test commands::sessions`
预期：2 个测试 PASS。

- [ ] **步骤 6：Commit**

```bash
git -C tauri-agent add src-tauri/src/commands/sessions.rs src-tauri/src/state/store.rs src-tauri/src/state/mod.rs
git -C tauri-agent commit -m "feat(commands): session listing from jsonl headers + extension UI respond"
```

### 任务 10：lib.rs 接线

**文件：**
- 修改：`src-tauri/src/lib.rs`

- [ ] **步骤 1：重写 `lib.rs`**

```rust
mod commands;
mod pi;
mod state;

use std::sync::Arc;

use tauri::Manager;

use pi::PiManager;
use state::AppStateStore;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_handle = app.handle();
            let app_data_dir = app_handle
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");
            std::fs::create_dir_all(&app_data_dir).ok();

            let store = AppStateStore::new(app_data_dir.join("app-state.json"));
            app_handle.manage(store);
            app_handle.manage(Arc::new(PiManager::new()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // workspace 生命周期
            commands::open_workspace,
            commands::close_workspace,
            // 提问/控制
            commands::agent_prompt,
            commands::agent_steer,
            commands::agent_follow_up,
            commands::agent_abort,
            // 模型/思考
            commands::agent_set_model,
            commands::agent_cycle_model,
            commands::agent_get_available_models,
            commands::agent_set_thinking_level,
            commands::agent_cycle_thinking_level,
            // 上下文/重试
            commands::agent_compact,
            commands::agent_set_auto_compaction,
            commands::agent_abort_retry,
            commands::agent_get_session_stats,
            // 状态
            commands::agent_get_state,
            commands::agent_get_messages,
            commands::agent_get_commands,
            // 会话
            commands::agent_new_session,
            commands::agent_switch_session,
            commands::agent_fork,
            commands::agent_clone,
            commands::agent_get_fork_messages,
            commands::agent_set_session_name,
            commands::list_pi_sessions,
            commands::extension_ui_respond,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

> 注意：`files.rs`/`git.rs`/`terminal.rs` 的命令本轮**不注册**（其面板功能后续轮次再设计）。文件保留以便后续接线。

- [ ] **步骤 2：编译验证**

运行：`cd tauri-agent/src-tauri; cargo build`
预期：通过。若报某 `agent_*` 命令未定义，回任务 8 补齐对应薄包装命令。

- [ ] **步骤 3：全量测试**

运行：`cd tauri-agent/src-tauri; cargo test`
预期：全部 PASS（types/framing/client/manager/app_state/sessions）。

- [ ] **步骤 4：Commit**

```bash
git -C tauri-agent add src-tauri/src/lib.rs
git -C tauri-agent commit -m "feat: wire shell plugin, PiManager, AppStateStore and agent commands"
```

---

## Phase 4：前端

### 任务 11：事件类型与归约 store（纯逻辑 + Vitest）

**文件：**
- 创建：`src/lib/pi.ts`
- 创建：`src/stores/agentReducer.ts`（纯归约函数，便于单测）
- 创建：`src/stores/agent.ts`（SolidJS store，封装 reducer + 事件订阅）
- 测试：`src/stores/agentReducer.test.ts`

- [ ] **步骤 1：编写 `src/lib/pi.ts`（invoke 包装 + 事件类型）**

```typescript
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface PiEventEnvelope {
  workspace: string;
  event: AgentEvent;
}
export interface PiUiRequestEnvelope {
  workspace: string;
  request: ExtensionUiRequest;
}
export interface PiExitEnvelope {
  workspace: string;
  code: number | null;
}

// 与 pi RPC 事件对齐（见 rpc.md）。只声明前端要消费的字段。
export type AgentEvent =
  | { type: 'agent_start' }
  | { type: 'agent_end'; messages: AgentMessage[] }
  | { type: 'turn_start' }
  | { type: 'turn_end'; message: AgentMessage; toolResults: unknown[] }
  | { type: 'message_start'; message: AgentMessage }
  | { type: 'message_update'; message: AgentMessage; assistantMessageEvent: AssistantMessageEvent }
  | { type: 'message_end'; message: AgentMessage }
  | { type: 'tool_execution_start'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool_execution_update'; toolCallId: string; toolName: string; partialResult: unknown }
  | { type: 'tool_execution_end'; toolCallId: string; toolName: string; result: unknown; isError: boolean }
  | { type: 'queue_update'; steering: string[]; followUp: string[] }
  | { type: 'compaction_start'; reason: string }
  | { type: 'compaction_end'; reason: string; aborted: boolean; willRetry: boolean; errorMessage?: string }
  | { type: 'auto_retry_start'; attempt: number; maxAttempts: number; delayMs: number; errorMessage: string }
  | { type: 'auto_retry_end'; success: boolean; attempt: number; finalError?: string }
  | { type: 'extension_error'; error: string }
  | { type: string; [k: string]: unknown };

export interface AgentMessage {
  role: 'user' | 'assistant' | 'toolResult' | string;
  content: unknown;
  [k: string]: unknown;
}
export type AssistantMessageEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'thinking_delta'; delta: string }
  | { type: string; [k: string]: unknown };

export interface ExtensionUiRequest {
  id: string;
  method: 'select' | 'confirm' | 'input' | 'editor' | 'notify' | 'setStatus' | 'setWidget' | 'setTitle' | 'set_editor_text' | string;
  title?: string;
  message?: string;
  options?: string[];
  placeholder?: string;
  prefill?: string;
  [k: string]: unknown;
}

// ---- 命令包装 ----
export const pi = {
  openWorkspace: (workspace: string) => invoke<void>('open_workspace', { workspace }),
  closeWorkspace: (workspace: string) => invoke<void>('close_workspace', { workspace }),
  prompt: (workspace: string, message: string, streamingBehavior?: 'steer' | 'followUp') =>
    invoke<unknown>('agent_prompt', { workspace, message, streamingBehavior }),
  abort: (workspace: string) => invoke<unknown>('agent_abort', { workspace }),
  setModel: (workspace: string, provider: string, modelId: string) =>
    invoke<unknown>('agent_set_model', { workspace, provider, modelId }),
  cycleModel: (workspace: string) => invoke<unknown>('agent_cycle_model', { workspace }),
  getAvailableModels: (workspace: string) => invoke<unknown>('agent_get_available_models', { workspace }),
  setThinkingLevel: (workspace: string, level: string) =>
    invoke<unknown>('agent_set_thinking_level', { workspace, level }),
  compact: (workspace: string) => invoke<unknown>('agent_compact', { workspace }),
  getState: (workspace: string) => invoke<unknown>('agent_get_state', { workspace }),
  getMessages: (workspace: string) => invoke<{ messages: AgentMessage[] }>('agent_get_messages', { workspace }),
  newSession: (workspace: string) => invoke<unknown>('agent_new_session', { workspace }),
  switchSession: (workspace: string, sessionPath: string) =>
    invoke<unknown>('agent_switch_session', { workspace, sessionPath }),
  listSessions: (workspace: string) => invoke<SessionInfo[]>('list_pi_sessions', { workspace }),
  respondUi: (workspace: string, response: Record<string, unknown>) =>
    invoke<void>('extension_ui_respond', { workspace, response }),
};

export interface SessionInfo {
  id: string;
  path: string;
  cwd: string | null;
  timestamp: string | null;
  name: string | null;
}

export function onPiEvent(handler: (e: PiEventEnvelope) => void): Promise<UnlistenFn> {
  return listen<PiEventEnvelope>('pi://event', (e) => handler(e.payload));
}
export function onPiUiRequest(handler: (e: PiUiRequestEnvelope) => void): Promise<UnlistenFn> {
  return listen<PiUiRequestEnvelope>('pi://ui-request', (e) => handler(e.payload));
}
export function onPiExit(handler: (e: PiExitEnvelope) => void): Promise<UnlistenFn> {
  return listen<PiExitEnvelope>('pi://exit', (e) => handler(e.payload));
}
```

- [ ] **步骤 2：编写失败的测试 `src/stores/agentReducer.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { initialAgentState, applyEvent, type ChatMessage } from './agentReducer';
import type { AgentEvent } from '../lib/pi';

function text(msg: ChatMessage): string {
  return msg.kind === 'assistant' || msg.kind === 'user' ? msg.text : '';
}

describe('applyEvent', () => {
  it('starts streaming assistant message on message_start', () => {
    let s = initialAgentState();
    s = applyEvent(s, { type: 'agent_start' } as AgentEvent);
    expect(s.isStreaming).toBe(true);
    s = applyEvent(s, {
      type: 'message_start',
      message: { role: 'assistant', content: [] },
    } as AgentEvent);
    expect(s.messages.at(-1)?.kind).toBe('assistant');
  });

  it('replaces streaming text from message_update snapshot deltas', () => {
    let s = initialAgentState();
    s = applyEvent(s, { type: 'message_start', message: { role: 'assistant', content: [] } } as AgentEvent);
    s = applyEvent(s, {
      type: 'message_update',
      message: { role: 'assistant', content: [{ type: 'text', text: 'Hello' }] },
      assistantMessageEvent: { type: 'text_delta', delta: 'Hello' },
    } as AgentEvent);
    expect(text(s.messages.at(-1)!)).toBe('Hello');
  });

  it('finalizes on agent_end and clears streaming', () => {
    let s = initialAgentState();
    s = applyEvent(s, { type: 'agent_start' } as AgentEvent);
    s = applyEvent(s, { type: 'agent_end', messages: [] } as AgentEvent);
    expect(s.isStreaming).toBe(false);
  });

  it('tracks tool calls by toolCallId', () => {
    let s = initialAgentState();
    s = applyEvent(s, {
      type: 'tool_execution_start', toolCallId: 'c1', toolName: 'bash', args: { command: 'ls' },
    } as AgentEvent);
    s = applyEvent(s, {
      type: 'tool_execution_end', toolCallId: 'c1', toolName: 'bash', result: { content: [] }, isError: false,
    } as AgentEvent);
    const tool = s.messages.find((m) => m.kind === 'tool' && m.toolCallId === 'c1');
    expect(tool && tool.kind === 'tool' ? tool.status : '').toBe('done');
  });
});
```

- [ ] **步骤 3：运行测试验证失败**

运行：`cd tauri-agent; pnpm test`
预期：FAIL（`agentReducer` 未定义）。

- [ ] **步骤 4：编写实现 `src/stores/agentReducer.ts`**

```typescript
import type { AgentEvent, AgentMessage, AssistantMessageEvent } from '../lib/pi';

export type ChatMessage =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'assistant'; id: string; text: string; thinking: string; streaming: boolean }
  | { kind: 'tool'; id: string; toolCallId: string; toolName: string; args: unknown; result: unknown; status: 'running' | 'done' | 'error' };

export interface AgentState {
  messages: ChatMessage[];
  isStreaming: boolean;
  steering: string[];
  followUp: string[];
  lastError?: string;
}

export function initialAgentState(): AgentState {
  return { messages: [], isStreaming: false, steering: [], followUp: [] };
}

let counter = 0;
const nextId = () => `m${++counter}`;

/** 从 pi 的 AgentMessage 快照里抽出可见文本/思考。 */
function extractText(msg: AgentMessage): { text: string; thinking: string } {
  let text = '';
  let thinking = '';
  const content = msg.content;
  if (typeof content === 'string') {
    text = content;
  } else if (Array.isArray(content)) {
    for (const block of content as Array<Record<string, unknown>>) {
      if (block.type === 'text' && typeof block.text === 'string') text += block.text;
      if (block.type === 'thinking' && typeof block.thinking === 'string') thinking += block.thinking;
    }
  }
  return { text, thinking };
}

/** 不可变归约：返回新 state。 */
export function applyEvent(state: AgentState, event: AgentEvent): AgentState {
  switch (event.type) {
    case 'agent_start':
      return { ...state, isStreaming: true, lastError: undefined };

    case 'agent_end':
      return {
        ...state,
        isStreaming: false,
        messages: state.messages.map((m) =>
          m.kind === 'assistant' ? { ...m, streaming: false } : m,
        ),
      };

    case 'message_start': {
      if (event.message.role !== 'assistant') return state;
      const msg: ChatMessage = { kind: 'assistant', id: nextId(), text: '', thinking: '', streaming: true };
      return { ...state, messages: [...state.messages, msg] };
    }

    case 'message_update': {
      const { text, thinking } = extractText(event.message);
      const messages = [...state.messages];
      // 更新最后一个 streaming 的 assistant 消息（若无则新建）
      const idx = lastIndex(messages, (m) => m.kind === 'assistant' && m.streaming);
      if (idx >= 0) {
        const cur = messages[idx] as Extract<ChatMessage, { kind: 'assistant' }>;
        messages[idx] = { ...cur, text, thinking };
      } else {
        messages.push({ kind: 'assistant', id: nextId(), text, thinking, streaming: true });
      }
      void (event.assistantMessageEvent as AssistantMessageEvent); // delta 仅作信号，渲染用快照
      return { ...state, messages };
    }

    case 'tool_execution_start':
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            kind: 'tool',
            id: nextId(),
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: event.args,
            result: undefined,
            status: 'running',
          },
        ],
      };

    case 'tool_execution_update':
      return updateTool(state, event.toolCallId, (t) => ({ ...t, result: event.partialResult }));

    case 'tool_execution_end':
      return updateTool(state, event.toolCallId, (t) => ({
        ...t,
        result: event.result,
        status: event.isError ? 'error' : 'done',
      }));

    case 'queue_update':
      return { ...state, steering: event.steering ?? [], followUp: event.followUp ?? [] };

    case 'auto_retry_end':
      return event.success ? state : { ...state, lastError: event.finalError };

    case 'extension_error':
      return { ...state, lastError: event.error };

    default:
      return state;
  }
}

function lastIndex(arr: ChatMessage[], pred: (m: ChatMessage) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i])) return i;
  return -1;
}

function updateTool(
  state: AgentState,
  toolCallId: string,
  fn: (t: Extract<ChatMessage, { kind: 'tool' }>) => Extract<ChatMessage, { kind: 'tool' }>,
): AgentState {
  return {
    ...state,
    messages: state.messages.map((m) =>
      m.kind === 'tool' && m.toolCallId === toolCallId ? fn(m) : m,
    ),
  };
}
```

- [ ] **步骤 5：运行测试验证通过**

运行：`cd tauri-agent; pnpm test`
预期：4 个测试 PASS。

- [ ] **步骤 6：编写 `src/stores/agent.ts`（SolidJS 封装）**

```typescript
import { createStore } from 'solid-js/store';
import { onCleanup } from 'solid-js';
import { applyEvent, initialAgentState, type AgentState } from './agentReducer';
import { onPiEvent } from '../lib/pi';

/** 为某工作区创建响应式 agent 状态，并订阅 pi://event。 */
export function createAgentStore(workspace: () => string) {
  const [state, setState] = createStore<AgentState>(initialAgentState());

  const unlistenP = onPiEvent((env) => {
    if (env.workspace !== workspace()) return;
    setState(applyEvent({ ...state, messages: [...state.messages] }, env.event));
  });

  onCleanup(() => {
    unlistenP.then((un) => un());
  });

  return { state, reset: () => setState(initialAgentState()) };
}
```

- [ ] **步骤 7：Commit**

```bash
git -C tauri-agent add src/lib/pi.ts src/stores/agentReducer.ts src/stores/agentReducer.test.ts src/stores/agent.ts
git -C tauri-agent commit -m "feat(ui): pi event types, reducer (tested) and agent store"
```

### 任务 12：ChatView 重写

**文件：**
- 重写：`src/components/chat/ChatView.tsx`

- [ ] **步骤 1：重写 `ChatView.tsx`**

```tsx
import { Component, createSignal, For, Show, onMount } from 'solid-js';
import { pi } from '../../lib/pi';
import { createAgentStore } from '../../stores/agent';
import './ChatView.css';

interface ChatViewProps {
  workspace: string;
}

const ChatView: Component<ChatViewProps> = (props) => {
  const { state } = createAgentStore(() => props.workspace);
  const [input, setInput] = createSignal('');

  onMount(() => {
    void pi.openWorkspace(props.workspace);
  });

  const send = async () => {
    const text = input().trim();
    if (!text) return;
    setInput('');
    // 流式中用 steer 排队，否则普通 prompt
    await pi.prompt(props.workspace, text, state.isStreaming ? 'steer' : undefined);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div class="chat-view">
      <div class="messages-container">
        <For each={state.messages}>
          {(m) => (
            <Show when={m.kind !== 'tool'} fallback={<ToolCard tool={m as any} />}>
              <div class={`message message-${m.kind}`}>
                <div class="message-role">{m.kind === 'user' ? 'You' : 'Assistant'}</div>
                <Show when={(m as any).thinking}>
                  <div class="message-thinking">{(m as any).thinking}</div>
                </Show>
                <div class="message-content">{(m as any).text}</div>
              </div>
            </Show>
          )}
        </For>
        <Show when={state.messages.length === 0}>
          <div class="welcome-message">
            <h2>Pi Desktop Agent</h2>
            <p>开始对话，或在左侧选择历史会话。</p>
          </div>
        </Show>
      </div>

      <Show when={state.lastError}>
        <div class="error-banner">{state.lastError}</div>
      </Show>

      <div class="input-container">
        <textarea
          class="message-input"
          placeholder="输入消息…（Enter 发送，Shift+Enter 换行）"
          value={input()}
          onInput={(e) => setInput(e.currentTarget.value)}
          onKeyDown={onKey}
          rows={3}
        />
        <Show
          when={state.isStreaming}
          fallback={
            <button class="send-button" onClick={send} disabled={!input().trim()}>
              发送
            </button>
          }
        >
          <button class="send-button stop" onClick={() => pi.abort(props.workspace)}>
            停止
          </button>
        </Show>
      </div>
    </div>
  );
};

const ToolCard: Component<{ tool: { toolName: string; args: unknown; status: string; result: unknown } }> = (p) => (
  <div class={`tool-card tool-${p.tool.status}`}>
    <div class="tool-header">🔧 {p.tool.toolName} <span class="tool-status">{p.tool.status}</span></div>
    <pre class="tool-args">{JSON.stringify(p.tool.args, null, 2)}</pre>
  </div>
);

export default ChatView;
```

- [ ] **步骤 2：更新 `App.tsx` 传入 workspace**

`App.tsx` 中 `<ChatView />` 改为 `<ChatView workspace={workspace()} />`，并在顶部加一个工作区状态（占位：先用一个 `createSignal` 默认空字符串或当前目录；选择目录的 UI 后续轮次再做）。最小改动：

```tsx
const [workspace] = createSignal('.'); // 后续替换为目录选择器
// ...
<ChatView workspace={workspace()} />
```

> `.` 让 pi sidecar 以应用启动目录为 cwd 运行，足够本轮端到端验证。

- [ ] **步骤 3：开发态冒烟（需任务 14 的 sidecar 就绪后再做，先占位编译）**

运行：`cd tauri-agent; pnpm build`
预期：TS 编译通过（`tsc && vite build`）。

- [ ] **步骤 4：Commit**

```bash
git -C tauri-agent add src/components/chat/ChatView.tsx src/App.tsx
git -C tauri-agent commit -m "feat(ui): rewrite ChatView to use pi events and commands"
```

### 任务 13：权限弹窗与模型控件

**文件：**
- 创建：`src/components/dialogs/ExtensionUiDialog.tsx`
- 创建：`src/components/controls/ModelControls.tsx`
- 修改：`src/App.tsx`（挂载弹窗与控件）

- [ ] **步骤 1：编写 `ExtensionUiDialog.tsx`**

```tsx
import { Component, createSignal, For, Show, onMount, onCleanup } from 'solid-js';
import { onPiUiRequest, pi, type ExtensionUiRequest } from '../../lib/pi';

const DIALOG_METHODS = ['select', 'confirm', 'input', 'editor'];

const ExtensionUiDialog: Component<{ workspace: string }> = (props) => {
  const [req, setReq] = createSignal<ExtensionUiRequest | null>(null);
  const [value, setValue] = createSignal('');

  onMount(() => {
    const p = onPiUiRequest((env) => {
      if (env.workspace !== props.workspace) return;
      if (DIALOG_METHODS.includes(env.request.method)) {
        setReq(env.request);
        setValue(env.request.prefill ?? '');
      }
      // 即发类（notify/setStatus/…）此处忽略或交由状态栏组件处理
    });
    onCleanup(() => p.then((un) => un()));
  });

  const respond = (response: Record<string, unknown>) => {
    const r = req();
    if (!r) return;
    void pi.respondUi(props.workspace, { type: 'extension_ui_response', id: r.id, ...response });
    setReq(null);
  };

  return (
    <Show when={req()}>
      {(r) => (
        <div class="dialog-overlay">
          <div class="dialog">
            <h3>{r().title ?? '请确认'}</h3>
            <Show when={r().message}><p>{r().message}</p></Show>

            <Show when={r().method === 'confirm'}>
              <div class="dialog-actions">
                <button onClick={() => respond({ confirmed: true })}>确认</button>
                <button onClick={() => respond({ confirmed: false })}>取消</button>
              </div>
            </Show>

            <Show when={r().method === 'select'}>
              <div class="dialog-actions">
                <For each={r().options ?? []}>
                  {(opt) => <button onClick={() => respond({ value: opt })}>{opt}</button>}
                </For>
                <button onClick={() => respond({ cancelled: true })}>取消</button>
              </div>
            </Show>

            <Show when={r().method === 'input' || r().method === 'editor'}>
              <textarea
                value={value()}
                placeholder={r().placeholder ?? ''}
                onInput={(e) => setValue(e.currentTarget.value)}
                rows={r().method === 'editor' ? 8 : 1}
              />
              <div class="dialog-actions">
                <button onClick={() => respond({ value: value() })}>确定</button>
                <button onClick={() => respond({ cancelled: true })}>取消</button>
              </div>
            </Show>
          </div>
        </div>
      )}
    </Show>
  );
};

export default ExtensionUiDialog;
```

- [ ] **步骤 2：编写 `ModelControls.tsx`**

```tsx
import { Component, createSignal, onMount } from 'solid-js';
import { pi } from '../../lib/pi';

const LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'];

const ModelControls: Component<{ workspace: string }> = (props) => {
  const [modelName, setModelName] = createSignal('—');

  onMount(async () => {
    try {
      const state = (await pi.getState(props.workspace)) as { model?: { name?: string } };
      if (state?.model?.name) setModelName(state.model.name);
    } catch { /* 工作区未就绪时忽略 */ }
  });

  const cycle = async () => {
    const res = (await pi.cycleModel(props.workspace)) as { model?: { name?: string } } | null;
    if (res?.model?.name) setModelName(res.model.name);
  };

  return (
    <div class="model-controls">
      <button class="model-button" onClick={cycle} title="切换模型">{modelName()}</button>
      <select onChange={(e) => pi.setThinkingLevel(props.workspace, e.currentTarget.value)}>
        {LEVELS.map((l) => <option value={l}>{l}</option>)}
      </select>
      <button onClick={() => pi.compact(props.workspace)} title="压缩上下文">压缩</button>
    </div>
  );
};

export default ModelControls;
```

- [ ] **步骤 3：在 `App.tsx` 挂载**

在三栏布局中：context 面板顶部放 `<ModelControls workspace={workspace()} />`；根容器末尾挂 `<ExtensionUiDialog workspace={workspace()} />`。

- [ ] **步骤 4：编译验证**

运行：`cd tauri-agent; pnpm build`
预期：TS 编译通过。

- [ ] **步骤 5：Commit**

```bash
git -C tauri-agent add src/components/dialogs/ExtensionUiDialog.tsx src/components/controls/ModelControls.tsx src/App.tsx
git -C tauri-agent commit -m "feat(ui): extension UI permission dialog and model/thinking controls"
```

---

## Phase 5：打包与端到端

### 任务 14：Sidecar 二进制打包

**文件：**
- 创建：`scripts/build-sidecar.mjs`
- 修改：`src-tauri/tauri.conf.json`
- 创建/修改：`src-tauri/capabilities/default.json`
- 修改：`src-tauri/.gitignore`
- 修改：`package.json`（scripts）

- [ ] **步骤 1：编写 `scripts/build-sidecar.mjs`**

把 pi 编译为独立二进制并按 Tauri target triple 命名放入 `src-tauri/binaries/`。

```javascript
// 用法：node scripts/build-sidecar.mjs
// 前置：已安装 bun；pi monorepo 位于 ../pi（相对本应用根）
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const appRoot = resolve(import.meta.dirname, '..');         // tauri-agent/
const piRoot = resolve(appRoot, '..', 'pi', 'packages', 'coding-agent');
const binDir = join(appRoot, 'src-tauri', 'binaries');
mkdirSync(binDir, { recursive: true });

// 1) 编译 pi 独立二进制（产物 pi/packages/coding-agent/dist/pi[.exe]）
console.log('Building pi binary via bun…');
execSync('npm run build:binary', { cwd: piRoot, stdio: 'inherit' });

// 2) 取 rustc host target triple
const hostLine = execSync('rustc -Vv').toString().split('\n').find((l) => l.startsWith('host:'));
const triple = hostLine.split('host:')[1].trim();
const isWin = triple.includes('windows');

const src = join(piRoot, 'dist', isWin ? 'pi.exe' : 'pi');
const dest = join(binDir, `pi-${triple}${isWin ? '.exe' : ''}`);
if (!existsSync(src)) throw new Error(`pi binary not found at ${src}`);
copyFileSync(src, dest);
console.log(`Sidecar ready: ${dest}`);
```

> 若 `bun build --compile` 在 Windows 产出无扩展名文件，按实际产物名调整 `src`。

- [ ] **步骤 2：`tauri.conf.json` 增 externalBin 与 shell 插件配置**

在 `bundle` 增 `"externalBin": ["binaries/pi"]`；在顶层增 `plugins`：

```json
{
  "bundle": {
    "active": true,
    "targets": "all",
    "externalBin": ["binaries/pi"],
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.icns", "icons/icon.ico"]
  },
  "plugins": {}
}
```

> Tauri 按 `binaries/pi` + 当前 target triple 解析实际文件（如 `binaries/pi-x86_64-pc-windows-msvc.exe`）。

- [ ] **步骤 3：`capabilities/default.json` 增 sidecar 执行权限**

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "default capabilities",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    "shell:allow-execute",
    {
      "identifier": "shell:allow-spawn",
      "allow": [{ "name": "binaries/pi", "sidecar": true, "args": ["--mode", "rpc"] }]
    }
  ]
}
```

> 权限标识符与 args 校验以 `tauri-plugin-shell` 2.x schema 为准；若 `shell:allow-spawn` 形态不同，按 `cargo tauri` 报错与 schema 调整。窗口标签 `main` 需与 `tauri.conf.json` 窗口 label 一致（默认窗口 label 为 `main`）。

- [ ] **步骤 4：`.gitignore` 忽略二进制产物**

在 `src-tauri/.gitignore` 增：

```
/binaries/
```

- [ ] **步骤 5：`package.json` 增脚本**

```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "tauri": "tauri",
  "test": "vitest --run",
  "build:sidecar": "node scripts/build-sidecar.mjs"
}
```

- [ ] **步骤 6：生成 sidecar 并验证存在**

运行：`cd tauri-agent; pnpm build:sidecar`
预期：`src-tauri/binaries/pi-<triple>[.exe]` 生成。

- [ ] **步骤 7：Commit**

```bash
git -C tauri-agent add scripts/build-sidecar.mjs src-tauri/tauri.conf.json src-tauri/capabilities/default.json src-tauri/.gitignore package.json
git -C tauri-agent commit -m "build: package pi as Tauri sidecar (bun-compiled binary)"
```

### 任务 15：端到端冒烟验证

**文件：** 无（手动验证 + 修复）

- [ ] **步骤 1：准备凭据**

确保 `~/.pi/agent/auth.json` 已配置可用模型的 API key，或设置环境变量（如 `ANTHROPIC_API_KEY`）。pi sidecar 会复用 pi 的凭据解析。

- [ ] **步骤 2：启动应用**

运行：`cd tauri-agent; pnpm tauri dev`
预期：窗口打开，三栏布局；无控制台报错。

- [ ] **步骤 3：发一条消息，验证真实流式**

在输入框发送「列出当前目录的文件」。
预期：
- 出现 assistant 流式文本；
- 若触发 `read`/`bash`/`ls` 工具，出现工具卡片（running → done）；
- 完成后「停止」按钮恢复为「发送」。

- [ ] **步骤 4：验证权限弹窗**

发送会触发危险命令的提示（如「删除某文件」），若 pi 扩展请求确认，应弹出确认框；点「确认/取消」后 pi 继续/中止。

- [ ] **步骤 5：验证模型切换与压缩**

点 context 面板的模型按钮循环模型、改思考级别、点压缩；预期无报错且 `get_state` 反映变化。

- [ ] **步骤 6：验证会话列表**

在左侧用 `list_pi_sessions` 渲染会话（若 UI 未接，先在控制台 `invoke('list_pi_sessions', { workspace: '.' })` 验证返回非空），选中后 `switch_session` + `get_messages` 能加载历史。

- [ ] **步骤 7：记录并修复偏差**

把发现的 API 形态偏差（CommandEvent 字段、shell 权限标识、bun 产物名等）就地修复并补 commit。

- [ ] **步骤 8：Commit（如有修复）**

```bash
git -C tauri-agent add -A
git -C tauri-agent commit -m "fix: address end-to-end integration issues"
```

---

## 自检

> 编写计划后以全新视角对照规格检查（写计划者已执行，以下为结论）。

**1. 规格覆盖度（规格 8 节逐项对应）：**
- §1 Rust 组件边界 → 任务 1–7（types/framing/transport/sink/client/sidecar/manager）✅
- §2 命令面 → 任务 8、10（agent 命令全集 + 注册）✅
- §3 事件桥 → 任务 5（stdout 循环 emit）、11（前端订阅 + reducer）、13（UI 请求弹窗）✅
- §4 会话与状态归属 → 任务 7（app-state.json）、9（list_pi_sessions/switch）✅
- §5 错误处理与生命周期 → 任务 4（malformed 跳过、pending 拒绝）、5（Terminated→handle_exit）、6（close_all）✅；应用退出 close_all 在任务 10 的 setup 可加 `on_window_event` 调用（见下「补充」）。
- §6 Sidecar 打包 → 任务 14 ✅
- §7 代码整理 → 任务 0（删目录）、8（删 chat.rs）、7（删 session_manager.rs）✅
- §8 测试 → 任务 1/2/4/6/7/9（Rust 单测）、11（前端 reducer 单测）、15（端到端）✅

**补充（修复遗漏）：** 应用退出时调用 `PiManager::close_all`。在任务 10 的 `lib.rs` `run()` 末尾 `.on_window_event(...)` 或 `.build()` 后监听退出，遍历 kill。实现时在任务 10 步骤 1 的 builder 链增：

```rust
.on_window_event(|window, event| {
    if let tauri::WindowEvent::CloseRequested { .. } = event {
        if let Some(mgr) = window.app_handle().try_state::<std::sync::Arc<PiManager>>() {
            let mgr = mgr.inner().clone();
            tauri::async_runtime::block_on(async move { mgr.close_all().await });
        }
    }
})
```

**2. 占位符扫描：** 任务 8 对「其余薄包装命令」给出了完整模板与两个范例，要求逐一写全、不留 TODO；其余步骤均含真实代码。无「待定/后续实现」。✅

**3. 类型一致性：**
- Rust：`PiOutbound` 变体名与 `ensure_id` 的 match 分支一致；`PiClient::{send,handle_line,handle_exit,kill,respond_ui}` 在任务 5/8/9 调用名一致；`AppStateStore::{new,update,snapshot}`、`AppState::{load,save,touch_workspace,set_last_session,last_session}` 跨任务一致。✅
- 前端：`pi.*` 命令名与 Rust `#[tauri::command]` 函数名（snake_case）一致；`applyEvent`/`initialAgentState`/`ChatMessage`/`AgentState` 在 reducer、store、ChatView、测试中一致。✅
- 命令参数命名：Tauri 默认把 Rust snake_case 参数转为前端 camelCase（如 `model_id`→`modelId`、`session_path`→`sessionPath`、`streaming_behavior`→`streamingBehavior`）。前端 `pi.ts` 已用 camelCase。✅

---

## 执行交接

**计划已完成并保存到 `docs/superpowers/plans/2026-06-10-pi-rpc-integration.md`。两种执行方式：**

**1. 子代理驱动（推荐）** — 每个任务调度一个新的子代理，任务间进行审查，快速迭代。必需子技能：subagent-driven-development。

**2. 内联执行** — 在当前会话中用 executing-plans 逐任务执行，批量执行并设有检查点。必需子技能：executing-plans。

选哪种方式？

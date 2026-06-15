# 设置热更新设计规格 — 运行时配置通道 / MCP 与值类扩展动态生效

> **面向 AI 代理：** 这是设计规格（spec）。下一步用 `superpowers:writing-plans` 产出实现计划，再用 `superpowers:executing-plans` 内联执行（本仓库**禁止子代理**）。
>
> 配套计划：`docs/superpowers/plans/2026-06-15-settings-hot-reload-plan.md`（writing-plans 阶段生成）。

**目标：** 让设置改动**即时生效、不重启 sidecar**（在可行范围内）。通过「**后端写运行时配置文件 + 扩展 `fs.watch` 监听 + 动态应用**」实现，**不改第三方 pi 本体**。

**架构原则：** 改动落在 `tauri-agent`(Rust 后端 + 前端) + `extensions/`（共享模块 + 各扩展）。不改 pi 本体、不改 pi RPC 协议。env 注入保留（用于首次启动兜底），运行时配置文件作为热更新通道叠加其上。

**技术栈：** Rust(Tauri) + TypeScript(扩展) + `node:fs`(`fs.watch`，bun --compile 已验证可用) + 现有 `pi.registerTool/getActiveTools/setActiveTools`。

---

## 1. 背景与约束

- **现状链路**：设置 → `AppState.settings` → `settings_env()`（过滤空值、排除 `titleModel`）→ `spawn_pi_client` 启动时注入 `process.env` → 扩展**加载时读 `process.env` 常量** → 改了要 `close/open` 重启 sidecar。
- **pi RPC 限制**：`PiOutbound` 22 个命令无"更新配置/env"命令；pi 是第三方 `@earendil-works/pi-coding-agent@0.79.2`，不改本体。
- **已具备的动态能力（验证过）**：
  - `extensions/mcp` 已用 `pi.registerTool()`（动态刷新 registry）+ `getActiveTools/setActiveTools`（动态激活）+ `@mcp/sdk` `Client`（运行时连/断），足以增删改 MCP server。
  - `fs.watch`（`node:fs`）在 `bun --compile` 单二进制下完整可用。
- **设置分类**：
  - **App 类**：`titleModel`——Tauri 后端 `workspaces.rs` 实时读 `AppState`，**本就即时生效**（不注入 sidecar）。
  - **Pi 值类**：API key / 阈值 / 模型 / 引擎链等——扩展"每次操作读个值"，可改成运行时读实现热更新。
  - **Pi 装配类**：`MCP_SERVERS`——连接 + 工具注册，靠 mcp 扩展动态增删改热更新。
  - **Pi 启动建立类（少数）**：如 `MEMORY_GLOBAL_DB`（启动时 `new MemoryStore(path)`）——热更新需重建实例，或归为仍需重启。

---

## 2. 范围

### 2.1 覆盖
- **运行时配置通道**：后端写 `runtime-settings.json` + 扩展共享模块 `fs.watch` 监听。
- **MCP 热更新**：增 / 删 / 改 server 不重启。
- **值类设置运行时读**：memory / knowledge-rag / web-search / web-fetch / tts / image-gen / safety / multi-agent 把"加载时 env 常量"改成"运行时读 config"。
- **前端即时落盘**：改动防抖自动保存，去掉强制"保存并重启"。

### 2.2 非目标（YAGNI）
- 不改 pi 本体 / pi RPC 协议 / MCP 协议。
- `titleModel` 已即时，仅确保它不再触发重启。
- 不做配置跨设备实时同步（单机本地）。
- 「启动建立类」（如 db 路径变更）不强求热更新——保留"该项改动提示重启"兜底。

---

## 3. 运行时配置通道

### 3.1 配置文件
- 路径：`~/.pi/agent/runtime-settings.json`（全局一份；与 global memory db 同目录，扩展可稳定定位）。
- 格式：`{ [ENV_KEY: string]: string }`，内容等于 `settings_env()`（已过滤空值）。
- 写入：**原子写**（写 `.tmp` 后 `rename`），避免 watch 读到半写。

### 3.2 后端改造（Rust）
- `set_settings` 命令：`replace_settings`(持久化 AppState) **+ 写 `runtime-settings.json`**；**不再强制 `close/open` 重启**。
- `spawn_pi_client`：仍注入 `settings_env`（首次启动）**+ 注入 `PI_RUNTIME_CONFIG`**=`runtime-settings.json` 绝对路径，供扩展定位 watch 目标。

### 3.3 共享模块 `extensions/_shared/runtime-config.ts`
```ts
// 运行时配置：优先读 runtime-settings.json（热更新源），回退 process.env（首次/无文件）。
export function getConfig(key: string): string | undefined;   // 读单值（带内存缓存）
export function getAllConfig(): Record<string, string>;        // 读全部
export function watchConfig(onChange: (next: Record<string,string>) => void): () => void; // fs.watch + 防抖，返回 unwatch
```
- **单例 + 内部自动 watch**：模块首次使用时启动一个进程级 `fs.watch(PI_RUNTIME_CONFIG)`（防抖 ~150ms）维护单例缓存。因此 `getConfig` 永远读到最新值——**值类扩展无需自己 watch**。
- `watchConfig(onChange)` 是在内部 watch 之上的额外订阅，仅给需要"变化即执行动作"的扩展（如 MCP 增删 server）。
- 文件不存在/读失败 → 回退 `process.env`（首次启动 file 尚未写时）。

---

## 4. 各扩展改造

### 4.1 MCP（`extensions/mcp/index.ts`）— 装配类热更新
- 保留首次启动连接逻辑。
- 新增 `watchConfig` 订阅：`MCP_SERVERS` 变化 → `parseMcpServers` → 与当前已连 server **diff**：
  - **新增**：`connect` → `registerTool` → `setActiveTools` 加入（复用现有 `connectServer`）。
  - **删除**：`client.close()` + `setActiveTools` 移除该 server 工具（从 active 列表剔除）。
  - **修改**（command/args/url 变）：先删后加。
- 推送状态（`ctx.ui.setStatus("mcp", ...)`）复用现有 `pushStatus`。

### 4.2 值类扩展 — 改运行时读
把模块顶层 `const X = process.env.X ...` 改为在**使用点**调用 `getConfig('X')`：
- `long-term-memory`：`MEMORY_AUTO_INJECT/TOPK/CAPTURE/EXTRACT/SMART/SMART_NOTICE/MODEL`、`MEMORY_EMBED_*`（注意 `MEMORY_GLOBAL_DB` 属启动建立类，见 4.3）。
- `knowledge-rag`：`KB_*`。
- `web-search`/`web-fetch`：`WEB_SEARCH_*`/`FETCH_*`/`TAVILY/BRAVE`/`OPEN_WEBSEARCH`。
- `tts`/`image-gen`：`TTS_*`/`IMAGE_*`。
- `safety`：`SAFETY_*`（`tool_call` 钩子每次读 `getConfig`，天然热更新）。
- `multi-agent`：`SUBAGENT_*`/`PI_BIN`（每次 spawn 读）。

> 这些扩展不需各自 `fs.watch`——`getConfig` 读共享模块缓存即可；只有 MCP 需要"变化即动作"，所以单独 `watchConfig`。

### 4.3 启动建立类（少数，本期不强热更新）
- `MEMORY_GLOBAL_DB`/项目库路径：扩展启动 `new MemoryStore(path)`。改路径需重建实例——本期归"该项改动仍提示重启"，不做热重建（YAGNI）。

---

## 5. 前端

- **即时落盘**：设置页改动防抖（如 600ms）`persist`（`set_settings`）→ 后端写 runtime file → 扩展 watch 应用。去掉强制"保存并重启"按钮。
- **生效标识**：字段/卡片标注生效方式——App 即时 / Pi 热更新（即时）/ 启动建立类（需重启）。仅"启动建立类"改动时才显示"重启生效"。
- 给 `settingsSchema` **新增** `effect?: 'instant' | 'hot' | 'restart'` 字段（settings-redesign 已落地的 schema 上加），标注每项生效方式；默认 `'hot'`，`titleModel`=`'instant'`，启动建立类（db 路径）=`'restart'`。

---

## 6. 分阶段

| 阶段 | 内容 | 验收 |
|------|------|------|
| **P1 通道 + MCP** | `runtime-config.ts` 共享模块；后端 `set_settings` 写 file + spawn 注入 `PI_RUNTIME_CONFIG`；mcp 扩展 watch 增删改 | 改 MCP_SERVERS（增/删 server）不重启即生效；冒烟可见工具增减 |
| **P2 值类运行时读** | 各值类扩展改 `getConfig`；单测验证运行时读取最新值 | 改阈值/key/模型后下次操作即用新值，无需重启 |
| **P3 前端即时落盘** | 设置页防抖自动存；`effect` 三态标注；仅启动建立类提示重启 | 改设置即落盘即生效；UI 标识清晰 |

P1 是地基（通道）；P2/P3 依赖 P1。

---

## 7. 风险与边界

| 风险 | 处理 |
|------|------|
| 删除 MCP server 工具未注销、registry 残留 | `setActiveTools` 移除激活（agent 不可见即达目的）；`registerTool` 同名覆盖避免累积；`unregisterTool` 若存在则用（待实现期确认） |
| `fs.watch` 抖动/半写 | 原子写(`.tmp`+rename) + 监听端防抖重读 |
| 首次启动 file 未写 | `getConfig` 回退 `process.env`（spawn 注入的初值） |
| 多 workspace sidecar 共享同一 file | 各自 watch、各自应用（幂等 diff） |
| 启动建立类（db 路径） | 不热更新，标"需重启" |
| bun --compile 下路径/权限 | `PI_RUNTIME_CONFIG` 用绝对路径；目录 `~/.pi/agent` 已被 memory 用，存在性有保障 |

---

## 8. 决策记录

| 决策 | 选项 | 结论 | 理由 |
|------|------|------|------|
| 通道 | 改 pi RPC / fs.watch 配置文件 | **fs.watch 文件** | 不依赖第三方 pi，扩展自给自足 |
| 配置文件粒度 | 每 workspace / 全局一份 | **全局一份** | 设置本就全局；多 sidecar 共享 watch |
| 值类生效 | 各扩展 watch / 共享缓存 getConfig | **共享 getConfig** | 只有 MCP 需"变化即动作"，值类读缓存即可，改动最小 |
| 启动建立类 | 强行热重建 / 标重启 | **标重启** | 收益小、复杂高（YAGNI） |
| env 注入 | 移除 / 保留作首次兜底 | **保留** | 首次启动 + 文件缺失兜底，零回归 |

---

## 9. 相关文件

- `extensions/_shared/runtime-config.ts` — **新增**：getConfig/getAllConfig/watchConfig
- `extensions/mcp/index.ts` — 改：watch + 增删改 server
- `extensions/long-term-memory/*` / `knowledge-rag/*` / `web-search/*` / `web-fetch/*` / `tts/*` / `image-gen/*` / `safety/*` / `multi-agent/*` — 改：值类 `getConfig`
- `tauri-agent/src-tauri/src/commands/*`（`set_settings`）— 改：写 runtime file、不强制重启
- `tauri-agent/src-tauri/src/commands/agent.rs`（`spawn_pi_client` 调用处）/ `pi/*`（spawn）— 改：注入 `PI_RUNTIME_CONFIG`
- `tauri-agent/src-tauri/src/state/store.rs` — 可加：写 runtime file 的方法
- `tauri-agent/src/features/settings/*` — 改：即时落盘 + `effect` 三态

---

**状态：** 设计待用户审阅并定范围（建议 P1 先行）。下一步 → `superpowers:writing-plans` 产出对应阶段计划。

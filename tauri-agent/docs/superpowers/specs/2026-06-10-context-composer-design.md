# Context 用量 Composer 设计

- 日期：2026-06-10
- 主题：将上下文用量展示与模型控件迁入聊天 Composer 底栏
- 状态：已评审通过，待编写实现计划
- 参考：`PiAgentUI` 的 `SidebarFooter`、`ContextDetailsDialog`、`InputToolbar` 交互模式
- 前置：`pi-rpc-integration` 已完成（sidecar + agent 命令 + ChatView 流式聊天）

## 背景

`tauri-agent` 右侧 Context 面板当前为占位状态：

- Token 用量写死 `0 / 200,000 tokens`，进度条固定 15%
- `ModelControls` 提供 cycle 模型、思考级别 `<select>`、压缩按钮，但思考级别无初始值绑定
- 无详情弹窗、无 compaction 后未知态处理

用户希望参考 `PiAgentUI` 的上下文用量能力，但**不放在右侧 Context 区**，而是放在**聊天输入框（Composer）底栏**，布局参考 Cursor 式 Composer（输入区 + 底栏工具条）。模型/思考/压缩控件一并迁入底栏。

## 目标与范围

### 目标

1. **Composer 底栏**：模型下拉、思考级别、上下文环形指示器、发送/停止
2. **详情弹窗**：点击指示器展示 `SessionStats` 完整统计（token 分项、费用、会话信息）
3. **数据真实**：对接已有 `agent_get_session_stats` RPC，与 pi CLI footer 同源
4. **状态语义**：compaction 后 `tokens: null` 显示未知；≥70% 警告、≥90% 危险着色

### 非目标（YAGNI）

- 消息级 step-finish token 展示
- OpenRouter 模型元数据 enrichment
- 右侧「上下文文件」列表实现（保留占位）
- Settings 页、主题系统、i18n
- PiAgentUI 的字符估算 fallback（直连 sidecar，不需要）

## 关键决策

| 项 | 决策 |
|---|---|
| 布局方案 | **方案 1：Composer Shell 重构** — 圆角容器 + textarea + 底栏工具条 |
| 用量位置 | Composer 底栏右侧环形指示器，点击开详情弹窗 |
| 模型控件 | 迁入 Composer 底栏左侧；右侧面板移除 `ModelControls` |
| 数据源 | 单一权威：`agent_get_session_stats` → `SessionStats.contextUsage` |
| 刷新机制 | 事件驱动 refetch（非定时轮询），refreshKey 绑定 agent 事件 |
| 右侧面板 | 保留三栏布局；移除用量条和模型控件，仅留「上下文文件」占位 |

## 设计

### 1. UI 布局

#### 1.1 ChatComposer 结构（新组件）

替换 `ChatView` 内现有 `input-container`（textarea + 发送按钮横排）。

```
┌─────────────────────────────────────────────────────────┐
│  输入消息…（Enter 发送，Shift+Enter 换行）                │
├─────────────────────────────────────────────────────────┤
│ [模型 ▾] [思考 ▾] [⋯]              ◉ 42%    [↑] / [■]   │
└─────────────────────────────────────────────────────────┘
```

| 区域 | 内容 |
|------|------|
| 输入区 | 多行 `textarea`，行为与现 `ChatView` 一致 |
| 底栏左 | 模型下拉（`get_available_models` + `set_model`）；思考级别下拉（`get_state` 初始值 + `set_thinking_level`） |
| 底栏左溢出 | `⋯` 菜单含「压缩上下文」（`compact`） |
| 底栏右 | `ContextIndicator` 环形进度；流式时「停止」，否则圆形「发送」 |

#### 1.2 ContextIndicator（底栏）

- 有数据：迷你环 + 百分比或 `used/limit` 简写
- `tokens: null`（compaction 后）：环显示 `?`，tooltip「压缩后需等待下次回复才能获知用量」
- 颜色：≥70% 黄、≥90% 红；未知态灰色
- 流式中：显示上次已知值 + 细脉冲边框（数据可能过时，`agent_end` 后刷新）
- 点击 → 打开 `ContextDetailsDialog`

#### 1.3 ContextDetailsDialog（详情弹窗）

数据来自最近一次 `get_session_stats` 结果：

| 区块 | 字段 |
|------|------|
| 会话 | `sessionId`、`sessionFile` |
| 模型 | 当前模型名、`contextUsage.contextWindow` |
| 用量 | `used / limit`、百分比、`contextKnown` 状态 |
| Token 分项 | `tokens.input/output/cacheRead/cacheWrite/total` |
| 费用 | `cost` |
| 消息统计 | `userMessages`、`assistantMessages`、`toolCalls` |
| 未知态说明 | compaction 后 `tokens: null` 的解释文案 |

本轮不做：raw messages JSON、OpenRouter 定价 enrichment。

#### 1.4 右侧面板调整（`App.tsx`）

- **移除**：硬编码 `usage-bar`、`ModelControls` 引用
- **保留**：`Context` 标题 + `context-files` 占位（「No files in context」）
- 三栏 `grid` 布局不变

#### 1.5 新增/改动文件

```
src/
├── hooks/
│   ├── useSessionStats.ts        # SessionStats → ContextStats 映射
│   └── useSessionStats.test.ts   # mapSessionStats 单元测试
├── components/
│   ├── chat/
│   │   ├── ChatComposer.tsx      # 新：textarea + 底栏
│   │   ├── ChatComposer.css
│   │   └── ChatView.tsx          # 改用 ChatComposer
│   └── context/
│       ├── ContextIndicator.tsx
│       ├── ContextDetailsDialog.tsx
│       └── CircularProgress.tsx  # 轻量 SVG 环
├── lib/pi.ts                     # + getSessionStats、setModel、getAvailableModels
└── App.tsx                       # 精简右侧面板
```

`ModelControls.tsx` 可删除或保留为内部逻辑参考（实现后删除）。

### 2. 数据流

#### 2.1 RPC 封装（`lib/pi.ts`）

新增：

```typescript
getSessionStats(workspace: string): Promise<SessionStats>
getAvailableModels(workspace: string): Promise<ModelInfo[]>
setModel(workspace: string, provider: string, modelId: string): Promise<unknown>
```

`SessionStats` / `ContextUsage` 类型与 pi `agent-session.ts` 对齐。

Rust 侧 `agent_get_session_stats`、`agent_get_available_models`、`agent_set_model` 已注册，无需后端改动。

#### 2.2 视图模型（`mapSessionStats`）

```typescript
interface ContextStats {
  contextUsed: number | null;
  contextLimit: number;
  contextPercent: number;
  contextKnown: boolean;
  contextStatus: 'unknown' | 'normal' | 'warning' | 'danger';
  tokens: SessionStats['tokens'];
  cost: number;
  sessionId: string;
  sessionFile?: string;
  userMessages: number;
  assistantMessages: number;
  toolCalls: number;
}
```

映射规则：

- `contextKnown` = `contextUsage.tokens !== null`
- `contextUsed` = `contextUsage.tokens`（null 时 UI 显示 `—`）
- `contextLimit` = `contextUsage.contextWindow`
- `contextPercent` = `contextUsage.percent ?? 0`，clamp 0–100
- `contextStatus`：unknown（`!contextKnown`）/ danger（≥90%）/ warning（≥70%）/ normal

模型名从并行持有的 `getState().model` 读取，供底栏下拉显示。

#### 2.3 刷新时机（`createSessionStats` hook）

订阅 `pi://event`，以下事件触发 `refetch()`：

| 事件 | 原因 |
|------|------|
| `agent_end` | 一轮结束，usage 更新 |
| `compaction_end` | 压缩后 tokens 可能变 null |
| `message_end`（assistant） | 流式结束有准确 usage |
| `openWorkspace` 成功 | 初始加载 |
| 用户操作：切换模型/思考级别/压缩 | 主动变更 |

实现：`createResource` 或 `createSignal` + `refetch` 计数器；`ChatComposer` 通过 props 或 context 消费。

不采用定时轮询。

#### 2.4 模型下拉数据流

1. `openWorkspace` 后并行拉取 `get_available_models` + `get_state`
2. 下拉选项：`provider/id` → 显示 `name`
3. 选中 → `set_model(provider, modelId)` → refetch stats + 更新选中态
4. 加载失败 → 降级显示 `get_state` 当前模型名，下拉 disabled

### 3. 错误处理

| 场景 | 行为 |
|------|------|
| 工作区未打开 | 环显示 `—`，静默；`openWorkspace` 后再拉取 |
| `get_session_stats` 失败 | 环灰色 `?`，tooltip「无法获取上下文用量」；详情弹窗提供重试 |
| `contextUsage` 缺失 | 「未选择模型」，隐藏百分比 |
| compaction 后 `tokens: null` | 环 `?` + tooltip + 详情弹窗 `—` |
| 流式进行中 | 显示上次值 + 脉冲边框；`agent_end` 刷新 |
| 模型列表加载失败 | 显示当前模型名，下拉 disabled + tooltip |

原则：**用量是辅助信息，失败不阻断聊天**；模型切换失败用 `error-banner` 提示。

### 4. 测试

#### 单元测试（Vitest）

`useSessionStats.test.ts` 覆盖 `mapSessionStats`：

- 正常 percent 与 status
- `tokens: null` → `contextKnown: false`、`contextStatus: 'unknown'`
- 70% / 90% 阈值
- 缺失 `contextUsage`

不测试 SVG 组件。

#### 手动冒烟

1. 打开工作区 → 底栏显示模型名 + 环
2. 发消息流式结束 → 环百分比更新
3. 点击环 → 详情弹窗展示 token 分项和费用
4. 压缩 → 环变 `?`；再发消息 → 恢复
5. 切换模型 → limit 跟随 `contextWindow` 变化

## 与 PiAgentUI 对照

| 能力 | PiAgentUI | tauri-agent（本设计） |
|------|-----------|----------------------|
| 用量位置 | 侧边栏 Footer | Composer 底栏 |
| 数据源 | HTTP `/context` + 消息 fallback | RPC `get_session_stats` |
| 详情弹窗 | `ContextDetailsDialog` | 同名字段子集 |
| 模型选择 | `InputToolbar` + `ModelSelector` | Composer 底栏下拉 |
| 环形进度 | `CircularProgress` | 轻量 SVG 复刻 |

## 规格自检

- [x] 无 TODO/待定占位
- [x] 布局、数据流、错误处理一致
- [x] 范围可用单份实现计划覆盖
- [x] 右侧面板处理方式明确（保留占位、移除控件）
- [x] 后端无需改动（命令已存在）

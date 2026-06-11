# Context Composer 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将上下文用量环形指示器、详情弹窗、模型/思考/压缩控件迁入聊天 Composer 底栏，数据来自 `agent_get_session_stats` RPC。

**架构：** 纯前端改动（Rust 命令已存在）。`mapSessionStats` 纯函数映射 pi `SessionStats` → `ContextStats`；`createSessionStats` 订阅 `pi://event` 事件驱动 refetch；`ChatComposer` 组合底栏控件；右侧面板移除占位用量与 `ModelControls`。

**技术栈：** SolidJS + TypeScript、Vitest、`@tauri-apps/api` invoke、已有 `pi.ts` 事件类型。

**规格：** `docs/superpowers/specs/2026-06-10-context-composer-design.md`

---

## 文件结构

### 新增

| 文件 | 职责 |
|------|------|
| `src/lib/sessionStats.ts` | `SessionStats`/`ContextStats` 类型 + `mapSessionStats()` 纯函数 |
| `src/lib/sessionStats.test.ts` | `mapSessionStats` 单元测试 |
| `src/stores/sessionStats.ts` | `createSessionStatsStore(workspace)`：拉取、refetch、错误态 |
| `src/components/context/CircularProgress.tsx` | SVG 环形进度（无外部依赖） |
| `src/components/context/ContextIndicator.tsx` | 底栏环 + tooltip + 点击回调 |
| `src/components/context/ContextDetailsDialog.tsx` | 详情弹窗 |
| `src/components/context/context.css` | 共用样式 |
| `src/components/chat/ChatComposer.tsx` | Composer 壳：textarea + 底栏 |
| `src/components/chat/ChatComposer.css` | Composer 样式 |

### 修改

| 文件 | 变更 |
|------|------|
| `src/lib/pi.ts` | 补 `SessionStats` 类型导出；新增 `getSessionStats()` |
| `src/components/chat/ChatView.tsx` | 用 `ChatComposer` 替换 `input-container`；接入 stats store |
| `src/App.tsx` | 移除 `ModelControls`、硬编码 `usage-bar` |
| `src/App.css` | 删除 `.context-usage` / `.usage-bar` 等无用样式（若已无引用） |

### 删除

| 文件 | 原因 |
|------|------|
| `src/components/controls/ModelControls.tsx` | 逻辑迁入 `ChatComposer` |
| `src/components/controls/ModelControls.css` | 同上 |

---

## 任务 1：`mapSessionStats` 纯函数 + 测试

**文件：**
- 创建：`src/lib/sessionStats.ts`
- 创建：`src/lib/sessionStats.test.ts`

- [ ] **步骤 1：编写失败的测试**

```typescript
// src/lib/sessionStats.test.ts
import { describe, it, expect } from 'vitest';
import { mapSessionStats, type SessionStats } from './sessionStats';

const base: SessionStats = {
  sessionId: 'sid-1',
  sessionFile: '/tmp/s.jsonl',
  userMessages: 2,
  assistantMessages: 3,
  toolCalls: 1,
  toolResults: 1,
  totalMessages: 6,
  tokens: { input: 100, output: 50, cacheRead: 10, cacheWrite: 5, total: 165 },
  cost: 0.012,
  contextUsage: { tokens: 50000, contextWindow: 200000, percent: 25 },
};

describe('mapSessionStats', () => {
  it('maps known context with normal status', () => {
    const r = mapSessionStats(base);
    expect(r.contextKnown).toBe(true);
    expect(r.contextUsed).toBe(50000);
    expect(r.contextLimit).toBe(200000);
    expect(r.contextPercent).toBe(25);
    expect(r.contextStatus).toBe('normal');
  });

  it('returns unknown when tokens is null', () => {
    const r = mapSessionStats({
      ...base,
      contextUsage: { tokens: null, contextWindow: 200000, percent: null },
    });
    expect(r.contextKnown).toBe(false);
    expect(r.contextUsed).toBeNull();
    expect(r.contextStatus).toBe('unknown');
  });

  it('returns warning at 70%', () => {
    const r = mapSessionStats({
      ...base,
      contextUsage: { tokens: 140000, contextWindow: 200000, percent: 70 },
    });
    expect(r.contextStatus).toBe('warning');
  });

  it('returns danger at 90%', () => {
    const r = mapSessionStats({
      ...base,
      contextUsage: { tokens: 180000, contextWindow: 200000, percent: 90 },
    });
    expect(r.contextStatus).toBe('danger');
  });

  it('handles missing contextUsage', () => {
    const r = mapSessionStats({ ...base, contextUsage: undefined });
    expect(r.contextKnown).toBe(false);
    expect(r.contextLimit).toBe(0);
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：`cd tauri-agent; pnpm test`
预期：FAIL，`Cannot find module './sessionStats'`

- [ ] **步骤 3：实现 `sessionStats.ts`**

```typescript
// src/lib/sessionStats.ts
export interface ContextUsage {
  tokens: number | null;
  contextWindow: number;
  percent: number | null;
}

export interface SessionStats {
  sessionFile?: string;
  sessionId: string;
  userMessages: number;
  assistantMessages: number;
  toolCalls: number;
  toolResults: number;
  totalMessages: number;
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
  cost: number;
  contextUsage?: ContextUsage;
}

export interface ContextStats {
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

export function mapSessionStats(stats: SessionStats): ContextStats {
  const usage = stats.contextUsage;
  const contextLimit = usage?.contextWindow ?? 0;
  const contextKnown = usage != null && usage.tokens !== null;
  const contextUsed = usage?.tokens ?? null;
  const rawPercent = usage?.percent ?? (contextKnown && contextLimit > 0
    ? ((contextUsed as number) / contextLimit) * 100
    : 0);
  const contextPercent = Math.min(100, Math.max(0, rawPercent ?? 0));

  let contextStatus: ContextStats['contextStatus'] = 'normal';
  if (!contextKnown) contextStatus = 'unknown';
  else if (contextPercent >= 90) contextStatus = 'danger';
  else if (contextPercent >= 70) contextStatus = 'warning';

  return {
    contextUsed,
    contextLimit,
    contextPercent,
    contextKnown,
    contextStatus,
    tokens: stats.tokens,
    cost: stats.cost,
    sessionId: stats.sessionId,
    sessionFile: stats.sessionFile,
    userMessages: stats.userMessages,
    assistantMessages: stats.assistantMessages,
    toolCalls: stats.toolCalls,
  };
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
```

- [ ] **步骤 4：运行测试确认通过**

运行：`pnpm test`
预期：全部 PASS（含既有 `agentReducer` 测试）

- [ ] **步骤 5：Commit**

```bash
git add src/lib/sessionStats.ts src/lib/sessionStats.test.ts
git commit -m "feat: add mapSessionStats for context usage view model"
```

---

## 任务 2：`pi.getSessionStats` + stats store

**文件：**
- 修改：`src/lib/pi.ts`
- 创建：`src/stores/sessionStats.ts`

- [ ] **步骤 1：在 `pi.ts` 增加类型与 invoke**

在 `src/lib/pi.ts` 顶部 import 并 re-export：

```typescript
import type { SessionStats } from './sessionStats';
export type { SessionStats } from './sessionStats';
```

在 `pi` 对象中增加（`setModel`/`getAvailableModels` 已存在，确认保留）：

```typescript
getSessionStats: (workspace: string) =>
  invoke<SessionStats>('agent_get_session_stats', { workspace }),
```

- [ ] **步骤 2：实现 `createSessionStatsStore`**

```typescript
// src/stores/sessionStats.ts
import { createSignal, onCleanup } from 'solid-js';
import { pi, onPiEvent, type AgentEvent } from '../lib/pi';
import { mapSessionStats, type ContextStats } from '../lib/sessionStats';

const REFETCH_EVENTS = new Set([
  'agent_end',
  'compaction_end',
  'message_end',
]);

function shouldRefetch(event: AgentEvent): boolean {
  if (REFETCH_EVENTS.has(event.type)) {
    if (event.type === 'message_end') {
      return (event as { message: { role?: string } }).message?.role === 'assistant';
    }
    return true;
  }
  return false;
}

export function createSessionStatsStore(workspace: () => string) {
  const [stats, setStats] = createSignal<ContextStats | null>(null);
  const [error, setError] = createSignal<string | undefined>();
  const [loading, setLoading] = createSignal(false);

  const refetch = async () => {
    const ws = workspace();
    if (!ws) return;
    setLoading(true);
    try {
      const raw = await pi.getSessionStats(ws);
      setStats(mapSessionStats(raw));
      setError(undefined);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const unlistenP = onPiEvent((env) => {
    if (env.workspace !== workspace()) return;
    if (shouldRefetch(env.event)) void refetch();
  });

  onCleanup(() => {
    unlistenP.then((un) => un());
  });

  return { stats, error, loading, refetch };
}
```

- [ ] **步骤 3：验证 TypeScript 编译**

运行：`pnpm build`
预期：`tsc && vite build` 通过

- [ ] **步骤 4：Commit**

```bash
git add src/lib/pi.ts src/stores/sessionStats.ts
git commit -m "feat: add getSessionStats invoke and session stats store"
```

---

## 任务 3：CircularProgress + ContextIndicator

**文件：**
- 创建：`src/components/context/CircularProgress.tsx`
- 创建：`src/components/context/ContextIndicator.tsx`
- 创建：`src/components/context/context.css`

- [ ] **步骤 1：实现 CircularProgress**

```tsx
// src/components/context/CircularProgress.tsx
import { Component } from 'solid-js';

interface Props {
  progress: number; // 0-1
  size?: number;
  strokeWidth?: number;
  trackClass?: string;
  progressClass?: string;
  children?: unknown;
}

export const CircularProgress: Component<Props> = (p) => {
  const size = () => p.size ?? 28;
  const sw = () => p.strokeWidth ?? 3;
  const r = () => (size() - sw()) / 2;
  const circ = () => 2 * Math.PI * r();
  const offset = () => circ() * (1 - Math.min(1, Math.max(0, p.progress)));

  return (
    <svg width={size()} height={size()} class="circular-progress" aria-hidden="true">
      <circle
        class={p.trackClass ?? 'cp-track'}
        cx={size() / 2}
        cy={size() / 2}
        r={r()}
        fill="none"
        stroke-width={sw()}
      />
      <circle
        class={p.progressClass ?? 'cp-progress'}
        cx={size() / 2}
        cy={size() / 2}
        r={r()}
        fill="none"
        stroke-width={sw()}
        stroke-dasharray={circ()}
        stroke-dashoffset={offset()}
        stroke-linecap="round"
        transform={`rotate(-90 ${size() / 2} ${size() / 2})`}
      />
      {p.children}
    </svg>
  );
};
```

- [ ] **步骤 2：实现 ContextIndicator**

```tsx
// src/components/context/ContextIndicator.tsx
import { Component, Show } from 'solid-js';
import { CircularProgress } from './CircularProgress';
import type { ContextStats } from '../../lib/sessionStats';
import { formatTokens } from '../../lib/sessionStats';
import './context.css';

interface Props {
  stats: ContextStats | null;
  error?: string;
  stale?: boolean; // 流式中
  onClick: () => void;
}

export const ContextIndicator: Component<Props> = (p) => {
  const label = () => {
    if (p.error) return '?';
    const s = p.stats;
    if (!s || !s.contextKnown) return '?';
    return `${Math.round(s.contextPercent)}%`;
  };

  const title = () => {
    if (p.error) return '无法获取上下文用量';
    const s = p.stats;
    if (!s) return '加载中…';
    if (!s.contextKnown) return '压缩后需等待下次回复才能获知用量';
    return `${formatTokens(s.contextUsed ?? 0)} / ${formatTokens(s.contextLimit)} tokens`;
  };

  const progressClass = () => {
    const s = p.stats;
    if (!s || p.error) return 'cp-unknown';
    if (!s.contextKnown) return 'cp-unknown';
    if (s.contextStatus === 'danger') return 'cp-danger';
    if (s.contextStatus === 'warning') return 'cp-warning';
    return 'cp-normal';
  };

  return (
    <button
      type="button"
      class={`context-indicator ${p.stale ? 'stale' : ''}`}
      title={title()}
      onClick={() => p.onClick()}
      aria-label="上下文用量详情"
    >
      <CircularProgress
        progress={(p.stats?.contextKnown ? p.stats.contextPercent : 0) / 100}
        progressClass={progressClass()}
      />
      <span class="context-indicator-label">{label()}</span>
    </button>
  );
};
```

- [ ] **步骤 3：添加 `context.css` 颜色与脉冲**

```css
/* src/components/context/context.css */
.cp-track { stroke: #334155; }
.cp-normal { stroke: #3b82f6; }
.cp-warning { stroke: #fbbf24; }
.cp-danger { stroke: #f87171; }
.cp-unknown { stroke: #64748b; }
.context-indicator {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}
.context-indicator:hover { background: #1e293b; }
.context-indicator.stale { outline: 1px solid #475569; animation: pulse 1.5s ease-in-out infinite; }
.context-indicator-label { font-size: 11px; min-width: 28px; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
```

- [ ] **步骤 4：Commit**

```bash
git add src/components/context/
git commit -m "feat(ui): add CircularProgress and ContextIndicator"
```

---

## 任务 4：ContextDetailsDialog

**文件：**
- 创建：`src/components/context/ContextDetailsDialog.tsx`

- [ ] **步骤 1：实现弹窗**

```tsx
// src/components/context/ContextDetailsDialog.tsx
import { Component, Show } from 'solid-js';
import type { ContextStats } from '../../lib/sessionStats';
import { formatTokens } from '../../lib/sessionStats';
import './context.css';

interface Props {
  open: boolean;
  stats: ContextStats | null;
  modelName?: string;
  error?: string;
  onClose: () => void;
  onRetry?: () => void;
}

function Row(p: { label: string; value: string }) {
  return (
    <div class="ctx-row">
      <span class="ctx-label">{p.label}</span>
      <span class="ctx-value">{p.value}</span>
    </div>
  );
}

export const ContextDetailsDialog: Component<Props> = (p) => (
  <Show when={p.open}>
    <div class="ctx-overlay" onClick={() => p.onClose()}>
      <div class="ctx-dialog" onClick={(e) => e.stopPropagation()}>
        <div class="ctx-dialog-header">
          <h3>上下文详情</h3>
          <button type="button" onClick={() => p.onClose()}>✕</button>
        </div>
        <Show when={p.error} fallback={
          <Show when={p.stats} fallback={<p class="ctx-muted">暂无数据</p>}>
            {(s) => (
              <div class="ctx-dialog-body">
                <Row label="会话 ID" value={s().sessionId} />
                <Row label="会话文件" value={s().sessionFile ?? '—'} />
                <Row label="模型" value={p.modelName ?? '—'} />
                <Row
                  label="上下文用量"
                  value={s().contextKnown
                    ? `${formatTokens(s().contextUsed ?? 0)} / ${formatTokens(s().contextLimit)} (${Math.round(s().contextPercent)}%)`
                    : '—（压缩后未知）'}
                />
                <Row label="Input" value={formatTokens(s().tokens.input)} />
                <Row label="Output" value={formatTokens(s().tokens.output)} />
                <Row label="Cache Read" value={formatTokens(s().tokens.cacheRead)} />
                <Row label="Cache Write" value={formatTokens(s().tokens.cacheWrite)} />
                <Row label="累计费用" value={`$${s().cost.toFixed(4)}`} />
                <Row label="用户消息" value={String(s().userMessages)} />
                <Row label="助手消息" value={String(s().assistantMessages)} />
                <Row label="工具调用" value={String(s().toolCalls)} />
                <Show when={!s().contextKnown}>
                  <p class="ctx-notice">压缩后 pi 无法立即估算上下文 token，需等待下一次模型回复。</p>
                </Show>
              </div>
            )}
          </Show>
        }>
          <p class="ctx-error">{p.error}</p>
          <Show when={p.onRetry}>
            <button type="button" class="ctx-retry" onClick={() => p.onRetry!()}>重试</button>
          </Show>
        </Show>
      </div>
    </div>
  </Show>
);
```

在 `context.css` 追加 dialog 样式（`.ctx-overlay` 全屏遮罩、`z-index: 100`、`ctx-dialog` 宽 420px 等）。

- [ ] **步骤 2：Commit**

```bash
git add src/components/context/ContextDetailsDialog.tsx src/components/context/context.css
git commit -m "feat(ui): add ContextDetailsDialog"
```

---

## 任务 5：ChatComposer

**文件：**
- 创建：`src/components/chat/ChatComposer.tsx`
- 创建：`src/components/chat/ChatComposer.css`

- [ ] **步骤 1：实现 ChatComposer**

Props 接口：

```typescript
interface ChatComposerProps {
  workspace: string;
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  isStreaming: boolean;
  stats: ContextStats | null;
  statsError?: string;
  statsStale?: boolean;
  onRefetchStats: () => void;
  onStatsClick: () => void;
}
```

结构：
- 外层 `.composer` 圆角边框容器
- `.composer-input` textarea（从 `ChatView` 迁入 onKey 逻辑）
- `.composer-toolbar` 底栏：
  - 左：`model-select`（`onMount` 拉 `getAvailableModels` + `getState`；`onChange` → `setModel` + `onRefetchStats`）
  - 左：`thinking-select`（LEVELS 数组；`value` 绑定 `getState().thinkingLevel`；`onChange` → `setThinkingLevel`）
  - 左：`⋯` 按钮 → 弹出「压缩上下文」项（`pi.compact` + `onRefetchStats`）
  - 右：`ContextIndicator`
  - 右：圆形发送/停止按钮

模型下拉选项格式：`${m.name ?? m.id}`，value 为 `${provider}\0${id}`（split 后调 `setModel`）。

模型列表加载失败：`select disabled`，显示 `getState` 当前模型名。

- [ ] **步骤 2：ChatComposer.css**

参考规格示意图：`.composer { border: 1px solid #334155; border-radius: 12px; }`、`.composer-toolbar { display: flex; justify-content: space-between; padding: 6px 8px; border-top: 1px solid #1e293b; }`、`.composer-send { width: 32px; height: 32px; border-radius: 50%; }`。

- [ ] **步骤 3：Commit**

```bash
git add src/components/chat/ChatComposer.tsx src/components/chat/ChatComposer.css
git commit -m "feat(ui): add ChatComposer with model toolbar and context indicator"
```

---

## 任务 6：接入 ChatView + 精简 App

**文件：**
- 修改：`src/components/chat/ChatView.tsx`
- 修改：`src/App.tsx`
- 删除：`src/components/controls/ModelControls.tsx`
- 删除：`src/components/controls/ModelControls.css`
- 修改：`src/App.css`（删除 `.context-usage` 等）

- [ ] **步骤 1：改 ChatView**

```tsx
// 在 ChatView 内：
const { stats, error: statsError, refetch } = createSessionStatsStore(() => props.workspace);
const [detailsOpen, setDetailsOpen] = createSignal(false);
const [modelName, setModelName] = createSignal<string>();

onMount(async () => {
  try {
    await pi.openWorkspace(props.workspace);
    await refetch();
    const state = (await pi.getState(props.workspace)) as { model?: { name?: string } };
    if (state?.model?.name) setModelName(state.model.name);
  } catch (e) {
    setLocalError(`无法打开工作区：${e}`);
  }
});

// 替换 input-container 为：
<ChatComposer
  workspace={props.workspace}
  input={input()}
  setInput={setInput}
  onSend={send}
  isStreaming={state.isStreaming}
  stats={stats()}
  statsError={statsError()}
  statsStale={state.isStreaming}
  onRefetchStats={refetch}
  onStatsClick={() => setDetailsOpen(true)}
/>
<ContextDetailsDialog
  open={detailsOpen()}
  stats={stats()}
  modelName={modelName()}
  error={statsError()}
  onClose={() => setDetailsOpen(false)}
  onRetry={refetch}
/>
```

删除原 `input-container` 块与相关 CSS（迁入 `ChatComposer.css`）。

- [ ] **步骤 2：精简 App.tsx**

移除 `import ModelControls` 与 `<ModelControls workspace={workspace()} />`。

删除：

```tsx
<div class="context-usage">...</div>
```

保留 `context-header` + `context-files` 占位。

- [ ] **步骤 3：删除 ModelControls**

```bash
git rm src/components/controls/ModelControls.tsx src/components/controls/ModelControls.css
```

- [ ] **步骤 4：验证构建与测试**

运行：`pnpm test; pnpm build`
预期：全绿

- [ ] **步骤 5：Commit**

```bash
git add src/components/chat/ChatView.tsx src/App.tsx src/App.css
git commit -m "feat(ui): wire ChatComposer, remove right-panel model controls"
```

---

## 任务 7：端到端冒烟

**文件：** 无（手动）

- [ ] **步骤 1：启动应用**

```bash
cd tauri-agent
pnpm build:sidecar   # 若 binaries 不存在
pnpm tauri dev
```

- [ ] **步骤 2：验证底栏**

预期：Composer 底栏显示模型下拉、思考级别、环形用量指示器。

- [ ] **步骤 3：发消息验证刷新**

发送「列出当前目录文件」，流式结束后环百分比应更新。

- [ ] **步骤 4：详情弹窗**

点击环 → 弹窗显示 token 分项、费用、会话 ID。

- [ ] **步骤 5：压缩未知态**

点 `⋯` → 压缩；环变 `?`；再发消息 → 恢复数值。

- [ ] **步骤 6：切换模型**

切换模型下拉 → `contextLimit` 在详情弹窗中跟随变化。

- [ ] **步骤 7：Commit（若有冒烟修复）**

```bash
git add -A
git commit -m "fix: address context composer smoke issues"
```

---

## 规格自检

| 规格需求 | 对应任务 |
|----------|----------|
| Composer 底栏布局 | 任务 5、6 |
| 详情弹窗字段 | 任务 4 |
| `get_session_stats` 数据源 | 任务 1、2 |
| 事件驱动 refetch | 任务 2 |
| compaction 未知态 | 任务 1（map）、3（indicator）、4（dialog） |
| 70%/90% 着色 | 任务 1、3 |
| 模型下拉 + 思考 + 压缩 | 任务 5 |
| 右侧面板精简 | 任务 6 |
| 错误处理（静默/重试） | 任务 2、3、4 |
| 单元测试 | 任务 1 |
| 手动冒烟 | 任务 7 |

无 TODO/占位符。类型 `ContextStats`/`SessionStats` 全计划一致。

---

## 执行选项

**计划已保存到 `docs/superpowers/plans/2026-06-10-context-composer.md`。两种执行方式：**

1. **子代理驱动（推荐）** — 每任务一个新子代理 + 两阶段审查（规格 → 质量）
2. **内联执行** — 当前会话用 executing-plans 批量执行，设检查点

**选哪种？**

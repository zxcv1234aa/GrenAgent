# UI 重新设计实施计划 - 阶段 1：性能修复

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 消除对话列表闪动和消息渲染卡顿，完善错误处理机制

**架构：** 使用 React.memo、useMemo、防抖优化组件渲染；添加 ErrorBoundary 统一错误处理；规范化加载状态管理

**技术栈：** React 19, TypeScript, Zustand, lodash-es (debounce)

---

## 文件结构

### 新建文件
- `src/components/common/ErrorBoundary.tsx` - 错误边界组件
- `src/hooks/useDebounce.ts` - 防抖 Hook
- `src/utils/performance.ts` - 性能优化工具函数

### 修改文件
- `src/components/sessions/SessionList.tsx` - 优化防止闪动
- `src/components/chat/MessageBubble.tsx` - memo 和缓存优化
- `src/components/chat/ChatView.tsx` - 优化滚动性能
- `src/App.tsx` - 添加 ErrorBoundary

---

## 任务 1：创建 ErrorBoundary 组件

**文件：**
- 创建：`src/components/common/ErrorBoundary.tsx`
- 测试：手动测试（组件生命周期方法无法用标准工具测试）

- [ ] **步骤 1：创建 ErrorBoundary 组件**

```typescript
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Button, Flexbox } from '@lobehub/ui';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Flexbox align="center" justify="center" style={{ padding: 24 }}>
          <Alert
            type="error"
            message={this.props.fallbackTitle || '组件错误'}
            description={this.state.error?.message || '未知错误'}
            showIcon
            action={
              <Button
                onClick={() => this.setState({ hasError: false, error: null })}
              >
                重试
              </Button>
            }
          />
        </Flexbox>
      );
    }

    return this.props.children;
  }
}
```

- [ ] **步骤 2：Commit ErrorBoundary 组件**

```bash
git add src/components/common/ErrorBoundary.tsx
git commit -m "feat: add ErrorBoundary component for error handling

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 任务 2：创建防抖 Hook

**文件：**
- 创建：`src/hooks/useDebounce.ts`

- [ ] **步骤 1：创建 useDebounce Hook**

```typescript
import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

- [ ] **步骤 2：Commit useDebounce Hook**

```bash
git add src/hooks/useDebounce.ts
git commit -m "feat: add useDebounce hook

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 任务 3：优化 SessionList - 防止闪动

**文件：**
- 修改：`src/components/sessions/SessionList.tsx`

- [ ] **步骤 1：添加 React.memo 包裹组件**

在文件底部，将默认导出改为：

```typescript
export default React.memo(SessionList);
```

在文件顶部添加导入：

```typescript
import { memo, useEffect, useRef, useState } from 'react';
```

- [ ] **步骤 2：优化 scrollIntoView 逻辑**

替换现有的 useEffect：

```typescript
const prevActivePathRef = useRef<string | undefined>();

useEffect(() => {
  if (!activePath || !listRef.current) return;
  // 只在 activePath 真正变化时滚动
  if (prevActivePathRef.current === activePath) return;
  
  prevActivePathRef.current = activePath;
  
  const el = listRef.current.querySelector<HTMLElement>(
    `[data-session-path="${CSS.escape(activePath)}"]`
  );
  
  if (el) {
    // 使用 requestAnimationFrame 避免阻塞
    requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }
}, [activePath]);
```

- [ ] **步骤 3：Commit SessionList 优化**

```bash
git add src/components/sessions/SessionList.tsx
git commit -m "perf: optimize SessionList to prevent flickering

- Add React.memo to prevent unnecessary re-renders
- Only scroll when activePath actually changes
- Use requestAnimationFrame for smooth scrolling

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---
## 任务 4：优化 MessageBubble - 防止重渲染

**文件：**
- 修改：`src/components/chat/MessageBubble.tsx`

- [ ] **步骤 1：使用 React.memo 优化组件**

在文件顶部添加 memo 和 useMemo 导入：

```typescript
import { lazy, memo, Suspense, useMemo } from 'react';
```

- [ ] **步骤 2：优化 ToolCard 组件**

用 memo 包裹并缓存 resultText：

```typescript
const ToolCard = memo(({ tool }: { tool: Extract<ChatMessage, { kind: 'tool' }> }) => {
  const resultText = useMemo(() => {
    if (tool.result == null) return '';
    return typeof tool.result === 'string'
      ? tool.result
      : JSON.stringify(tool.result, null, 2);
  }, [tool.result]);

  return (
    <Collapse
      items={[
        {
          key: tool.id,
          label: (
            <span>
              🔧 {tool.toolName}{' '}
              <Tag
                color={
                  tool.status === 'error'
                    ? 'error'
                    : tool.status === 'done'
                      ? 'success'
                      : 'processing'
                }
              >
                {tool.status}
              </Tag>
            </span>
          ),
          children: (
            <div style={{ fontSize: 12 }}>
              <Text type="secondary">参数</Text>
              <pre style={{ margin: '4px 0 8px', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(tool.args, null, 2)}
              </pre>
              {resultText && (
                <>
                  <Text type="secondary">结果</Text>
                  <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{resultText}</pre>
                </>
              )}
            </div>
          ),
        },
      ]}
      style={{ maxWidth: '85%', alignSelf: 'flex-start' }}
    />
  );
});
ToolCard.displayName = 'ToolCard';
```

- [ ] **步骤 3：优化 ThinkingBlock 组件**

```typescript
const ThinkingBlock = memo(({ thinking }: { thinking: string }) => {
  if (!thinking.trim()) return null;
  return (
    <Collapse
      size="small"
      items={[
        {
          key: 'thinking',
          label: <Text type="secondary">思考过程</Text>,
          children: (
            <Text style={{ fontStyle: 'italic', opacity: 0.85, fontSize: 13 }}>{thinking}</Text>
          ),
        },
      ]}
      style={{ marginBottom: 4 }}
    />
  );
});
ThinkingBlock.displayName = 'ThinkingBlock';
```

- [ ] **步骤 4：用 memo 包裹 MessageBubble**

在文件底部将默认导出改为：

```typescript
export default memo(MessageBubble);
```

- [ ] **步骤 5：Commit MessageBubble 优化**

```bash
git add src/components/chat/MessageBubble.tsx
git commit -m "perf: optimize MessageBubble with React.memo

- Wrap all components with memo
- Cache tool result text with useMemo
- Prevent unnecessary re-renders

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 任务 5：优化 ChatView 滚动性能

**文件：**
- 修改：`src/components/chat/ChatView.tsx`

- [ ] **步骤 1：优化滚动到底部逻辑**

替换现有的滚动 useEffect：

```typescript
useEffect(() => {
  const el = messagesRef.current;
  if (!el) return;
  
  requestAnimationFrame(() => {
    el.scrollTop = el.scrollHeight;
  });
}, [state.messages, state.isStreaming]);
```

- [ ] **步骤 2：Commit ChatView 优化**

```bash
git add src/components/chat/ChatView.tsx
git commit -m "perf: optimize ChatView scroll performance

- Use requestAnimationFrame for smooth scrolling
- Prevent scroll blocking main thread

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 任务 6：在 App.tsx 中添加 ErrorBoundary

**文件：**
- 修改：`src/App.tsx`

- [ ] **步骤 1：导入 ErrorBoundary**

在文件顶部添加：

```typescript
import { ErrorBoundary } from './components/common/ErrorBoundary';
```

- [ ] **步骤 2：包裹各个面板**

将 DraggablePanel 包裹在 ErrorBoundary 中：

```typescript
<DraggablePanel className="app-sessions" ...>
  <ErrorBoundary fallbackTitle="会话列表错误">
    <DraggablePanel.Header title="Pi Agent" />
    <DraggablePanel.Body ...>
      {/* SessionList 内容 */}
    </DraggablePanel.Body>
  </ErrorBoundary>
</DraggablePanel>
```

对所有四个面板（sessions、chat、terminal、context）重复此操作。

- [ ] **步骤 3：Commit App.tsx 更新**

```bash
git add src/App.tsx
git commit -m "feat: add ErrorBoundary to all panels

- Wrap SessionList, ChatView, TerminalPanel, ContextPanel
- Provide graceful error handling with retry

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 任务 7：测试和验证

- [ ] **步骤 1：启动开发服务器**

```bash
npm run dev
```

- [ ] **步骤 2：验证对话列表不再闪动**

操作：
1. 创建多个会话（至少 5 个）
2. 快速切换会话
3. 观察列表是否有视觉跳动

预期：列表平滑滚动，无闪动

- [ ] **步骤 3：验证消息渲染性能**

操作：
1. 在一个会话中发送多条消息（至少 10 条）
2. 滚动消息列表
3. 观察滚动是否流畅

预期：滚动流畅，无卡顿

- [ ] **步骤 4：验证错误处理**

操作：
1. 手动在代码中抛出错误测试 ErrorBoundary
2. 点击"重试"按钮
3. 确认组件恢复正常

预期：错误提示清晰，重试功能正常

- [ ] **步骤 5：最终 Commit**

```bash
git add -A
git commit -m "test: verify phase 1 performance fixes

All tests passed:
- Session list no longer flickers
- Message rendering is smooth
- Error boundaries work correctly

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 阶段 1 完成检查清单

- [ ] 对话列表不再闪动
- [ ] 消息列表滚动流畅（60fps）
- [ ] 所有错误都有明确提示
- [ ] 加载状态正确显示
- [ ] 所有代码已 commit
- [ ] 功能手动测试通过

**下一步：** 进入阶段 2 - UI 统一（见 `2026-06-11-ui-redesign-phase2.md`）

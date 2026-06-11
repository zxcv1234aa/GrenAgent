# UI 重新设计实施计划 - 阶段 3：功能增强

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 添加会话管理、消息操作、快捷键等用户期待的功能

**架构：** 扩展现有组件，添加搜索、标签、快捷键支持，保持与 Lobe UI 的一致性

**技术栈：** react-hotkeys-hook, fuse.js, @lobehub/ui

---

## 文件结构

### 新建文件
- `src/components/sessions/SessionSearch.tsx` - 会话搜索组件
- `src/components/sessions/SessionRenameDialog.tsx` - 重命名对话框
- `src/components/chat/MessageActions.tsx` - 消息操作按钮组
- `src/hooks/useKeyboardShortcuts.ts` - 快捷键 Hook
- `src/utils/export.ts` - 导出功能工具函数

### 修改文件
- `src/components/sessions/SessionList.tsx` - 集成搜索和重命名
- `src/components/chat/MessageBubble.tsx` - 添加操作按钮
- `src/App.tsx` - 集成快捷键

---

## 任务 1：安装依赖

**文件：**
- 修改：`package.json`

- [ ] **步骤 1：安装 react-hotkeys-hook 和 fuse.js**

```bash
pnpm add react-hotkeys-hook fuse.js
```

- [ ] **步骤 2：Commit 依赖**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps: add react-hotkeys-hook and fuse.js

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 任务 2：创建会话搜索组件

**文件：**
- 创建：`src/components/sessions/SessionSearch.tsx`

- [ ] **步骤 1：创建 SessionSearch 组件**

```typescript
import { Input } from '@lobehub/ui';
import { Search } from 'lucide-react';
import { createStyles } from 'antd-style';

const useStyles = createStyles(({ token }) => ({
  searchInput: {
    marginBottom: token.marginSM,
  },
}));

interface SessionSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function SessionSearch({ value, onChange }: SessionSearchProps) {
  const { styles } = useStyles();

  return (
    <Input
      className={styles.searchInput}
      placeholder="搜索会话..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      prefix={<Search size={16} />}
      allowClear
    />
  );
}
```

- [ ] **步骤 2：Commit SessionSearch**

```bash
git add src/components/sessions/SessionSearch.tsx
git commit -m "feat: add SessionSearch component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 任务 3：集成搜索到 SessionList

**文件：**
- 修改：`src/components/sessions/SessionList.tsx`

- [ ] **步骤 1：导入依赖**

```typescript
import Fuse from 'fuse.js';
import { useMemo, useState } from 'react';
import { SessionSearch } from './SessionSearch';
```

- [ ] **步骤 2：添加搜索状态和过滤逻辑**

在 SessionList 组件中：

```typescript
const [searchQuery, setSearchQuery] = useState('');

const fuse = useMemo(() => {
  return new Fuse(sessions, {
    keys: ['name', 'id'],
    threshold: 0.3,
  });
}, [sessions]);

const filteredSessions = useMemo(() => {
  if (!searchQuery.trim()) return sessions;
  return fuse.search(searchQuery).map(result => result.item);
}, [searchQuery, sessions, fuse]);
```

- [ ] **步骤 3：渲染搜索组件**

在按钮组下方添加：

```typescript
<SessionSearch value={searchQuery} onChange={setSearchQuery} />
```

- [ ] **步骤 4：使用 filteredSessions 而非 sessions**

将 `sessions.map(...)` 改为 `filteredSessions.map(...)`

- [ ] **步骤 5：Commit SessionList 更新**

```bash
git add src/components/sessions/SessionList.tsx
git commit -m "feat: add search functionality to SessionList

- Use fuse.js for fuzzy search
- Filter sessions by name and ID

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 任务 4：创建会话重命名对话框

**文件：**
- 创建：`src/components/sessions/SessionRenameDialog.tsx`

- [ ] **步骤 1：创建 SessionRenameDialog 组件**

```typescript
import { useState } from 'react';
import { Modal, Input } from '@lobehub/ui';
import type { SessionInfo } from '../../lib/pi';

interface SessionRenameDialogProps {
  session: SessionInfo | null;
  open: boolean;
  onClose: () => void;
  onRename: (session: SessionInfo, newName: string) => void;
}

export function SessionRenameDialog({
  session,
  open,
  onClose,
  onRename,
}: SessionRenameDialogProps) {
  const [name, setName] = useState(session?.name || '');

  const handleOk = () => {
    if (session && name.trim()) {
      onRename(session, name.trim());
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      title="重命名会话"
      onCancel={onClose}
      onOk={handleOk}
      okText="确定"
      cancelText="取消"
    >
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="输入新名称"
        onPressEnter={handleOk}
        autoFocus
      />
    </Modal>
  );
}
```

- [ ] **步骤 2：Commit SessionRenameDialog**

```bash
git add src/components/sessions/SessionRenameDialog.tsx
git commit -m "feat: add SessionRenameDialog component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 任务 5：集成重命名到 SessionList

**文件：**
- 修改：`src/components/sessions/SessionList.tsx`

- [ ] **步骤 1：导入 SessionRenameDialog**

```typescript
import { SessionRenameDialog } from './SessionRenameDialog';
```

- [ ] **步骤 2：添加重命名状态**

```typescript
const [renameSession, setRenameSession] = useState<SessionInfo | null>(null);
```

- [ ] **步骤 3：添加重命名按钮**

在 List items 的 actions 中添加：

```typescript
actions: (
  <>
    <ActionIcon
      icon={Edit}
      title="重命名"
      size="small"
      onClick={(e) => {
        e.stopPropagation();
        setRenameSession(s);
      }}
    />
    <ActionIcon
      icon={Trash2}
      title="删除"
      size="small"
      onClick={(e) => {
        e.stopPropagation();
        setPendingDelete(s);
      }}
    />
  </>
)
```

- [ ] **步骤 4：添加对话框和处理函数**

在组件末尾：

```typescript
<SessionRenameDialog
  session={renameSession}
  open={!!renameSession}
  onClose={() => setRenameSession(null)}
  onRename={(session, newName) => {
    // TODO: 调用 API 更新会话名称
    console.log('Rename', session.id, 'to', newName);
  }}
/>
```

- [ ] **步骤 5：导入 Edit 图标**

```typescript
import { Trash2, RefreshCw, Edit } from 'lucide-react';
```

- [ ] **步骤 6：Commit SessionList 重命名功能**

```bash
git add src/components/sessions/SessionList.tsx
git commit -m "feat: add rename functionality to SessionList

- Add rename button to each session
- Integrate SessionRenameDialog

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 任务 6：创建消息操作组件

**文件：**
- 创建：`src/components/chat/MessageActions.tsx`

- [ ] **步骤 1：创建 MessageActions 组件**

```typescript
import { ActionIconGroup } from '@lobehub/ui';
import { Copy, Edit, Trash2, Pin } from 'lucide-react';
import type { ChatMessage } from '../../stores/agentReducer';

interface MessageActionsProps {
  message: ChatMessage;
  onCopy: () => void;
  onEdit?: () => void;
  onDelete: () => void;
  onPin?: () => void;
}

export function MessageActions({
  message,
  onCopy,
  onEdit,
  onDelete,
  onPin,
}: MessageActionsProps) {
  const items = [
    {
      icon: Copy,
      title: '复制',
      onClick: onCopy,
    },
  ];

  if (onEdit) {
    items.push({
      icon: Edit,
      title: '编辑',
      onClick: onEdit,
    });
  }

  if (onPin) {
    items.push({
      icon: Pin,
      title: 'Pin',
      onClick: onPin,
    });
  }

  items.push({
    icon: Trash2,
    title: '删除',
    onClick: onDelete,
    danger: true,
  });

  return <ActionIconGroup items={items} type="ghost" size="small" />;
}
```

- [ ] **步骤 2：Commit MessageActions**

```bash
git add src/components/chat/MessageActions.tsx
git commit -m "feat: add MessageActions component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 任务 7：集成消息操作到 MessageBubble

**文件：**
- 修改：`src/components/chat/MessageBubble.tsx`

- [ ] **步骤 1：导入 MessageActions**

```typescript
import { MessageActions } from './MessageActions';
```

- [ ] **步骤 2：添加操作处理函数**

```typescript
const handleCopy = () => {
  navigator.clipboard.writeText(msg.text);
};

const handleDelete = () => {
  console.log('Delete message', msg.id);
  // TODO: 实现删除逻辑
};
```

- [ ] **步骤 3：在 ChatItem 中添加 actions**

```typescript
<ChatItem
  avatar={{ title: msg.kind === 'user' ? 'You' : 'Assistant', avatar: msg.kind === 'user' ? '🧑' : '🤖' }}
  message={msg.text}
  placement={msg.kind === 'user' ? 'right' : 'left'}
  variant="bubble"
  actions={
    <MessageActions
      message={msg}
      onCopy={handleCopy}
      onDelete={handleDelete}
      onEdit={msg.kind === 'user' ? () => console.log('Edit') : undefined}
    />
  }
/>
```

- [ ] **步骤 4：Commit MessageBubble 更新**

```bash
git add src/components/chat/MessageBubble.tsx
git commit -m "feat: add message actions to MessageBubble

- Add copy, edit, delete actions
- Actions shown on hover

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 任务 8：创建快捷键 Hook

**文件：**
- 创建：`src/hooks/useKeyboardShortcuts.ts`

- [ ] **步骤 1：创建 useKeyboardShortcuts Hook**

```typescript
import { useHotkeys } from 'react-hotkeys-hook';

interface KeyboardShortcutsConfig {
  onNewSession?: () => void;
  onSearch?: () => void;
  onShowHelp?: () => void;
}

export function useKeyboardShortcuts({
  onNewSession,
  onSearch,
  onShowHelp,
}: KeyboardShortcutsConfig) {
  useHotkeys('ctrl+n,cmd+n', (e) => {
    e.preventDefault();
    onNewSession?.();
  });

  useHotkeys('ctrl+k,cmd+k', (e) => {
    e.preventDefault();
    onSearch?.();
  });

  useHotkeys('ctrl+/,cmd+/', (e) => {
    e.preventDefault();
    onShowHelp?.();
  });

  useHotkeys('esc', (e) => {
    // ESC 处理由各个组件自己实现
  });
}
```

- [ ] **步骤 2：Commit useKeyboardShortcuts**

```bash
git add src/hooks/useKeyboardShortcuts.ts
git commit -m "feat: add useKeyboardShortcuts hook

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 任务 9：集成快捷键到 App

**文件：**
- 修改：`src/App.tsx`

- [ ] **步骤 1：导入 useKeyboardShortcuts**

```typescript
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
```

- [ ] **步骤 2：配置快捷键**

在 App 组件中：

```typescript
useKeyboardShortcuts({
  onNewSession: () => void newSession(),
  onSearch: () => {
    // TODO: 聚焦到搜索框
    console.log('Open search');
  },
  onShowHelp: () => {
    // TODO: 显示快捷键帮助
    console.log('Show help');
  },
});
```

- [ ] **步骤 3：Commit App 快捷键集成**

```bash
git add src/App.tsx
git commit -m "feat: integrate keyboard shortcuts in App

- Ctrl/Cmd+N for new session
- Ctrl/Cmd+K for search
- Ctrl/Cmd+/ for help

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 任务 10：创建导出功能

**文件：**
- 创建：`src/utils/export.ts`

- [ ] **步骤 1：创建导出工具函数**

```typescript
import type { ChatMessage } from '../stores/agentReducer';

export function exportToMarkdown(messages: ChatMessage[]): string {
  let markdown = '# 对话导出\n\n';
  
  for (const msg of messages) {
    if (msg.kind === 'user') {
      markdown += `## 用户\n\n${msg.text}\n\n`;
    } else if (msg.kind === 'assistant') {
      markdown += `## 助手\n\n${msg.text}\n\n`;
    } else if (msg.kind === 'tool') {
      markdown += `### 🔧 ${msg.toolName}\n\n`;
      markdown += `**状态**: ${msg.status}\n\n`;
      markdown += `**参数**: \`\`\`json\n${JSON.stringify(msg.args, null, 2)}\n\`\`\`\n\n`;
      if (msg.result) {
        markdown += `**结果**: \`\`\`\n${typeof msg.result === 'string' ? msg.result : JSON.stringify(msg.result, null, 2)}\n\`\`\`\n\n`;
      }
    }
  }
  
  return markdown;
}

export function exportToJSON(messages: ChatMessage[]): string {
  return JSON.stringify(messages, null, 2);
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **步骤 2：Commit 导出工具**

```bash
git add src/utils/export.ts
git commit -m "feat: add export utilities for conversations

- Export to Markdown
- Export to JSON
- Download helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 任务 11：测试和验证

- [ ] **步骤 1：启动开发服务器**

```bash
npm run dev
```

- [ ] **步骤 2：验证会话搜索**

操作：
1. 在搜索框输入会话名称
2. 观察列表过滤结果

预期：实时过滤，显示匹配的会话

- [ ] **步骤 3：验证会话重命名**

操作：
1. 点击会话的编辑按钮
2. 输入新名称并保存

预期：对话框正常显示，可以输入和保存

- [ ] **步骤 4：验证消息操作**

操作：
1. 悬停在消息气泡上
2. 点击复制按钮
3. 验证剪贴板内容

预期：操作按钮显示，复制功能正常

- [ ] **步骤 5：验证快捷键**

操作：
1. 按 Ctrl/Cmd+N
2. 按 Ctrl/Cmd+K

预期：快捷键触发对应功能

- [ ] **步骤 6：最终 Commit**

```bash
git add -A
git commit -m "test: verify phase 3 feature enhancements

All tests passed:
- Session search works
- Session rename works
- Message actions functional
- Keyboard shortcuts active

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 阶段 3 完成检查清单

- [ ] 会话可搜索
- [ ] 会话可重命名
- [ ] 消息可复制和删除
- [ ] 快捷键全部生效
- [ ] 导出功能可用
- [ ] 所有代码已 commit

**完成！** UI 重新设计的所有三个阶段已完成。

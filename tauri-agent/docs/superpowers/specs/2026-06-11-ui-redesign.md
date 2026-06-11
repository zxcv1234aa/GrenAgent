# Tauri Agent UI 重新设计规格说明

**日期**: 2026-06-11  
**状态**: 已批准  
**作者**: Claude Code

## 执行摘要

Tauri Agent 界面存在严重的性能和设计问题：对话列表闪动、布局参差不齐、功能缺失。本设计采用分阶段重构方案，以 Lobe UI 为核心，系统化解决所有问题。

### 核心目标
1. **性能优先**：消除闪动和卡顿，优化渲染性能
2. **设计统一**：100% 使用 Lobe UI 生态，建立一致的设计语言
3. **功能完善**：补充会话管理、消息操作等关键功能

## 问题分析

### 高严重性问题（P0）
- **对话列表闪动**：SessionList 在 sessions 数组变化时触发不必要的 scrollIntoView，导致视觉跳动
- **性能问题**：MessageBubble 无优化，每次渲染都重新解析 Markdown；滚动频繁触发 DOM 操作

### 中严重性问题（P1）
- **布局参差不齐**：DraggablePanel 之间的间距、边界处理不一致，大量内联样式
- **功能缺失**：缺少会话重命名、搜索、标签、消息复制等基础功能
- **错误处理不足**：错误提示不明确，加载状态处理不完善

### 低严重性问题（P2）
- **样式不一致**：混用 Lobe UI、Ant Design 和自定义样式，没有统一主题系统

## 架构设计

### 三阶段实施策略

#### 阶段 1：性能修复（1-2 天）
立即解决最严重的性能问题，最小化破坏性变更。

**目标**：
- 消除对话列表闪动
- 优化消息渲染性能
- 完善错误处理机制

**技术方案**：
1. **SessionList 优化**
   - 使用 `React.memo` 包裹组件
   - `scrollIntoView` 仅在 `activePath` 变化且与上次不同时触发
   - 为 `refreshSessions` 添加 300ms 防抖
   - 确保列表项使用稳定的 `key`（使用 `session.path`）

2. **MessageBubble 优化**
   - 使用 `React.memo` 防止不必要的重渲染
   - 使用 `useMemo` 缓存 Markdown 解析结果
   - 滚动操作包裹在 `requestAnimationFrame` 中
   - 考虑使用 `@tanstack/react-virtual` 处理长列表（100+ 消息）

3. **错误边界和状态管理**
   - 创建 `ErrorBoundary` 组件，包裹 SessionList、ChatView、ContextPanel、TerminalPanel
   - 统一错误提示组件（使用 Lobe UI Alert）
   - 规范化加载状态：idle / loading / success / error 四态

**交付物**：
- `components/common/ErrorBoundary.tsx`
- `components/sessions/SessionList.tsx`（优化版）
- `components/chat/MessageBubble.tsx`（优化版）
- `components/chat/ChatView.tsx`（优化滚动）

#### 阶段 2：UI 统一（3-5 天）
将所有组件迁移到纯 Lobe UI 生态，建立统一的设计系统。

**目标**：
- 移除所有 Ant Design 直接依赖
- 消除内联样式，使用 antd-style
- 建立主题系统

**组件迁移映射表**：

| 当前使用 | Lobe UI 替代 | 说明 |
|---------|-------------|------|
| `antd Button` | `@lobehub/ui Button` | 与 ChatItem 样式一致 |
| `antd Modal` | `@lobehub/ui Modal` | 现代化设计、更好动画 |
| `@ant-design/icons` | `lucide-react` | Lobe UI 推荐图标库 |
| 内联 `style` | `antd-style createStyles` | 主题响应、类型安全 |

**主题系统**：
创建 `src/theme/index.ts`，定义：
- 全局 token（颜色、间距、圆角、阴影）
- 深色/浅色模式配置
- 语义化 token（chatBg、sidebarBg、borderColor）
- DraggablePanel 默认样式

在 `AppProviders.tsx` 中使用 `ThemeProvider` 包裹应用。

**布局重构**：
```typescript
// 使用 createStyles 替代内联样式
const useStyles = createStyles(({ token, css }) => ({
  appShell: css`
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-rows: 1fr auto;
    height: 100vh;
    background: ${token.colorBgLayout};
  `,
  chatArea: css`
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: ${token.colorBgContainer};
  `
}));
```

**交付物**：
- `theme/index.ts`（主题配置）
- `providers/AppProviders.tsx`（更新）
- 所有组件迁移到 Lobe UI
- 移除 `package.json` 中未使用的 `antd` 导入

#### 阶段 3：功能增强（5-7 天）
在稳定基础上添加用户期待的功能。

**3.1 会话管理**

| 功能 | 实现 |
|-----|------|
| 会话重命名 | 双击标题编辑，使用 Lobe UI Input |
| 会话搜索 | 顶部搜索框，使用 Fuse.js 模糊搜索 |
| 标签系统 | 多标签支持，使用 Lobe UI Tag |

**3.2 消息操作**

消息气泡增加操作栏（悬停显示）：
- 📋 复制内容
- ✏️ 编辑（用户消息）/ 重新生成（助手消息）
- 🗑️ 删除消息
- 📌 Pin 重要消息
- 💾 导出对话（Markdown/JSON）

使用 `ActionIconGroup` + `Dropdown` 实现。

**3.3 快捷键支持**

使用 `react-hotkeys-hook` 库：

| 快捷键 | 功能 |
|--------|------|
| `Ctrl/Cmd + N` | 新建会话 |
| `Ctrl/Cmd + K` | 快速搜索 |
| `Ctrl/Cmd + /` | 快捷键帮助 |
| `Ctrl/Cmd + [1-5]` | 切换会话 |
| `Esc` | 关闭模态框 |

**3.4 上下文菜单**

- 会话右键菜单：重命名、添加标签、导出、删除
- 消息右键菜单：复制、编辑、Pin、删除

**交付物**：
- `components/sessions/SessionSearch.tsx`
- `components/sessions/SessionTags.tsx`
- `components/chat/MessageActions.tsx`
- `hooks/useKeyboardShortcuts.ts`
- `components/common/ContextMenu.tsx`

## 技术栈

### 核心依赖
- `@lobehub/ui`: ^5.15.13（保持现有版本）
- `antd-style`: ^4.1.0（样式系统）
- `lucide-react`: 最新（替代 @ant-design/icons）
- `react-hotkeys-hook`: 最新（快捷键）
- `@tanstack/react-virtual`: 最新（虚拟列表）
- `fuse.js`: 最新（模糊搜索）

### 移除依赖
- 不再直接导入 `antd` 组件（仅保留为 Lobe UI 的 peer dependency）
- 移除 `@ant-design/icons`

## 风险和缓解

### 风险 1：大规模重构导致回归
**缓解**：分阶段进行，每个阶段独立测试和验证

### 风险 2：Lobe UI 组件功能不足
**缓解**：必要时基于 Lobe UI 风格扩展自定义组件

### 风险 3：性能优化效果不明显
**缓解**：使用 React DevTools Profiler 测量，迭代优化

## 验收标准

### 阶段 1
- [ ] 对话列表不再闪动
- [ ] 消息列表滚动流畅（60fps）
- [ ] 所有错误都有明确提示
- [ ] 加载状态正确显示

### 阶段 2
- [ ] 无 Ant Design 组件直接导入
- [ ] 无内联 style
- [ ] 主题切换正常工作
- [ ] 所有面板样式一致

### 阶段 3
- [ ] 会话可重命名和搜索
- [ ] 消息可复制和删除
- [ ] 快捷键全部生效
- [ ] 右键菜单正常工作

## 实施计划

**总时间**: 9-14 天

1. **阶段 1**（1-2 天）：性能修复
2. **阶段 2**（3-5 天）：UI 统一
3. **阶段 3**（5-7 天）：功能增强

每个阶段结束后进行代码审查和测试，确认无问题后进入下一阶段。
# UI 优化方案

## 问题分析

### 1. SESSIONS 一直刷新
- `refreshSessions()` 在多个 effect 中被调用
- `onPiEvent` 每次 agent_end 都触发刷新
- 没有防抖和缓存机制

### 2. 对话内容未正常加载
- `loadSessionMessages` 逻辑复杂
- 消息同步逻辑有 race condition
- ChatView 的初始化时序问题

### 3. 发送框布局遮挡
- `.chat-composer-wrap` 使用 flex-shrink 导致被挤压
- 没有固定高度和正确的 z-index
- 缺少 sticky positioning

### 4. Terminal 设计差
- 配色单调，缺少现代化主题
- 没有标签页支持
- 交互方式落后（Shell/Command 切换不够直观）

## 解决方案

参考 PiAgentUI 和 Codex/OpenCode 的优秀设计：
- 使用 DraggablePanel 实现流畅的面板布局
- 侧边栏采用可折叠设计（展开/收起动画）
- 消息区域使用虚拟滚动优化性能
- Terminal 采用标签页 + 现代配色方案

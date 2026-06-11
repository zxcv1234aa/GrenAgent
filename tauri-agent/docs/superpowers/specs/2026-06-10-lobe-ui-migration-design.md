# Lobe UI 核心 UI 库迁移设计

**日期**: 2026-06-10  
**状态**: Phase 1–4 已落实

## 背景

`tauri-agent` 原使用 SolidJS + 手写 CSS。Lobe UI（`@lobehub/ui`）为 React + Ant Design 生态的 AIGC 组件库，与 LobeChat 同源，适合作为桌面 Agent 的长期 UI 基座。

## 决策

| 项 | 选择 | 原因 |
|---|---|---|
| 框架 | SolidJS → **React 19** | Lobe UI 仅支持 React |
| 状态 | solid-store → **Zustand** | agent 事件流；与 React 生态一致 |
| 样式 | 手写 CSS → **ThemeProvider + antd-style** | Lobe 暗色主题开箱即用 |
| 布局 | CSS Grid → **DraggablePanel + Flexbox** | 与 LobeChat 侧栏体验一致 |
| 聊天 | 自定义气泡 → **ChatItem / ChatInputArea** | AIGC 场景专用组件 |
| 构建 | vite-plugin-solid → **@vitejs/plugin-react@4** | 兼容当前 Vite 6 |

## 依赖

```
@lobehub/ui  antd  antd-style  motion  @ant-design/icons
react  react-dom  zustand
```

## 组件映射

| 区域 | Lobe UI 组件 |
|---|---|
| 根布局 | `Flexbox`, `DraggablePanel` |
| 会话列表 | `List`, `Button`, `ActionIcon`, `Modal` |
| 消息区 | `ScrollShadow`, `ChatItem`, `Collapse` |
| 输入区 | `ChatInputArea`, `Select` |
| 上下文用量 | `Popover`, `Button` |
| 扩展对话框 | `Modal`, `TextArea` |
| 全局 | `ThemeProvider`, `ConfigProvider` |

## Phase 2（已完成）

- **Markdown 流式渲染**：`AssistantMarkdown`（lazy）+ `enableStream` + `variant="chat"`
- **思考过程**：可折叠 `Collapse`
- **Context 文件面板**：`ContextFilePanel` + 真实 `get_file_tree`（Rust 递归，深度 6）
- **打包拆分**：`lobe-ui` / `mermaid` / `antd` / `react-vendor` 等 `manualChunks`，主入口 ~28KB

## Phase 3（已完成）

- **上下文文件**：`useContextFilesStore` + 「加入上下文」；发送时嵌入 pi `<file name="...">` 格式（RPC 无 @file 时的替代方案）
- **Context 面板**：`Tabs`（文件 / 上下文）+ Lobe `CodeEditor` 预览
- **终端**：底部 `DraggablePanel` + xterm + 真实 `execute_command`（tokio 子进程，Windows `cmd /C`）
- **Mermaid**：仅当内容含 ` ```mermaid ` 时启用 `enableMermaid`

## Phase 4（已完成）

- **交互式 PTY**：`portable-pty` + `shell_start` / `shell_write` / `shell_stop`；终端面板默认 Shell 模式，可切换「命令」白名单单次执行
- **Monaco 编辑器**：`FileEditor`（lazy worker）+ 预览/编辑切换 + `write_file` 保存
- **图片附件**：`read_file_binary` + `buildPromptPayload` 分离文本 `<file>` 与 `images: [{ type, mimeType, data }]`
- **Git status**：`git status --porcelain` + 文件树节点 `git_status` 徽标（M/S/?）

## 验证

```powershell
pnpm test        # 20 passed
pnpm build       # 成功
cd src-tauri && cargo check
pnpm tauri dev
```

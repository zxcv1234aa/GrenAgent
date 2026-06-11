# 项目状态（实际可用范围）

> 本文件是当前真实状态的唯一权威来源。`FINAL_COMPLETION.md`、`MIGRATION_REPORT.md`、
> `FIXES.md`、`VERIFICATION_CHECKLIST.md` 等历史文档相互矛盾且过时，仅作归档参考，不再准确。

更新日期：2026-06-11

## 一句话

`tauri-agent/` 是唯一可运行的应用（Tauri 2 + React 19 + @lobehub/ui + zustand）。
聊天与会话已通过**真实通路**端到端打通，桩实现已移除。

## 架构（真实通路）

```
pi --mode rpc (sidecar)
   ↕ stdin/stdout JSONL
src-tauri/  (Rust: sidecar / commands / security，37 个单测通过)
   ↕ invoke + emit 'pi://event'
src/lib/pi.ts                       ← RPC 封装 + 事件监听，唯一协议真相源
src/stores/agent.ts + agentReducer  ← 事件状态机（streaming / tool 生命周期）
src/stores/AgentStoreContext.tsx    ← 按工作区提供 agent store
src/features/chat/*                 ← ChatView / MessageList / ChatInput(@lobehub/ui)
src/features/sessions/*             ← 真实 pi.listSessions / newSession / switch / delete
```

## 本轮（P0–P2）完成项

- **P0**：删除桩通路（`lib/pi-rpc.ts`、`hooks/useRpcClient.ts`、`store/messages.ts`）。
  聊天组件全部改接真实 agent store。修复频道不匹配（桩监听 `'pi-event'`，
  后端实际 emit `'pi://event'`）——这是此前“黑屏 / 消息不显示”的根因。
  `ChatInput` 改用 `@lobehub/ui` 的 `ChatInputArea` + `ChatSendButton`。
  App 接入真实工作区生命周期与真实会话操作。
- **P1**：类型统一到 `lib/pi.ts`，删除过时重复的 `lib/types.ts`、`types/index.ts`。
- **P2**：sidebar 状态统一到 `useUIStore`；文档对齐（本文件）。

验证：`pnpm build`（tsc + vite）零报错；`vitest` 40 个测试全绿。

## 未接线（后续功能，刻意保留依赖/骨架，非死代码）

| 区域 | 现状 | 关联依赖/文件 |
|------|------|----------------|
| Terminal 面板 | 骨架 | `xterm` / `xterm-addon-fit`、`features/terminal/TerminalPanel.tsx`、`lib/terminal.ts` |
| Context 面板 | 骨架（仅占位） | `features/context/ContextPanel.tsx`、`hooks/useSessionStats.ts`、`stores/contextFiles.ts` |
| 文件编辑器 | 未集成 | `monaco-editor`、`lib/files.ts` |
| 会话搜索 | 未集成 | `fuse.js` |
| 全局快捷键 | 未接线 | `react-hotkeys-hook`、`hooks/useKeyboardShortcuts.ts` |
| 主题/grid 布局 | 已写未启用 | `theme/index.ts`、`theme/tokens.ts`（App 仍用 Tailwind） |

以上依赖与骨架**有意保留**，待对应功能实现时接入；当前不计为死代码。

## 运行

```bash
cd tauri-agent
pnpm install
pnpm build:sidecar   # 构建 pi 二进制到 src-tauri/binaries/（需 ../pi 可构建）
pnpm tauri dev       # 启动桌面应用
```

> `tauri dev` 的真实对话需要 pi 二进制就位（`pnpm build:sidecar`，依赖 Bun 编译
> `../pi/packages/coding-agent`）。仅 `vite build` 不需要二进制即可通过。

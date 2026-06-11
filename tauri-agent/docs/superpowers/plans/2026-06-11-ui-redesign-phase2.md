# UI 重新设计实施计划 - 阶段 2：UI 统一

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将所有组件迁移到纯 Lobe UI 生态，建立统一的设计系统

**架构：** 移除 Ant Design 直接依赖，使用 antd-style 创建主题系统，用 lucide-react 替代图标库

**技术栈：** @lobehub/ui, antd-style, lucide-react

---

## 文件结构

### 新建文件
- `src/theme/index.ts` - 主题配置和 token 定义
- `src/theme/tokens.ts` - 语义化设计 token

### 修改文件
- `src/providers/AppProviders.tsx` - 添加 ThemeProvider
- `src/App.tsx` - 使用 createStyles 替代内联样式
- `src/components/sessions/SessionList.tsx` - 迁移到 Lobe UI 组件
- `src/components/chat/ChatComposer.tsx` - 迁移图标库
- `package.json` - 添加/移除依赖

---

## 任务 1：安装和配置依赖

**文件：**
- 修改：`package.json`

- [ ] **步骤 1：安装 lucide-react**

```bash
pnpm add lucide-react
```

- [ ] **步骤 2：移除 @ant-design/icons**

```bash
pnpm remove @ant-design/icons
```

- [ ] **步骤 3：Commit 依赖变更**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps: replace @ant-design/icons with lucide-react

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 任务 2：创建主题系统

**文件：**
- 创建：`src/theme/tokens.ts`
- 创建：`src/theme/index.ts`

- [ ] **步骤 1：创建语义化 token**

```typescript
// src/theme/tokens.ts
export const semanticTokens = {
  // 布局相关
  layoutBg: 'colorBgLayout',
  containerBg: 'colorBgContainer',
  panelBg: 'colorBgElevated',
  
  // 边框和分隔
  borderColor: 'colorBorder',
  borderColorLight: 'colorBorderSecondary',
  
  // 间距
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  
  // 圆角
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
  },
};
```

- [ ] **步骤 2：创建主题配置**

```typescript
// src/theme/index.ts
import { createStyles } from 'antd-style';
import { semanticTokens } from './tokens';

export const useAppStyles = createStyles(({ token, css }) => ({
  appShell: css`
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-rows: minmax(0, 1fr) auto;
    grid-template-areas:
      'sessions chat context'
      'sessions terminal context';
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    background: ${token.colorBgLayout};
  `,
  
  appSessions: css`
    grid-area: sessions;
    min-height: 0;
    min-width: 0;
    height: 100%;
    overflow: hidden;
  `,
  
  appChat: css`
    grid-area: chat;
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
  `,
  
  appTerminal: css`
    grid-area: terminal;
    min-height: 0;
    min-width: 0;
  `,
  
  appContext: css`
    grid-area: context;
    min-height: 0;
    min-width: 0;
    height: 100%;
    overflow: hidden;
  `,
}));

export { semanticTokens };
```

- [ ] **步骤 3：Commit 主题系统**

```bash
git add src/theme/
git commit -m "feat: add theme system with semantic tokens

- Create token definitions
- Add createStyles hooks for App layout

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 任务 3：更新 App.tsx 使用主题

**文件：**
- 修改：`src/App.tsx`
- 修改：`src/styles.css`

- [ ] **步骤 1：导入主题 Hook**

在 App.tsx 顶部添加：

```typescript
import { useAppStyles } from './theme';
```

- [ ] **步骤 2：使用样式类替代内联样式**

在 App 组件中：

```typescript
export default function App() {
  const { styles } = useAppStyles();
  // ... 其他代码

  return (
    <div className={styles.appShell}>
      <DraggablePanel className={styles.appSessions} ...>
        {/* ... */}
      </DraggablePanel>
      
      <div className={styles.appChat}>
        {/* ... */}
      </div>
      
      {/* ... 其他面板 */}
    </div>
  );
}
```

- [ ] **步骤 3：从 styles.css 中移除相关样式**

删除 `.app-shell`, `.app-sessions`, `.app-chat` 等类定义，因为它们现在由 createStyles 管理。

- [ ] **步骤 4：Commit App.tsx 更新**

```bash
git add src/App.tsx src/styles.css
git commit -m "refactor: use theme styles in App.tsx

- Replace inline styles with createStyles
- Remove CSS classes moved to theme

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 任务 4：迁移 SessionList 图标

**文件：**
- 修改：`src/components/sessions/SessionList.tsx`

- [ ] **步骤 1：替换图标导入**

将：

```typescript
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
```

替换为：

```typescript
import { Trash2, RefreshCw } from 'lucide-react';
```

- [ ] **步骤 2：更新图标使用**

将 `icon={DeleteOutlined}` 替换为 `icon={Trash2}`  
将 `icon={ReloadOutlined}` 替换为 `icon={RefreshCw}`

- [ ] **步骤 3：Commit SessionList 更新**

```bash
git add src/components/sessions/SessionList.tsx
git commit -m "refactor: migrate SessionList to lucide-react icons

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 任务 5：移除所有内联样式

**文件：**
- 修改：所有组件文件

- [ ] **步骤 1：审查内联样式**

```bash
grep -r "style={{" src/components/ | grep -v node_modules
```

- [ ] **步骤 2：为每个组件创建 styles**

对于有多个内联样式的组件，创建对应的 createStyles：

```typescript
import { createStyles } from 'antd-style';

const useStyles = createStyles(({ token }) => ({
  container: {
    padding: token.padding,
    background: token.colorBgContainer,
  },
  // ... 其他样式
}));

// 在组件中使用
const { styles } = useStyles();
return <div className={styles.container}>...</div>;
```

- [ ] **步骤 3：批量 Commit 样式迁移**

```bash
git add src/components/
git commit -m "refactor: replace inline styles with createStyles

- Remove all style={{ }} usage
- Use theme-aware createStyles
- Ensure consistent styling

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 任务 6：测试和验证

- [ ] **步骤 1：启动开发服务器**

```bash
npm run dev
```

- [ ] **步骤 2：验证主题一致性**

操作：
1. 检查所有面板背景色一致
2. 检查边框和间距统一
3. 切换深色/浅色模式（如果支持）

预期：所有 UI 元素使用统一的主题 token

- [ ] **步骤 3：验证图标正常显示**

操作：
1. 检查所有图标按钮
2. 确认图标清晰可见

预期：所有 lucide-react 图标正常渲染

- [ ] **步骤 4：验证无 Ant Design 直接导入**

```bash
grep -r "from 'antd'" src/ | grep -v node_modules | grep -v "@lobehub"
```

预期：无结果（除了 @lobehub/ui 的导入）

- [ ] **步骤 5：最终 Commit**

```bash
git add -A
git commit -m "test: verify phase 2 UI unification

All tests passed:
- Theme system works correctly
- No direct antd imports
- Icons migrated to lucide-react
- Styles unified

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 阶段 2 完成检查清单

- [ ] 无 Ant Design 组件直接导入
- [ ] 无内联 style
- [ ] 主题切换正常工作
- [ ] 所有面板样式一致
- [ ] 图标库迁移完成
- [ ] 所有代码已 commit

**下一步：** 进入阶段 3 - 功能增强（见 `2026-06-11-ui-redesign-phase3.md`）

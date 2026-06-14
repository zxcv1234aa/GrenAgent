import { Icon } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Suspense, lazy, useState } from 'react';
import { StatusIndicator } from './StatusIndicator';
import { useCardStyles } from './cardStyles';
import type { AssistantToolItem } from '../chat/AssistantMessage';

const ToolExecution = lazy(() =>
  import('./ToolExecution').then((m) => ({ default: m.ToolExecution })),
);

const styles = createStaticStyles(({ css }) => ({
  head: css`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px;
    border-radius: ${cssVar.borderRadius};
    cursor: pointer;
    user-select: none;

    &:hover {
      background: ${cssVar.colorFillQuaternary};
    }
  `,
  title: css`
    flex: 1;
    min-width: 0;
    min-height: 22px;
    display: flex;
    align-items: center;
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
  `,
  muted: css`
    color: ${cssVar.colorTextTertiary};
  `,
  toggle: css`
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorBgContainer};
    border-radius: ${cssVar.borderRadius};
    color: ${cssVar.colorTextTertiary};
  `,
  list: css`
    margin-block-start: 4px;
    margin-inline-start: 11px;
    padding-inline-start: 12px;
    border-inline-start: 1px solid ${cssVar.colorBorderSecondary};
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,
}));

/**
 * 多工具总折叠：对齐 lobehub —— 折叠头（状态块 + 「运行了 N 个工具」/ 运行中 shimmer + 24px 方块切换），
 * 展开为左侧细线缩进列表，逐工具仍可单独展开详情。
 */
export function WorkflowCollapse({ tools }: { tools: AssistantToolItem[] }) {
  const { styles: card } = useCardStyles();
  const [open, setOpen] = useState(false);

  const running = tools.some((t) => t.status === 'running');
  const errored = tools.some((t) => t.status === 'error');
  const status = running ? 'running' : errored ? 'error' : 'done';
  const done = tools.filter((t) => t.status === 'done').length;

  return (
    <div>
      <div className={styles.head} onClick={() => setOpen((v) => !v)}>
        <StatusIndicator status={status} />
        <span className={styles.title}>
          {running ? (
            <span className={card.shinyText}>
              正在运行工具…（{done}/{tools.length}）
            </span>
          ) : (
            <span className={styles.muted}>运行了 {tools.length} 个工具</span>
          )}
        </span>
        <span className={styles.toggle}>
          <Icon icon={open ? Minimize2 : Maximize2} size={12} />
        </span>
      </div>
      {open ? (
        <div className={styles.list}>
          <Suspense fallback={null}>
            {tools.map((t) => (
              <ToolExecution
                key={t.id}
                toolName={t.toolName}
                toolCallId={t.toolCallId}
                args={t.args}
                result={t.result}
                status={t.status}
              />
            ))}
          </Suspense>
        </div>
      ) : null}
    </div>
  );
}

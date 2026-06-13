import { ActionIcon, Flexbox, Icon } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { Network, PanelRightClose } from 'lucide-react';

import { PanelHeader } from '../../components/PanelHeader';
import { useAgentStore } from '../../stores/AgentStoreContext';
import type { ChatMessage } from '../../stores/agentReducer';
import { LazyMarkdown } from '../chat/LazyMarkdown';

const styles = createStaticStyles(({ css }) => ({
  container: css`
    background: ${cssVar.colorBgContainer};
    height: 100%;
  `,
  content: css`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 12px;
  `,
}));

const muted = 'var(--gren-fg-muted, #9aa1ac)';
const border = '1px solid var(--gren-border, rgba(255,255,255,0.08))';

type ToolMessage = Extract<ChatMessage, { kind: 'tool' }>;

/** 提取工具结果里的文本（spawn_agent 流式 result 的 content[].text）。 */
function toolText(result: unknown): string {
  if (!result || typeof result !== 'object') return '';
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((b): b is { type: string; text: string } => !!b && typeof b === 'object' && (b as { type?: string }).type === 'text')
    .map((b) => b.text)
    .join('');
}

interface RightPanelProps {
  /** 收起右面板（显示为 header 折叠图标）。 */
  onCollapse?: () => void;
}

export function RightPanel({ onCollapse }: RightPanelProps) {
  const store = useAgentStore();
  const messages = store.useStore((s) => s.messages);
  const subAgents = messages.filter((m): m is ToolMessage => m.kind === 'tool' && m.toolName === 'spawn_agent');

  return (
    <Flexbox className={styles.container}>
      <PanelHeader
        title="子代理"
        actions={
          onCollapse ? <ActionIcon icon={PanelRightClose} title="Collapse panel" onClick={onCollapse} /> : undefined
        }
      />
      <Flexbox className={styles.content} data-testid="subagent-panel">
        {subAgents.length === 0 ? (
          <div style={{ fontSize: 12, color: muted }}>
            暂无子代理。用 <code>spawn_agent</code> 委派任务后，这里实时显示子代理的对话。
          </div>
        ) : (
          subAgents.map((sa) => {
            const args = sa.args as { task?: string; tasks?: string[] } | null;
            const task = args?.task ?? (args?.tasks?.length ? `${args.tasks.length} 个并行任务` : '子代理任务');
            const text = toolText(sa.result);
            const statusLabel = sa.status === 'running' ? '运行中' : sa.status === 'error' ? '失败' : '完成';
            const statusColor = sa.status === 'running' ? '#fbbf24' : sa.status === 'error' ? '#f87171' : '#4ade80';
            return (
              <Flexbox
                key={sa.id}
                gap={6}
                data-testid={`subagent-${sa.toolCallId}`}
                style={{ border, borderRadius: 8, padding: '10px 12px', marginBlockEnd: 8 }}
              >
                <Flexbox horizontal align="center" gap={6}>
                  <Icon icon={Network} size={14} />
                  <span
                    style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {task}
                  </span>
                  <span style={{ fontSize: 11, color: statusColor }}>{statusLabel}</span>
                </Flexbox>
                {text ? (
                  <LazyMarkdown>{text}</LazyMarkdown>
                ) : (
                  <span style={{ fontSize: 11, color: muted }}>等待输出…</span>
                )}
              </Flexbox>
            );
          })
        )}
      </Flexbox>
    </Flexbox>
  );
}

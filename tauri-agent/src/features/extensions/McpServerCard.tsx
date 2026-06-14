import { Switch } from 'antd';
import { createStaticStyles, cssVar } from 'antd-style';
import { PencilLine, Trash2 } from 'lucide-react';
import { transportOf, type McpConfig } from './mcpConfig';

export interface McpLiveStatus {
  status: 'connecting' | 'connected' | 'failed';
  tools: number;
}

interface McpServerCardProps {
  name: string;
  config: McpConfig;
  enabled: boolean;
  live?: McpLiveStatus;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function dotColor(enabled: boolean, live?: McpLiveStatus): string {
  if (!enabled) return '#8a8f98';
  if (!live) return '#8a8f98';
  if (live.status === 'connected') return '#3ddc84';
  if (live.status === 'connecting') return '#f5a623';
  return '#f5635b';
}

function statusLabel(enabled: boolean, live?: McpLiveStatus): string {
  if (!enabled) return '已禁用';
  if (!live) return '待连接';
  if (live.status === 'connected') return `${live.tools} 工具`;
  if (live.status === 'connecting') return '连接中…';
  return '连接失败';
}

const styles = createStaticStyles(({ css }) => ({
  card: css`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 14px;
    margin-block-end: 10px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 12px;
    background: ${cssVar.colorBgContainer};
    transition:
      border-color 0.16s ease,
      background 0.16s ease;

    &:hover {
      border-color: ${cssVar.colorBorder};
      background: ${cssVar.colorFillQuaternary};
    }
  `,
  disabled: css`
    opacity: 0.55;
  `,
  dot: css`
    width: 8px;
    height: 8px;
    flex: 0 0 auto;
    border-radius: 50%;
  `,
  name: css`
    font-size: 13px;
    color: ${cssVar.colorText};
  `,
  pill: css`
    padding: 1px 8px;
    border-radius: 6px;
    background: ${cssVar.colorFillTertiary};
    color: ${cssVar.colorTextSecondary};
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    text-transform: uppercase;
  `,
  grow: css`
    flex: 1;
    min-width: 0;
  `,
  status: css`
    font-size: 11px;
  `,
  ops: css`
    display: flex;
    align-items: center;
    gap: 12px;
    color: ${cssVar.colorTextTertiary};
  `,
  iconbtn: css`
    display: inline-flex;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
  `,
}));

export function McpServerCard({
  name,
  config,
  enabled,
  live,
  onToggle,
  onEdit,
  onDelete,
}: McpServerCardProps) {
  const color = dotColor(enabled, live);
  return (
    <div className={`${styles.card} ${enabled ? '' : styles.disabled}`} data-testid={`mcp-server-${name}`}>
      <span className={styles.dot} style={{ background: color }} />
      <span className={styles.name}>{name}</span>
      <span className={styles.pill}>{transportOf(config)}</span>
      <span className={styles.grow} />
      <span className={styles.status} style={{ color }}>
        {statusLabel(enabled, live)}
      </span>
      <span className={styles.ops}>
        <Switch size="small" checked={enabled} onChange={onToggle} data-testid={`mcp-toggle-${name}`} />
        <button type="button" className={styles.iconbtn} data-testid={`mcp-edit-${name}`} onClick={onEdit}>
          <PencilLine size={15} />
        </button>
        <button type="button" className={styles.iconbtn} data-testid={`mcp-delete-${name}`} onClick={onDelete}>
          <Trash2 size={15} />
        </button>
      </span>
    </div>
  );
}

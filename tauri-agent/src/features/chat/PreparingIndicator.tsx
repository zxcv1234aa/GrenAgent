import { Flexbox } from '@lobehub/ui';
import { useCardStyles } from '../tools/cardStyles';
import { StatusIndicator } from '../tools/StatusIndicator';

interface PreparingIndicatorProps {
  /** 提示文案；默认对应 pi 的 agent_start → 首条输出之间的等待区间。 */
  label?: string;
}

/**
 * agent_start 之后、首条助手输出之前的等待占位（shimmer 文案）。
 * 左边缘与 ChatItemShell 助手消息对齐（paddingBlock 8、无左内边距），避免「偏右呆滞」。
 */
export function PreparingIndicator({ label = '准备响应中…' }: PreparingIndicatorProps) {
  const { styles } = useCardStyles();
  return (
    <Flexbox horizontal align="center" gap={8} style={{ paddingBlock: 8 }}>
      <StatusIndicator status="running" />
      <span className={styles.shinyText} style={{ fontSize: 14 }}>
        {label}
      </span>
    </Flexbox>
  );
}

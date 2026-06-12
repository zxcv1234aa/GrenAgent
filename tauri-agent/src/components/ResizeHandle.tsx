import { DraggablePanel, type DraggablePanelProps } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import type { ReactNode } from 'react';

type ResizePlacement = 'left' | 'right' | 'top' | 'bottom';

// DraggablePanel 的 <aside> 自身不设主轴外的尺寸，仅靠 flex 拉伸（height/width 为 auto），
// 导致内部 Resizable 的 height:100% 无法解析、内容塌陷。显式补足交叉轴尺寸让百分比链路可解析。
const useStyles = createStyles(({ css }) => ({
  fillHeight: css`
    height: 100%;
  `,
  fillWidth: css`
    width: 100%;
  `,
}));

interface ResizeHandleProps {
  /** 停靠边；left/right 调宽，top/bottom 调高，拖拽手柄在反向边 */
  placement: ResizePlacement;
  /** 初始尺寸（宽或高，取决于 placement），通常来自 layoutStore */
  defaultSize: number;
  minSize: number;
  maxSize: number;
  /** 拖拽结束后回调，传回新的主轴尺寸（px 数值） */
  onResize: (size: number) => void;
  children?: ReactNode;
}

export function ResizeHandle({
  placement,
  defaultSize,
  minSize,
  maxSize,
  onResize,
  children,
}: ResizeHandleProps) {
  const { styles } = useStyles();
  const isVertical = placement === 'top' || placement === 'bottom';

  const handleSizeChange: DraggablePanelProps['onSizeChange'] = (_delta, size) => {
    if (!size) return;
    const raw = isVertical ? size.height : size.width;
    const next = typeof raw === 'number' ? raw : parseFloat(raw ?? '');
    if (!Number.isNaN(next)) onResize(next);
  };

  return (
    <DraggablePanel
      mode="fixed"
      placement={placement}
      expandable={false}
      className={isVertical ? styles.fillWidth : styles.fillHeight}
      defaultSize={isVertical ? { height: defaultSize } : { width: defaultSize }}
      minWidth={isVertical ? undefined : minSize}
      maxWidth={isVertical ? undefined : maxSize}
      minHeight={isVertical ? minSize : undefined}
      maxHeight={isVertical ? maxSize : undefined}
      onSizeChange={handleSizeChange}
    >
      {children}
    </DraggablePanel>
  );
}

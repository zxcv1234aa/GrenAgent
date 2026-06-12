import { DraggablePanel, type DraggablePanelProps } from '@lobehub/ui';
import type { ReactNode } from 'react';

type ResizePlacement = 'left' | 'right' | 'top' | 'bottom';

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
      stableLayout
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

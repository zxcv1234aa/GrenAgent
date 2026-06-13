import type { MenuProps } from 'antd';
import { createElement } from 'react';
import { Icon } from '@lobehub/ui';
import { PencilLine, Pin, PinOff, Trash2 } from 'lucide-react';

export interface SessionMenuParams {
  pinned: boolean;
  onPinToggle: () => void;
  onRename: () => void;
  onDelete: () => void;
}

type Items = NonNullable<MenuProps['items']>;

export function buildSessionMenuItems(p: SessionMenuParams): Items {
  return [
    {
      key: 'pin',
      icon: createElement(Icon, { icon: p.pinned ? PinOff : Pin, size: 'small' }),
      label: p.pinned ? '取消置顶' : '置顶',
      onClick: p.onPinToggle,
    },
    {
      key: 'rename',
      icon: createElement(Icon, { icon: PencilLine, size: 'small' }),
      label: '重命名',
      onClick: p.onRename,
    },
    { type: 'divider' },
    {
      key: 'delete',
      icon: createElement(Icon, { icon: Trash2, size: 'small' }),
      label: '删除',
      danger: true,
      onClick: p.onDelete,
    },
  ];
}

export const useSessionMenu = (p: SessionMenuParams): Items => buildSessionMenuItems(p);

import type { MenuProps } from 'antd';
import { createElement } from 'react';
import { Icon } from '@lobehub/ui';
import { EyeOff, FolderOpen, PencilLine, Pin, PinOff } from 'lucide-react';

export interface ProjectMenuParams {
  pinned: boolean;
  onPinToggle: () => void;
  onReveal: () => void; // 在资源管理器中打开
  onRename: () => void; // 重命名（别名）
  onHide: () => void; // 从列表隐藏
}

type Items = NonNullable<MenuProps['items']>;

export function buildProjectMenuItems(p: ProjectMenuParams): Items {
  return [
    {
      key: 'pin',
      icon: createElement(Icon, { icon: p.pinned ? PinOff : Pin, size: 'small' }),
      label: p.pinned ? '取消置顶项目' : '置顶项目',
      onClick: p.onPinToggle,
    },
    {
      key: 'reveal',
      icon: createElement(Icon, { icon: FolderOpen, size: 'small' }),
      label: '在资源管理器中打开',
      onClick: p.onReveal,
    },
    {
      key: 'rename',
      icon: createElement(Icon, { icon: PencilLine, size: 'small' }),
      label: '重命名（别名）',
      onClick: p.onRename,
    },
    { type: 'divider' },
    {
      key: 'hide',
      icon: createElement(Icon, { icon: EyeOff, size: 'small' }),
      label: '从列表隐藏',
      danger: true,
      onClick: p.onHide,
    },
  ];
}

export const useProjectMenu = (p: ProjectMenuParams): Items => buildProjectMenuItems(p);

import { Block, Icon } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { Atom, Check, Loader2, X } from 'lucide-react';

export type StatusKind = 'running' | 'done' | 'error' | 'thinking';

interface StatusIndicatorProps {
  status: StatusKind;
}

export function StatusIndicator({ status }: StatusIndicatorProps) {
  let icon = <Icon icon={Loader2} size={14} spin />;
  let color: string | undefined;

  switch (status) {
    case 'done':
      icon = <Icon icon={Check} size={14} />;
      color = cssVar.colorSuccess;
      break;
    case 'error':
      icon = <Icon icon={X} size={14} />;
      color = cssVar.colorError;
      break;
    case 'thinking':
      icon = <Icon icon={Atom} size={14} />;
      color = cssVar.purple;
      break;
    case 'running':
    default:
      icon = <Icon icon={Loader2} size={14} spin />;
      break;
  }

  return (
    <Block
      horizontal
      align="center"
      justify="center"
      variant="outlined"
      style={{ flex: 'none', width: 24, height: 24, fontSize: 12, color }}
    >
      {icon}
    </Block>
  );
}

import { Button, Flexbox, Icon } from '@lobehub/ui';
import { ArrowUp, Square } from 'lucide-react';
import { actionMap, type ActionKey } from './config';
import { useChatInput } from './ChatInputContext';

interface SendAreaProps {
  actions: ActionKey[];
}

export function SendArea({ actions }: SendAreaProps) {
  const { value, attachments, isStreaming, send, stop } = useChatInput();
  const canSend = value.trim().length > 0 || attachments.length > 0;

  return (
    <Flexbox horizontal align="center" gap={2}>
      {actions.map((key) => {
        const Render = actionMap[key];
        return <Render key={key} />;
      })}
      <Button
        type="primary"
        shape="circle"
        disabled={!isStreaming && !canSend}
        title={isStreaming ? '停止' : '发送'}
        icon={<Icon icon={isStreaming ? Square : ArrowUp} size={16} />}
        onClick={() => (isStreaming ? stop() : send())}
      />
    </Flexbox>
  );
}

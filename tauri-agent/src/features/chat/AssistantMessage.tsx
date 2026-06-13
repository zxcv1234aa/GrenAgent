import { ChatItem } from '@lobehub/ui/chat';
import { Thinking } from './Thinking';

interface AssistantMessageProps {
  text: string;
  thinking: string;
  streaming: boolean;
  thinkingDuration?: number;
}

export function AssistantMessage({
  text,
  thinking,
  streaming,
  thinkingDuration,
}: AssistantMessageProps) {
  // 推理进行中：streaming 且正文尚未开始。
  const reasoning = streaming && !text;

  return (
    <ChatItem
      placement="left"
      variant="docs"
      showAvatar={false}
      fontSize={14}
      loading={streaming && !text && !thinking}
      message={text || (reasoning && !thinking ? '...' : '')}
      avatar={{ avatar: '🤖', title: 'Assistant' }}
      aboveMessage={
        thinking ? (
          <Thinking content={thinking} thinking={reasoning} duration={thinkingDuration} />
        ) : undefined
      }
    />
  );
}

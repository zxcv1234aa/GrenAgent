import { Collapse } from '@lobehub/ui';
import { ChatItem } from '@lobehub/ui/chat';

interface AssistantMessageProps {
  text: string;
  thinking: string;
  streaming: boolean;
}

export function AssistantMessage({ text, thinking, streaming }: AssistantMessageProps) {
  return (
    <ChatItem
      placement="left"
      loading={streaming && !text}
      message={text || (streaming ? '...' : '')}
      avatar={{ avatar: '🤖', title: 'Assistant' }}
      aboveMessage={
        thinking ? (
          <Collapse
            variant="borderless"
            gap={4}
            items={[
              {
                key: 'thinking',
                label: 'Thinking',
                children: (
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 12, opacity: 0.7 }}>
                    {thinking}
                  </div>
                ),
              },
            ]}
          />
        ) : undefined
      }
    />
  );
}

import { ChatItem } from '@lobehub/ui/chat';
import { Suspense, lazy } from 'react';
import { Thinking } from './Thinking';

const ToolExecution = lazy(() =>
  import('../tools/ToolExecution').then((m) => ({ default: m.ToolExecution })),
);

/** Tool calls associated with an assistant turn (shape matches groupMessages' ToolDisplay). */
export interface AssistantToolItem {
  id: string;
  toolCallId: string;
  toolName: string;
  args: unknown;
  result: unknown;
  status: 'running' | 'done' | 'error';
}

interface AssistantMessageProps {
  text: string;
  thinking: string;
  streaming: boolean;
  thinkingDuration?: number;
  /** Optional inline tool calls rendered beneath the bubble (grouped-message rendering). */
  tools?: AssistantToolItem[];
}

export function AssistantMessage({
  text,
  thinking,
  streaming,
  thinkingDuration,
  tools,
}: AssistantMessageProps) {
  // 推理进行中：streaming 且正文尚未开始。
  const reasoning = streaming && !text;

  const toolsBlock =
    tools && tools.length > 0 ? (
      <Suspense fallback={null}>
        {tools.map((t) => (
          <ToolExecution
            key={t.id}
            toolName={t.toolName}
            toolCallId={t.toolCallId}
            args={t.args}
            result={t.result}
            status={t.status}
          />
        ))}
      </Suspense>
    ) : undefined;

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
      belowMessage={toolsBlock}
    />
  );
}

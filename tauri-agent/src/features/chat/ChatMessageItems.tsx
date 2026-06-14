import { lazy, Suspense } from 'react';
import type { DisplayMessage } from './groupMessages';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';
import { NoticePill } from './NoticePill';

const ToolExecution = lazy(() =>
  import('../tools/ToolExecution').then((m) => ({ default: m.ToolExecution })),
);

interface ChatMessageItemsProps {
  messages: DisplayMessage[];
}

/** 共享的对话气泡渲染：主对话与子代理对话复用同一套 user/assistant/tool/notice 组件。 */
export function ChatMessageItems({ messages }: ChatMessageItemsProps) {
  return (
    <>
      {messages.map((msg) => {
        switch (msg.kind) {
          case 'user':
            return <UserMessage key={msg.id} text={msg.text} />;
          case 'assistantGroup':
            return (
              <AssistantMessage
                key={msg.id}
                text={msg.text}
                thinking={msg.thinking}
                streaming={msg.streaming}
                thinkingDuration={msg.thinkingDuration}
                tools={msg.tools.length > 0 ? msg.tools : undefined}
              />
            );
          case 'tool':
            return (
              <Suspense key={msg.id} fallback={null}>
                <ToolExecution
                  toolName={msg.toolName}
                  toolCallId={msg.toolCallId}
                  args={msg.args}
                  result={msg.result}
                  status={msg.status}
                />
              </Suspense>
            );
          case 'notice':
            return <NoticePill key={msg.id} customType={msg.customType} content={msg.content} />;
          default:
            return null;
        }
      })}
    </>
  );
}

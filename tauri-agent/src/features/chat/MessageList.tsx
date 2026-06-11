import { useAgentStore } from '../../stores/AgentStoreContext';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';
import { ToolExecution } from '../tools/ToolExecution';

export function MessageList() {
  const { useStore } = useAgentStore();
  const messages = useStore((s) => s.messages);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        bottom: 88,
        left: 0,
        right: 0,
        overflowY: 'auto',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      {messages.map((msg) => {
        switch (msg.kind) {
          case 'user':
            return <UserMessage key={msg.id} text={msg.text} />;
          case 'assistant':
            return (
              <AssistantMessage
                key={msg.id}
                text={msg.text}
                thinking={msg.thinking}
                streaming={msg.streaming}
              />
            );
          case 'tool':
            return (
              <ToolExecution
                key={msg.id}
                toolName={msg.toolName}
                args={msg.args}
                result={msg.result}
                status={msg.status}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

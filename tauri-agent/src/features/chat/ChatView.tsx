import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { pi } from '../../lib/pi';
import { useAgentStoreContext } from '../../stores/AgentStoreContext';

export function ChatView() {
  const { workspace, store } = useAgentStoreContext();

  const handleSend = async (message: string) => {
    const text = message.trim();
    if (!text) return;
    // pi 不会回发用户消息，发送前主动加入以乐观显示用户气泡。
    store.pushUserMessage(text);
    await pi.prompt(workspace, text);
  };

  const handleAbort = async () => {
    await pi.abort(workspace);
  };

  return (
    <div style={{ height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <MessageList />
      <ChatInput onSend={handleSend} onAbort={handleAbort} />
    </div>
  );
}

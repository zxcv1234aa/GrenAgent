import { ChatListView } from './ChatListView';
import { ChatInput } from './ChatInput';
import type { PromptImage } from './input/ChatInputContext';
import { pi } from '../../lib/pi';
import { useAgentStoreContext } from '../../stores/AgentStoreContext';

export function ChatView() {
  const { workspace, store } = useAgentStoreContext();

  const handleSend = async (message: string, images?: PromptImage[]) => {
    const text = message.trim();
    if (!text && !images?.length) return;
    // pi 不会回发用户消息，发送前主动加入以乐观显示用户气泡。
    if (text) store.pushUserMessage(text);
    await pi.prompt(workspace, text, undefined, images);
  };

  const handleAbort = async () => {
    await pi.abort(workspace);
  };

  // Flex 列：消息区 flex:1 滚动，输入框在流内置于底部（不浮动遮挡内容，对齐 lobe）。
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <ChatListView />
      </div>
      <ChatInput onSend={handleSend} onAbort={handleAbort} />
    </div>
  );
}

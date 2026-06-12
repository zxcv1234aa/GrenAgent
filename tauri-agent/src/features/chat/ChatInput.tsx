import { useState } from 'react';
import { Flexbox } from '@lobehub/ui';
import { ChatInputAreaInner, ChatSendButton } from '@lobehub/ui/chat';
import { createStyles } from 'antd-style';
import { useAgentStore } from '../../stores/AgentStoreContext';

const useStyles = createStyles(({ token, css }) => ({
  inputWrap: css`
    border: 1px solid ${token.colorBorder};
    border-radius: ${token.borderRadiusLG}px;
    padding: 4px 8px;
    background: ${token.colorBgContainer};
  `,
}));

interface ChatInputProps {
  onSend: (message: string) => Promise<void>;
  onAbort: () => Promise<void>;
}

export function ChatInput({ onSend, onAbort }: ChatInputProps) {
  const { useStore } = useAgentStore();
  const isStreaming = useStore((s) => s.isStreaming);
  const [value, setValue] = useState('');
  const { styles } = useStyles();

  const handleSend = () => {
    const text = value.trim();
    if (!text || isStreaming) return;
    setValue('');
    void onSend(text);
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        right: 16,
        zIndex: 20,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        padding: 12,
      }}
    >
      <Flexbox gap={8} align="stretch">
        <div className={styles.inputWrap}>
          <ChatInputAreaInner
            value={value}
            loading={isStreaming}
            placeholder="Type a message..."
            autoSize={{ minRows: 1, maxRows: 8 }}
            onInput={setValue}
            onSend={handleSend}
          />
        </div>
        <ChatSendButton
          loading={isStreaming}
          onSend={handleSend}
          onStop={() => void onAbort()}
        />
      </Flexbox>
    </div>
  );
}

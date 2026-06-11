import { ChatItem } from '@lobehub/ui/chat';

interface UserMessageProps {
  text: string;
}

export function UserMessage({ text }: UserMessageProps) {
  return (
    <ChatItem
      placement="right"
      message={text}
      avatar={{ avatar: '🧑', title: 'You' }}
    />
  );
}

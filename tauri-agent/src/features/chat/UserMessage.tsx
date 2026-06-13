import { ChatItem } from '@lobehub/ui/chat';

interface UserMessageProps {
  text: string;
}

export function UserMessage({ text }: UserMessageProps) {
  return (
    <ChatItem
      placement="right"
      showAvatar={false}
      variant="bubble"
      fontSize={14}
      message={text}
      avatar={{ avatar: '🧑', title: 'You' }}
    />
  );
}

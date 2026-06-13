import { createContext, useContext } from 'react';

/** pi.prompt 接受的图片格式（纯 base64 data）。 */
export interface PromptImage {
  type: 'image';
  mimeType: string;
  data: string;
}

/** UI 侧附件：在 PromptImage 基础上附带预览所需的 name/url。 */
export interface ImageAttachment extends PromptImage {
  name: string;
  url: string;
}

/**
 * 输入区共享状态。
 * actionMap 渲染出的按钮没有 props 通道，需从此 context 读取输入内容、
 * 附件、流式状态并触发发送/停止。
 */
export interface ChatInputContextValue {
  value: string;
  setValue: (value: string) => void;
  attachments: ImageAttachment[];
  addAttachments: (items: ImageAttachment[]) => void;
  removeAttachment: (index: number) => void;
  isStreaming: boolean;
  send: () => void;
  stop: () => void;
}

const ChatInputContext = createContext<ChatInputContextValue | null>(null);

export const ChatInputProvider = ChatInputContext.Provider;

export function useChatInput(): ChatInputContextValue {
  const ctx = useContext(ChatInputContext);
  if (!ctx) {
    throw new Error('useChatInput must be used within a ChatInput');
  }
  return ctx;
}

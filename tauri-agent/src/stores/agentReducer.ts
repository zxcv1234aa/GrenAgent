import type { AgentEvent, AgentMessage, AssistantMessageEvent } from '../lib/pi';

export type ChatMessage =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'assistant'; id: string; text: string; thinking: string; streaming: boolean }
  | { kind: 'tool'; id: string; toolCallId: string; toolName: string; args: unknown; result: unknown; status: 'running' | 'done' | 'error' };

export interface AgentState {
  messages: ChatMessage[];
  isStreaming: boolean;
  steering: string[];
  followUp: string[];
  lastError?: string;
}

export function initialAgentState(): AgentState {
  return { messages: [], isStreaming: false, steering: [], followUp: [] };
}

let counter = 0;
const nextId = () => `m${++counter}`;

function extractText(msg: AgentMessage): { text: string; thinking: string } {
  let text = '';
  let thinking = '';
  const content = msg.content;
  if (typeof content === 'string') {
    text = content;
  } else if (Array.isArray(content)) {
    for (const block of content as Array<Record<string, unknown> | null>) {
      if (!block || typeof block !== 'object') continue;
      if (block.type === 'text' && typeof block.text === 'string') text += block.text;
      if (block.type === 'thinking' && typeof block.thinking === 'string') thinking += block.thinking;
    }
  }
  return { text, thinking };
}

export function applyEvent(state: AgentState, event: AgentEvent): AgentState {
  switch (event.type) {
    case 'agent_start':
      return { ...state, isStreaming: true, lastError: undefined };

    case 'agent_end':
      return {
        ...state,
        isStreaming: false,
        messages: state.messages.map((m) =>
          m.kind === 'assistant' ? { ...m, streaming: false } : m,
        ),
      };

    case 'message_start': {
      const ev = event as Extract<AgentEvent, { type: 'message_start' }>;
      if (ev.message.role !== 'assistant') return state;
      const { text, thinking } = extractText(ev.message);
      const messages = [...state.messages];
      const idx = lastIndex(messages, (m) => m.kind === 'assistant' && m.streaming);
      // pi 同一时刻只有一个 streamingMessage；重复 message_start 应复用而非叠空泡
      if (idx >= 0) {
        const cur = messages[idx] as Extract<ChatMessage, { kind: 'assistant' }>;
        messages[idx] = {
          ...cur,
          text: text || cur.text,
          thinking: thinking || cur.thinking,
        };
        return { ...state, messages };
      }
      return {
        ...state,
        messages: [...messages, { kind: 'assistant', id: nextId(), text, thinking, streaming: true }],
      };
    }

    case 'message_end': {
      const ev = event as Extract<AgentEvent, { type: 'message_end' }>;
      if (ev.message.role !== 'assistant') return state;
      const { text, thinking } = extractText(ev.message);
      const messages = [...state.messages];
      const idx = lastIndex(messages, (m) => m.kind === 'assistant' && m.streaming);
      if (idx < 0) {
        if (!text && !thinking) return state;
        return {
          ...state,
          messages: [...messages, { kind: 'assistant', id: nextId(), text, thinking, streaming: false }],
        };
      }
      // 仅含 tool call、无可见文本的 assistant 消息不展示（否则会叠成多条灰线）
      if (!text && !thinking) {
        messages.splice(idx, 1);
      } else {
        const cur = messages[idx] as Extract<ChatMessage, { kind: 'assistant' }>;
        messages[idx] = { ...cur, text, thinking, streaming: false };
      }
      return { ...state, messages };
    }

    case 'message_update': {
      const ev = event as Extract<AgentEvent, { type: 'message_update' }>;
      const { text, thinking } = extractText(ev.message);
      const messages = [...state.messages];
      const idx = lastIndex(messages, (m) => m.kind === 'assistant' && m.streaming);
      if (idx >= 0) {
        const cur = messages[idx] as Extract<ChatMessage, { kind: 'assistant' }>;
        messages[idx] = { ...cur, text, thinking };
      } else {
        messages.push({ kind: 'assistant', id: nextId(), text, thinking, streaming: true });
      }
      void (ev.assistantMessageEvent as AssistantMessageEvent);
      return { ...state, messages };
    }

    case 'tool_execution_start': {
      const ev = event as Extract<AgentEvent, { type: 'tool_execution_start' }>;
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            kind: 'tool',
            id: nextId(),
            toolCallId: ev.toolCallId,
            toolName: ev.toolName,
            args: ev.args,
            result: undefined,
            status: 'running',
          },
        ],
      };
    }

    case 'tool_execution_update': {
      const ev = event as Extract<AgentEvent, { type: 'tool_execution_update' }>;
      return updateTool(state, ev.toolCallId, (t) => ({ ...t, result: ev.partialResult }));
    }

    case 'tool_execution_end': {
      const ev = event as Extract<AgentEvent, { type: 'tool_execution_end' }>;
      return updateTool(state, ev.toolCallId, (t) => ({
        ...t,
        result: ev.result,
        status: ev.isError ? 'error' : 'done',
      }));
    }

    case 'queue_update': {
      const ev = event as Extract<AgentEvent, { type: 'queue_update' }>;
      return { ...state, steering: ev.steering ?? [], followUp: ev.followUp ?? [] };
    }

    case 'auto_retry_end': {
      const ev = event as Extract<AgentEvent, { type: 'auto_retry_end' }>;
      return ev.success ? { ...state, lastError: undefined } : { ...state, lastError: ev.finalError };
    }

    case 'extension_error': {
      const ev = event as Extract<AgentEvent, { type: 'extension_error' }>;
      return { ...state, lastError: ev.error };
    }

    default:
      return state;
  }
}

/** 本地插入一条用户消息（pi 不会回发用户消息，需前端在发送时主动加入）。 */
export function addUserMessage(state: AgentState, text: string): AgentState {
  return {
    ...state,
    messages: [...state.messages, { kind: 'user', id: nextId(), text }],
  };
}

/** 从 pi get_messages 结果还原聊天列表（用于切换会话）。 */
export function messagesFromAgent(msgs: AgentMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const msg of msgs) {
    if (msg.role === 'user') {
      const { text } = extractText(msg);
      if (text.trim()) out.push({ kind: 'user', id: nextId(), text });
    } else if (msg.role === 'assistant') {
      const { text, thinking } = extractText(msg);
      if (text.trim() || thinking.trim()) {
        out.push({ kind: 'assistant', id: nextId(), text, thinking, streaming: false });
      }
    }
  }
  return out;
}

function lastIndex(arr: ChatMessage[], pred: (m: ChatMessage) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i])) return i;
  return -1;
}

function updateTool(
  state: AgentState,
  toolCallId: string,
  fn: (t: Extract<ChatMessage, { kind: 'tool' }>) => Extract<ChatMessage, { kind: 'tool' }>,
): AgentState {
  return {
    ...state,
    messages: state.messages.map((m) =>
      m.kind === 'tool' && m.toolCallId === toolCallId ? fn(m) : m,
    ),
  };
}

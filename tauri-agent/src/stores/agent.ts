import { create } from 'zustand';
import {
  applyEvent,
  initialAgentState,
  addUserMessage,
  messagesFromAgent,
  type AgentState,
} from './agentReducer';
import { onPiEvent, onPiExit, type AgentEvent, type AgentMessage } from '../lib/pi';
import { getThinkingDuration, saveThinkingDuration } from '../lib/thinkingDurations';

export interface LoadMessagesOptions {
  force?: boolean;
  /** 本次载入对应的会话路径：记录后供切回时判断「内存内容是否已是目标会话」从而跳过重载。 */
  sessionPath?: string | null;
}

export interface AgentStoreApi {
  useStore: {
    (): AgentState;
    <T>(selector: (s: AgentState) => T): T;
    getState: () => AgentState;
    setState: (partial: Partial<AgentState> | ((s: AgentState) => Partial<AgentState>)) => void;
    subscribe: (listener: (s: AgentState, prev: AgentState) => void) => () => void;
  };
  setActive: (active: boolean) => void;
  pushUserMessage: (text: string) => void;
  loadMessages: (msgs: AgentMessage[], options?: LoadMessagesOptions) => void;
  reset: () => void;
  hasLiveActivity: () => boolean;
  /**
   * 当前内存内容对应的会话路径：
   * - `undefined`：从未载入过（需完整加载）
   * - `string | null`：已载入过该会话（切回时若与目标一致即可复用缓存、跳过重载）
   */
  getLoadedSessionPath: () => string | null | undefined;
  destroy: () => void;
}

/** 非 active store 的 flush 间隔（rAF 在后台被节流，用 setTimeout 兜底）。 */
const BACKGROUND_FLUSH_MS = 60;

/** 为某工作区创建 agent 状态，并订阅 pi://event。 */
export function createAgentStore(workspace: string): AgentStoreApi {
  let liveActivity = false;
  // 内存内消息当前对应的会话路径（undefined = 从未载入）。用于切回工作区时判断是否可复用缓存。
  let loadedSessionPath: string | null | undefined = undefined;
  const unsubs: Array<() => void> = [];

  const useStore = create<AgentState>(() => initialAgentState());

  const setFullState = (next: AgentState) => {
    useStore.setState(next, true);
  };

  // —— 事件按动画帧批量应用（对齐 lobehub 流式平滑的思路）——
  // 高频 thinking/text delta 一帧内合并为一次 setState，降低渲染压力；
  // 打字机视觉由 Markdown animated 承担，不丢任何事件、保持顺序。
  let queue: AgentEvent[] = [];
  let rafId: number | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let active = true;

  /** 推理结束后把实时计出的时长按消息 timestamp 落盘（供切换会话后回填）。 */
  const persistThinkingDurations = (state: AgentState) => {
    for (const m of state.messages) {
      if (
        m.kind === 'assistant' &&
        m.thinking &&
        m.timestamp != null &&
        m.thinkingDuration != null
      ) {
        saveThinkingDuration(m.timestamp, m.thinkingDuration);
      }
    }
  };

  const flush = () => {
    rafId = null;
    timeoutId = null;
    if (!queue.length) return;
    const events = queue;
    queue = [];
    let state = useStore.getState();
    let reachedEnd = false;
    for (const ev of events) {
      state = applyEvent(state, ev);
      if (ev.type === 'message_end' || ev.type === 'agent_end') reachedEnd = true;
    }
    setFullState(state);
    if (reachedEnd) persistThinkingDurations(state);
  };

  const scheduleFlush = () => {
    if (rafId != null || timeoutId != null) return;
    if (active && typeof requestAnimationFrame === 'function') {
      rafId = requestAnimationFrame(flush);
    } else {
      timeoutId = setTimeout(flush, BACKGROUND_FLUSH_MS);
    }
  };

  /** 丢弃未应用的排队事件（切换/重置会话时调用，避免旧会话事件串场）。 */
  const clearQueue = () => {
    queue = [];
    if (rafId != null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(rafId);
    }
    if (timeoutId != null) {
      clearTimeout(timeoutId);
    }
    rafId = null;
    timeoutId = null;
  };

  onPiEvent((env) => {
    if (env.workspace !== workspace) return;
    queue.push(env.event);
    scheduleFlush();
  }).then((un) => unsubs.push(un));

  onPiExit((env) => {
    if (env.workspace !== workspace) return;
    useStore.setState({ isStreaming: false });
  }).then((un) => unsubs.push(un));

  const pushUserMessage = (text: string) => {
    liveActivity = true;
    setFullState(addUserMessage(useStore.getState(), text));
  };

  const loadMessages = (msgs: AgentMessage[], options?: LoadMessagesOptions) => {
    if (liveActivity && !options?.force) return;
    liveActivity = false;
    if (options && 'sessionPath' in options) {
      loadedSessionPath = options.sessionPath ?? null;
    }
    clearQueue();
    setFullState({
      ...initialAgentState(),
      messages: messagesFromAgent(msgs, getThinkingDuration),
    });
  };

  const reset = () => {
    liveActivity = false;
    // 新会话尚无落盘路径：标记为未载入，切回时按完整加载处理（届时会话已有路径）。
    loadedSessionPath = undefined;
    clearQueue();
    setFullState(initialAgentState());
  };

  return {
    useStore,
    setActive: (next) => {
      active = next;
    },
    pushUserMessage,
    loadMessages,
    reset,
    hasLiveActivity: () => liveActivity,
    getLoadedSessionPath: () => loadedSessionPath,
    destroy: () => {
      clearQueue();
      for (const un of unsubs) un();
      unsubs.length = 0;
    },
  };
}

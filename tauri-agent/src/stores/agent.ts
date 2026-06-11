import { create } from 'zustand';
import {
  applyEvent,
  initialAgentState,
  addUserMessage,
  messagesFromAgent,
  type AgentState,
} from './agentReducer';
import { onPiEvent, onPiExit, type AgentMessage } from '../lib/pi';

export interface LoadMessagesOptions {
  force?: boolean;
}

export interface AgentStoreApi {
  useStore: {
    (): AgentState;
    <T>(selector: (s: AgentState) => T): T;
    getState: () => AgentState;
    setState: (partial: Partial<AgentState> | ((s: AgentState) => Partial<AgentState>)) => void;
  };
  pushUserMessage: (text: string) => void;
  loadMessages: (msgs: AgentMessage[], options?: LoadMessagesOptions) => void;
  reset: () => void;
  hasLiveActivity: () => boolean;
  destroy: () => void;
}

/** 为某工作区创建 agent 状态，并订阅 pi://event。 */
export function createAgentStore(workspace: string): AgentStoreApi {
  let liveActivity = false;
  const unsubs: Array<() => void> = [];

  const useStore = create<AgentState>(() => initialAgentState());

  const setFullState = (next: AgentState) => {
    useStore.setState(next, true);
  };

  onPiEvent((env) => {
    if (env.workspace !== workspace) return;
    setFullState(applyEvent(useStore.getState(), env.event));
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
    setFullState({ ...initialAgentState(), messages: messagesFromAgent(msgs) });
  };

  const reset = () => {
    liveActivity = false;
    setFullState(initialAgentState());
  };

  return {
    useStore,
    pushUserMessage,
    loadMessages,
    reset,
    hasLiveActivity: () => liveActivity,
    destroy: () => {
      for (const un of unsubs) un();
      unsubs.length = 0;
    },
  };
}

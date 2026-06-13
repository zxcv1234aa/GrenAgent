import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 捕获事件订阅 handler，测试中手动注入 pi 事件。
const eventHandlers: Array<(e: { workspace: string; event: unknown }) => void> = [];
vi.mock('../lib/pi', () => ({
  onPiEvent: (h: (e: { workspace: string; event: unknown }) => void) => {
    eventHandlers.push(h);
    return Promise.resolve(() => {});
  },
  onPiExit: () => Promise.resolve(() => {}),
}));

import { createAgentStore } from './agent';
import { clearThinkingDurationsForTest } from '../lib/thinkingDurations';

function emit(event: unknown) {
  for (const h of eventHandlers) h({ workspace: '.', event });
}

describe('createAgentStore', () => {
  let store: ReturnType<typeof createAgentStore>;
  let rafCallbacks: FrameRequestCallback[] = [];

  beforeEach(() => {
    eventHandlers.length = 0;
    rafCallbacks = [];
    clearThinkingDurationsForTest();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    store?.destroy();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const flushRAF = () => {
    const cbs = [...rafCallbacks];
    rafCallbacks = [];
    for (const cb of cbs) cb(performance.now());
  };

  it('loadMessages is skipped after live user activity unless forced', () => {
    store = createAgentStore('.');
    store.pushUserMessage('hello');
    expect(store.useStore.getState().messages).toHaveLength(1);

    store.loadMessages([{ role: 'assistant', content: [{ type: 'text', text: 'ignored' }] }]);
    expect(store.useStore.getState().messages).toHaveLength(1);
    expect(store.useStore.getState().messages[0].kind).toBe('user');

    store.loadMessages(
      [{ role: 'assistant', content: [{ type: 'text', text: 'synced' }] }],
      { force: true },
    );
    expect(store.useStore.getState().messages).toHaveLength(1);
    expect(store.useStore.getState().messages[0].kind).toBe('assistant');
  });

  it('一帧内的多条事件批量应用（flush 前不可见，flush 后按顺序生效）', () => {
    store = createAgentStore('.');
    emit({ type: 'agent_start' });
    emit({ type: 'message_start', message: { role: 'assistant', content: [], timestamp: 111 } });
    emit({
      type: 'message_update',
      message: {
        role: 'assistant',
        content: [{ type: 'thinking', thinking: '推理中' }],
        timestamp: 111,
      },
      assistantMessageEvent: { type: 'thinking_delta', delta: '推理中' },
    });

    // 尚未到动画帧：状态不变
    expect(store.useStore.getState().messages).toHaveLength(0);
    expect(store.useStore.getState().isStreaming).toBe(false);

    flushRAF();

    const s = store.useStore.getState();
    expect(s.isStreaming).toBe(true);
    const m = s.messages.at(-1);
    expect(m?.kind).toBe('assistant');
    expect(m?.kind === 'assistant' ? m.thinking : '').toBe('推理中');
  });

  it('推理时长在 message_end 后持久化，切换会话恢复时按 timestamp 回填', () => {
    // 只 fake Date（推理计时用 Date.now），不接管 rAF/setTimeout。
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1700000000000);

    store = createAgentStore('.');
    const ts = 1700000000123;

    emit({ type: 'agent_start' });
    emit({ type: 'message_start', message: { role: 'assistant', content: [], timestamp: ts } });
    emit({
      type: 'message_update',
      message: {
        role: 'assistant',
        content: [{ type: 'thinking', thinking: '思考…' }],
        timestamp: ts,
      },
      assistantMessageEvent: { type: 'thinking_delta', delta: '思考…' },
    });
    flushRAF(); // 首个 thinking 出现：记下推理起点

    vi.advanceTimersByTime(2300); // 推理耗时 2.3s

    emit({
      type: 'message_update',
      message: {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: '思考…' },
          { type: 'text', text: '答案' },
        ],
        timestamp: ts,
      },
      assistantMessageEvent: { type: 'text_delta', delta: '答案' },
    });
    emit({
      type: 'message_end',
      message: {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: '思考…' },
          { type: 'text', text: '答案' },
        ],
        timestamp: ts,
      },
    });
    emit({ type: 'agent_end', messages: [] });
    flushRAF();

    const live = store.useStore.getState().messages.at(-1);
    expect(live?.kind === 'assistant' ? live.thinkingDuration : undefined).toBe(2300);

    // 模拟切换会话后从 get_messages 还原：pi 数据本身不带时长
    store.loadMessages(
      [
        {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: '思考…' },
            { type: 'text', text: '答案' },
          ],
          timestamp: ts,
        },
      ],
      { force: true },
    );
    const restored = store.useStore.getState().messages.at(-1);
    expect(restored?.kind === 'assistant' ? restored.thinkingDuration : undefined).toBe(2300);
  });

  it('reset 丢弃尚未应用的排队事件', () => {
    store = createAgentStore('.');
    emit({ type: 'message_start', message: { role: 'assistant', content: [], timestamp: 1 } });
    store.reset();
    flushRAF();
    expect(store.useStore.getState().messages).toHaveLength(0);
  });
});

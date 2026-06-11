import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../lib/pi', () => ({
  onPiEvent: () => Promise.resolve(() => {}),
  onPiExit: () => Promise.resolve(() => {}),
}));

import { createAgentStore } from './agent';

describe('createAgentStore', () => {
  let store: ReturnType<typeof createAgentStore>;

  afterEach(() => {
    store?.destroy();
  });

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
});

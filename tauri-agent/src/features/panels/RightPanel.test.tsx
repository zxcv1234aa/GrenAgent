import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { messagesRef } = vi.hoisted(() => ({ messagesRef: { current: [] as unknown[] } }));
vi.mock('../../stores/AgentStoreContext', () => ({
  useAgentStore: () => ({
    useStore: (sel: (s: { messages: unknown[] }) => unknown) => sel({ messages: messagesRef.current }),
  }),
}));
vi.mock('../chat/LazyMarkdown', () => ({
  LazyMarkdown: ({ children }: { children: string }) => <div>{children}</div>,
}));

import { RightPanel } from './RightPanel';

afterEach(() => {
  cleanup();
  messagesRef.current = [];
});

describe('RightPanel sub-agent view', () => {
  it('shows an empty hint when there are no sub-agents', () => {
    render(<RightPanel />);
    expect(screen.getByTestId('subagent-panel').textContent).toContain('暂无子代理');
  });

  it('renders sub-agent task + streaming output + status (ignores other tools)', () => {
    messagesRef.current = [
      {
        kind: 'tool',
        id: 't1',
        toolCallId: 'c1',
        toolName: 'spawn_agent',
        args: { task: 'research X' },
        result: { content: [{ type: 'text', text: 'partial output' }] },
        status: 'running',
      },
      { kind: 'tool', id: 't2', toolCallId: 'c2', toolName: 'bash', args: {}, result: {}, status: 'done' },
    ];
    render(<RightPanel />);
    const card = screen.getByTestId('subagent-c1');
    expect(card.textContent).toContain('research X');
    expect(card.textContent).toContain('partial output');
    expect(card.textContent).toContain('运行中');
    expect(screen.queryByTestId('subagent-c2')).toBeNull();
  });
});

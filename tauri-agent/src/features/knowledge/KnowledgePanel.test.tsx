import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { kbStats, kbSources, kbChunks } = vi.hoisted(() => ({
  kbStats: vi.fn(() => Promise.resolve({ chunks: 3, sources: 2, model: 'text-embed' })),
  kbSources: vi.fn(() =>
    Promise.resolve([
      { source: 'a.md', chunks: 2 },
      { source: 'b.md', chunks: 1 },
    ]),
  ),
  kbChunks: vi.fn(() => Promise.resolve([{ id: 'c1', text: 'hello chunk' }])),
}));

vi.mock('../../stores/AgentStoreContext', () => ({
  useAgentStoreContext: () => ({ workspace: '/ws' }),
}));
vi.mock('../../lib/pi', () => ({ pi: { kbStats, kbSources, kbChunks } }));

import { KnowledgePanel } from './KnowledgePanel';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('KnowledgePanel', () => {
  it('shows stats and source list', async () => {
    render(<KnowledgePanel />);
    await waitFor(() => expect(screen.getByTestId('kb-header').textContent).toContain('3'));
    expect(screen.getByTestId('kb-header').textContent).toContain('2');
    expect(screen.getByTestId('kb-source-a.md')).toBeTruthy();
    expect(screen.getByTestId('kb-source-b.md')).toBeTruthy();
  });

  it('loads chunks when a source is clicked', async () => {
    render(<KnowledgePanel />);
    await waitFor(() => expect(screen.getByTestId('kb-source-a.md')).toBeTruthy());
    fireEvent.click(screen.getByTestId('kb-source-a.md'));
    await waitFor(() => expect(kbChunks).toHaveBeenCalledWith('/ws', 'a.md'));
    await waitFor(() => expect(screen.getByTestId('kb-detail').textContent).toContain('hello chunk'));
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@lobehub/ui';
import { WorkflowCollapse } from './WorkflowCollapse';

afterEach(cleanup);

const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider themeMode="dark">{ui}</ThemeProvider>);

const tools = [
  { id: 'a', toolCallId: 'a', toolName: 'glob', args: {}, result: {}, status: 'done' as const },
  { id: 'b', toolCallId: 'b', toolName: 'read', args: {}, result: {}, status: 'done' as const },
];

describe('WorkflowCollapse', { timeout: 30_000 }, () => {
  it('折叠态显示工具数摘要', () => {
    wrap(<WorkflowCollapse tools={tools} />);
    expect(screen.getByText(/运行了 2 个工具|2 个工具/)).toBeTruthy();
  });

  it('运行中显示 shimmer 进度（done/total）', () => {
    const running = [
      tools[0],
      { id: 'c', toolCallId: 'c', toolName: 'bash', args: {}, result: {}, status: 'running' as const },
    ];
    wrap(<WorkflowCollapse tools={running} />);
    expect(screen.getByText(/正在运行工具…/)).toBeTruthy();
  });
});

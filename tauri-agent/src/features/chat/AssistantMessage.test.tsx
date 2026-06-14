// DOM 级验证：thinking 数据到达后，AssistantMessage 是否真的渲染出深度思考块。
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@lobehub/ui';
import { AssistantMessage } from './AssistantMessage';

afterEach(cleanup);

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider themeMode="dark">{ui}</ThemeProvider>);
}

// @lobehub/ui 渲染链路较重，全量并发跑时首渲可能超过默认 5s。
describe('AssistantMessage thinking 渲染', { timeout: 30_000 }, () => {
  it('推理流式中：显示「深度思考中…」（正文走打字机动画，jsdom 无 rAF 不断言文本）', () => {
    renderWithTheme(
      <AssistantMessage text="" thinking="用户要求计算 47*83" streaming={true} />,
    );
    expect(screen.getAllByText('深度思考中…').length).toBeGreaterThan(0);
  });

  it('推理结束：显示「已深度思考（用时 X 秒）」', () => {
    renderWithTheme(
      <AssistantMessage
        text="3901"
        thinking="用户要求计算 47*83"
        streaming={false}
        thinkingDuration={2300}
      />,
    );
    expect(screen.getAllByText(/已深度思考（用时 2\.3 秒）/).length).toBeGreaterThan(0);
  });

  it('无 thinking 时不渲染思考块', () => {
    renderWithTheme(<AssistantMessage text="hi" thinking="" streaming={false} />);
    expect(screen.queryByText(/深度思考/)).toBeNull();
  });
});

describe('AssistantMessage tools 内联渲染', { timeout: 30_000 }, () => {
  it('提供 tools 时渲染 ToolExecution 列表（按 toolName 命中）', async () => {
    renderWithTheme(
      <AssistantMessage
        text="完成"
        thinking=""
        streaming={false}
        tools={[
          {
            id: 't1',
            toolCallId: 'tc1',
            toolName: 'grep_search',
            args: { q: 'foo' },
            result: { hits: 3 },
            status: 'done',
          },
        ]}
      />,
    );
    await screen.findByText(/grep_search/i, undefined, { timeout: 5000 });
  });

  it('tools 为空数组时不渲染 ToolExecution', () => {
    renderWithTheme(
      <AssistantMessage text="hi" thinking="" streaming={false} tools={[]} />,
    );
    expect(screen.queryByText(/grep_search/i)).toBeNull();
  });

  it('tools 未提供时不渲染 ToolExecution', () => {
    renderWithTheme(<AssistantMessage text="hi" thinking="" streaming={false} />);
    expect(screen.queryByText(/grep_search/i)).toBeNull();
  });
});

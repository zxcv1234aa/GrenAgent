import { describe, it, expect } from 'vitest';
import {
  argSummary,
  extractText,
  getDiff,
  langByPath,
  toolMeta,
} from './toolUtils';
import { Terminal, Wrench } from 'lucide-react';

describe('toolUtils', () => {
  it('extractText from content blocks', () => {
    expect(
      extractText({ content: [{ type: 'text', text: 'line1' }, { type: 'text', text: 'line2' }] }),
    ).toBe('line1\nline2');
  });

  it('extractText from string content', () => {
    expect(extractText({ content: 'hello' })).toBe('hello');
    expect(extractText('raw')).toBe('raw');
  });

  it('getDiff reads details.diff', () => {
    expect(getDiff({ details: { diff: '@@ -1 +1 @@\n-old\n+new' } })).toContain('@@');
    expect(getDiff({ details: {} })).toBeUndefined();
  });

  it('toolMeta maps bash to Terminal', () => {
    expect(toolMeta('bash').icon).toBe(Terminal);
    expect(toolMeta('unknown_tool').icon).toBe(Wrench);
  });

  it('argSummary shows first key value truncated', () => {
    expect(argSummary({ command: 'ls -la' })).toBe('command: ls -la');
    expect(argSummary({})).toBe('');
  });

  it('langByPath maps extensions', () => {
    expect(langByPath('src/foo.ts')).toBe('typescript');
    expect(langByPath('readme')).toBe('plaintext');
  });
});

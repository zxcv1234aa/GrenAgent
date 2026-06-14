import { describe, it, expect } from 'vitest';
import { buildConversations } from './useConversations';
import type { SessionInfo } from '../../lib/pi';

const mk = (cwd: string, ts: string, name: string | null): SessionInfo => ({
  id: cwd + ts,
  path: `${cwd}/${ts}.jsonl`,
  cwd,
  timestamp: ts,
  name,
});

describe('buildConversations', () => {
  it('folds each works cwd to one item, latest first, name fallback', () => {
    const all = [
      mk('/w/works/u1', '2026-01-01T00:00:00Z', null),
      mk('/w/works/u1', '2026-01-02T00:00:00Z', 'Renamed'),
      mk('/proj/a', '2026-01-03T00:00:00Z', 'proj'),
    ];
    const items = buildConversations(all, '/w/works', '/w/works/u1', '');
    expect(items).toHaveLength(1);
    expect(items[0].cwd).toBe('/w/works/u1');
    expect(items[0].name).toBe('Renamed');
    expect(items[0].isCurrent).toBe(true);
  });

  it('returns empty when worksDir is unset', () => {
    const all = [mk('/w/works/u1', '2026-01-01T00:00:00Z', null)];
    expect(buildConversations(all, '', '', '')).toHaveLength(0);
  });
});

import { describe, it, expect } from 'vitest';
import { buildProjectGroups } from './useProjectGroups';
import type { SessionInfo } from '../../lib/pi';

const s = (cwd: string, ts: string): SessionInfo => ({
  id: cwd + ts,
  path: `${cwd}/${ts}.jsonl`,
  cwd,
  timestamp: ts,
  name: null,
});

describe('buildProjectGroups worksDir filter', () => {
  it('excludes sessions under worksDir', () => {
    const sessions = [s('/home/.pi/agent/works/u1', 't1'), s('/proj/a', 't2')];
    const groups = buildProjectGroups(sessions, {
      current: '',
      pinnedProjects: [],
      hiddenProjects: [],
      aliases: {},
      keyword: '',
      worksDir: '/home/.pi/agent/works',
    });
    expect(groups.map((g) => g.cwd)).toEqual(['/proj/a']);
  });
});

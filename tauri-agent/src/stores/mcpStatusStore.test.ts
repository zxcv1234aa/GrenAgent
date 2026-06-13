import { beforeEach, describe, expect, it } from 'vitest';
import { useMcpStatusStore } from './mcpStatusStore';

beforeEach(() => useMcpStatusStore.setState({ servers: [] }));

describe('mcpStatusStore', () => {
  it('sets and clears server statuses', () => {
    useMcpStatusStore.getState().setServers([{ name: 'fs', transport: 'stdio', status: 'connected', tools: 14 }]);
    expect(useMcpStatusStore.getState().servers).toHaveLength(1);
    expect(useMcpStatusStore.getState().servers[0]).toMatchObject({ name: 'fs', status: 'connected', tools: 14 });
    useMcpStatusStore.getState().setServers([]);
    expect(useMcpStatusStore.getState().servers).toEqual([]);
  });
});

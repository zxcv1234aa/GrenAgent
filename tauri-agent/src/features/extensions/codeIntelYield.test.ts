import { describe, expect, it } from 'vitest';
import { userConfiguredCodegraph } from './codeIntelYield';

describe('userConfiguredCodegraph', () => {
  it('detects a user-configured server named codegraph', () => {
    const json = '{"mcpServers":{"codegraph":{"command":"codegraph","args":["serve","--mcp"]}}}';
    expect(userConfiguredCodegraph(json, [])).toBe(true);
  });

  it('detects a differently-named server exposing codegraph_* tools', () => {
    expect(userConfiguredCodegraph('{"mcpServers":{"my-cg":{"command":"x"}}}', ['codegraph_explore'])).toBe(true);
  });

  it('returns false when neither name nor tool signature matches', () => {
    expect(userConfiguredCodegraph('{"mcpServers":{"fs":{"command":"npx"}}}', ['read_file'])).toBe(false);
  });

  it('tolerates empty / invalid JSON', () => {
    expect(userConfiguredCodegraph('', [])).toBe(false);
    expect(userConfiguredCodegraph('not json', [])).toBe(false);
    expect(userConfiguredCodegraph('{}', [])).toBe(false);
  });

  it('accepts a bare map without the mcpServers wrapper', () => {
    expect(userConfiguredCodegraph('{"codegraph":{"command":"x"}}', [])).toBe(true);
  });
});

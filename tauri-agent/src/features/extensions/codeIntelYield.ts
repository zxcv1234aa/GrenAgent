// 让位推断（纯函数，无 I/O）：用户是否已自配 codegraph —— 同名 server，或别名 server
// 暴露 codegraph_* 工具。命中则内置引擎「让位」，UI 显示对应徽标。
// 与 sidecar 侧 injectDefaultServers 的让位策略对齐（此处是前端只读复刻，用于展示）。
const CODEGRAPH_SERVER_NAME = 'codegraph';
const CODEGRAPH_TOOL_PREFIX = 'codegraph_';

export function userConfiguredCodegraph(mcpServersJson: string, toolNames: string[]): boolean {
  if (toolNames.some((t) => t.startsWith(CODEGRAPH_TOOL_PREFIX))) return true;
  let parsed: unknown;
  try {
    parsed = JSON.parse(mcpServersJson);
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== 'object') return false;
  const root = parsed as Record<string, unknown>;
  const servers =
    'mcpServers' in root && root.mcpServers && typeof root.mcpServers === 'object'
      ? (root.mcpServers as Record<string, unknown>)
      : root;
  return Object.prototype.hasOwnProperty.call(servers, CODEGRAPH_SERVER_NAME);
}

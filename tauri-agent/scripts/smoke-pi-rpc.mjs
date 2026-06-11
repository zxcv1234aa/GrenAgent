// 对 pi sidecar 做最小 RPC 冒烟：get_state + prompt（列出目录）
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve, join } from 'node:path';

const appRoot = resolve(import.meta.dirname, '..');
const piExe = join(
  appRoot,
  'src-tauri',
  'binaries',
  'pi-x86_64-pc-windows-msvc.exe',
);
const packageDir = join(appRoot, 'src-tauri', 'binaries');

const child = spawn(piExe, ['--mode', 'rpc'], {
  cwd: appRoot,
  env: { ...process.env, PI_PACKAGE_DIR: packageDir },
  stdio: ['pipe', 'pipe', 'pipe'],
});

const rl = createInterface({ input: child.stdout });
const pending = new Map();
let sawTool = false;
let sawAssistant = false;
let done = false;

function send(obj) {
  child.stdin.write(`${JSON.stringify(obj)}\n`);
}

rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    console.error('non-json:', line.slice(0, 200));
    return;
  }

  if (msg.type === 'response' && msg.id) {
    pending.get(msg.id)?.(msg);
    pending.delete(msg.id);
    return;
  }

  const ev = msg.event ?? msg;
  const t = ev?.type ?? msg.type;
  if (t === 'message_update' || t === 'text_delta' || t === 'assistant_message') {
    sawAssistant = true;
  }
  if (t === 'tool_execution_start' || t === 'tool_execution_update' || t === 'tool_execution_end') {
    sawTool = true;
  }
  if (t === 'agent_end' || t === 'turn_end') {
    done = true;
  }
});

child.stderr.on('data', (d) => process.stderr.write(d));

function rpc(type, extra = {}) {
  const id = `smoke-${type}-${Math.random().toString(36).slice(2, 8)}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${type}`)), 120_000);
    pending.set(id, (res) => {
      clearTimeout(timer);
      if (res.success) resolve(res.data);
      else reject(new Error(res.error ?? `${type} failed`));
    });
    send({ type, id, ...extra });
  });
}

try {
  const state = await rpc('get_state');
  console.log('get_state ok, model:', state?.model?.id ?? state?.model);

  send({
    type: 'prompt',
    id: 'smoke-prompt',
    message: '列出当前目录的文件（只列文件名，不要改任何东西）',
  });

  const deadline = Date.now() + 120_000;
  while (!done && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log('assistant stream:', sawAssistant);
  console.log('tool activity:', sawTool);
  console.log('turn complete:', done);

  if (!sawAssistant) {
    console.error('FAIL: no assistant output');
    process.exitCode = 1;
  } else {
    console.log('SMOKE OK');
  }
} catch (err) {
  console.error('FAIL:', err);
  process.exitCode = 1;
} finally {
  child.kill();
  process.exit(process.exitCode ?? 0);
}

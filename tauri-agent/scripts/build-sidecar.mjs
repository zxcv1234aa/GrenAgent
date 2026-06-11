// 把 pi 编译为独立二进制，并按 Tauri target triple 命名放入 src-tauri/binaries/。
// 用法：node scripts/build-sidecar.mjs  （或 pnpm build:sidecar）
// 前置：已安装 bun；pi monorepo 位于 ../pi（相对本应用根）。
import { execSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const appRoot = resolve(import.meta.dirname, '..'); // tauri-agent/
const piRoot = resolve(appRoot, '..', 'pi', 'packages', 'coding-agent');
const binDir = join(appRoot, 'src-tauri', 'binaries');
mkdirSync(binDir, { recursive: true });

// 1) 编译 pi 独立二进制（产物 pi/packages/coding-agent/dist/pi[.exe]）
console.log('Building pi binary via bun…');
execSync('npm run build:binary', { cwd: piRoot, stdio: 'inherit' });

// 2) 取 rustc host target triple
const hostLine = execSync('rustc -Vv')
  .toString()
  .split('\n')
  .find((l) => l.startsWith('host:'));
if (!hostLine) throw new Error('could not determine rustc host triple');
const triple = hostLine.split('host:')[1].trim();
const isWin = triple.includes('windows');

const src = join(piRoot, 'dist', isWin ? 'pi.exe' : 'pi');
const dest = join(binDir, `pi-${triple}${isWin ? '.exe' : ''}`);
if (!existsSync(src)) throw new Error(`pi binary not found at ${src}`);
copyFileSync(src, dest);

// 3) Bun 编译产物需在 exe 同目录附带 theme/assets/export-html 等运行时资源
const distRoot = join(piRoot, 'dist');
for (const dir of ['theme', 'assets', 'export-html', 'docs', 'examples']) {
  const from = join(distRoot, dir);
  if (!existsSync(from)) continue;
  cpSync(from, join(binDir, dir), { recursive: true });
}
for (const file of ['package.json', 'README.md', 'CHANGELOG.md', 'photon_rs_bg.wasm']) {
  const from = join(distRoot, file);
  if (!existsSync(from)) continue;
  copyFileSync(from, join(binDir, file));
}

console.log(`Sidecar ready: ${dest}`);

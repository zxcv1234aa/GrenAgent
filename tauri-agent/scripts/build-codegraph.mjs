// Build script: vendors the self-contained CodeGraph bundle for the current
// platform into src-tauri/binaries/codegraph/ so Tauri can ship it as a bundled
// resource (see tauri.conf.json `bundle.resources`). Run via `npm run build:codegraph`.
//
// CodeGraph is NOT a single-file binary: each platform ships a directory bundle
// (a vendored Node 24 runtime + lib/dist + a bin launcher), distributed as the
// per-platform npm package @colbymchenry/codegraph-<platform>-<arch> AND as a
// GitHub Releases archive (codegraph-<platform>-<arch>.tar.gz / .zip). We fetch
// the GitHub Releases archive directly — same artifact the upstream npm shim's
// self-heal path uses — because it does not depend on optionalDependencies being
// mirrored by the active registry (npmmirror/cnpm often drop them).
//
// Layout after extraction (strip-components=1):
//   unix : codegraph/bin/codegraph        (launcher) + codegraph/node + codegraph/lib/...
//   win32: codegraph/node.exe + codegraph/lib/dist/bin/codegraph.js
//
// Knobs:
//   CODEGRAPH_VERSION=x.y.z       override the pinned version
//   CODEGRAPH_DOWNLOAD_BASE=URL   release-download base (mirrors / air-gapped)
//   CODEGRAPH_FORCE=1             re-download even if a bundle is already present
import { execSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, createWriteStream, readFileSync, renameSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import https from "node:https";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CODEGRAPH_VERSION = process.env.CODEGRAPH_VERSION || "1.0.1"; // pinned; bump to upgrade
const REPO = "colbymchenry/codegraph";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const destDir = join(appRoot, "src-tauri", "binaries", "codegraph");

const isWin = process.platform === "win32";
const target = `${process.platform}-${process.arch}`; // e.g. win32-x64, darwin-arm64, linux-x64
const asset = `codegraph-${target}${isWin ? ".zip" : ".tar.gz"}`;
const base = process.env.CODEGRAPH_DOWNLOAD_BASE || `https://github.com/${REPO}/releases/download`;
const url = `${base}/v${CODEGRAPH_VERSION}/${asset}`;

// The launcher proving a usable bundle (mirrors the upstream shim's layout check).
function launcherExists(dir) {
  if (isWin) {
    return existsSync(join(dir, "node.exe")) && existsSync(join(dir, "lib", "dist", "bin", "codegraph.js"));
  }
  return existsSync(join(dir, "bin", "codegraph"));
}

async function main() {
  if (!process.env.CODEGRAPH_FORCE && launcherExists(destDir)) {
    console.log(`[build-codegraph] bundle already present for ${target}: ${destDir}`);
    return;
  }

  console.log(`[build-codegraph] fetching ${asset} (codegraph v${CODEGRAPH_VERSION})…`);
  mkdirSync(dirname(destDir), { recursive: true });
  const stage = mkdtempSync(join(tmpdir(), "codegraph-dl-"));
  try {
    const archivePath = join(stage, asset);
    await download(url, archivePath, 6);
    await verifyChecksum(archivePath, asset, stage);

    // Extract straight into destDir, stripping the archive's top-level
    // codegraph-<target>/ directory so bin/ node lib/ land at destDir root.
    rmSync(destDir, { recursive: true, force: true });
    mkdirSync(destDir, { recursive: true });
    extract(archivePath, destDir);

    if (!launcherExists(destDir)) {
      throw new Error(`extracted bundle is missing its launcher under ${destDir}`);
    }
    if (!isWin) {
      // Ensure launcher + bundled node are executable after extraction.
      for (const rel of ["bin/codegraph", "node"]) {
        const p = join(destDir, rel);
        if (existsSync(p)) chmodSync(p, 0o755);
      }
    }
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }

  console.log(`[build-codegraph] bundle ready: ${destDir}`);
  smoke();
}

// GET with manual redirect following (GitHub release URLs redirect to a CDN).
function download(fileUrl, dest, redirectsLeft) {
  return new Promise((resolvePromise, reject) => {
    const req = https.get(fileUrl, { headers: { "User-Agent": "pi-build-codegraph" }, timeout: 30000 }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        if (redirectsLeft <= 0) return reject(new Error("too many redirects"));
        return download(new URL(res.headers.location, fileUrl).toString(), dest, redirectsLeft - 1).then(resolvePromise, reject);
      }
      if (status !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${status} for ${fileUrl}`));
      }
      const file = createWriteStream(dest);
      res.on("error", reject);
      res.pipe(file);
      file.on("error", reject);
      file.on("finish", () => file.close(() => resolvePromise()));
    });
    req.on("timeout", () => req.destroy(new Error("connection timed out")));
    req.on("error", reject);
  });
}

// Best-effort integrity check: if the release publishes SHA256SUMS, the archive
// MUST match; if absent/unreachable, proceed (it still arrived from GitHub TLS).
async function verifyChecksum(archivePath, assetName, stage) {
  const sumsPath = join(stage, "SHA256SUMS");
  try {
    await download(`${base}/v${CODEGRAPH_VERSION}/SHA256SUMS`, sumsPath, 6);
  } catch {
    return; // not published / unreachable → skip
  }
  let expected = null;
  for (const line of readFileSync(sumsPath, "utf8").split("\n")) {
    const m = line.trim().match(/^([0-9a-fA-F]{64})\s+\*?(.+)$/);
    if (m && m[2].trim().replace(/^.*[\\/]/, "") === assetName) {
      expected = m[1].toLowerCase();
      break;
    }
  }
  if (!expected) return; // asset not listed → nothing to check
  const actual = createHash("sha256").update(readFileSync(archivePath)).digest("hex");
  if (actual !== expected) {
    throw new Error(`checksum mismatch for ${assetName} (expected ${expected.slice(0, 12)}…, got ${actual.slice(0, 12)}…)`);
  }
  console.log("[build-codegraph] checksum verified.");
}

// Extract via the system tar — present on macOS, Linux, and Windows 10+
// (bsdtar reads .zip too). Strip the archive's top-level codegraph-<target>/ dir.
function extract(archive, dir) {
  const args = isWin
    ? ["-xf", archive, "-C", dir, "--strip-components=1"]
    : ["-xzf", archive, "-C", dir, "--strip-components=1"];
  execSync(`tar ${args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`, { stdio: "inherit" });
}

// Best-effort smoke: print the bundled launcher's version. Never fails the build.
function smoke() {
  try {
    const cmd = isWin
      ? `"${join(destDir, "node.exe")}" --liftoff-only "${join(destDir, "lib", "dist", "bin", "codegraph.js")}" --version`
      : `"${join(destDir, "bin", "codegraph")}" --version`;
    const out = execSync(cmd, { encoding: "utf8" }).trim();
    console.log(`[build-codegraph] smoke ok: codegraph ${out}`);
  } catch (e) {
    console.warn(`[build-codegraph] smoke skipped: ${e.message}`);
  }
}

main().catch((e) => {
  console.error(`[build-codegraph] ${e && e.message ? e.message : e}`);
  process.exit(1);
});

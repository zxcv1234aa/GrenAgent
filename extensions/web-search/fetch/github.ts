const README_CANDIDATES = [
  "README.md",
  "README.mdx",
  "README.markdown",
  "README",
  "README.txt",
  "readme.md",
  "readme.mdx",
  "readme.markdown",
  "readme",
  "readme.txt",
];

export function extractGithubRepo(url: string): { owner: string; repo: string } | null {
  const trimmed = url.trim();
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s]+)/i,
    /git@github\.com:([^/\s]+)\/([^/\s]+)\.git/i,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (!match) continue;
    const owner = match[1].trim();
    const repo = match[2].replace(/(?:[?#].*$|\.git$|\/.*$)/g, "").trim();
    if (owner && repo) return { owner, repo };
  }
  return null;
}

// 移植自 open-webSearch src/engines/github/github.ts。
export async function fetchGithubReadme(
  githubUrl: string,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<string | null> {
  const repoInfo = extractGithubRepo(githubUrl);
  if (!repoInfo) return null;

  for (const readmeFile of README_CANDIDATES) {
    const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(repoInfo.owner)}/${encodeURIComponent(repoInfo.repo)}/HEAD/${readmeFile}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true });
    try {
      const res = await fetch(rawUrl, {
        signal: controller.signal,
        headers: { "user-agent": "GitHub-README-Fetcher/1.0" },
      });
      if (res.status === 404) continue;
      if (!res.ok) return null;
      const text = (await res.text()).trim();
      if (text) return text;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

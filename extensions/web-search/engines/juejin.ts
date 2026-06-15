import type { SearchResult } from "../provider.js";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function asNum(v: unknown): number {
  return typeof v === "number" ? v : 0;
}
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function stripEm(s: string): string {
  return s.replace(/<\/?em>/g, "");
}

// 移植自 open-webSearch src/engines/juejin/juejin.ts（api.juejin.cn JSON API）。
export function parseJuejin(json: unknown): SearchResult[] {
  const root = asRecord(json);
  if (asNum(root.err_no) !== 0) return [];
  return asArray(root.data)
    .map((item) => {
      const row = asRecord(item);
      const model = asRecord(row.result_model);
      const articleId = asStr(model.article_id);
      const info = asRecord(model.article_info);
      const author = asRecord(model.author_user_info);
      const category = asRecord(model.category);
      const title = stripEm(asStr(row.title_highlight) || asStr(info.title));
      if (!articleId || !title) return null;

      const content = stripEm(asStr(row.content_highlight) || asStr(info.brief_content));
      const tags = asArray(model.tags)
        .map((t) => asStr(asRecord(t).tag_name))
        .filter(Boolean)
        .join(", ");
      const snippet = [
        content,
        category.category_name ? `分类: ${asStr(category.category_name)}` : "",
        tags ? `标签: ${tags}` : "",
        `👍 ${asNum(info.digg_count)} · 👀 ${asNum(info.view_count)}`,
      ]
        .filter(Boolean)
        .join(" | ");

      return { title, url: `https://juejin.cn/post/${articleId}`, snippet };
    })
    .filter((r): r is SearchResult => r !== null);
}

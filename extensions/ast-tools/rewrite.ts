// ast-grep 的 node.replace() 不展开 metavariable（与 CLI 不同），需在 JS 侧自己拼。
// expandTemplate 把 out 模板里的 $NAME / $$$NAME 替换为 resolver 提供的文本；$$ 转义为字面 $。
export interface MetaResolver {
  /** $NAME 单匹配文本，无则 null */
  single(name: string): string | null;
  /** $$$NAME 多匹配的原始源码切片（含原分隔符），无则 null */
  multi(name: string): string | null;
}

// 顺序：先 $$$NAME（多），再 $NAME（单），再 $$（字面 $）。
const META_RE = /\$\$\$([A-Z_][A-Z0-9_]*)|\$([A-Z_][A-Z0-9_]*)|\$\$/g;

export function expandTemplate(out: string, r: MetaResolver): string {
  return out.replace(META_RE, (m, multi: string | undefined, single: string | undefined) => {
    if (m === "$$") return "$";
    if (multi !== undefined) return r.multi(multi) ?? "";
    if (single !== undefined) return r.single(single) ?? "";
    return m;
  });
}

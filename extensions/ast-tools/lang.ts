// ast-grep 核心包（@ast-grep/napi@0.43）内置语言：Html / JavaScript / Tsx / Css / TypeScript。
// 这些值是 parse(lang, src) 接受的语言字符串（Lang enum 运行时为空，故用字面量）。
// 其他语言（python/go/rust/...）需 registerDynamicLanguage + tree-sitter 动态库，列为后续增强。
export type CoreLang = "JavaScript" | "TypeScript" | "Tsx" | "Css" | "Html";

const EXT_TO_LANG: Record<string, CoreLang> = {
  js: "JavaScript",
  jsx: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  ts: "TypeScript",
  mts: "TypeScript",
  cts: "TypeScript",
  tsx: "Tsx",
  css: "Css",
  html: "Html",
  htm: "Html",
};

export function extToLang(filename: string): CoreLang | null {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = filename.slice(dot + 1).toLowerCase();
  return EXT_TO_LANG[ext] ?? null;
}

# pi-code-review

为 [Pi coding agent](https://github.com/earendil-works/pi) 写的**结构化代码审查扩展**。

让 agent 拉取 git diff、逐条记录审查发现(带 severity),最后生成分组报告。发现存 `node:sqlite`,**零第三方依赖**。

## 能力

| 类型 | 名称 | 说明 |
|---|---|---|
| 工具(LLM 可调) | `git_diff` | 取工作区 / 暂存 / 对比某 ref 的 diff(`staged` / `base` / `path`) |
| 工具(LLM 可调) | `review_note` | 记录一条发现:`file` + `severity` + `message`(+ 可选 `line`) |
| 命令 | `/review report` `/review list` `/review clear` | 生成报告 / 列出 / 清空 |

severity 约定:`blocker` > `major` > `minor` > `nit` > `praise`。存储:`<cwd>/.pi/reviews/reviews.db`。

## 安装 / 用法

```bash
pi -e ./extensions/code-review/index.ts
# 会话里:
> review 一下我暂存的改动
  (agent 调 git_diff{staged:true} 看变更,对每个问题调 review_note 记录)
/review report   # 输出按 severity 分组的 markdown 报告
```

## 文件结构

```text
code-review/
├── index.ts       # git_diff / review_note 工具 + /review 命令
├── store.ts       # node:sqlite 存审查发现 + 生成分组报告
├── git.ts         # git diff via child_process(零依赖)
├── package.json
└── README.md
```

## 进阶扩展点

1. **自动 review 流程**:加一个 `/review run [base]` 命令,自动 `git_diff` + `pi.sendUserMessage` 注入审查指令,一键触发完整 review。
2. **导出**:`/review report` 写入 `REVIEW.md` 文件而非仅 toast。
3. **规则集**:加载项目 `.pi/review-rules.md` 作为审查 checklist 注入(参考 lobehub 的 review-checklist skill)。
4. **行级定位**:解析 diff 的 hunk 头,让 `review_note` 的 `line` 映射到新文件行号。

## 注意

- 包名按官方新名 `@earendil-works/*` + `typebox`;旧包改 `index.ts` 顶部 import。
- `git_diff` 在非 git 目录会返回友好错误;diff 超过 50000 字符会截断。

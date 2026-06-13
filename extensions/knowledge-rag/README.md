# pi-knowledge-rag

为 [Pi coding agent](https://github.com/earendil-works/pi) 写的**本地知识库 / RAG 扩展**。

给 agent 加上「先检索本地知识库、再回答」的能力,补齐 Pi 生态目前缺失的 RAG。**开箱即跑**:配置了 embedding key 就走语义检索,没配就自动降级为关键词检索。

## 能力

| 类型 | 名称 | 说明 |
|---|---|---|
| 工具(LLM 可调) | `kb_search` | 按自然语言查询检索知识库,返回 top-k 片段 |
| 工具(LLM 可调) | `kb_add` | 把文件或文本分块后写入知识库(重复 source 覆盖) |
| 命令 | `/kb stats` `/kb add <path>` `/kb clear` | 人工管理知识库 |
| 自动注入 | `before_agent_start` 钩子 | 每次提问自动检索并注入相关片段(`KB_AUTO_INJECT=0` 关闭) |

存储:`<cwd>/.pi/knowledge/default.db`(**node:sqlite**,项目级、跨重启保留)。零第三方依赖,只用 Node 内置 `node:sqlite`/`fetch`/`fs`/`crypto`。

## 安装 / 加载

```bash
# 方式 1:快速试用(在 Pi 项目根目录)
pi -e ./extensions/knowledge-rag/index.ts

# 方式 2:自动发现(放到全局或项目扩展目录)
cp -r extensions/knowledge-rag ~/.pi/agent/extensions/
#   或  .pi/extensions/  下,Pi 启动时自动加载,可用 /reload 热重载

# 方式 3:当作 Pi Package 安装(本仓库已带 package.json 的 pi 字段)
pi install git:github.com/<you>/<repo>
```

> 类型提示(可选):`npm i -D @earendil-works/pi-coding-agent @earendil-works/pi-ai typebox`

## 配置 embedding(可选,但推荐)

通过环境变量启用语义检索(任意 OpenAI 兼容 `/embeddings` 端点):

| 变量 | 默认值 | 说明 |
|---|---|---|
| `KB_EMBED_API_KEY` | (回退到 `OPENAI_API_KEY`) | 有值即启用语义检索 |
| `KB_EMBED_BASE_URL` | `https://api.openai.com/v1` | 兼容端点,可指向本地/代理 |
| `KB_EMBED_MODEL` | `text-embedding-3-small` | embedding 模型 |
| `KB_AUTO_INJECT` | `1`(开启) | 设 `0` 关闭「提问时自动检索注入」 |
| `KB_AUTO_TOPK` | `3` | 自动注入时取的片段数 |

未设置 key 时,`kb_search` 自动用关键词频率打分(纯本地,无网络)。

## 用法示例

```text
# 在 Pi 会话里
/kb add ./docs/architecture.md        # 索引一个文件
/kb stats                             # 查看条目数

# 或让 agent 自己调用工具
> 把 docs/ 下的设计文档加进知识库,然后回答:我们的鉴权方案是什么?
  (agent 会调用 kb_add 索引,再调用 kb_search 检索后回答)
```

## 文件结构

```text
knowledge-rag/
├── index.ts       # 扩展入口:注册 kb_search / kb_add 工具 + /kb 命令
├── store.ts       # 分块、node:sqlite 持久化(Float32 BLOB)、cosine / 关键词检索
├── embedding.ts   # OpenAI 兼容 embedding 调用 + 自动降级
├── package.json   # Pi Package 清单(pi.extensions)
└── README.md
```

## 进阶扩展点(脚手架预留)

这是一个**起步骨架**,以下方向可按需深化,基本不动 `index.ts`:

1. **向量索引加速**:目前用 `node:sqlite` 存 + JS cosine(O(n))。大规模时可在 `store.ts` 接 `sqlite-vec` 扩展(`db.loadExtension`)做 ANN,接口(`addDocument` / `search`)保持不变即可。
2. ✅ **自动上下文注入(已内置)**:`index.ts` 用 `before_agent_start` 钩子实现——每次用户提问自动 `kb_search`,把命中片段作为额外上下文消息注入(`display: true` 可见)。用 `KB_AUTO_INJECT=0` 关闭、`KB_AUTO_TOPK` 调数量。选 `before_agent_start` 而非 `context` 事件,是因为它能直接拿到 `event.prompt`,更简单可靠。

3. **多知识库 / collection**:把 `default.db` 换成按 `collection` 命名,`kb_search` / `kb_add` 加一个 `collection` 参数。
4. **更好的分块**:按代码 AST / Markdown 标题切分,替换 `store.ts` 的 `chunkText`。
5. **引用回链**:`kb_add` 时记录文件行号,`kb_search` 结果回链到具体位置。

## 注意

- 包名:本扩展按官方新包名 `@earendil-works/*` + `typebox` 写(**实测**该 Pi 版本 bundle 的是 `typebox`,不是 `@sinclair/typebox`)。如果你的 Pi 是旧包 `@mariozechner/*` / `@sinclair/typebox`,把 `index.ts` 顶部 import 改掉即可(类型 import 不影响运行时)。
- 工具输出已限制在约 8000 字符内,避免撑爆上下文。
- 存储用 Node 内置 `node:sqlite`(实验特性),首次加载会打印一行 `ExperimentalWarning`,属正常、不影响功能(需 Node ≥ 22.5;你的 v24.11 无需 flag)。

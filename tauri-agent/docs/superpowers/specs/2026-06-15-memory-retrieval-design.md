# long-term-memory 检索升级设计规格 — 结构化过滤 / 纯 JS 向量召回优化 / 降权老化

> **面向 AI 代理：** 这是设计规格（spec）。下一步用 `superpowers:writing-plans` 产出实现计划，再用 `superpowers:executing-plans` 内联执行（本仓库**禁止子代理**）。
>
> 配套计划：`docs/superpowers/plans/2026-06-15-memory-retrieval-plan.md`（writing-plans 阶段生成）。

**目标：** 把 `extensions/long-term-memory` 的召回从「每次全表 SELECT + 逐条 decode BLOB + 全量内存 cosine」优化为「**结构化过滤缩候选 + 预解码向量缓存 + 加权重排**」，并补齐**基于使用度的降权排序**——全程**纯 JS、零新增依赖**，与 Pi 的 `bun --compile` 单二进制 sidecar + 「复制即跑」完全兼容。

**架构原则：** 改动全部落在 `extensions/long-term-memory/`。**不动** `consolidate.ts`（mem0 写入决策）、`history`/`rollback`、双 scope 合并语义、`_shared/sqlite.ts`（跨 bun/node 的 SQLite 封装）。**不引入任何原生扩展**。

**技术栈：** TypeScript + `node:sqlite`/`bun:sqlite`（经现有 `_shared/sqlite.ts`，不改）+ 纯 JS 向量计算 + typebox + vitest（node 环境）。**无新增运行时依赖。**

---

## 1. 背景与动机

### 1.1 现状（实测）

- **存储：** `store.ts` 经 `_shared/sqlite.ts` 用 SQLite（`memories` 表：`id`(TEXT pk)、`text`、`category`、`createdAt`、`updatedAt`、`version`、`embedding` Float32 BLOB；另 `memory_history` 表）。双 scope（project/global 各一 `MemoryStore`）。
- **召回：** `recall()` 每次 `SELECT * FROM memories` → 逐条 `decodeEmbedding`(BLOB→Float32) → 全量 `cosine`（无 embedding 时 `keywordScore`）→ 排序取 topK。
- **写入：** `consolidate.ts` mem0 风格 LLM 决策；`history` + `rollback` 保证可撤销、不丢事实。
- **依赖：** `package.json` 无 `dependencies`，纯 `node:` 内置 + 宿主注入；无 key 关键词兜底，开箱即跑。

### 1.2 运行时约束（关键 — 决定本方案走向）

- Pi 把扩展包**编译进 `bun --compile` 单二进制 sidecar**，运行时是 **`bun:sqlite`**（`_shared/sqlite.ts` 用「变量 require」按运行时选 `bun:sqlite`/`node:sqlite`，并刻意绕开 bun 对 `node:sqlite` 的静态解析）。
- **原生动态库（`sqlite-vec` 的 `.dylib/.so/.dll`）无法嵌入 `bun --compile` 单二进制**：必须从文件系统 `dlopen`，已知大量案例（`@libsql`/`sharp`/`onnxruntime`/`transformers.js`）在编译后移动位置即崩 `Cannot find module '.../$bunfs/...'`。macOS 上 bun 还用 Apple SQLite（禁用扩展），需 `Database.setCustomSQLite()` 指向用户自装的 vanilla SQLite。
- **结论：** 排除 sqlite-vec 及任何原生 ANN；用纯 JS 实现，保持单二进制 + 零原生依赖 + 复制即跑。

### 1.3 缺口

| 维度 | 现状 | 缺口 |
|------|------|------|
| 检索性能 | 每次全表 SELECT + **逐条重复 decode BLOB** + 全量 cosine | 重复解码 + 无候选裁剪；记忆变多后线性成本叠加 |
| 结构化过滤 | 仅按 score 排序 | 无法按 `category`/时间/scope 收窄候选 |
| 排序质量 | 纯相似度 | 无使用度/时效加权，常用记忆不上浮、旧记忆不沉降 |

> 量级判断：单用户 coding agent 记忆通常几百~几千条。1536 维 × 几千条的纯 JS 暴力 cosine 约几十毫秒，**足够**；真正的浪费在「每次 recall 重复 decode 全量 BLOB」和「不裁剪候选」。故优化目标是消除重复解码 + 结构化裁剪，而非引入 ANN 索引。

---

## 2. 范围

### 2.1 覆盖（三块，按阶段实现）

- **检索优化（纯 JS）：** 结构化过滤前置裁剪候选 + 预解码向量缓存（消除每次 recall 的重复 BLOB 解码）。
- **结构化过滤：** `category` / 时间范围 / scope 进入查询与召回 API。
- **降权老化：** 新增 `useCount` / `lastUsedAt`，命中即更新，融入加权排序（**只降权、不删除**）。

### 2.2 非目标（YAGNI）

- 不引入 `sqlite-vec` 或任何原生扩展（保 `bun --compile` 单二进制 + 复制即跑）。
- 不构建真正的 ANN 索引（量级不需要；纯 JS 暴力 + 缓存足够）。
- **int8 量化仅作预留**：本期不实现；仅在 §8 记录接口位置，留待记忆量级真正变大时再做。
- 不改 `consolidate`/`history`/`rollback`/双 scope 语义、`_shared/sqlite.ts`、Rust/Tauri/前端。
- 不自动删除任何记忆（老化仅影响排序）。

---

## 3. 数据层

### 3.1 表结构

- `memories` 表**基本不变**；`save()` 的 `INSERT OR REPLACE` **保留不动**（纯 JS 方案不需要 rowid 对齐，故无 §sqlite-vec 方案中的 upsert 改造）。
- 新增两列老化字段（**Phase 3 引入**，沿用现有 `migrate()` 的 PRAGMA 增量迁移，老库无损升级）：

```sql
ALTER TABLE memories ADD COLUMN lastUsedAt INTEGER;          -- 最近被召回命中的时间(ms)
ALTER TABLE memories ADD COLUMN useCount   INTEGER DEFAULT 0; -- 被召回命中的累计次数
```

### 3.2 内存向量缓存

`MemoryStore` 维护一份内存缓存，消除每次 `recall` 的重复 BLOB 解码：

```ts
interface CachedVec { vec: Float32Array; norm: number; }   // norm 预计算，cosine 复用
private vecCache: Map<string /*id*/, CachedVec> | null = null;  // null = 未初始化
```

- **懒初始化**：首次 `recall` 时一次性 `SELECT id, embedding FROM memories`，解码并预算 `norm`，填充缓存。
- **增量维护**：`insert`/`save` 写入缓存条目；`update` 重算 embedding 时更新；`remove`/`rollback` 删除/重置对应条目；`clear` 清空缓存。
- **一致性兜底**：以 DB 为准；任何疑似不一致场景可丢弃缓存（置 `null`）下次重建。

### 3.3 决策

| 决策 | 选项 | 结论 | 理由 |
|------|------|------|------|
| 向量后端 | sqlite-vec / 纯 JS / better-sqlite3 | **纯 JS** | bun --compile 无法嵌入原生扩展；纯 JS 零依赖、单二进制兼容、量级够用 |
| 重复解码 | 每次 decode / 内存缓存 | **内存向量缓存（懒初始化+增量维护）** | 消除每次 recall 的全量 BLOB 解码，单实例可控一致性 |
| `save()` 写法 | 保留 INSERT OR REPLACE / 改 upsert | **保留不动** | 纯 JS 无 rowid 对齐需求，无须改动 |
| 候选裁剪 | 全量算分 / SQL 过滤前置 | **SQL 过滤前置** | category/时间过滤直接缩小要算 cosine 的行数 |

---

## 4. 检索流程

```
recall(query, topK, filters?):
  1. config.enabled?  否 → 关键词召回分支（现有逻辑，含 filters 过滤）
  2. ensureVecCache()                                   // 懒初始化向量缓存
  3. 候选集 = SQL 过滤: SELECT id,text,category,createdAt[,useCount,lastUsedAt]
              FROM memories WHERE (category IN :cats)? AND (createdAt BETWEEN :from,:to)?
  4. qv = embed(query); qnorm = norm(qv)
  5. 对候选: sim = dot(qv, cache[id].vec) / (qnorm * cache[id].norm)   // 复用预算 norm
  6. 加权重排（§5），截取 topK
  7. （Phase 3）命中项批量 UPDATE useCount=useCount+1, lastUsedAt=now，并同步可能的内存态
```

- 结构化过滤在 **SQL 层**完成（缩小候选），向量算分在 **内存缓存** 完成（免重复解码）。
- 向量 BLOB 编解码沿用现有 `encodeEmbedding`/`decodeEmbedding`（Float32 ↔ `Uint8Array`）。

---

## 5. 排序公式

```
score = w_sim · sim
      + w_recency · exp(−Δt / τ)        // Δt = now − lastUsedAt；从未命中按 createdAt
      + w_usage · norm(useCount)        // norm = log(1 + useCount) / log(1 + USE_CAP)
```

- 默认权重 `w_sim=0.7 / w_recency=0.2 / w_usage=0.1`，`τ` 默认 30 天，`USE_CAP` 默认 20。
- 抽成纯函数 `scoreMemory(...)` 便于单测；权重/常量先以模块常量实现（YAGNI，暂不加 env）。
- Phase 1 仅用 `w_sim`（行为对齐现状）；Phase 2 引入 recency；Phase 3 引入 usage。

---

## 6. 老化（降权不删）

- 召回命中 → `useCount+1`、`lastUsedAt=now`；久不命中者经公式自然降分下沉。
- **永不自动物理删除**，与现有 `history`/`rollback`「不丢事实」哲学一致。物理删除仍只经 `/memory forget`/`clear` 人工触发。

---

## 7. 缓存一致性

| 写路径 | 缓存动作 |
|--------|----------|
| `insert` / `save` | 解码新 embedding 写入缓存（无 embedding 则不写） |
| `update`（文本变、重算 embedding） | 更新该 id 的缓存条目 |
| `remove` / `rollback`（删除态） | 删除该 id 缓存条目 |
| `rollback`（恢复态） | 重算并写回缓存条目 |
| `clear` | 清空缓存（置 `null` 或空 Map） |
| 懒初始化未触发 | 首次 `recall` 全量加载 |

---

## 8. 预留：int8 量化（本期不实现）

记忆量真正变大（如 ≥ 数万条）时，可把缓存向量量化为 int8（每维 `round(v / scale)`，4× 内存压缩 + 整数点积更快）做快速预筛，再对 top 候选用 float32 精算（两段式）。**本期 YAGNI 不做**，仅在缓存结构上预留扩展位（`CachedVec` 可后续加 `q?: Int8Array`）。

---

## 9. 降级 / 错误处理

| 场景 | 处理 |
|------|------|
| 无 embedding key（`config.enabled=false`） | 走现有关键词召回（叠加 §4 的结构化过滤） |
| 缓存与 DB 疑似不一致 | 以 DB 为准；丢弃缓存（置 `null`）下次重建 |
| 候选过滤后为空 | 返回空结果，不报错 |
| 老库无 `useCount`/`lastUsedAt` | `migrate` 增列；缺省 `useCount=0`、`lastUsedAt=NULL`（排序按 `createdAt` 兜底） |
| 某条无 embedding（混合库） | 该条向量分计 0（与现状一致），仍可被关键词/过滤命中 |

---

## 10. 测试（vitest，node 环境）

- 向量缓存：懒初始化加载、insert/update/remove/rollback/clear 后缓存与 DB 一致。
- 召回等价：相同数据下，缓存路径 recall 结果与「现状全表 decode」一致（防回归）。
- 结构化过滤：按 category / 时间范围筛选正确。
- 排序：`scoreMemory` 纯函数单测（sim/recency/usage 各项与组合）。
- 老化：命中后 `useCount`/`lastUsedAt` 更新且影响排序顺序。
- 降级：无 key 走关键词 + 过滤。
- 复用现有 `store.test.ts`/`consolidate.test.ts` 风格与夹具。

---

## 11. 分期实现顺序

| 阶段 | 内容 | 依赖 | 验收（独立可交付） |
|------|------|------|--------------------|
| **Phase 1 — 检索优化 + 结构化过滤** | 内存向量缓存（懒初始化+增量维护）、`recall` 改走缓存、`category`/时间过滤进 SQL、`recall`/`memory_recall` 加 filters 参数 | 无 | 召回结果与现状一致但不再重复全量 decode；可按 category/时间过滤 |
| **Phase 2 — 加权重排（时效）** | 抽 `scoreMemory` 纯函数、引入 `w_recency` | Phase 1 | 近期命中上浮 |
| **Phase 3 — 老化降权** | `lastUsedAt`/`useCount` 字段、命中更新、`scoreMemory` 引入 `w_usage` | Phase 1 | 常用记忆上浮、久不用下沉，无删除 |

P2/P3 均依赖 P1 的检索重构，可顺序内联实现；每阶段独立可合并、可验证。

---

## 12. 决策记录

| 决策 | 选项 | 结论 | 理由 |
|------|------|------|------|
| 范围 | 仅检索优化 / 优化+过滤+老化 / 含分层persona | **优化+过滤+老化** | 补齐召回质量，不上重型建模 |
| 向量后端 | sqlite-vec / 纯 JS / better-sqlite3 | **纯 JS** | bun --compile 不能嵌原生扩展；纯 JS 零依赖、复制即跑、量级够用 |
| 解码成本 | 每次 decode / 内存缓存 | **内存向量缓存** | 消除每次 recall 重复解码（最大浪费点） |
| 老化行为 | 降权不删 / 软清理 / 硬删除 | **降权不删** | 契合现有「不丢事实 + 可回滚」哲学 |
| int8 量化 | 本期做 / 预留 | **预留不做** | 当前量级 float32 缓存足够（YAGNI） |
| 依赖 | 新增 sqlite-vec / 零新增 | **零新增依赖** | 保持开箱即跑、单二进制兼容 |

> 历史记录：初版 spec 曾按 sqlite-vec 设计，后发现 Pi 是 bun --compile 单二进制（`_shared/sqlite.ts`），原生扩展无法嵌入/加载，遂改纯 JS 方案。

---

## 13. 相关文件（现状）

- `extensions/long-term-memory/store.ts` — `MemoryStore`：建表/CRUD/`recall`/history/rollback（**主改**：向量缓存、过滤、加权重排、老化字段）
- `extensions/long-term-memory/embedding.ts` — `resolveEmbeddingConfig`/`embedTexts`（不改）
- `extensions/long-term-memory/index.ts` — 工具/命令/注入接线（`memory_recall` 加 filters 参数透传）
- `extensions/long-term-memory/consolidate.ts` — mem0 写入决策（**不改**，仅复用 `recall`）
- `extensions/long-term-memory/store.test.ts` / `consolidate.test.ts` — 测试风格与夹具参考
- `extensions/_shared/sqlite.ts` — 跨 bun/node SQLite 封装（**不改**；本方案不需要 loadExtension）
- `extensions/long-term-memory/package.json` — **无须新增依赖**（纯 JS）
- `extensions/long-term-memory/README.md` — 更新「进阶扩展点」勾选（向量召回优化/遗忘策略）

---

**状态：** 设计已经用户批准（纯 JS 方案，bun --compile 约束已纳入），待 writing-plans 定稿计划。下一步 → `superpowers:writing-plans` 产出 `2026-06-15-memory-retrieval-plan.md`。

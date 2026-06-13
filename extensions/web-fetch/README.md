# pi-web-fetch

为 [Pi coding agent](https://github.com/earendil-works/pi) 写的**网页抓取扩展**。

让 agent 不用 `bash`/`curl` 就能抓取 http(s) 网页,并转成 markdown(或纯文本)读取——适合查文档、读文章、看 API 参考 / release notes。**零第三方依赖**(Node 内置 `fetch` + 正则),带 SSRF 防护、超时和输出截断。

## 能力

| 类型 | 名称 | 说明 |
|---|---|---|
| 工具(LLM 可调) | `fetch_url` | 抓取 `url`,返回正文 markdown(默认)或纯文本(`format:"text"`) |

## 安装 / 加载

```bash
pi -e ./extensions/web-fetch/index.ts
# 或放入 ~/.pi/agent/extensions/ 自动发现,或 pi install
```

## 配置

| 变量 | 默认值 | 说明 |
|---|---|---|
| `FETCH_MAX_CHARS` | `20000` | 单次返回的最大字符数(超出截断) |
| `FETCH_TIMEOUT_MS` | `15000` | 请求超时(毫秒) |

## 安全(SSRF 防护)

`fetch_url` 只允许 http/https,并拒绝指向本机/内网的地址:`localhost`、`127.*`、`10.*`、`192.168.*`、`172.16-31.*`、`169.254.*`、IPv6 回环/链路本地/ULA。

> 注:这是基于主机名的基础防护,**不防 DNS rebinding**。若部署在能访问敏感内网的环境,建议在网络层再加出站白名单。

## 用法示例

```text
> 读一下 https://github.com/earendil-works/pi 的 README,总结 Pi 的扩展机制
  (agent 调 fetch_url 抓取并阅读后回答)
```

## 文件结构

```text
web-fetch/
├── index.ts       # fetch_url 工具(SSRF 检查 + 超时 + 截断)
├── html.ts        # HTML → markdown / text 转换 + isSafeUrl
├── package.json
└── README.md
```

## 进阶扩展点

1. **更好的正文提取**:接 `@mozilla/readability` + `jsdom` 做主内容抽取(需加依赖),去掉导航/页脚噪音。
2. **缓存**:对同一 URL 加本地缓存(配合 knowledge-rag 直接入库)。
3. **截图/PDF**:接 headless 浏览器抓动态页面。

## 注意

- 包名按官方新名 `@earendil-works/*` + `typebox` 写;旧包改 `index.ts` 顶部 import。
- 纯正则解析对结构怪异的页面可能不完美,够喂给 LLM 阅读即可。

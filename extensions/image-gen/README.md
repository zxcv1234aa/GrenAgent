# pi-image-gen

为 [Pi coding agent](https://github.com/earendil-works/pi) 写的**文生图扩展**。

给 agent 加上 `generate_image` 工具,用任意 OpenAI 兼容的 `/images/generations` 端点生成图片,保存到 `.pi/images/` 并返回路径。和 embedding 一样直接 `fetch`,**零额外依赖**。

## 能力

| 类型 | 名称 | 说明 |
|---|---|---|
| 工具(LLM 可调) | `generate_image` | 按 `prompt` 生成 PNG,存到 `<cwd>/.pi/images/img_<ts>.png` |

## 配置(必需 key)

| 变量 | 默认值 | 说明 |
|---|---|---|
| `IMAGE_API_KEY` | (回退 `OPENAI_API_KEY`) | **必需**,没有则工具报错 |
| `IMAGE_BASE_URL` | `https://api.openai.com/v1` | OpenAI 兼容端点 |
| `IMAGE_MODEL` | `gpt-image-1` | 也可 `dall-e-3` 等 |
| `IMAGE_SIZE` | `1024x1024` | 默认尺寸,可被工具参数覆盖 |

## 安装 / 用法

```bash
pi -e ./extensions/image-gen/index.ts
# 会话里:
> 生成一张"赛博朋克风格的猫,霓虹灯背景"的图
  (agent 调 generate_image,返回保存路径)
```

## 文件结构

```text
image-gen/
├── index.ts       # generate_image 工具(保存 PNG + 返回路径)
├── image.ts       # OpenAI 兼容 images API 调用(b64_json / url 两种返回)
├── package.json
└── README.md
```

## 进阶扩展点

1. **直接在 TUI 显示**:返回 `content` 里追加 `{ type: "image", source: { type: "base64", mediaType: "image/png", data } }`,配合 `@earendil-works/pi-tui` 的 Image 组件即可在终端预览(需确认你所用 Pi 版本对 tool image part 的支持)。
2. **图生图 / 编辑**:接 `/images/edits` 端点,加 `image` + `mask` 参数。
3. **多张 / 批量**:加 `n` 参数,循环保存。

## 注意

- 包名按官方新名 `@earendil-works/*` + `typebox`;旧包改 `index.ts` 顶部 import。
- 默认请求 `response_format: "b64_json"` 一次拿到图片字节;若端点只回 `url` 也会自动下载。

# pi-tts

为 [Pi coding agent](https://github.com/earendil-works/pi) 写的**文字转语音扩展**。

给 agent 加上 `speak` 工具,用任意 OpenAI 兼容的 `/audio/speech` 端点合成语音,保存到 `.pi/audio/` 并返回路径(用系统播放器播放)。和 image-gen 同模式,**零额外依赖**。

## 能力

| 类型 | 名称 | 说明 |
|---|---|---|
| 工具(LLM 可调) | `speak` | 把 `text` 合成音频,存到 `<cwd>/.pi/audio/speech_<ts>.<format>` |

## 配置(必需 key)

| 变量 | 默认值 | 说明 |
|---|---|---|
| `TTS_API_KEY` | (回退 `OPENAI_API_KEY`) | **必需**,没有则报错 |
| `TTS_BASE_URL` | `https://api.openai.com/v1` | OpenAI 兼容端点 |
| `TTS_MODEL` | `gpt-4o-mini-tts` | 也可 `tts-1` / `tts-1-hd` |
| `TTS_VOICE` | `alloy` | 可被工具参数覆盖(alloy/echo/fable/onyx/nova/shimmer) |
| `TTS_FORMAT` | `mp3` | mp3/opus/aac/flac/wav |

## 安装 / 用法

```bash
pi -e ./extensions/tts/index.ts
# 会话里:
> 把这段说明读出来
  (agent 调 speak,返回保存的音频路径)
```

## 文件结构

```text
tts/
├── index.ts       # speak 工具(保存音频 + 返回路径)
├── tts.ts         # OpenAI 兼容 /audio/speech 调用
├── package.json
└── README.md
```

## 进阶扩展点

1. **自动朗读**:用 `message_end` 钩子检测 assistant 消息,自动 `speak` 并(在桌面端)播放。
2. **自动播放**:`speak` 后用 `pi.exec` 调系统播放器(macOS `afplay` / Windows `start` / Linux `aplay`)。
3. **STT 配套**:加 `transcribe` 工具走 `/audio/transcriptions` 形成语音双向。

## 注意

- 包名按官方新名 `@earendil-works/*` + `typebox`;旧包改 `index.ts` 顶部 import。
- 返回二进制音频(`arrayBuffer`),不走 json;不同端点的 voice/format 取值可能不同。

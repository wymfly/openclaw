---
name: wecom-send-media
description: 通过当前 wecom 会话发送本地文件。当用户要求交付 csv、pdf、docx、txt、图片或其它文件时使用。
metadata: { "openclaw": { "requires": { "config": ["channels.wecom"] } } }
---

# 发送本地文件

当前 WeCom 渠道支持通过 `MEDIA:` 指令把本地文件交付给用户。

## 指令

```text
MEDIA: /absolute/path/to/file.csv
```

规则：

- 每个文件单独一行。
- 路径使用绝对路径。
- 路径包含空格时用反引号包裹。
- 生成的文件优先放在 OpenClaw workspace 目录内。

## 支持度

- 图片：超过 10 MB 会按文件发送。
- 视频：超过 10 MB 会按文件发送。
- 语音：仅 AMR 适合作为语音消息；其它音频按文件发送。
- 普通文件：PDF、CSV、DOCX、TXT 等按文件发送，单文件最大 20 MB。

## 示例

```text
报告已生成：
MEDIA: /home/openclaw/data.openclaw/workspace/report.pdf
```

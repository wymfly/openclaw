---
title: OC-21 Extension 插件总览
date: 2026-04-07
tags:
  - openclaw
  - extensions
  - plugins
  - providers
  - channels
type: module-doc
---

# OC-21 Extension 插件总览

## 1. 概述

OpenClaw 采用**插件架构**将核心 Gateway 与外部集成解耦。所有扩展统一存放在 `extensions/` 目录下，每个扩展是一个独立的 workspace 包（`@openclaw/<id>` 命名空间），通过 `openclaw.plugin.json` 清单文件声明自身能力。

### Bundled vs External

| 类型              | 说明                                                            |
| ----------------- | --------------------------------------------------------------- |
| **Bundled 插件**  | 随仓库一起发布，位于 `extensions/` 目录，由核心团队维护         |
| **External 插件** | 通过 `npm install` 安装的第三方插件，遵循相同的 Plugin SDK 接口 |

> [!info] 插件清单结构
> 每个插件的 `openclaw.plugin.json` 可包含以下关键字段：
>
> - `id` — 插件唯一标识
> - `providers` — 注册的 LLM Provider ID 列表
> - `channels` — 注册的消息渠道 ID 列表
> - `kind` — 特殊类型标记（如 `"memory"`）
> - `skills` — 提供的 skill 路径
> - `configSchema` — JSON Schema 配置模式
> - `providerAuthEnvVars` — 各 provider 的环境变量
> - `providerAuthChoices` — 认证方式选项（API key / OAuth / Device login 等）
> - `uiHints` — Dashboard UI 展示提示
> - `enabledByDefault` — 是否默认启用

当前仓库共包含 **84 个扩展目录**（含 1 个共享工具库 `shared/`），其中 82 个有 `openclaw.plugin.json` 清单。

---

## 2. 分类总表

### 2.1 LLM Providers（语言模型提供商）

OpenClaw 支持 35 个 LLM provider 扩展，涵盖商业 API、开源推理引擎、聚合路由等多种接入方式。

#### 一线商业 API

| 扩展               | Provider ID                   | 认证方式                | 说明                                                                |
| ------------------ | ----------------------------- | ----------------------- | ------------------------------------------------------------------- |
| `anthropic`        | `anthropic`                   | setup-token / API key   | Claude 系列模型，支持 `ANTHROPIC_API_KEY`                           |
| `anthropic-vertex` | _(内置 catalog)_              | GCP Vertex 凭证         | 通过 Google Cloud Vertex AI 访问 Claude 模型                        |
| `openai`           | `openai`, `openai-codex`      | OAuth (Codex) / API key | GPT / o-系列模型，支持 `OPENAI_API_KEY`                             |
| `google`           | `google`, `google-gemini-cli` | API key / OAuth         | Gemini 系列模型，支持 `GEMINI_API_KEY`，另提供 web search grounding |
| `mistral`          | `mistral`                     | API key                 | Mistral AI 模型，支持 `MISTRAL_API_KEY`                             |
| `xai`              | `xai`                         | API key                 | Grok 系列模型，另提供 web search 能力                               |

#### 中国厂商 API

| 扩展               | Provider ID                     | 认证方式                                   | 说明                                  |
| ------------------ | ------------------------------- | ------------------------------------------ | ------------------------------------- |
| `deepseek`         | `deepseek`                      | API key                                    | DeepSeek 系列模型                     |
| `modelstudio`      | `modelstudio`                   | Standard / Coding Plan API key (CN/Global) | 阿里云百炼（Qwen 模型），4 种端点     |
| `qwen-portal-auth` | `qwen-portal`                   | OAuth (Device code)                        | 通义千问 OAuth 登录                   |
| `qianfan`          | `qianfan`                       | API key                                    | 百度千帆平台（文心大模型）            |
| `moonshot`         | `moonshot`                      | API key (.ai/.cn)                          | 月之暗面 Kimi K2.5，另提供 web search |
| `kimi-coding`      | `kimi`, `kimi-coding`           | API key                                    | Kimi 编码专用端点                     |
| `minimax`          | `minimax`, `minimax-portal`     | OAuth (Global/CN) / API key                | MiniMax M2.7 模型                     |
| `volcengine`       | `volcengine`, `volcengine-plan` | API key                                    | 火山引擎（字节跳动）                  |
| `byteplus`         | `byteplus`, `byteplus-plan`     | API key                                    | BytePlus（字节跳动国际版）            |
| `xiaomi`           | `xiaomi`                        | API key                                    | 小米大模型                            |
| `zai`              | `zai`                           | API key (Coding Plan / Global / CN)        | Z.AI / 智谱 GLM 系列，5 种端点        |

#### 推理引擎 & 自托管

| 扩展     | Provider ID | 认证方式             | 说明                           |
| -------- | ----------- | -------------------- | ------------------------------ |
| `ollama` | `ollama`    | Local (可选 API key) | 本地 / 云端开源模型推理        |
| `vllm`   | `vllm`      | Custom               | 自托管 OpenAI 兼容服务器       |
| `sglang` | `sglang`    | Custom               | 高性能自托管 OpenAI 兼容服务器 |

#### 聚合路由 & 网关

| 扩展                    | Provider ID             | 认证方式                | 说明                               |
| ----------------------- | ----------------------- | ----------------------- | ---------------------------------- |
| `openrouter`            | `openrouter`            | API key                 | OpenRouter 多模型聚合路由          |
| `together`              | `together`              | API key                 | Together AI 开源模型平台           |
| `huggingface`           | `huggingface`           | HF token                | Hugging Face Inference API         |
| `nvidia`                | `nvidia`                | API key                 | NVIDIA NIM 推理服务                |
| `chutes`                | `chutes`                | OAuth / API key         | Chutes.ai 开源模型（**默认启用**） |
| `venice`                | `venice`                | API key                 | Venice AI 隐私优先/无审查模型      |
| `amazon-bedrock`        | `amazon-bedrock`        | AWS 凭证                | Amazon Bedrock 多模型服务          |
| `github-copilot`        | `github-copilot`        | Device login / GH token | GitHub Copilot 模型访问            |
| `copilot-proxy`         | `copilot-proxy`         | Local config            | 本地 Copilot 代理，自定义 base URL |
| `cloudflare-ai-gateway` | `cloudflare-ai-gateway` | API key                 | Cloudflare AI Gateway 代理层       |
| `vercel-ai-gateway`     | `vercel-ai-gateway`     | API key                 | Vercel AI Gateway 代理层           |
| `kilocode`              | `kilocode`              | API key                 | Kilo Gateway（OpenRouter 兼容）    |
| `synthetic`             | `synthetic`             | API key                 | Synthetic 多模型兼容平台           |
| `opencode`              | `opencode`              | API key                 | OpenCode Zen catalog               |
| `opencode-go`           | `opencode-go`           | API key                 | OpenCode Go catalog                |
| `fal`                   | `fal`                   | API key                 | fal 平台（主要用于图像生成）       |

---

### 2.2 Messaging Channels（消息渠道）

22 个消息渠道插件，覆盖主流即时通讯、企业协作、社交媒体平台。

#### 主流即时通讯

| 扩展          | Channel ID    | 传输模式                             | 关键特性                                    |
| ------------- | ------------- | ------------------------------------ | ------------------------------------------- |
| `telegram`    | `telegram`    | Webhook / Long polling               | DM/群组、allowlist、pairing、IPv4-first DNS |
| `discord`     | `discord`     | WebSocket (Gateway)                  | DM/Server、Carbon UI 组件、slash command    |
| `slack`       | `slack`       | WebSocket (Socket Mode) / Events API | Thread 消息、allowlist、workspace 集成      |
| `whatsapp`    | `whatsapp`    | Web.js bridge                        | WhatsApp Web 协议，Web UI 即核心 `src/web`  |
| `signal`      | `signal`      | signal-cli bridge                    | 端到端加密 DM/群组、pairing                 |
| `imessage`    | `imessage`    | macOS AppleScript bridge             | 仅限 macOS，通过 Messages.app               |
| `bluebubbles` | `bluebubbles` | BlueBubbles API                      | iMessage 替代方案，跨平台                   |
| `line`        | `line`        | Webhook                              | LINE Messaging API                          |

#### 企业协作

| 扩展             | Channel ID       | 传输模式        | 关键特性                                        |
| ---------------- | ---------------- | --------------- | ----------------------------------------------- |
| `msteams`        | `msteams`        | Bot Framework   | Microsoft Teams 集成                            |
| `googlechat`     | `googlechat`     | Google Chat API | Google Workspace 集成                           |
| `feishu`         | `feishu`         | Webhook         | 飞书/Lark，社区维护 (@m1heng)，含 skills        |
| `wecom`          | `wecom`          | Webhook         | 企业微信，增强 fork 版，配额追踪/去重/MCP Skill |
| `mattermost`     | `mattermost`     | WebSocket       | 开源 Slack 替代                                 |
| `nextcloud-talk` | `nextcloud-talk` | Polling         | Nextcloud Talk 集成                             |
| `synology-chat`  | `synology-chat`  | Webhook         | Synology Chat NAS 内置聊天                      |

#### 社交媒体 & 特殊平台

| 扩展       | Channel ID | 传输模式          | 关键特性                              |
| ---------- | ---------- | ----------------- | ------------------------------------- |
| `matrix`   | `matrix`   | Client-Server API | 去中心化协议，E2E 加密                |
| `irc`      | `irc`      | IRC 协议          | 经典 IRC 频道/DM                      |
| `nostr`    | `nostr`    | Relay WebSocket   | NIP-04 加密 DM                        |
| `twitch`   | `twitch`   | IRC/WebSocket     | Twitch 直播聊天                       |
| `tlon`     | `tlon`     | Tlon SDK          | Tlon/Urbit 去中心化网络，含外部 skill |
| `zalo`     | `zalo`     | Webhook           | Zalo Official Account（越南）         |
| `zalouser` | `zalouser` | Native zca-js     | Zalo 个人账号直连                     |

---

### 2.3 Search & Web Tools（搜索与网页工具）

9 个搜索/网页扩展，通过 `configSchema.webSearch` 统一配置模式。

| 扩展         | 认证方式                                    | 特性                                          |
| ------------ | ------------------------------------------- | --------------------------------------------- |
| `brave`      | `BRAVE_API_KEY`                             | Brave Search，支持 web / llm-context 两种模式 |
| `duckduckgo` | 无需 key                                    | DuckDuckGo 搜索，可配区域和 SafeSearch 级别   |
| `exa`        | `EXA_API_KEY`                               | Exa 语义搜索                                  |
| `firecrawl`  | `FIRECRAWL_API_KEY`                         | Firecrawl 网页爬取 + 搜索，可自定义 base URL  |
| `google`     | `GEMINI_API_KEY`                            | Gemini Search Grounding（复用 google 扩展）   |
| `moonshot`   | `MOONSHOT_API_KEY`                          | Kimi 搜索（复用 moonshot 扩展）               |
| `perplexity` | `PERPLEXITY_API_KEY` / `OPENROUTER_API_KEY` | Sonar 模型搜索增强                            |
| `tavily`     | `TAVILY_API_KEY`                            | Tavily 搜索 + 网页提取，含 skills             |
| `xai`        | _(复用 xai 扩展)_                           | Grok web search                               |

> [!tip] 搜索插件的配置统一性
> 大部分搜索插件都通过 `configSchema.webSearch.apiKey` 配置 API 密钥，支持 `uiHints.sensitive: true` 安全输入，并可通过环境变量回退。

---

### 2.4 Media & Generation（媒体与生成）

| 扩展         | 类型     | 说明                                               |
| ------------ | -------- | -------------------------------------------------- |
| `fal`        | 图像生成 | fal 平台，`onboardingScopes: ["image-generation"]` |
| `deepgram`   | 媒体理解 | Deepgram 语音转文字 (media-understanding provider) |
| `groq`       | 媒体理解 | Groq 快速推理 + 媒体理解能力                       |
| `elevenlabs` | 语音合成 | ElevenLabs TTS（文字转语音）                       |
| `microsoft`  | 语音合成 | Microsoft Azure Speech TTS                         |
| `talk-voice` | 语音管理 | Talk 语音选择管理（list/set）                      |

---

### 2.5 Development & Infrastructure Tools（开发与基础设施工具）

| 扩展               | 说明                                                           |
| ------------------ | -------------------------------------------------------------- |
| `openshell`        | OpenShell 沙箱后端，SSH 命令执行 + 本地工作区镜像              |
| `acpx`             | ACP Runtime 后端（acpx），支持 MCP servers、权限控制、队列管理 |
| `diffs`            | 只读 diff 查看器 + 文件渲染器，支持 PNG/PDF 输出，含 skills    |
| `lobster`          | Lobster 工作流工具，typed pipelines + 可恢复审批               |
| `llm-task`         | 通用 JSON-only LLM 工具，供工作流调用的结构化任务              |
| `diagnostics-otel` | OpenTelemetry 诊断导出器                                       |
| `open-prose`       | OpenProse VM skill pack，提供 `/prose` slash 命令              |

---

### 2.6 Memory（记忆系统）

| 扩展             | Kind     | 说明                                                                               |
| ---------------- | -------- | ---------------------------------------------------------------------------------- |
| `memory-core`    | `memory` | 核心记忆搜索插件                                                                   |
| `memory-lancedb` | `memory` | LanceDB 向量数据库长期记忆，支持 auto-capture/auto-recall，需 OpenAI embedding API |

---

### 2.7 Specialized（专用工具）

| 扩展               | 说明                                                       |
| ------------------ | ---------------------------------------------------------- |
| `voice-call`       | 电话语音呼叫，支持 Twilio/Telnyx/Plivo，入站/出站/流式 STT |
| `phone-control`    | 手机节点高风险命令的 arm/disarm 控制（摄像头/屏幕/写入）   |
| `device-pair`      | 设备配对，生成 setup code + 审批配对请求                   |
| `thread-ownership` | Slack thread 所有权控制，防止多 agent 同时回复             |

---

## 3. 完整扩展一行摘要表

| #   | 扩展名                  | 类型                  | 描述                              | 关键配置                                  |
| --- | ----------------------- | --------------------- | --------------------------------- | ----------------------------------------- |
| 1   | `acpx`                  | 工具                  | ACP Runtime 后端 (acpx)           | `command`, `permissionMode`, `mcpServers` |
| 2   | `amazon-bedrock`        | LLM Provider          | Amazon Bedrock 多模型             | AWS 凭证                                  |
| 3   | `anthropic`             | LLM Provider          | Anthropic Claude 系列             | `ANTHROPIC_API_KEY`                       |
| 4   | `anthropic-vertex`      | LLM Provider (内置)   | GCP Vertex AI Claude              | GCP 凭证                                  |
| 5   | `bluebubbles`           | Channel               | BlueBubbles iMessage 桥接         | -                                         |
| 6   | `brave`                 | Web Search            | Brave Search API                  | `BRAVE_API_KEY`, `mode`                   |
| 7   | `byteplus`              | LLM Provider          | BytePlus (字节国际)               | `BYTEPLUS_API_KEY`                        |
| 8   | `chutes`                | LLM Provider          | Chutes.ai 开源模型 (**默认启用**) | `CHUTES_API_KEY` / OAuth                  |
| 9   | `cloudflare-ai-gateway` | LLM Gateway           | Cloudflare AI Gateway             | Account ID + Gateway ID + API key         |
| 10  | `copilot-proxy`         | LLM Provider          | 本地 Copilot 代理                 | base URL + model ids                      |
| 11  | `deepgram`              | 媒体理解              | Deepgram 语音转文字               | -                                         |
| 12  | `deepseek`              | LLM Provider          | DeepSeek 模型                     | `DEEPSEEK_API_KEY`                        |
| 13  | `device-pair`           | 工具                  | 设备配对管理                      | `publicUrl`                               |
| 14  | `diagnostics-otel`      | 基础设施              | OpenTelemetry 导出                | -                                         |
| 15  | `diffs`                 | 工具                  | Diff 查看器/文件渲染              | `defaults.*`, `security.*`                |
| 16  | `discord`               | Channel               | Discord Bot                       | Discord Bot Token                         |
| 17  | `duckduckgo`            | Web Search            | DuckDuckGo 搜索                   | `region`, `safeSearch`                    |
| 18  | `elevenlabs`            | TTS                   | ElevenLabs 语音合成               | -                                         |
| 19  | `exa`                   | Web Search            | Exa 语义搜索                      | `EXA_API_KEY`                             |
| 20  | `fal`                   | 图像生成              | fal 图像生成平台                  | `FAL_KEY`                                 |
| 21  | `feishu`                | Channel               | 飞书/Lark (社区)                  | App ID + Secret                           |
| 22  | `firecrawl`             | Web Search            | Firecrawl 爬取+搜索               | `FIRECRAWL_API_KEY`, `baseUrl`            |
| 23  | `github-copilot`        | LLM Provider          | GitHub Copilot                    | GH Token / Device login                   |
| 24  | `google`                | LLM Provider + Search | Gemini 模型 + Search Grounding    | `GEMINI_API_KEY` / OAuth                  |
| 25  | `googlechat`            | Channel               | Google Chat                       | Google Workspace 凭证                     |
| 26  | `groq`                  | 媒体理解              | Groq 快速推理                     | -                                         |
| 27  | `huggingface`           | LLM Provider          | HF Inference API                  | `HF_TOKEN`                                |
| 28  | `imessage`              | Channel               | iMessage (macOS)                  | -                                         |
| 29  | `irc`                   | Channel               | IRC 协议                          | Server / Channel                          |
| 30  | `kilocode`              | LLM Provider          | Kilo Gateway                      | `KILOCODE_API_KEY`                        |
| 31  | `kimi-coding`           | LLM Provider          | Kimi 编码端点                     | `KIMI_API_KEY`                            |
| 32  | `line`                  | Channel               | LINE Messaging                    | LINE Channel Token                        |
| 33  | `llm-task`              | 工具                  | JSON-only LLM 结构化任务          | `defaultProvider`, `defaultModel`         |
| 34  | `lobster`               | 工具                  | Typed 工作流 + 审批               | -                                         |
| 35  | `matrix`                | Channel               | Matrix 去中心化                   | Homeserver + Token                        |
| 36  | `mattermost`            | Channel               | Mattermost 开源协作               | Server URL + Token                        |
| 37  | `memory-core`           | Memory                | 核心记忆搜索                      | -                                         |
| 38  | `memory-lancedb`        | Memory                | LanceDB 向量长期记忆              | `embedding.apiKey`, `dbPath`              |
| 39  | `microsoft`             | TTS                   | Microsoft Azure Speech            | -                                         |
| 40  | `minimax`               | LLM Provider          | MiniMax M2.7                      | OAuth / API key (Global/CN)               |
| 41  | `mistral`               | LLM Provider          | Mistral AI                        | `MISTRAL_API_KEY`                         |
| 42  | `modelstudio`           | LLM Provider          | 阿里云百炼 Qwen                   | Standard / Coding Plan (CN/Global)        |
| 43  | `moonshot`              | LLM Provider + Search | Kimi K2.5 + 搜索                  | `MOONSHOT_API_KEY` (.ai/.cn)              |
| 44  | `msteams`               | Channel               | Microsoft Teams                   | Bot Framework 凭证                        |
| 45  | `nextcloud-talk`        | Channel               | Nextcloud Talk                    | Server URL + Token                        |
| 46  | `nostr`                 | Channel               | Nostr NIP-04 加密 DM              | Relay URL + Key                           |
| 47  | `nvidia`                | LLM Provider          | NVIDIA NIM                        | `NVIDIA_API_KEY`                          |
| 48  | `ollama`                | LLM Provider          | Ollama 本地/云端                  | Local / API key                           |
| 49  | `open-prose`            | 工具                  | OpenProse VM skill pack           | -                                         |
| 50  | `openai`                | LLM Provider          | OpenAI GPT + Codex                | OAuth / `OPENAI_API_KEY`                  |
| 51  | `opencode`              | LLM Provider          | OpenCode Zen                      | `OPENCODE_API_KEY`                        |
| 52  | `opencode-go`           | LLM Provider          | OpenCode Go                       | `OPENCODE_API_KEY`                        |
| 53  | `openrouter`            | LLM Provider          | OpenRouter 聚合                   | `OPENROUTER_API_KEY`                      |
| 54  | `openshell`             | 沙箱                  | OpenShell SSH 沙箱                | `command`, `gateway`, `from`              |
| 55  | `perplexity`            | Web Search            | Perplexity Sonar 搜索             | `PERPLEXITY_API_KEY`                      |
| 56  | `phone-control`         | 工具                  | 手机高风险命令控制                | -                                         |
| 57  | `qianfan`               | LLM Provider          | 百度千帆                          | `QIANFAN_API_KEY`                         |
| 58  | `qqbot`                 | _(仅 node_modules)_   | QQ Bot (待完善)                   | -                                         |
| 59  | `qwen-portal-auth`      | LLM Provider          | 通义千问 OAuth                    | Device code                               |
| 60  | `sglang`                | LLM Provider          | SGLang 自托管                     | Custom config                             |
| 61  | `signal`                | Channel               | Signal 加密通讯                   | signal-cli bridge                         |
| 62  | `slack`                 | Channel               | Slack Workspace                   | Socket Mode / Events API                  |
| 63  | `synology-chat`         | Channel               | Synology Chat                     | Webhook URL                               |
| 64  | `synthetic`             | LLM Provider          | Synthetic 多模型                  | `SYNTHETIC_API_KEY`                       |
| 65  | `talk-voice`            | 工具                  | Talk 语音选择                     | -                                         |
| 66  | `tavily`                | Web Search            | Tavily 搜索+提取                  | `TAVILY_API_KEY`                          |
| 67  | `telegram`              | Channel               | Telegram Bot                      | Bot Token                                 |
| 68  | `thread-ownership`      | 工具                  | Slack Thread 所有权               | `forwarderUrl`, `abTestChannels`          |
| 69  | `tlon`                  | Channel               | Tlon/Urbit                        | Tlon SDK                                  |
| 70  | `together`              | LLM Provider          | Together AI                       | `TOGETHER_API_KEY`                        |
| 71  | `twitch`                | Channel               | Twitch 直播聊天                   | OAuth Token                               |
| 72  | `venice`                | LLM Provider          | Venice AI (隐私优先)              | `VENICE_API_KEY`                          |
| 73  | `vercel-ai-gateway`     | LLM Gateway           | Vercel AI Gateway                 | `AI_GATEWAY_API_KEY`                      |
| 74  | `vllm`                  | LLM Provider          | vLLM 自托管                       | Custom config                             |
| 75  | `voice-call`            | 专用                  | 电话语音呼叫                      | Twilio/Telnyx/Plivo 凭证                  |
| 76  | `volcengine`            | LLM Provider          | 火山引擎 (字节)                   | `VOLCANO_ENGINE_API_KEY`                  |
| 77  | `wecom`                 | Channel               | 企业微信 (增强版)                 | App ID + Secret + Token                   |
| 78  | `whatsapp`              | Channel               | WhatsApp Web                      | Web.js session                            |
| 79  | `xai`                   | LLM Provider + Search | xAI Grok + Web Search             | API key                                   |
| 80  | `xiaomi`                | LLM Provider          | 小米大模型                        | `XIAOMI_API_KEY`                          |
| 81  | `zai`                   | LLM Provider          | Z.AI / 智谱 GLM                   | API key (5 种端点)                        |
| 82  | `zalo`                  | Channel               | Zalo Official Account             | OA 凭证                                   |
| 83  | `zalouser`              | Channel               | Zalo 个人账号 (zca-js)            | 个人凭证                                  |

---

## 4. 共享工具库 (`extensions/shared/`)

`extensions/shared/` 不是一个独立插件，而是为各扩展提供公共工具函数的共享模块。

| 文件                                | 用途                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| `runtime.ts`                        | `resolveLoggerBackedRuntime()` — 当插件未注入 runtime 时提供基于 logger 的回退 runtime        |
| `config-schema-helpers.ts`          | `requireChannelOpenAllowFrom()` — 校验 `dmPolicy="open"` 时必须配置 `allowFrom` 通配符        |
| `channel-status-summary.ts`         | `buildPassiveChannelStatusSummary()` — 构建渠道状态快照（configured/running/lastError/probe） |
| `passive-monitor.ts`                | 被动渠道监控基础设施                                                                          |
| `status-issues.ts`                  | 渠道状态问题枚举与诊断                                                                        |
| `deferred.ts`                       | 延迟加载辅助工具                                                                              |
| `resolve-target-test-helpers.ts`    | 测试用目标解析辅助                                                                            |
| `windows-cmd-shim-test-fixtures.ts` | Windows cmd shim 测试 fixture                                                                 |

---

## 5. 统计摘要

| 类别              | 数量                                                                   |
| ----------------- | ---------------------------------------------------------------------- |
| LLM Provider 扩展 | 35                                                                     |
| 消息渠道扩展      | 22                                                                     |
| Web 搜索扩展      | 9                                                                      |
| 媒体/生成扩展     | 6                                                                      |
| 开发/基础设施工具 | 7                                                                      |
| Memory 扩展       | 2                                                                      |
| 专用工具          | 4                                                                      |
| 含 Skills 的扩展  | 7 (`acpx`, `diffs`, `feishu`, `open-prose`, `tavily`, `tlon`, `wecom`) |
| 默认启用的扩展    | 1 (`chutes`)                                                           |

---

## 6. 如何开发新扩展

> [!note] 参考文档
>
> - 插件系统架构 → [[OC-14 Plugin 系统]]
> - Plugin SDK API 与开发指南 → [[OC-15 Plugin SDK]]

### 快速开发流程

1. 在 `extensions/` 下创建目录，添加 `package.json`（`@openclaw/<id>` 命名）
2. 创建 `openclaw.plugin.json` 清单，声明 `id`、`providers`/`channels`/`kind` 等
3. 实现 provider 或 channel 接口，通过 `openclaw/plugin-sdk/*` 导入 SDK
4. 配置 `configSchema` + `uiHints` 使 Dashboard 自动生成配置表单
5. 添加 `providerAuthEnvVars` 和 `providerAuthChoices` 支持 onboarding 认证流程
6. 运行 `pnpm test` 验证并提交

> [!warning] 开发约束
>
> - 扩展内部不可直接 import 核心 `src/**`，必须通过 `openclaw/plugin-sdk/<subpath>` 公共接口
> - 扩展间不可相互 import，共享代码应提取到 Plugin SDK
> - runtime deps 放 `dependencies`，避免 `workspace:*`（npm install 会失败）
> - `openclaw` 放 `devDependencies` 或 `peerDependencies`

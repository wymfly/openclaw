# OpenClaw Enhanced Fork — 架构全景图

> **分支：** enhanced（领先 upstream/main 56 commits）
> **生成时间：** 2026-03-19 | **总代码量：** 1,007,000+ LOC | **6,162 源文件**

---

## 1. 系统全景

```
                              ┌──────────────────────────────┐
                              │        用户触达层             │
                              ├──────┬───────┬───────┬───────┤
                              │ iOS  │Android│ macOS │  Web  │
                              │Swift │Kotlin │Swift  │ Deck  │
                              │  UI  │Compose│Menubar│ SPA   │
                              └──┬───┴───┬───┴───┬───┴───┬───┘
                                 │       │       │       │
                                 └───────┴───┬───┴───────┘
                                             │ HTTP / WS / SSE
                    ┌────────────────────────▼─────────────────────────┐
                    │              OpenClaw Gateway                     │
                    │  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌───────┐ │
                    │  │ RPC v3  │ │ AI Agent │ │ Session │ │ Cron  │ │
                    │  │ Server  │ │ Runtime  │ │ Manager │ │ Heart │ │
                    │  └────┬────┘ └────┬─────┘ └────┬────┘ └───┬───┘ │
                    │       └───────────┴────────────┴──────────┘     │
                    │  ┌──────────┐ ┌──────────┐ ┌─────────────────┐  │
                    │  │ Security │ │ Config   │ │ Plugin Loader   │  │
                    │  │ SSRF/ACL │ │ YAML/JSON│ │ 37 Extensions   │  │
                    │  └──────────┘ └──────────┘ └────────┬────────┘  │
                    └─────────────────────────────────────┼───────────┘
                                                          │
                    ┌─────────────────────────────────────▼───────────┐
                    │               渠道 & 集成层                      │
                    ├─────┬─────┬──────┬──────┬──────┬───────┬───────┤
                    │Tele │Disc │Slack │Sig-  │iMsg  │WeCom  │ 30+  │
                    │gram │ord  │      │nal   │      │[EN]   │others│
                    └─────┴─────┴──────┴──────┴──────┴───────┴───────┘
                                                          │
                    ┌─────────────────────────────────────▼───────────┐
                    │              AI 服务商层                          │
                    ├──────┬──────┬──────┬────────┬────────┬─────────┤
                    │Claude│ GPT  │Gemini│Moonshot│DeepSeek│ Ollama  │
                    │      │      │      │ [EN]   │ [EN]   │(local)  │
                    └──────┴──────┴──────┴────────┴────────┴─────────┘
```

---

## 2. 代码来源总览

| 来源              | 标记    | 代码量    | 说明                                   |
| ----------------- | ------- | --------- | -------------------------------------- |
| OpenClaw 上游     | `[OC]`  | ~950K LOC | 核心引擎、渠道、CLI、Gateway、Apps     |
| Enhanced 二次开发 | `[EN]`  | ~35K LOC  | Dashboard 全量 + WeCom 增强 + 安全加固 |
| 移植第三方项目    | `[TP]`  | ~5K LOC   | 4 个 vendor 项目的核心模块             |
| 第三方库          | `[LIB]` | ~1.2K LOC | shadcn/ui 组件                         |

---

## 3. 核心引擎 (`src/`) — 4,429 files, 822K LOC `[OC]`

```
src/
│
├── 【AI 代理框架】
│   ├── agents/ ·········· 760 files, 153K LOC [OC]
│   │   AI 代理编排：模型路由、prompt 管理、auth profiles、
│   │   工作区管理、SOUL.md 人格系统
│   ├── auto-reply/ ······ 270 files, 60K LOC  [OC]
│   │   自动回复规则引擎：条件评估、消息匹配、回复生成
│   ├── providers/ ······· [OC] AI 服务商适配器（Claude/GPT/Gemini/Ollama/...）
│   └── memory/ ·········· [OC] 基础记忆系统（文件 + embedding）
│
├── 【Gateway 服务】
│   ├── gateway/ ········· 325 files, 74K LOC  [OC]
│   │   RPC v3 服务端、WebSocket 管理、认证、
│   │   事件循环、AI 路由、会话管理
│   ├── sessions/ ········ [OC] 会话持久化 + 历史
│   ├── cron/ ············ [OC] 定时任务 + heartbeat
│   └── hooks/ ··········· [OC] 命令钩子系统
│
├── 【CLI 工具链】
│   ├── cli/ ············· 281 files, 42K LOC  [OC]
│   │   参数解析、启动器、进度条、终端 UI
│   ├── commands/ ········ 332 files, 61K LOC  [OC]
│   │   32+ 子命令：agent、config、gateway、send、doctor...
│   ├── terminal/ ········ [OC] ANSI table、palette、输出格式化
│   └── wizard/ ·········· [OC] 首次配置向导
│
├── 【渠道集成】(内置 7 + 扩展 30)
│   ├── telegram/ ········ 117 files, 32K LOC  [OC]
│   ├── discord/ ········· 150 files, 40K LOC  [OC]
│   ├── slack/ ··········· [OC] Slack Bot
│   ├── signal/ ·········· [OC] Signal (通过 signal-cli)
│   ├── imessage/ ········ [OC] iMessage (macOS)
│   ├── web/ ············· 77 files, 13K LOC   [OC] WhatsApp Web
│   ├── channels/ ········ 160 files, 21K LOC  [OC] 渠道路由 & DM/群组策略
│   └── routing/ ········· [OC] 消息转发 & 负载均衡
│
├── 【安全框架】
│   ├── infra/net/ ······· [OC+EN]
│   │   ├── ssrf.ts ····· [EN] 双阶段 SSRF 防护（DNS 前 + DNS 后检查）
│   │   ├── fetch-guard.ts [EN] 重定向跳转校验 + 敏感 header 剥离
│   │   └── hostname.ts · [OC] 网络工具
│   ├── security/ ········ 44 files [OC+EN]
│   │   ├── external-content.ts  [EN] Unicode 同形字防护 + 随机化边界
│   │   ├── windows-acl.ts       [EN] Windows SID ACL 检测
│   │   ├── host-env-security.ts [EN] 危险环境变量阻止
│   │   ├── audit.ts             [OC] 安全审计
│   │   ├── safe-regex.ts        [OC] 正则安全
│   │   ├── secret-equal.ts      [OC] 恒时比较
│   │   └── skill-scanner.ts     [OC] AST 扫描不安全模式
│   └── daemon/ ·········· [OC+EN]
│       ├── launchd 管理    [OC] macOS 服务
│       ├── systemd 管理    [OC] Linux 服务
│       └── schtasks 解析   [EN] Windows 任务计划检测
│
├── 【基础设施】
│   ├── infra/retry.ts ··· [EN] 通用重试框架（指数退避 + jitter）
│   ├── config/ ·········· 218 files, 40K LOC [OC] YAML/JSON 配置 + schema
│   ├── logging/ ········· [OC] 结构化日志
│   ├── pairing/ ········· [OC] 设备配对
│   ├── secrets/ ········· [OC] 密钥管理
│   └── i18n/ ············ [OC] 国际化（8 种语言）
│
├── 【媒体 & 理解】
│   ├── media/ ··········· [OC] 媒体处理管线
│   ├── media-understanding/ [OC] 图片/视频理解
│   ├── link-understanding/  [OC] URL 预览
│   ├── markdown/ ········ [OC] Markdown 处理
│   └── tts/ ············· [OC] 文本转语音
│
├── 【插件系统】
│   ├── plugin-sdk/ ······ [OC] 插件开发 SDK
│   ├── plugins/ ········· [OC] 插件加载 & 生命周期
│   └── acp/ ············· [OC] Agent Control Protocol
│
└── 【其他】
    ├── browser/ ········· 142 files [OC] Playwright 浏览器自动化
    ├── canvas-host/ ····· [OC] Canvas 渲染
    ├── process/ ·········· [OC] 进程管理
    └── shared/, utils/, types/ [OC] 共享工具
```

---

## 4. 扩展生态 (`extensions/`) — 37 个, 936 files `[OC+EN]`

```
extensions/
│
├── 【渠道扩展】(16 个) ── 全部 [OC]（WeCom 除外）
│   ├── matrix/ ·········· 92 files   Matrix/Element
│   ├── msteams/ ········· 79 files   Microsoft Teams
│   ├── feishu/ ·········· 86 files   飞书
│   ├── voice-call/ ······ 59 files   语音通话
│   ├── bluebubbles/ ····· 43 files   iMessage 接力
│   ├── mattermost/ ······ 41 files   Mattermost
│   ├── tlon/ ············ 35 files   Tlon/Urbit
│   ├── twitch/ ·········· 32 files   Twitch
│   ├── zalouser/ ········ 30 files   Zalo 用户端
│   ├── nextcloud-talk/ ·· 29 files   Nextcloud Talk
│   ├── irc/ ············· 26 files   IRC
│   ├── zalo/ ············ 25 files   Zalo 商务
│   ├── nostr/ ··········· 24 files   Nostr (Web3)
│   ├── googlechat/ ······ 22 files   Google Chat
│   ├── synology-chat/ ··· 15 files   群晖 Chat
│   └── line/ ············  7 files   LINE
│
├── 【企业微信 WeCom】 ──── [EN] 二次开发
│   └── wecom/ ··········· 151 files
│       ├── transport/ ··· WebSocket + HTTP 双通道
│       ├── quota-tracker   配额追踪 + 限流
│       ├── reqid-store ·· 请求 ID 持久化去重
│       ├── reasoning-visibility  推理过程可视化
│       ├── monitor-active  主动消息推送
│       ├── outbound ····· 消息发送（含矩阵多账号）
│       ├── crypto ······· 企业微信加解密
│       └── config-routing  多账号配置路由
│
├── 【记忆增强 Memory-LanceDB】 ── [TP:lancedb] + [EN]
│   └── memory-lancedb/ ·· 36 files, 225 tests
│       ├── embedder.ts ·· 多 key 嵌入器 + LRU 缓存
│       ├── chunker.ts ··· 自动分块
│       ├── retriever.ts · 混合检索（Vector + BM25 + Rerank）
│       ├── adaptive-retrieval.ts  自适应策略
│       ├── noise-filter.ts  噪声过滤
│       ├── smart-extractor.ts  6 类智能提取
│       ├── scopes.ts ···· 5 模式作用域隔离
│       ├── decay-engine.ts  Weibull 3 层衰减
│       ├── llm-client.ts  LLM JSON 提取
│       └── memory-categories.ts  分类系统
│
└── 【其他扩展】 ── [OC]
    ├── acpx/ ············ 19 files  ACP 协议扩展
    ├── diffs/ ··········· 22 files  差异比较
    ├── lobster/ ·········  6 files  UI 主题
    └── diagnostics-otel/   3 files  OpenTelemetry 诊断
```

---

## 5. Web Dashboard (`dashboard/`) — 247 files, 27K LOC `[EN]`

```
dashboard/                          ── 100% [EN] 二次开发（含移植模块）
│
├── server/ ·················· 13 files, 2,041 LOC  服务端基础设施
│   ├── gateway-adapter.ts ·· [TP:studio]  Gateway WS 适配器 (Protocol v3)
│   ├── event-bus.ts ········ [TP:mc]      发布/订阅事件总线
│   ├── projection-store.ts · [TP:studio]  SQLite 事件投影 (SSE replay)
│   ├── access-gate.ts ······ [TP:studio]  请求认证
│   ├── rate-limit.ts ······· [TP:mc]      滑动窗口限流
│   ├── contracts.ts ········ [TP:studio]  协议类型
│   ├── runtime.ts ·········· [EN]         应用启动 + 迁移 + 定时器
│   ├── db.ts ··············· [EN]         SQLite WAL + 迁移系统
│   ├── alert-engine.ts ····· [EN]         告警评估 + 触发路由
│   ├── approval-bridge.ts ·· [EN]         审批策略桥接
│   └── gateway-allowlist.ts  [EN]         RPC 方法白名单
│
├── src/lib/ ················· 11 files, 1,365 LOC  核心库
│   ├── budget-governance.ts  [TP:cc]      预算治理引擎
│   ├── webhooks.ts ········· [TP:mc]      Webhook + HMAC + 重试
│   ├── injection-guard.ts ·· [TP:mc]      SQL/命令注入防护
│   ├── token-pricing.ts ···· [TP:mc]      Token 费用计算
│   ├── commander.ts ········ [TP:cc]      告警动作路由
│   ├── doc-extractor.ts ···· [EN]         对话文档提取
│   ├── message-extract.ts ·· [EN]         消息解析
│   ├── schema-parser.ts ···· [EN]         JSON Schema → 表单
│   └── api-helpers.ts ······ [EN]         RPC 代理
│
├── src/stores/ ·············· 21 stores, 1,496 LOC [EN] Zustand 状态管理
├── src/components/panels/ ··· 19 panels, 71 files, 8,682 LOC [EN]
├── src/components/layout/ ··· 5 files, 605 LOC [EN] NavRail/HeaderBar/Shell
├── src/components/ui/ ······· 15 files, 1,198 LOC [LIB:shadcn/ui]
├── src/components/onboarding/ 4 files, 572 LOC [EN] 3 步引导
├── src/app/api/ ·············· 49 routes, 2,752 LOC [EN] API 网关层
├── src/i18n/ ················· zh.json + en.json, 436 keys [EN]
└── src/hooks/ ················ 2 files [EN] 快捷键 + 响应式
```

---

## 6. 原生应用 (`apps/`) — 550 Swift files `[OC]`

```
apps/
├── ios/ ············· ~175 files [OC]  SwiftUI iOS App
├── macos/ ··········· ~200 files [OC]  SwiftUI macOS Menubar + Gateway
├── android/ ········· [OC]            Kotlin/Compose（规划中）
└── shared/ ·········· ~100 files [OC]  跨平台共享代码
```

---

## 7. 数据流全景

```
┌─────────────────────────────────────────────────────────────────┐
│                        外部消息来源                              │
│  Telegram │ Discord │ Slack │ Signal │ WeCom │ Matrix │ 30+    │
└──────┬────┴────┬────┴───┬───┴────┬───┴───┬───┴────┬───┴────────┘
       │         │        │        │       │        │
       ▼         ▼        ▼        ▼       ▼        ▼
┌──────────────────────────────────────────────────────────────────┐
│  src/channels/ ─── 消息路由 + DM/群组策略 + 速率限制              │
│  src/routing/  ─── 渠道分发 + 负载均衡                           │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  Gateway (src/gateway/)                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ RPC v3   │  │ Session  │  │ Auth     │  │ Config Manager   │ │
│  │ 路由分发  │  │ 管理器   │  │ Profile  │  │ (YAML/JSON)      │ │
│  └────┬─────┘  └────┬─────┘  └──────────┘  └──────────────────┘ │
│       │              │                                           │
│  ┌────▼──────────────▼─────────────────────┐                     │
│  │  Agent Runtime (src/agents/)             │                     │
│  │  ├── Model Router → AI Provider         │                     │
│  │  ├── SOUL.md Personality                │                     │
│  │  ├── Tool Executor                      │                     │
│  │  ├── Memory Read/Write                  │                     │
│  │  └── Auto-Reply Engine                  │                     │
│  └────┬────────────────────────────────────┘                     │
│       │                                                          │
│  ┌────▼────────────┐  ┌───────────────┐  ┌────────────────────┐ │
│  │ AI Providers    │  │ Memory System │  │ Plugin System      │ │
│  │ Claude/GPT/     │  │ Files + Vector│  │ 37 Extensions      │ │
│  │ Gemini/Moonshot │  │ + LanceDB     │  │ + Skills           │ │
│  └─────────────────┘  └───────────────┘  └────────────────────┘ │
└──────────────────────────────┬───────────────────────────────────┘
                               │ WebSocket (Protocol v3)
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  Deck Server (dashboard/server/)                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ WS       │  │ EventBus │  │ Alert    │  │ Approval         │ │
│  │ Adapter  │  │          │  │ Engine   │  │ Bridge           │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────────────┘ │
│       │              │              │              │              │
│  ┌────▼──────────────▼──────────────▼──────────────▼────────────┐ │
│  │  49 API Routes + SSE Stream + SQLite deck.db                 │ │
│  └──────────────────────────┬───────────────────────────────────┘ │
└─────────────────────────────┼────────────────────────────────────┘
                              │ HTTP + SSE
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Browser SPA (dashboard/src/)                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ 19 Panel │  │ 21 Zustand│  │ SSE      │  │ shadcn/ui       │ │
│  │ 组件      │  │ Stores   │  │ Hooks    │  │ + Tailwind      │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
│  NavRail(折叠分组) │ HeaderBar(状态+主题+i18n) │ Mission Control  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Enhanced Fork 增量清单

### 全新模块 (100% `[EN]`)

| 模块                | LOC    | 功能                                             |
| ------------------- | ------ | ------------------------------------------------ |
| `dashboard/` 全量   | 27,000 | Web Dashboard（19 面板 + 49 routes + 21 stores） |
| `extensions/wecom/` | ~8,000 | 企业微信完整插件（150 文件）                     |

### 安全加固 (插入 `[OC]` 模块)

| 文件                                | LOC | 功能                               |
| ----------------------------------- | --- | ---------------------------------- |
| `src/infra/net/ssrf.ts`             | 300 | 双阶段 SSRF 防护（DNS 前 + 后）    |
| `src/infra/net/ssrf.test.ts`        | 134 | 57 测试（私有 IP、公网、编码攻击） |
| `src/infra/net/fetch-guard.ts`      | 250 | 重定向跳转 + 敏感 header 剥离      |
| `src/infra/retry.ts` + test         | 180 | 指数退避 + jitter 重试框架         |
| `src/security/external-content.ts`  | 200 | Unicode 同形字 + 随机化边界        |
| `src/security/windows-acl.ts`       | 150 | Windows SID ACL 检测               |
| `src/security/host-env-security.ts` | 100 | LD_PRELOAD 等危险变量阻止          |

### 渠道稳定性 (插入 `[OC]` 模块)

| 改动                | 位置                        | 功能               |
| ------------------- | --------------------------- | ------------------ |
| Discord HELLO 超时  | `src/discord/`              | 防 HELLO 事件阻塞  |
| Telegram IPv4-first | `src/telegram/`             | DNS 优先 IPv4 解析 |
| Signal JSON 防护    | `src/signal/`               | 畸形 JSON 容错     |
| 统一重试策略        | `src/infra/retry-policy.ts` | 渠道统一退避配置   |

### Memory Enhancement (移植 + 增强)

| 模块                  | 来源           | LOC    |
| --------------------- | -------------- | ------ |
| embedder + chunker    | `[TP:lancedb]` | ~970   |
| retriever (hybrid)    | `[TP:lancedb]` | ~1,100 |
| smart-extractor       | `[TP:lancedb]` | ~1,040 |
| scopes + decay-engine | `[TP:lancedb]` | ~570   |
| 其他 7 模块           | `[TP:lancedb]` | ~480   |

---

## 9. 量化统计

```
┌─────────────────────────────────────────────────────────┐
│  代码规模                                                │
│                                                         │
│  核心引擎 [OC]      ████████████████████████████ 822K   │
│  扩展生态 [OC]      █████ 173K                          │
│  Dashboard [EN]     █ 27K                               │
│  安全加固 [EN]      ▎ ~1.5K                             │
│  WeCom [EN]         ▎ ~8K                               │
│  Memory [TP]        ▎ ~4K                               │
│  移植模块 [TP]      ▎ ~2K                               │
│                                                         │
│  总计: 1,007,000+ LOC                                   │
│  Enhanced 净增: ~35K LOC (3.5%)                         │
│  56 enhanced commits                                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  测试覆盖                                                │
│                                                         │
│  Dashboard 单元测试    368 tests                         │
│  Memory-LanceDB       225 tests                         │
│  核心安全模块          497 tests                         │
│  Retry 框架             9 tests                         │
│  E2E 浏览器测试        35 tests                         │
│  核心上游测试        6,615 tests                         │
│                                                         │
│  总计: 7,749 tests                                      │
└─────────────────────────────────────────────────────────┘
```

---

## 10. 技术栈一览

| 层                 | 技术                  | 版本         |
| ------------------ | --------------------- | ------------ |
| **运行时**         | Node.js / Bun         | 22+ / latest |
| **语言**           | TypeScript (strict)   | 5.9+         |
| **核心框架**       | OpenClaw Engine       | 2026.3.3     |
| **Web 框架**       | Next.js               | 16+          |
| **前端**           | React                 | 19           |
| **样式**           | Tailwind CSS          | v4           |
| **组件库**         | shadcn/ui (Base UI)   | latest       |
| **状态管理**       | Zustand               | latest       |
| **数据库**         | SQLite (WAL)          | deck.db      |
| **向量 DB**        | LanceDB               | latest       |
| **i18n**           | next-intl             | latest       |
| **图表**           | Recharts              | latest       |
| **测试**           | Vitest + Playwright   | latest       |
| **Lint**           | Oxlint + Oxfmt        | latest       |
| **原生 iOS/macOS** | SwiftUI (Observation) | latest       |
| **包管理**         | pnpm (workspace)      | latest       |

---

> 本文档反映 enhanced 分支 commit `2f2ddd0d4` 的完整代码状态。

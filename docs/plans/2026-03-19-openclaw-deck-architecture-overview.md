# OpenClaw-Deck 架构全景图

> **生成时间：** 2026-03-19 | **分支：** enhanced | **代码量：** 26,991 LOC | **215 源文件**

---

## 1. 系统架构

```
                        ┌─────────────────────────────────────┐
                        │           Browser (SPA)              │
                        │  React 19 + Tailwind + shadcn/ui     │
                        │  Zustand Stores (21) + SSE Client    │
                        └──────────────┬──────────────────────┘
                                       │ HTTP / SSE
                        ┌──────────────▼──────────────────────┐
                        │        Deck Server (Next.js 16)      │
                        │  ┌─────────┐ ┌──────────┐ ┌───────┐ │
                        │  │ 49 API  │ │ SSE      │ │Access │ │
                        │  │ Routes  │ │ Bridge   │ │ Gate  │ │
                        │  └────┬────┘ └────┬─────┘ └───┬───┘ │
                        │       │           │           │      │
                        │  ┌────▼───────────▼───────────▼───┐  │
                        │  │         EventBus + Runtime      │  │
                        │  │  Alert Engine │ Approval Bridge │  │
                        │  │  Budget Gov.  │ Webhook Delivery│  │
                        │  └────┬──────────────────┬────────┘  │
                        │       │                  │           │
                        │  ┌────▼────┐      ┌──────▼──────┐   │
                        │  │ SQLite  │      │  Gateway WS  │   │
                        │  │ deck.db │      │  Adapter     │   │
                        │  └─────────┘      └──────┬──────┘   │
                        └──────────────────────────┼──────────┘
                                                   │ WebSocket (Protocol v3)
                        ┌──────────────────────────▼──────────┐
                        │       OpenClaw Gateway (Node.js)     │
                        │  Agents │ Channels │ Sessions │ RPC  │
                        └──────────────────────────────────────┘
```

---

## 2. 代码模块来源标注

### 图例

| 标记           | 含义                                   |
| -------------- | -------------------------------------- |
| `[OC]`         | OpenClaw 原生代码（上游 repo）         |
| `[EN]`         | Enhanced fork 二次开发（我们自己写的） |
| `[TP:studio]`  | 移植自 openclaw-studio                 |
| `[TP:mc]`      | 移植自 Mission Control                 |
| `[TP:cc]`      | 移植自 Control Center                  |
| `[TP:lancedb]` | 移植自 memory-lancedb-pro              |
| `[LIB]`        | 第三方库（shadcn/ui, Zustand 等）      |

---

## 3. 服务端模块 (`dashboard/server/`) — 2,041 LOC

```
server/
├── gateway-adapter.ts ···· 547 LOC [TP:studio] Gateway WS 适配器，Protocol v3 RPC 客户端
├── runtime.ts ············ 303 LOC [EN]        应用启动引导，SQLite 迁移，EventBus 初始化，Webhook/Alert 定时器
├── alert-engine.ts ······· 263 LOC [EN]        告警规则评估引擎（条件计算 + 触发路由 + 冷却期）
├── projection-store.ts ··· 188 LOC [TP:studio] SQLite 事件投影存储（SSE replay 用 outbox）
├── db.ts ················· 144 LOC [EN]        SQLite 初始化 + WAL 模式 + 迁移系统
├── approval-bridge.ts ···· 128 LOC [EN]        审批策略桥接（Gateway exec.approvals ↔ Deck 策略）
├── event-bus.ts ·········· 113 LOC [TP:mc]     发布/订阅事件总线（订阅者隔离 + replay）
├── access-gate.ts ········ 121 LOC [TP:studio] 请求认证 & 访问控制
├── rate-limit.ts ·········  78 LOC [TP:mc]     滑动窗口限流
├── gateway-allowlist.ts ··  56 LOC [EN]        Gateway RPC 方法白名单扩展
├── contracts.ts ··········  55 LOC [TP:studio] 协议类型定义 & 接口
├── gateway-errors.ts ·····  15 LOC [EN]        错误码定义
└── index.ts ··············  30 LOC [EN]        模块导出
```

---

## 4. 核心库 (`dashboard/src/lib/`) — 1,365 LOC

```
src/lib/
├── budget-governance.ts ·· 411 LOC [TP:cc]     预算规则评估（多维阈值 + 3 状态）
├── message-extract.ts ···· 406 LOC [EN]        消息内容解析（tool_use blocks, thinking, markdown）
├── webhooks.ts ··········· 389 LOC [TP:mc]     Webhook 投递 + HMAC-SHA256 签名 + 指数退避重试
├── injection-guard.ts ···· 333 LOC [TP:mc]     SQL/命令注入防护
├── doc-extractor.ts ······ 244 LOC [EN]        对话文档提取（分类 + 关键词匹配 + content blocks 处理）
├── schema-parser.ts ······  92 LOC [EN]        JSON Schema → 表单字段解析
├── token-pricing.ts ······  86 LOC [TP:mc]     Token 费用计算模块
├── with-auth.ts ··········  81 LOC [EN]        API 路由认证中间件
├── commander.ts ··········  64 LOC [TP:cc]     告警动作路由（toast / activity / webhook）
├── api-helpers.ts ········  66 LOC [EN]        Gateway RPC 代理 + 错误处理
└── utils.ts ··············   6 LOC [LIB]       cn() 工具函数（tailwind-merge）
```

---

## 5. 状态管理 (`dashboard/src/stores/`) — 21 stores, 1,496 LOC

```
src/stores/
├── memory.ts ············ 241 LOC [EN] 记忆浏览器（文件树 + 向量搜索 + 图谱 + 健康）
├── cron.ts ·············· 191 LOC [EN] 定时任务 CRUD + 运行历史
├── sessions.ts ·········· 185 LOC [EN] 会话列表 + 详情 + 删除
├── webhooks.ts ·········· 175 LOC [EN] Webhook CRUD + 投递记录
├── usage.ts ············· 160 LOC [EN] 用量聚合 + 时序数据 + 上下文压力
├── skills.ts ············ 158 LOC [EN] 技能列表 + 状态过滤 + 配置
├── budget.ts ············ 154 LOC [EN] 预算规则 CRUD + 评估
├── approvals.ts ········· 168 LOC [EN] 审批队列 + 策略配置
├── alerts.ts ············ 147 LOC [EN] 告警规则 CRUD + 触发记录
├── config.ts ············ 142 LOC [EN] 配置编辑器（schema + 冲突检测）
├── channels.ts ·········· 136 LOC [EN] 渠道列表 + 配置
├── settings.ts ·········· 134 LOC [EN] 用户偏好（主题/语言/通知/连接）
├── docs.ts ·············· 126 LOC [EN] 文档中心 CRUD + 分类搜索
├── chat.ts ·············· 118 LOC [EN] 消息列表 + 流式 + 去重 + session
├── activity.ts ··········  90 LOC [EN] 事件时间线 + 过滤
├── models.ts ············  85 LOC [EN] 模型目录 + 供应商配置
├── agents.ts ············  77 LOC [EN] 智能体列表 + CRUD
├── logs.ts ··············  73 LOC [EN] 日志流 + level 过滤
├── gateway.ts ···········  72 LOC [EN] 连接状态 + 健康摘要
├── ui.ts ················  55 LOC [EN] UI 状态（面板/主题/语言/sidebar）
└── notifications.ts ·····  43 LOC [EN] Toast 通知队列
```

---

## 6. 面板组件 — 19 面板, 71 文件, 8,682 LOC

```
src/components/panels/
│
├── 核心 (Core) ─────────────────────────────────────────── [EN] 全部自研
│   ├── chat/ ············ 5 files, 704 LOC   流式对话 + session 切换 + 附件
│   ├── agents/ ·········· 3 files, 411 LOC   智能体列表 + 详情编辑
│   ├── gateway/ ········· 4 files, 308 LOC   3 卡片仪表盘（连接/健康/心跳）
│   └── models/ ·········· 3 files, 220 LOC   模型目录 + 供应商配置
│
├── 观测 (Observe) ──────────────────────────────────────── [EN] 全部自研
│   ├── usage/ ··········· 5 files, 556 LOC   Token/费用汇总 + Recharts 图表 + breakdown
│   ├── sessions/ ········ 3 files, 404 LOC   会话浏览器 + 详情 + 历史
│   ├── memory/ ·········· 5 files, 542 LOC   文件树 + 向量搜索 + 图谱 + 健康
│   ├── logs/ ············ 4 files, 329 LOC   实时日志 + level/source 过滤
│   └── activity/ ········ 2 files, 221 LOC   事件时间线 + SSE 实时
│
├── 自动化 (Automate) ───────────────────────────────────── [EN] 全部自研
│   ├── cron/ ············ 5 files, 482 LOC   任务 CRUD + 运行历史 + 手动触发
│   ├── webhooks/ ········ 3 files, 429 LOC   Webhook CRUD + 投递历史 + 测试
│   ├── approvals/ ······· 4 files, 474 LOC   审批队列 + 4 维策略编辑器
│   └── skills/ ·········· 3 files, 338 LOC   技能列表 + 配置 + 安装
│
└── 控制 (Control) ──────────────────────────────────────── [EN] 全部自研
    ├── budget/ ·········· 4 files, 556 LOC   规则 CRUD + 多维阈值 + 状态
    ├── alerts/ ·········· 4 files, 485 LOC   规则 CRUD + 触发记录
    ├── channels/ ········ 3 files, 322 LOC   渠道列表 + 配置表单
    ├── config-editor/ ··· 4 files, 449 LOC   Schema 驱动表单 + 冲突检测
    ├── docs/ ············ 4 files, 397 LOC   文档中心 + 提取 + 分类
    └── settings/ ········ 5 files, 427 LOC   外观/连接/通知/关于
```

---

## 7. 布局 & 基础组件

```
src/components/
├── layout/ ·············· 5 files, 605 LOC [EN]
│   ├── NavRail.tsx ····· 370 LOC  可折叠分组导航 + 响应式 3 断点 + accent bar
│   ├── HeaderBar.tsx ··· 150 LOC  面板标题 + 状态 pill + 语言/主题切换
│   ├── Shell.tsx ·······  23 LOC  根布局容器
│   ├── ThemeScript.tsx ·  22 LOC  主题初始化（防闪烁）
│   └── ThemeSync.tsx ···  40 LOC  主题状态同步
│
├── ui/ ·················· 15 files, 1,198 LOC [LIB:shadcn/ui]
│   ├── select.tsx, dialog.tsx, sheet.tsx, dropdown-menu.tsx ...
│   └── 基于 Base UI (Radix 替代) 的无头组件
│
├── onboarding/ ·········· 4 files, 572 LOC [EN]
│   ├── OnboardingWizard.tsx  3 步向导容器
│   ├── StepConnection.tsx    Gateway 连接测试
│   ├── StepProvider.tsx      LLM 供应商配置
│   └── StepFirstChat.tsx     首次对话测试
│
└── notifications/ ······· 2 files, 162 LOC [EN]
    ├── ToastContainer.tsx    语义化 Toast（info/success/warning/error）
    └── useNotificationSSE.ts SSE 通知订阅
```

---

## 8. API 路由层 — 49 routes, 2,752 LOC

```
src/app/api/                                              全部 [EN] 自研
├── stream/route.ts ····· 128 LOC  SSE 长连接 + Last-Event-ID replay
├── onboarding/ ········· 3 routes  首次引导（status / save / test-connection）
├── chat/ ··············· 4 routes  send / abort / history / sessions
├── agents/ ············· 4 routes  list / detail / files / file-content
├── gateway/ ············ 2 routes  health / status
├── models/ ············· 2 routes  list / config
├── sessions/ ··········· 2 routes  list / detail
├── usage/ ·············· 4 routes  overview / cost / timeseries / budget
├── memory/ ············· 3 routes  browse / search / health
├── logs/ ··············· 1 route   tail
├── activity/ ··········· 1 route   event stream
├── channels/ ··········· 3 routes  list / detail / logout
├── config/ ············· 3 routes  get / schema / apply
├── settings/ ··········· 3 routes  CRUD / test-connection / version
├── cron/ ··············· 5 routes  list / detail / run / runs / status
├── webhooks/ ··········· 4 routes  list / detail / test / deliveries
├── approvals/ ·········· 3 routes  list / pending / policy
├── alerts/ ············· 2 routes  list+create / detail
├── skills/ ············· 3 routes  list / detail / install
├── docs/ ··············· 3 routes  list / detail / extract
└── budget/ ············· 3 routes  rules / detail / evaluate
```

---

## 9. Memory Enhancement (`extensions/memory-lancedb/`) — 225 tests

```
extensions/memory-lancedb/src/
├── embedder.ts ·········· [TP:lancedb] 多 key 嵌入器 + LRU 缓存 + key 轮转
├── chunker.ts ··········· [TP:lancedb] 自动分块（超 token 限制时切分）
├── retriever.ts ········· [TP:lancedb] 混合检索（Vector + BM25 + Rerank）
├── adaptive-retrieval.ts  [TP:lancedb] 自适应检索策略
├── noise-filter.ts ······ [TP:lancedb] 噪声过滤器
├── access-tracker.ts ···· [TP:lancedb] 访问追踪器
├── smart-extractor.ts ··· [TP:lancedb] 智能提取器（6 类分类）
├── scopes.ts ············ [TP:lancedb] 5 模式作用域隔离
├── decay-engine.ts ······ [TP:lancedb] Weibull 3 层衰减引擎
├── llm-client.ts ········ [TP:lancedb] LLM JSON 提取客户端
├── memory-categories.ts · [TP:lancedb] 记忆分类系统
├── smart-metadata.ts ···· [TP:lancedb] 智能元数据
└── extraction-prompts.ts  [TP:lancedb] 提取 prompt 模板
```

---

## 10. 设计系统 — Mission Control

```
globals.css                                               [EN] 自研
├── Deep Space 色板 ····· 深色 #0a0f1c / 浅色 #f8fafc + 20 CSS 变量
├── Accent 辉光签名 ····· shadow-[0_0_8px_var(--accent)] + 3px 左 bar
├── 字体 ··············· Outfit (display) + Geist Mono (data) — next/font/google
├── Card hover glow ···· .card-hover → accent border + glow
├── prefers-reduced-motion  动画降级
└── Focus glow ········· .focus-glow → accent ring
```

---

## 11. 来源统计

| 来源                                              | 文件数   | LOC         | 占比     |
| ------------------------------------------------- | -------- | ----------- | -------- |
| **[EN] 自研** — 面板/stores/routes/引导/布局      | ~170     | ~21,500     | **80%**  |
| **[TP:studio]** — WS 适配器/投影存储/访问门       | 4        | ~910        | 3%       |
| **[TP:mc]** — EventBus/限流/Webhook/注入防护/定价 | 5        | ~750        | 3%       |
| **[TP:cc]** — 预算治理/告警路由                   | 2        | ~475        | 2%       |
| **[TP:lancedb]** — Memory Enhancement 13 模块     | 13       | ~2,160      | 8%       |
| **[LIB]** — shadcn/ui 15 组件                     | 15       | ~1,200      | 4%       |
| **合计**                                          | **~215** | **~27,000** | **100%** |

---

## 12. 数据流

```
用户操作 (Browser)
    │
    ▼
Zustand Store ──── 状态更新 ──→ React 组件重渲染
    │
    ▼
fetch("/api/...") ──→ API Route Handler
    │                      │
    ├── SQLite 本地操作     │  Webhooks, Budget, Alerts, Settings, Docs
    │   (deck.db)          │
    │                      ▼
    │              gatewayRequest(rpc, params)
    │                      │
    │                      ▼
    │              Gateway WS Adapter ──→ OpenClaw Gateway
    │                      │                    │
    │                      ◄────────────────────┘
    │                      │              RPC Response
    ▼                      ▼
EventBus.publish(event) ──→ ProjectionStore (SQLite outbox)
    │                              │
    ▼                              ▼
SSE Bridge ("/api/stream") ──→ Browser EventSource
    │                              │
    ▼                              ▼
useChatSSE / useNotificationSSE / useActivitySSE
    │
    ▼
Zustand Store 更新 → UI 实时刷新
```

---

## 13. 测试覆盖

| 测试域             | 框架       | 数量      | 文件          |
| ------------------ | ---------- | --------- | ------------- |
| Dashboard 单元测试 | Vitest     | 368       | 17 test files |
| Memory-LanceDB     | Vitest     | 225       | 12 test files |
| 核心安全模块       | Vitest     | 497       | 28 test files |
| Retry 框架         | Vitest     | 9         | 1 test file   |
| E2E 浏览器测试     | Playwright | 35        | 4 spec files  |
| **总计**           |            | **1,134** |               |

---

> 本文档由 E2E 测试会话自动生成，反映 enhanced 分支 commit `2f2ddd0d4` 的实际代码状态。

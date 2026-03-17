# openclaw-deck Design Specification

> Personal AI assistant full-featured Web Dashboard — core capability layer for claw-platform.

## Overview

**openclaw-deck** is a Web Dashboard for OpenClaw that surfaces all Gateway capabilities through a browser UI. It serves two audiences:

1. **Individual users** — full visibility and control over their personal AI assistant
2. **Platform developers** — clean API contract layer that claw-platform wraps for enterprise features (multi-tenancy, RBAC, billing)

### Key Decisions

| Decision             | Choice                                           | Rationale                                                                        |
| -------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------- |
| Target user          | Personal use, but feature-complete               | Acts as core layer for enterprise platform                                       |
| Deployment           | Pure Web app (Node.js)                           | Universal; desktop shell optional later                                          |
| Frontend stack       | Next.js 15+ + React 19 + Tailwind + shadcn/ui    | Same stack as reference projects; transplant-friendly; upgrade to 16 when stable |
| Gateway relationship | Independent process, connects to running Gateway | Dashboard doesn't manage Gateway lifecycle                                       |
| Code location        | `dashboard/` in monorepo (pnpm workspace)        | Shares types with OpenClaw core                                                  |
| i18n                 | Chinese + English (zh default)                   | Platform needs English; i18n from day one                                        |
| Naming               | openclaw-deck                                    | "command deck" metaphor; pairs with claw-platform                                |

### Scope

- **19 panels** + 2 global features
- Covers all non-Desktop-specific features from the official macOS App
- Adds capabilities macOS App doesn't have: Budget, Alerts, Webhooks, Doc Hub, Activity Feed
- Does NOT include: multi-tenancy, RBAC, user management (claw-platform scope)

### Out of Scope Gateway Capabilities

The following Gateway features are intentionally excluded (Desktop-specific or deferred):

| Capability          | Gateway RPC                         | Reason                                        |
| ------------------- | ----------------------------------- | --------------------------------------------- |
| TTS                 | `tts.*`                             | Desktop audio feature                         |
| Voice Wake          | `voicewake.*`                       | Desktop microphone feature                    |
| Node/Device Pairing | `node.pair.*`, `device.pair.*`      | Deferred to platform layer                    |
| Secrets management  | `secrets.reload`, `secrets.resolve` | Low priority; config editor covers most needs |
| Wizard flow         | `wizard.*`                          | Replaced by custom Onboarding Wizard          |

### Platform Integration Contract

claw-platform wraps openclaw-deck through one of these patterns:

1. **Reverse proxy (recommended)** — Platform runs its own server, proxies `/api/*` to deck server with added auth/tenant headers. Deck reads headers but doesn't enforce them.
2. **Module import** — Platform imports deck's `lib/` modules directly as a workspace dependency. Bypasses deck's HTTP layer entirely.
3. **Middleware injection** — Platform extends deck's Next.js middleware to add RBAC checks before routes execute.

P0 API routes should be designed with pattern #1 in mind: accept optional `X-Tenant-Id` / `X-User-Id` headers, pass them through to lib functions, but don't require them.

## Architecture

### System Layers

```
Browser (React SPA)
    │ HTTP REST + SSE
    ▼
Deck Server (Next.js API Routes + Node.js)
    │ WebSocket          │ File I/O
    ▼                    ▼
OpenClaw Gateway    SQLite (deck.db) + ~/.openclaw/
(:18789)
```

### Communication Flow

| Path             | Protocol          | Purpose                                        |
| ---------------- | ----------------- | ---------------------------------------------- |
| Browser → Server | REST API          | All mutations + queries                        |
| Server → Browser | SSE               | Real-time events (chat stream, status updates) |
| Server → Gateway | WebSocket         | OpenClaw Protocol v3, challenge-response auth  |
| Server → Disk    | SQLite + File I/O | Deck state + OpenClaw config/sessions read     |

### Design Principles

1. **Browser never talks to Gateway directly** — Server holds the WS connection. Enables security, caching, and future platform wrapping.
2. **SQLite for deck state only** — OpenClaw data stays in `~/.openclaw/`. SQLite stores dashboard-specific state: event outbox, usage aggregation, budget rules, webhook config.
3. **EventBus bridges WS → SSE** — Gateway events arrive via WS, get processed + persisted, then broadcast via SSE.
4. **API Routes as platform contract** — Every route is a clean interface that claw-platform can wrap or proxy.

## Project Structure

```
dashboard/
├── package.json              # name: "openclaw-deck"
├── next.config.ts
├── tsconfig.json
│
├── server/                   # Node.js server infrastructure
│   ├── gateway-adapter.ts    ← studio (511 LOC)
│   ├── event-bus.ts          ← MC (64 LOC)
│   ├── projection-store.ts   ← studio (SQLite outbox)
│   ├── access-gate.ts        ← studio + CC
│   ├── rate-limit.ts         ← MC (200 LOC)
│   └── contracts.ts          ← studio (WS protocol types)
│
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx          # SPA entry
│   │   └── api/              # ~40 API Route endpoints
│   │       ├── gateway/      # status, health, pause/resume
│   │       ├── chat/         # send, abort, history
│   │       ├── agents/       # CRUD, config, files, SOUL.md
│   │       ├── models/       # catalog, provider config
│   │       ├── sessions/     # list, detail, context usage
│   │       ├── cron/         # CRUD, run, history
│   │       ├── approvals/    # get, resolve, policy, allowlist
│   │       ├── usage/        # tokens, costs, budget
│   │       ├── webhooks/     # CRUD, deliveries, test
│   │       ├── memory/       # search, browse, graph
│   │       ├── skills/       # list, install, enable, env config
│   │       ├── channels/     # status, config forms
│   │       ├── config/       # schema-driven get/set
│   │       ├── logs/         # stream, filter
│   │       ├── alerts/       # rules CRUD
│   │       ├── activity/     # feed
│   │       ├── docs/         # doc hub
│   │       ├── stream/       # SSE endpoint
│   │       └── settings/     # deck preferences
│   │
│   ├── components/
│   │   ├── ui/              # shadcn/ui primitives
│   │   ├── layout/          # Shell, NavRail, HeaderBar
│   │   ├── panels/          # 19 panels (each <500 LOC)
│   │   │   ├── chat/
│   │   │   ├── agents/
│   │   │   ├── gateway-overview/
│   │   │   ├── models/
│   │   │   ├── usage/
│   │   │   ├── sessions/
│   │   │   ├── memory/
│   │   │   ├── logs/
│   │   │   ├── activity/
│   │   │   ├── cron/
│   │   │   ├── webhooks/
│   │   │   ├── approvals/
│   │   │   ├── skills/
│   │   │   ├── budget/
│   │   │   ├── alerts/
│   │   │   ├── channels/
│   │   │   ├── config-editor/
│   │   │   └── docs/
│   │   ├── onboarding/      # First-run wizard
│   │   └── notifications/   # Toast system
│   │
│   ├── lib/                 # Shared business logic
│   │   ├── token-pricing.ts  ← MC (77 LOC)
│   │   ├── budget-governance.ts ← CC
│   │   ├── commander.ts      ← CC (alert routing)
│   │   ├── injection-guard.ts ← MC (330 LOC)
│   │   ├── webhooks.ts       ← MC (372 LOC)
│   │   ├── message-extract.ts ← studio
│   │   └── api-client.ts     # Browser fetch wrapper
│   │
│   ├── stores/              # Zustand slices (NOT monolithic)
│   │   ├── gateway.ts       # connection state
│   │   ├── chat.ts          # messages, streaming
│   │   ├── agents.ts        # fleet
│   │   ├── usage.ts         # tokens, costs
│   │   ├── cron.ts
│   │   ├── ui.ts            # sidebar, theme, locale
│   │   └── notifications.ts
│   │
│   ├── i18n/                # next-intl
│   │   ├── en.json
│   │   └── zh.json
│   │
│   └── types/               # Shared TypeScript types
│
├── migrations/              # SQLite schema migrations
│   ├── 001_init.sql
│   └── ...
│
└── tests/
    ├── unit/
    └── e2e/
```

### SQLite Migration Strategy

- Tool: Raw SQL files in `migrations/` directory (no ORM)
- Naming: `001_init.sql`, `002_add_webhooks.sql`, etc.
- Execution: Auto-migrate on server startup (check `schema_version` table)
- Plugin extensibility: `registerMigrations()` hook for future platform extensions

### Hard Rules

| Rule           | Limit                     | Rationale                                        |
| -------------- | ------------------------- | ------------------------------------------------ |
| File size      | < 500 LOC                 | Prevent god components (MC's worst debt)         |
| Store slice    | < 200 LOC                 | Prevent monolithic store (MC had 762-line store) |
| API route      | < 100 LOC                 | Keep routes thin; logic in lib/                  |
| TypeScript     | strict, zero `any`        | Type safety                                      |
| i18n           | All UI text via next-intl | No hardcoded strings                             |
| Gateway access | Server-side only          | Browser never connects directly                  |

## Layout

### Desktop (≥1024px)

```
┌──────────────────────────────────────────────────┐
│ Header: Panel name │ Gateway status │ EN/中 │ 🌙 │
├──────────┬───────────────────────────────────────┤
│ NavRail  │                                       │
│          │                                       │
│ Core     │           Main Content                │
│  Chat    │           (active panel)              │
│  Agents  │                                       │
│  Gateway │                                       │
│  Models  │                                       │
│          │                                       │
│ Observe  │                                       │
│  Usage   │                                       │
│  Sessions│                                       │
│  Memory  │                                       │
│  Logs    │                                       │
│  Activity│                                       │
│          │                                       │
│ Automate │                                       │
│  Cron    │                                       │
│  Webhooks│                                       │
│  Approval│                                       │
│  Skills  │                                       │
│          │                                       │
│ Control  │                                       │
│  Budget  │                                       │
│  Alerts  │                                       │
│  Channels│                                       │
│  Config  │                                       │
│  Docs    │                                       │
│          │                                       │
│ Settings │                                       │
└──────────┴───────────────────────────────────────┘
```

- NavRail: collapsible (icon-only ↔ full labels), 4 groups
- HeaderBar: current panel name, Gateway connection indicator, language toggle, theme toggle
- SPA routing via catch-all `[[...panel]]/page.tsx`

## Panel Specifications

### Core Group (P0)

**Chat** — Primary interaction surface.

- Streaming message display with tool_use blocks, thinking trace (collapsible), code blocks
- File attachment (drag & drop)
- Session selector sidebar
- Agent selector
- Gateway RPC: `chat.send`, `chat.abort`, `chat.history`, `sessions.list`

**Agents** — Agent fleet management.

- Agent list with status indicators
- Per-agent config: model, personality (SOUL.md), workspace
- Agent create/delete
- Gateway RPC: `agents.list`, `agents.create`, `agents.update`, `agents.delete`, `agents.files.list`, `agents.files.get`, `agents.files.set`

**Gateway Overview** — Connection and health dashboard.

- Connection status (connected/reconnecting/error)
- Health card: link status, auth age, session stats
- Heartbeat monitor
- Gateway state display (active/paused, read-only via config)
- Control channel diagnostics: StatusSummary (sessions/channels/heartbeat) + Deck Server 自测 WS roundtrip 延迟
- Gateway RPC: `health`, `status`, `config.get`

**Models** — Model catalog and provider management.

- Installed models list with provider grouping
- Provider config (API key, base URL, pricing)
- Model cost display
- Default model selection per agent
- Gateway RPC: `models.list`, `config.get`, `config.set`, `config.patch` (model config lives in openclaw.json)

### Observe Group (P1)

**Usage & Costs** — Token consumption and cost tracking.

- Today / 7d / 30d aggregation
- Per-model and per-agent breakdown
- Charts (Recharts)
- Context window pressure indicators
- Transplant: `token-pricing.ts` from MC
- Gateway RPC: `usage.status`, `usage.cost`, `sessions.usage`, `sessions.usage.timeseries`, `sessions.usage.logs`

**Sessions** — Session browser and detail view.

- Session list with kind badges (direct/group/global/unknown)
- Context usage bar (visual)
- Token stats (input/output)
- Model and session ID display (无 creation timestamp，仅用 `updatedAt`)
- Conversation history viewer
- Gateway RPC: `sessions.list`, `chat.history`

**Memory Browser** — Knowledge base visualization.

- File tree browser (agent memory directories)
- Vector search interface (仅在 memory-lancedb 插件启用时可用)
- Knowledge graph visualization (links between memories)
- Health diagnostics: `doctor.memory.status` 返回 `agentId/provider/embedding.ok|error`（Gateway 不提供 orphan/broken-link 计数）
- **Data access strategy**: Deck Server 先检测 `memory-lancedb` 扩展是否启用（通过 `config.get` 读取插件配置），启用时从扩展配置动态解析 LanceDB 数据路径（不硬编码 `~/.openclaw/agents/*/memory/`）。未启用时降级为 memory-core 文件浏览模式，vector search 不可用。
- Gateway RPC (health only): `doctor.memory.status`

**Logs** — Real-time log viewer.

- Streaming log output
- Level filter (debug/info/warn/error)
- Source filter (gateway/agent/channel)
- Session filter
- Gateway RPC: `logs.tail` RPC 轮询（Deck Server 定时调用后通过 SSE 转发到浏览器，无 WS log event subscription）

**Activity Feed** — Operational timeline.

- Chronological event stream
- Agent events (tool calls, chat messages, status changes)
- Filterable by agent/event type
- Real-time via SSE
- Transplant: `commander.ts` from CC for alert routing

### Automate Group (P2)

**Cron** — Scheduled task management.

- Job list with next-run time
- Create/edit with schedule templates (every 5m, hourly, daily, weekly)
- Cron expression support
- Run history with output
- Manual trigger ("Run Now")
- Gateway RPC: `cron.list`, `cron.add`, `cron.update`, `cron.remove`, `cron.run`, `cron.status`, `cron.runs`

**Webhooks** — Event delivery management.

- Webhook CRUD (URL, events, secret)
- HMAC-SHA256 signature
- Delivery history with status
- Retry with exponential backoff
- Test delivery
- Transplant: `webhooks.ts` from MC

**Approvals & Security** — Execution safety.

- Pending approvals list with approve/deny actions
- 4 维审批策略配置：`security`(deny/allowlist/full) + `ask`(off/on-miss/always) + `askFallback`(deny/allow) + `autoAllowSkills`(boolean)
- Per-agent security policy (same 4-dimensional model)
- Path allowlist management
- Gateway RPC: `exec.approval.resolve`, `exec.approvals.get`, `exec.approvals.set`

**Skills** — Skill lifecycle management.

- Skill list with status filters (ready/needs-setup/disabled)
- Install / disable + remove config (Gateway 无 `uninstall` RPC)
- Enable/disable toggle
- Environment variable / API key configuration
- Source tags (bundled/managed/plugin)
- Missing requirements indicators
- Gateway RPC: `skills.status`, `skills.update`

### Control Group (P2-P3)

**Budget** — Token budget governance.

- Budget rules: per-agent, per-task scope
- 4 dimensions: tokensIn / tokensOut / totalTokens / cost
- 3 states: ok / warn / over (configurable thresholds)
- Transplant: `budget-governance.ts` from CC

**Alerts** — Alert rule management.

- Rule CRUD: entity type, condition, threshold, action
- Cooldown periods
- Notification routing
- Transplant: `commander.ts` routing from CC

**Channels** — Chat channel configuration.

- Configured vs available channel list (sidebar + detail)
- Per-channel status indicator (linked/error/unconfigured)
- Configuration forms (token, webhook URL, etc.)
- Enable/disable, re-link actions
- Gateway RPC: `channels.status`, `channels.logout`, `config.get`, `config.set`, `config.patch` (channel add/remove is done via config mutation, not dedicated RPC)

**Config Editor** — Schema-driven configuration.

- Auto-generated forms from OpenClaw JSON Schema
- Section navigation (gateway/agents/hooks/models/etc.)
- Save: 发送 full raw 字符串 + `baseHash` 并发保护（非只发 changed values），冲突时展示 diff
- Reload with dirty state tracking
- Gateway RPC: `config.get`, `config.schema` (required for auto-generated forms), `config.apply` (with `{ raw, baseHash }`)

**Settings** — Deck preferences and system info.

- Theme selection (dark/light/system)
- Language preference (zh/en)
- Gateway connection URL and token
- Notification preferences
- Version info (deck version, Gateway version, OpenClaw CLI version)
- Links (docs, GitHub, support)
- Data stored in `deck.db` settings table

**Doc Hub (P3)** — Conversation knowledge extraction.

- Auto-extract structured documents from agent conversations
- Smart categorization (summary/plan/spec/manual/draft)
- Chinese + English keyword matching
- Search and browse interface

### Global Features

**Onboarding Wizard** — First-run setup guide.

- Step 1: Gateway connection (URL + token)
- Step 2: Provider setup (model + API key)
- Step 3: First chat test
- Detects unconfigured state via `config.get`

**Toast Notification System** — Global event notifications.

- Non-blocking toast popups
- Types: info, success, warning, error
- Auto-dismiss with configurable duration
- Approval request notifications
- Budget threshold alerts

## Transplant Manifest

Modules transplanted from vendor projects (total ~2500 LOC):

### From openclaw-studio

| Module             | File                  | LOC  | Target                       |
| ------------------ | --------------------- | ---- | ---------------------------- |
| Gateway WS Adapter | `openclaw-adapter.ts` | 511  | `server/gateway-adapter.ts`  |
| Protocol types     | `contracts.ts`        | 55   | `server/contracts.ts`        |
| SQLite outbox      | `projection-store.ts` | ~300 | `server/projection-store.ts` |
| Access gate        | `access-gate.js`      | 120  | `server/access-gate.ts`      |
| Message parser     | `message-extract.ts`  | ~150 | `src/lib/message-extract.ts` |

### From Mission Control

| Module          | File                 | LOC | Target                       |
| --------------- | -------------------- | --- | ---------------------------- |
| EventBus        | `event-bus.ts`       | 64  | `server/event-bus.ts`        |
| Token pricing   | `token-pricing.ts`   | 77  | `src/lib/token-pricing.ts`   |
| Webhooks        | `webhooks.ts`        | 372 | `src/lib/webhooks.ts`        |
| Injection guard | `injection-guard.ts` | 330 | `src/lib/injection-guard.ts` |
| Rate limiter    | `rate-limit.ts`      | 200 | `server/rate-limit.ts`       |

### From Control Center

| Module            | File                                        | LOC  | Target                          |
| ----------------- | ------------------------------------------- | ---- | ------------------------------- |
| Security config   | `local-token-auth.ts` + `config.ts`         | ~200 | `server/access-gate.ts` (merge) |
| Budget governance | `budget-governance.ts` + `budget-policy.ts` | ~280 | `src/lib/budget-governance.ts`  |
| Alert routing     | `commander.ts`                              | ~250 | `src/lib/commander.ts`          |

### Memory Enhancement (extensions/memory-lancedb)

**Phase 1 (P1):**

| Module             | File                                      | LOC   | Target                                  |
| ------------------ | ----------------------------------------- | ----- | --------------------------------------- |
| Embedder           | `embedder.ts` + `chunker.ts`              | ~970  | Replace in `extensions/memory-lancedb/` |
| Retriever          | `retriever.ts`                            | ~1100 | Replace in `extensions/memory-lancedb/` |
| Adaptive retrieval | `adaptive-retrieval.ts`                   | 97    | Add to `extensions/memory-lancedb/`     |
| Noise filter       | `noise-filter.ts` + `noise-prototypes.ts` | ~260  | Add to `extensions/memory-lancedb/`     |

**Phase 2 (P3):**

| Module          | File                           | LOC   | Target                              |
| --------------- | ------------------------------ | ----- | ----------------------------------- |
| Smart extractor | `smart-extractor.ts`           | ~1040 | Add to `extensions/memory-lancedb/` |
| Scopes          | `scopes.ts`                    | 373   | Add to `extensions/memory-lancedb/` |
| Decay engine    | `decay-engine.ts` (simplified) | ~200  | Add to `extensions/memory-lancedb/` |

## Implementation Phases

### P0 — Foundation + Core Panels

**Goal:** "Connect to Gateway and chat"

**Infrastructure (~2500 LOC transplant):**

- Next.js scaffold + pnpm workspace integration
- gateway-adapter.ts, event-bus.ts, projection-store.ts, contracts.ts
- access-gate.ts, rate-limit.ts
- i18n framework (next-intl, zh/en)
- Zustand multi-slice setup
- shadcn/ui + Tailwind + layout shell (NavRail + HeaderBar)

**Panels (4):**

- Chat (streaming, tool_use, thinking, file attach)
- Agents (list, config, model select, SOUL.md)
- Gateway Overview (status, health, pause/resume, heartbeat, diagnostics)
- Models (catalog, provider config, pricing)

**Global:**

- Onboarding Wizard (connection → provider → first chat)
- Toast Notification system

**Exit criteria:** Gateway connected, chat working with streaming, agents listed, models configurable.

### P1 — Observability + Configuration Panels

**Goal:** "Know what agents are doing, how much they cost, and configure the system"

**Transplant:** token-pricing.ts, message-extract.ts, commander.ts

**Panels (7):**

- Usage & Costs (token stats, charts, context pressure)
- Sessions (list, context bar, token count, history)
- Memory Browser (search, file tree, knowledge graph)
- Logs (real-time stream, filters)
- Activity Feed (timeline + agent events)
- Channels (configured/available, status, config forms) — moved from P2 for workload balance
- Config Editor (schema-driven forms, section nav) — moved from P2 for workload balance

**Memory Enhancement Phase 1:**

- Replace embedder in extensions/memory-lancedb (multi-key + cache + chunking)
- Replace retriever (Vector + BM25 + Rerank)
- Add adaptive-retrieval + noise-filter

**Exit criteria:** Token costs tracked, sessions browsable, memory searchable, logs streaming, activity timeline working.

### P2 — Automation + Control Panels

**Goal:** "Automation and security control"

**Transplant:** webhooks.ts, injection-guard.ts, budget-governance.ts

**Panels (6):**

- Cron (CRUD, run history, schedule templates)
- Webhooks (CRUD, delivery history, HMAC, retry)
- Approvals & Security (pending, policy, allowlist)
- Skills (list, install, enable/disable, env config)
- Budget (agent/task level, thresholds)
- Alerts (rules CRUD, condition engine)

**Exit criteria:** All automation panels working, security policies configurable.

### P3 — Polish + Knowledge + Platform Ready

**Goal:** "Production-ready, platform-integrable"

**Panels (2):**

- Doc Hub (auto-extract, categorize, search)
- Settings (theme, language, gateway URL, version info)

**Memory Enhancement Phase 2:**

- smart-extractor (LLM-driven 6-class extraction)
- scopes (multi-agent isolation)
- decay-engine (simplified Weibull)

**Polish:**

- Responsive layout (tablet/mobile)
- Dark/Light theme refinement
- Keyboard shortcuts
- API documentation for claw-platform
- E2E test suite (Playwright)
- Performance optimization
- Settings panel (deck preferences)

**Exit criteria:** All 19 panels complete, API documented for platform integration, E2E tests passing, production-ready.

### Phase Summary (rebalanced)

| Phase | Panels         | Transplant      | Focus                         |
| ----- | -------------- | --------------- | ----------------------------- |
| P0    | 4 + 2 global   | ~2500 LOC infra | Core interaction              |
| P1    | 7 + memory ext | ~500 LOC lib    | Observability + configuration |
| P2    | 6              | ~1000 LOC lib   | Automation + control          |
| P3    | 2 + polish     | memory phase 2  | Knowledge + platform ready    |

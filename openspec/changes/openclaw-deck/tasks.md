## 1. P0: Project Scaffold & Infrastructure

- [ ] 1.1 Create `dashboard/` directory with package.json (name: openclaw-deck), tsconfig.json, next.config.ts, pnpm workspace integration
- [ ] 1.2 Install core dependencies: next, react, react-dom, typescript, tailwindcss, better-sqlite3, ws, zustand, next-intl, lucide-react
- [ ] 1.3 Configure shadcn/ui with Tailwind CSS and dark/light theme CSS variables
- [ ] 1.4 Transplant `server/gateway-adapter.ts` from openclaw-studio (WS Protocol v3, challenge-response auth, reconnection). **Must extend method allowlist** to include: `usage.status`, `usage.cost`, `sessions.usage`, `sessions.usage.timeseries`, `sessions.usage.logs`, `channels.status`, `channels.logout`, `logs.tail`, `doctor.memory.status`, `config.schema`, `config.apply`, `cron.status`, `cron.runs`
- [ ] 1.5 Transplant `server/contracts.ts` from openclaw-studio (Gateway protocol type definitions)
- [ ] 1.6 Transplant `server/event-bus.ts` from Mission Control (EventEmitter-based event broadcast, 64 LOC)
- [ ] 1.7 Implement `server/projection-store.ts` based on openclaw-studio (SQLite WAL mode, outbox table, idempotent event writes)
- [ ] 1.8 Create SQLite migration system: `migrations/001_init.sql` with schema_version table, outbox table, settings table
- [ ] 1.9 Transplant `server/access-gate.ts` merging openclaw-studio access gate + Control Center local-token-auth
- [ ] 1.10 Transplant `server/rate-limit.ts` from Mission Control (IP-based rate limiting, 200 LOC)
- [ ] 1.11 Implement server runtime singleton: initialize gateway adapter + SQLite + EventBus on Next.js startup
- [ ] 1.12 Implement SSE stream endpoint `src/app/api/stream/route.ts` (ReadableStream, Last-Event-ID replay, heartbeat)
- [ ] 1.13 Set up next-intl with `i18n/zh.json` and `i18n/en.json` scaffold (Chinese default)
- [ ] 1.14 Create Zustand store slices: `stores/gateway.ts`, `stores/chat.ts`, `stores/agents.ts`, `stores/ui.ts`, `stores/notifications.ts`
- [ ] 1.15 Build layout shell: NavRail (collapsible, 4 groups), HeaderBar (panel name, connection status, locale/theme toggles), SPA catch-all router
- [ ] 1.16 Implement platform contract headers: all API routes SHALL accept and transparently pass through optional `X-Tenant-Id` / `X-User-Id` headers to lib functions (required for claw-platform reverse proxy integration)

## 2. P0: Core Panels

- [ ] 2.1 Implement Chat panel: message list with streaming text display, Markdown rendering (react-markdown + remark-gfm)
- [ ] 2.2 Implement Chat panel: tool_use block display, thinking trace collapsible sections
- [ ] 2.3 Implement Chat panel: message input with file attachment (drag & drop), send/abort actions
- [ ] 2.4 Implement Chat panel: session selector sidebar, agent selector dropdown
- [ ] 2.5 Implement Chat API routes: `api/chat/send`, `api/chat/abort`, `api/chat/history`
- [ ] 2.6 Implement Agents panel: agent list with status indicators, create/delete actions
- [ ] 2.7 Implement Agents panel: per-agent config (model select, personality/SOUL.md editor, workspace)
- [ ] 2.8 Implement Agents API routes: `api/agents/` (CRUD + files.list/get/set)
- [ ] 2.9 Implement Gateway Overview panel: connection status card, health card (link status, auth age, session stats)
- [ ] 2.10 Implement Gateway Overview panel: heartbeat monitor, Gateway state display (active/paused, read-only), control channel diagnostics (StatusSummary + Deck Server 自测 WS roundtrip)
- [ ] 2.11 Implement Gateway API routes: `api/gateway/status`, `api/gateway/health`
- [ ] 2.12 Implement Models panel: model catalog list grouped by provider, cost display
- [ ] 2.13 Implement Models panel: provider config form (API key, base URL, pricing), default model selection
- [ ] 2.14 Implement Models API routes: `api/models/` (list, provider config via config.set/patch)

## 3. P0: Global Features

- [ ] 3.1 Implement Onboarding Wizard: step 1 Gateway connection (URL + token input, connection test)
- [ ] 3.2 Implement Onboarding Wizard: step 2 provider setup (model + API key, validation)
- [ ] 3.3 Implement Onboarding Wizard: step 3 first chat test (send message, verify streaming response)
- [ ] 3.4 Implement Onboarding Wizard: unconfigured state detection via config.get on app load
- [ ] 3.5 Implement Toast Notification system: global provider, toast types (info/success/warning/error), auto-dismiss
- [ ] 3.6 Implement Toast Notification: approval request and budget alert notifications via EventBus subscription

## 4. P1: Observe Panels

- [ ] 4.1 Transplant `src/lib/token-pricing.ts` from Mission Control (77 LOC, multi-model pricing table)
- [ ] 4.2 Implement Usage & Costs panel: today/7d/30d aggregation, per-model and per-agent breakdown
- [ ] 4.3 Implement Usage & Costs panel: charts (Recharts), context window pressure indicators
- [ ] 4.4 Implement Usage API routes: `api/usage/` (wrapping usage.status, usage.cost, sessions.usage, sessions.usage.timeseries)
- [ ] 4.5 Create `stores/usage.ts` Zustand slice for token/cost state
- [ ] 4.6 Implement Sessions panel: session list with kind badges (direct/group/global/unknown), context usage bar
- [ ] 4.7 Implement Sessions panel: token stats (input/output), model display, conversation history viewer
- [ ] 4.8 Implement Sessions API routes: `api/sessions/` (list, detail, delete)
- [ ] 4.9 Implement Memory Browser panel: file tree browser (detect memory-lancedb plugin → dynamic path; fallback to memory-core file browsing)
- [ ] 4.10 Implement Memory Browser panel: vector search via embedded LanceDB SDK
- [ ] 4.11 Implement Memory Browser panel: knowledge graph visualization (links between memories)
- [ ] 4.12 Implement Memory API routes: `api/memory/` (browse, search, graph, health via doctor.memory.status)
- [ ] 4.13 Transplant `src/lib/message-extract.ts` from openclaw-studio (message parsing utilities)
- [ ] 4.14 Implement Logs panel: real-time streaming via logs.tail RPC polling + SSE forwarding, level/source/session filters
- [ ] 4.15 Implement Logs API routes: `api/logs/` (stream, filter)
- [ ] 4.16 Transplant `src/lib/commander.ts` from Control Center (alert routing, 3-level severity)
- [ ] 4.17 Implement Activity Feed panel: chronological event stream, agent event display (tool calls, status changes)
- [ ] 4.18 Implement Activity Feed panel: filterable by agent/event type, real-time via SSE
- [ ] 4.19 Implement Activity API routes: `api/activity/`

## 5. P1: Configuration Panels (moved from P2 for balance)

- [ ] 5.1 Implement Channels panel: configured vs available channel list (sidebar + detail layout)
- [ ] 5.2 Implement Channels panel: per-channel status indicator, config forms (token/webhook URL), enable/disable/re-link
- [ ] 5.3 Implement Channels API routes: `api/channels/` (wrapping channels.status, channels.logout, config.set/patch)
- [ ] 5.4 Implement Config Editor panel: fetch schema via config.schema RPC, parse JSON Schema into form sections
- [ ] 5.5 Implement Config Editor panel: section navigation (gateway/agents/hooks/models/etc.), form rendering
- [ ] 5.6 Implement Config Editor panel: save (raw string + baseHash concurrency control) / reload with dirty state tracking, config.apply with conflict detection
- [ ] 5.7 Implement Config API routes: `api/config/` (schema, get, set, patch, apply)

## 6. P1: Memory Enhancement (extensions/memory-lancedb)

- [ ] 6.1 Transplant enhanced embedder from memory-lancedb-pro: multi-key rotation, LRU cache (256 entries, 30min TTL), auto-chunking
- [ ] 6.2 Transplant chunker from memory-lancedb-pro: adaptive chunk sizing, semantic splitting, overlap windows
- [ ] 6.3 Transplant hybrid retriever from memory-lancedb-pro: Vector + BM25 parallel search, RRF score fusion
- [ ] 6.4 Transplant Rerank support: Cross-Encoder API rerank with 5s timeout and cosine fallback
- [ ] 6.5 Transplant adaptive-retrieval from memory-lancedb-pro: skip retrieval for greetings/commands/affirmations
- [ ] 6.6 Transplant noise-filter from memory-lancedb-pro: regex pattern matching + embedding prototype library
- [ ] 6.7 Migrate tests from memory-lancedb-pro .mjs to Vitest format, verify all transplanted modules pass

## 7. P2: Automation Panels

- [ ] 7.1 Implement Cron panel: job list with next-run time, create/edit with schedule templates
- [ ] 7.2 Implement Cron panel: cron expression config, run history with output, manual trigger ("Run Now")
- [ ] 7.3 Implement Cron API routes: `api/cron/` (wrapping cron.list/add/update/remove/run/status/runs)
- [ ] 7.4 Create `stores/cron.ts` Zustand slice
- [ ] 7.5 Transplant `src/lib/webhooks.ts` from Mission Control (HMAC-SHA256, exponential backoff retry, 372 LOC)
- [ ] 7.6 Implement Webhooks panel: webhook CRUD (URL, events, secret), delivery history, test delivery
- [ ] 7.7 Implement Webhooks API routes: `api/webhooks/` (CRUD, deliveries, test)
- [ ] 7.8 Add SQLite migration for webhooks + webhook_deliveries tables
- [ ] 7.9 Transplant `src/lib/injection-guard.ts` from Mission Control (prompt/command/exfil detection, 330 LOC)
- [ ] 7.10 Implement Approvals & Security panel: pending approvals list, approve/deny actions
- [ ] 7.11 Implement Approvals & Security panel: 4-dimensional policy (security/ask/askFallback/autoAllowSkills), per-agent security, path allowlist
- [ ] 7.12 Implement Approvals API routes: `api/approvals/` (wrapping exec.approval.resolve, exec.approvals.get/set)
- [ ] 7.13 Implement Skills panel: skill list with status filters (ready/needs-setup/disabled), source tags
- [ ] 7.14 Implement Skills panel: install/disable (no uninstall RPC — use disable + remove config), enable/disable, env variable/API key config
- [ ] 7.15 Implement Skills API routes: `api/skills/` (wrapping skills.status, skills.update)

## 8. P2: Control Panels

- [ ] 8.1 Transplant `src/lib/budget-governance.ts` from Control Center (multi-dimension thresholds, ~280 LOC)
- [ ] 8.2 Implement Budget panel: budget rule CRUD (per-agent, per-task scope), 4 dimensions, warn/over states
- [ ] 8.3 Implement Budget API routes: `api/usage/budget` (CRUD, evaluation)
- [ ] 8.4 Add SQLite migration for budget_rules table
- [ ] 8.5 Implement Alerts panel: alert rule CRUD (entity type, condition, threshold, action), cooldown config
- [ ] 8.6 Implement Alerts panel: notification routing integration with commander.ts
- [ ] 8.7 Implement Alerts API routes: `api/alerts/` (CRUD)
- [ ] 8.8 Add SQLite migration for alert_rules table

## 9. P3: Knowledge & Polish

- [ ] 9.1 Implement Doc Hub panel: auto-extract structured docs from conversation history
- [ ] 9.2 Implement Doc Hub panel: smart categorization (summary/plan/spec/manual/draft), zh+en keywords
- [ ] 9.3 Implement Doc Hub panel: search and browse interface
- [ ] 9.4 Implement Doc Hub API routes: `api/docs/`
- [ ] 9.5 Implement Settings panel: theme (dark/light/system), language (zh/en), Gateway URL, notification prefs
- [ ] 9.6 Implement Settings panel: version info (deck, Gateway, CLI versions), external links
- [ ] 9.7 Implement Settings API routes: `api/settings/`

## 10. P3: Memory Enhancement Phase 2

- [ ] 10.1 Transplant smart-extractor from memory-lancedb-pro: LLM-driven 6-class extraction + 7-type dedup decisions
- [ ] 10.2 Transplant scopes from memory-lancedb-pro: multi-agent memory isolation (5 scope modes)
- [ ] 10.3 Implement simplified decay-engine: exponential decay (simplified from Weibull), 3-tier system (core/working/peripheral)
- [ ] 10.4 Update Memory Browser panel to display scope filters and tier indicators

## 11. P3: Production Readiness

- [ ] 11.1 Responsive layout: tablet/mobile breakpoints, NavRail collapse behavior
- [ ] 11.2 Dark/Light theme polish: verify all panels in both themes
- [ ] 11.3 Keyboard shortcuts: panel navigation, chat send, common actions
- [ ] 11.4 API documentation: document all ~40 endpoints for claw-platform integration
- [ ] 11.5 E2E test suite: Playwright tests for critical flows (onboarding, chat, agent CRUD, cron CRUD)
- [ ] 11.6 Performance optimization: lazy panel loading, SSE reconnection, SQLite query optimization
- [ ] 11.7 Complete i18n: verify all UI strings in both zh and en, fix missing translations

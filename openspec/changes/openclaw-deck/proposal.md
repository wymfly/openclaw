## Why

OpenClaw has no built-in Web Dashboard. The official macOS App (SwiftUI) covers desktop users, but there is no browser-based UI for managing Gateway, agents, models, channels, cron, memory, and other core capabilities. This blocks two audiences:

1. **Individual users** on non-macOS platforms (Linux servers, remote machines) who need full visibility and control.
2. **Enterprise platform (claw-platform)** which requires a core UI capability layer to wrap with multi-tenancy, RBAC, and billing — without reimplementing every Gateway interaction from scratch.

## What Changes

- **New `dashboard/` workspace package** (pnpm monorepo) containing a Next.js Web application
- **19 UI panels** covering all non-Desktop-specific Gateway capabilities, organized into 4 groups (Core / Observe / Automate / Control)
- **2 global features**: Onboarding Wizard + Toast Notification system
- **Server-side Gateway adapter** (WebSocket Protocol v3) — browser never connects directly
- **SQLite local database** for deck-specific state (event outbox, usage aggregation, budget rules, webhook config)
- **EventBus + SSE bridge** for real-time event delivery to browser
- **Memory enhancement** in `extensions/memory-lancedb/` — upgraded embedder (multi-key + cache), hybrid retrieval (Vector + BM25 + Rerank)
- **~2500 LOC transplanted** from 5 analyzed vendor projects (openclaw-studio, Mission Control, Control Center, ClawX, memory-lancedb-pro)
- **Platform Integration Contract** — API Routes designed for claw-platform wrapping (reverse proxy, module import, or middleware injection)

## Capabilities

### New Capabilities

- `gateway-communication`: WebSocket adapter connecting to OpenClaw Gateway (Protocol v3), EventBus for internal event routing, SSE stream for browser delivery, SQLite projection store for event persistence
- `chat-panel`: Real-time chat with streaming messages, tool_use display, thinking trace, file attachments, session management
- `agent-management`: Agent fleet CRUD, per-agent model/personality config, SOUL.md file editing
- `gateway-overview`: Connection status dashboard, health monitoring, heartbeat tracking, pause/resume control, control channel diagnostics
- `model-management`: Model catalog browsing, provider configuration (API keys, base URLs, pricing), default model selection
- `usage-tracking`: Token consumption and cost tracking (today/7d/30d), per-model and per-agent breakdown, context window pressure monitoring, charts
- `session-browser`: Session list with kind badges, context usage visualization, token stats, conversation history viewer
- `memory-browser`: Memory file tree browsing, vector search (via embedded LanceDB SDK), knowledge graph visualization, health diagnostics
- `log-viewer`: Real-time streaming logs, level/source/session filtering
- `activity-feed`: Chronological event timeline, agent events (tool calls, status changes), filterable stream
- `cron-management`: Scheduled task CRUD, cron expression support, schedule templates, run history, manual trigger
- `webhook-engine`: Webhook CRUD with HMAC-SHA256 signing, delivery history, exponential backoff retry, test delivery
- `approval-security`: Execution approval management (pending/approve/deny), approval policy configuration, per-agent security policy, path allowlist management
- `skill-management`: Skill lifecycle (list, install, enable/disable), environment variable and API key configuration, source tagging
- `budget-governance`: Token budget rules (per-agent, per-task scope), multi-dimension thresholds (tokensIn/Out/total/cost), warn/over states
- `alert-system`: Alert rule CRUD, condition engine, cooldown periods, notification routing
- `channel-configuration`: Chat channel management (configured/available), per-channel status and config forms, enable/disable/re-link
- `config-editor`: Schema-driven configuration forms auto-generated from OpenClaw JSON Schema, section navigation, save/reload with dirty tracking
- `doc-hub`: Auto-extraction of structured documents from agent conversations, smart categorization (summary/plan/spec/manual/draft), search
- `onboarding-wizard`: First-run setup guide (Gateway connection → provider setup → first chat test)
- `deck-settings`: Theme, language, Gateway URL, notification preferences, version info
- `memory-enhancement`: Upgraded embedder (multi-key rotation, LRU cache, auto-chunking), hybrid retriever (Vector + BM25 + Rerank), adaptive retrieval, noise filter

### Modified Capabilities

(none — all new capabilities, no existing specs modified)

## Impact

- **New files**: `dashboard/` directory (~15,000-20,000 LOC estimated across 4 phases)
- **Modified files**: `extensions/memory-lancedb/` (embedder + retriever replacement)
- **New dependencies**: `next`, `react`, `react-dom`, `better-sqlite3`, `ws`, `zustand`, `recharts`, `next-intl`, `@lancedb/lancedb` (in dashboard package)
- **Build**: New pnpm workspace package with independent build/dev/test scripts
- **No changes to OpenClaw core** (`src/`) — dashboard reads Gateway via WS and `~/.openclaw/` via file I/O
- **API surface**: ~40 REST endpoints + 1 SSE endpoint, designed as platform integration contract

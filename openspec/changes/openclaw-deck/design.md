## Context

OpenClaw is a TypeScript-based personal AI assistant with a Gateway architecture. The official macOS App (SwiftUI) provides full GUI coverage, but no Web UI exists. Five community projects (ClawX, Mission Control, openclaw-studio, Control Center, memory-lancedb-pro) have been analyzed in depth, yielding ~2500 LOC of proven, transplantable infrastructure modules.

The enhanced fork (`wymfly/openclaw`, branch `enhanced`) already contains security hardening (SSRF protection, fetch guard), stability improvements (unified retry framework), and Windows adaptation. A parallel enterprise platform project (`claw-platform`) depends on this dashboard as its core UI layer.

Existing design document: `docs/plans/2026-03-16-openclaw-deck-design.md` (brainstormed and spec-reviewed).

## Goals / Non-Goals

**Goals:**

- Surface ALL non-Desktop-specific Gateway capabilities through a browser UI (19 panels)
- Provide clean API contract layer for claw-platform to wrap
- Transplant proven infrastructure from vendor projects (~2500 LOC) rather than reinventing
- Enhance memory retrieval quality (Vector + BM25 + Rerank) via memory-lancedb-pro modules
- Chinese-first with English support (next-intl from day one)
- Every file < 500 LOC, every store slice < 200 LOC, every API route < 100 LOC

**Non-Goals:**

- Multi-tenancy, RBAC, user management (claw-platform scope)
- Desktop-specific features (voice wake, TTS, camera, canvas, push-to-talk)
- Gateway process lifecycle management (users run `openclaw gateway run` separately)
- Node/device pairing workflows
- Replacing the official macOS App

## Decisions

### D1: Three-layer server architecture (Browser → Deck Server → Gateway)

**Choice**: Browser never connects to Gateway directly. Deck Server holds the WebSocket connection and proxies via REST + SSE.

**Alternatives considered**:

- Browser direct WS to Gateway — simpler but exposes WS token in browser, blocks platform wrapping
- Shared WS connection (browser + server) — complex multiplexing, no clear benefit

**Rationale**: Security (no token in browser), cacheability (server can aggregate), platform-ready (claw-platform injects auth middleware at server layer).

**Method Allowlist Extension**: When transplanting the openclaw-studio WS adapter, the existing method allowlist MUST be extended to include all RPC methods used by Deck panels: `usage.status`, `usage.cost`, `sessions.usage`, `sessions.usage.timeseries`, `sessions.usage.logs`, `channels.status`, `channels.logout`, `logs.tail`, `doctor.memory.status`, `config.schema`, `config.apply`, `cron.status`, `cron.runs`. The allowlist controls which Gateway RPC methods the Deck Server is permitted to invoke over the WebSocket connection.

### D2: SQLite for deck state, NOT for OpenClaw data

**Choice**: `deck.db` stores only dashboard-specific state (event outbox, usage aggregation, budget rules, webhook config, alert rules). OpenClaw's own data stays in `~/.openclaw/`.

**Alternatives considered**:

- Replicate OpenClaw data into SQLite — data duplication, sync complexity
- No local DB (stateless server) — can't persist budget rules, webhook config, or event replay

**Rationale**: Single source of truth for OpenClaw data. Deck state is orthogonal and small.

### D3: EventBus bridges Gateway WS events to browser SSE

**Choice**: Gateway events arrive via WS → processed by server → written to SQLite outbox → broadcast via EventBus → SSE to browser.

**Alternatives considered**:

- Direct WS passthrough to browser — loses server-side processing/persistence
- Polling — unacceptable latency for chat streaming

**Rationale**: Decouples Gateway protocol from browser protocol. Enables replay (SSE `Last-Event-ID`), persistence, and future multi-client support.

### D4: Transplant-first for infrastructure, new-write for UI

**Choice**: Transplant ~2500 LOC of proven infrastructure modules (WS adapter, EventBus, token pricing, webhooks, injection guard, rate limiter, budget governance, etc.). Write all UI panels fresh using shadcn/ui.

**Alternatives considered**:

- Fork Mission Control (52K LOC) and prune — too much technical debt (2951-line components, 762-line store)
- Fork openclaw-studio and extend — only 6 panels, page.tsx is 1861-line god component
- Build everything from scratch — wastes proven infrastructure

**Rationale**: Infrastructure modules are small (< 500 LOC each), well-tested, and self-contained. UI panels need to match our design system and file size limits, so they're better written fresh.

### D5: Zustand multi-slice state management

**Choice**: Multiple independent Zustand stores (gateway, chat, agents, usage, cron, ui, notifications), each < 200 LOC.

**Alternatives considered**:

- Single Zustand store — Mission Control's 762-line monolithic store is their biggest tech debt
- Redux Toolkit — heavier API, not needed for this scale
- React Context + useReducer — openclaw-studio used this but it doesn't scale well

**Rationale**: Zustand is lightweight, TypeScript-friendly, and slice pattern prevents monolithic growth.

### D6: Memory enhancement via LanceDB SDK in server process

**Choice**: Deck Server embeds `@lancedb/lancedb` SDK to read the same `.lance` database that the memory-lancedb extension writes to. No new Gateway RPC needed.

**Important**: The default memory slot in OpenClaw is `memory-core` (file-based storage). `memory-lancedb` is an optional extension plugin. Memory Browser MUST first detect whether the `memory-lancedb` extension is enabled (by reading plugin config from `config.get`). If enabled, resolve the LanceDB data path dynamically from the extension's configuration (do NOT hardcode `~/.openclaw/agents/*/memory/`). If not enabled, fall back to a file-based browsing mode over the default memory-core storage, with vector search disabled.

**Alternatives considered**:

- New Gateway RPC for memory queries — requires upstream OpenClaw changes
- File-only browsing — loses vector search capability
- Hardcode `~/.openclaw/agents/*/memory/` path — fragile; path is configurable per extension

**Rationale**: LanceDB is an embedded database (no server process). Reading it from Deck Server is a local operation with zero network overhead. Dynamic path resolution ensures correctness across different configurations.

### D7: Platform integration via reverse proxy pattern

**Choice**: claw-platform wraps deck API via reverse proxy with added auth/tenant headers. Deck accepts optional `X-Tenant-Id` / `X-User-Id` headers.

**Alternatives considered**:

- Module import (workspace dependency) — tighter coupling, harder to deploy independently
- Middleware injection — requires Next.js-specific knowledge in platform layer

**Rationale**: Reverse proxy is framework-agnostic, testable independently, and standard in enterprise deployments.

## Risks / Trade-offs

| Risk                                                                | Impact                           | Mitigation                                                                                 |
| ------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------ |
| Gateway Protocol v3 changes in upstream                             | Breaks WS adapter                | Pin to known-good protocol version; adapter has version negotiation                        |
| LanceDB version mismatch between deck and memory extension          | Corrupted reads                  | Share `@lancedb/lancedb` version via pnpm workspace                                        |
| SQLite WAL mode under concurrent writes                             | Data corruption                  | Single-writer pattern; deck server is single process                                       |
| 19 panels × 2 languages = 38 translation sets                       | i18n maintenance burden          | Use structured JSON keys; MC's translation files as starting point                         |
| P2 has 6 panels (still largest phase)                               | Schedule risk                    | Cron and Skills are simpler panels (~300 LOC each); Webhooks transplant handles complexity |
| memory-lancedb-pro modules may diverge from upstream memory-lancedb | Merge conflicts on upstream sync | Isolate changes to clearly marked files; use adapter pattern                               |

## Open Questions

1. **Chart library**: Recharts (MC uses it) vs lightweight alternative (e.g., Chart.js)? Recharts is React-native but heavy (~400KB).
2. **Knowledge graph rendering**: reagraph (MC uses it, 3D) vs @xyflow/react (2D, lighter)? Depends on memory data volume.
3. **Config Editor JSON Schema parser**: Build custom form generator or use existing library (e.g., react-jsonschema-form)?

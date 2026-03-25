# Deck Upstream Sync Design (2026-03-04 → 2026-03-24)

Upgrade the enhanced fork's web UI (openclaw-deck) to natively adopt upstream OpenClaw API changes from the March 4-24 release cycle (~4944 commits). Goal: perfect alignment with upstream design intent, not compatibility shims.

## Scope

**In scope:**

- Full chat flow migration to `sessions.create/send/steer/abort`
- Session lifecycle state display (running/done/failed/killed/timeout)
- Dual-layer event architecture (`sessions.subscribe` + existing chat/agent events)
- `tools.effective` integration
- `config.schema.lookup` integration
- `sessions-history-http` REST+SSE utilization
- New session fields: `fastMode`, `subagentRole`, `subagentControlScope`, `spawnedWorkspaceDir`
- TTS `edge` → `microsoft` rename

**Out of scope:**

- `talk.speak` (low value for web UI)
- `gateway.identity.get` (low value)

## Key Design Decisions

| Decision                | Choice                               | Rationale                                                                                                                                                                                                            |
| ----------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat migration strategy | Full migration to `sessions.*` API   | `sessions.send` wraps `chat.send` internally; keeping both adds maintenance burden. `buildDashboardSessionKey()` in upstream proves this is the intended path.                                                       |
| Steer UX                | Auto-steer on send during active run | Web chat mental model: "I send → agent listens". `sessions.steer` was designed for this. No precedent in macOS Control UI (still on `chat.send`).                                                                    |
| Event architecture      | Both layers retained                 | Layer 1 (chat/agent events) for streaming delta/final. Layer 2 (sessions.changed/session.message/session.tool) for session state tracking. They are complementary per upstream comments in `server-chat.ts:742-746`. |
| Implementation strategy | Vertical module slicing              | Each module completes its full stack (allowlist → store → API route → component) independently.                                                                                                                      |
| Config schema loading   | Lazy lookup with fallback            | `config.schema.lookup` for incremental loading; fall back to `config.schema` full load for older gateways.                                                                                                           |

## Architecture

### Event Flow (dual-layer)

```
Gateway WebSocket
    │
    ├─ Layer 1 (run-scoped, existing)
    │   "chat"  events → delta/final/error/aborted (streaming text)
    │   "agent" events → tool/lifecycle/thinking (agent activity)
    │   Broadcast to ALL connected clients by runId
    │
    └─ Layer 2 (session-scoped, new)
        "sessions.changed" → session state changes (create/send/steer/abort/message/lifecycle)
        "session.message"  → complete transcript messages
        "session.tool"     → tool events mirrored for late-joining subscribers
        Broadcast ONLY to sessions.subscribe subscribers
    │
    ▼
gateway-adapter.ts (backend, receives both layers)
    │
    ▼
run-event-pipeline.ts (classifies + buffers)
    │
    ├─ "chat"/"agent" → existing SSE event types (unchanged)
    ├─ "sessions.changed" → SSE event type "session-state"
    ├─ "session.message"  → SSE event type "session-msg"
    └─ "session.tool"     → SSE event type "session-tool"
    │
    ▼
EventSource /api/stream (frontend)
    │
    ├─ useChatSSE → dispatches to chat store (streaming, unchanged)
    └─ useSessionEvents (new) → dispatches to sessions store (state updates)
```

### Chat Message Flow (after migration)

```
New session:
  MessageInput → POST /api/chat/sessions/create
    → gatewayRequest("sessions.create", { agentId, message, model? })
    → returns { key, sessionId, entry, runStarted, messageSeq? }
    → store.setActiveSession(key)

Subsequent messages (session idle):
  MessageInput → POST /api/chat/send
    → gatewayRequest("sessions.send", { key, message, thinking?, attachments? })
    → returns { messageSeq, runId, status }

Message during active run (auto-steer):
  MessageInput → POST /api/chat/send { steer: true }
    → gatewayRequest("sessions.steer", { key, message, thinking?, attachments? })
    → returns { messageSeq, runId, interruptedActiveRun: true }

Explicit abort (stop button):
  → gatewayRequest("sessions.abort", { key, runId? })

History load:
  → gatewayRequest("sessions.get", { key, limit })
  Large exports: GET /sessions/{key}/history?limit=1000&cursor=...
```

## Module Design

### Module 0: Infrastructure

**Gateway allowlist** — add to `dashboard/server/gateway-allowlist.ts`:

```
sessions.create, sessions.send, sessions.steer, sessions.abort,
sessions.get, sessions.subscribe, sessions.unsubscribe,
sessions.messages.subscribe, sessions.messages.unsubscribe,
tools.effective, config.schema.lookup
```

**Gateway adapter event subscription** — in `gateway-adapter.ts`, after successful connect:

1. Call `sessions.subscribe` to register for `sessions.changed` events
2. The adapter already receives Layer 1 events via broadcast; Layer 2 events now arrive via subscription

**SSE pipeline extension** — in `run-event-pipeline.ts`:

- Add classification rules for `sessions.changed` → `"session-state"`
- Add classification rules for `session.message` → `"session-msg"`
- Add classification rules for `session.tool` → `"session-tool"`

**TTS compatibility** — search and replace `"edge"` provider references with `"microsoft"` across dashboard code.

**i18n** — pre-register translation keys in `zh.json` and `en.json` for new UI elements.

### Module 1: Chat Core Migration

**Files modified:**

- `dashboard/src/app/api/chat/send/route.ts` — switch from `chat.send` to `sessions.send`/`sessions.steer`
- New: `dashboard/src/app/api/chat/sessions/create/route.ts` — `sessions.create` wrapper
- `dashboard/src/stores/chat.ts` — remove client-side sessionKey generation; accept Gateway-assigned keys
- `dashboard/src/stores/chat-dispatchers.ts` — auto-steer logic (if session.status === "running", set steer flag)
- `dashboard/src/stores/chat-abort.ts` — migrate to `sessions.abort`
- `dashboard/src/components/panels/chat/MessageInput.tsx` — first-message triggers create; subsequent triggers send/steer
- `dashboard/src/components/panels/chat/RunStatusBar.tsx` — lifecycle status from `sessions.changed` events

**Session key generation change:**

- Before: frontend generates `agent:{agentId}:web-{timestamp}-{random}`
- After: Gateway generates `agent:{agentId}:dashboard:{uuid}` via `sessions.create`

**Auto-steer behavior:**

- Frontend checks `sessionState.status === "running"` before sending
- If running → POST with `steer: true` → backend calls `sessions.steer`
- If idle → POST without steer → backend calls `sessions.send`
- No extra UI button; transparent to user

**SessionState type extension:**

```typescript
interface SessionState {
  // existing fields retained...

  // new lifecycle fields
  status: "idle" | "running" | "done" | "failed" | "killed" | "timeout";
  startedAt?: number;
  endedAt?: number;
  runtimeMs?: number;
  fastMode?: boolean;
}
```

**SessionMeta type extension (from sessions.changed snapshots):**

```typescript
interface SessionMeta {
  // existing fields retained...

  status?: string;
  model?: string;
  totalTokens?: number;
  estimatedCostUsd?: number;
  parentSessionKey?: string;
}
```

### Module 2: Sessions Panel Enhancement

**Real-time session list** — `sessions.changed` events drive incremental updates:

- `reason: "create"` → insert new session at list head
- `reason: "send"/"steer"` → update status/updatedAt
- `reason: "abort"` → update status = "killed"
- `reason: "message"` → update token counts/updatedAt
- `phase: "end"/"error"` → update status = "done"/"failed"

Event payload carries full session row snapshot; direct field overwrite, no re-query.
Initial load still uses `sessions.list`; events handle subsequent updates.

**SessionDetail new fields:**

| Field                              | Display                                               | Interaction                            |
| ---------------------------------- | ----------------------------------------------------- | -------------------------------------- |
| `status`                           | Top badge (colored by state)                          | Read-only, real-time                   |
| `startedAt`/`endedAt`/`runtimeMs`  | Time info area                                        | Read-only                              |
| `fastMode`                         | Session config area                                   | Editable toggle via `sessions.patch`   |
| `model`                            | Session config area                                   | Editable dropdown via `sessions.patch` |
| `subagentRole`                     | Subagent info area (hidden for non-subagent sessions) | Read-only                              |
| `subagentControlScope`             | Subagent info area                                    | Read-only                              |
| `spawnedWorkspaceDir`              | Subagent info area                                    | Read-only                              |
| `parentSessionKey`/`childSessions` | Session relationship area                             | Clickable navigation                   |

**ContextHealthBar** — update `contextTokens` from `sessions.changed` events in real-time.

**SessionExport** — use `sessions-history-http` (`GET /sessions/{key}/history?limit=1000&cursor=...`) for paginated export of large sessions.

### Module 3: Agent/Tools Enhancement

**tools.effective integration:**

- New API route: `dashboard/src/app/api/deck/tools-effective/route.ts`
- `deck-agents.ts` store: add `fetchEffectiveTools(agentId, sessionKey?)` action
- `ToolPolicyViz.tsx`: add "Effective Tools" view showing the final tool list after policy filtering
  - Contrasts with existing policy rules view: rules show "how configured", effective shows "what actually works"
  - Groups tools by source, shows allowed/denied status

**Agent sessions real-time tracking:**

- `SessionsTab` in agent detail uses `sessions.changed` events filtered by sessionKey prefix `agent:{agentId}:` for live status updates.

### Module 4: Config Enhancement

**config.schema.lookup integration:**

- New API route: `dashboard/src/app/api/config/schema-lookup/route.ts`
- `config.ts` store: add `lookupSchema(path)` action with in-memory cache
- `SectionNav.tsx`: lazy-load children on node expand via lookup (instead of loading full tree)
- `SchemaForm.tsx`: use `hint` field from lookup response for precise input controls (password fields, enum dropdowns, file path pickers)

**Fallback strategy:**

- Try `config.schema.lookup` first
- If error (old Gateway) → fall back to `config.schema` full load
- Detection: single failed lookup attempt triggers fallback mode for the session

## Module Dependencies

```
Module 0 (Infrastructure)
    ↓ blocks all others
Module 1 (Chat Core) ←── highest priority, most complex
Module 2 (Sessions Panel) ←── depends on Module 0 event subscription
Module 3 (Agent/Tools) ←── independent after Module 0
Module 4 (Config) ←── independent after Module 0
```

Modules 2, 3, 4 can be parallelized after Module 0 + Module 1 complete.

## Upstream API Reference

### sessions.create

- Params: `{ key?, agentId?, label?, model?, parentSessionKey?, task?, message? }`
- Returns: `{ ok, key, sessionId, entry, runStarted, messageSeq?, runError? }`
- Key format: `agent:{agentId}:dashboard:{uuid}` (auto-generated if no key provided)
- Supports initial message via `task` or `message` param (sent via `chat.send` internally)

### sessions.send

- Params: `{ key, message, thinking?, attachments?, timeoutMs?, idempotencyKey? }`
- Returns: `{ messageSeq?, runId?, status?, interruptedActiveRun: false }`
- Does NOT interrupt active runs

### sessions.steer

- Params: same as `sessions.send`
- Returns: same shape, but `interruptedActiveRun` may be `true`
- Interrupts active run first, then sends new message

### sessions.abort

- Params: `{ key, runId? }`
- Returns: `{ ok, abortedRunId, status: "aborted"|"no-active-run" }`

### sessions.subscribe / sessions.unsubscribe

- Params: none (uses connection ID)
- Subscribes to `sessions.changed` events globally

### sessions.messages.subscribe / sessions.messages.unsubscribe

- Params: `{ key }`
- Subscribes to `session.message` events for a specific session

### sessions.get

- Params: `{ key, limit? }` (default limit 200)
- Returns: `{ messages }` — session transcript messages

### tools.effective

- Params: `{ agentId?, sessionKey? }`
- Returns: `{ groups[{ name, tools[{ id, name, allowed, source }] }] }`

### config.schema.lookup

- Params: `{ path }` (e.g. "agents.main.model")
- Returns: `{ path, schema, hint?, children[{ key, path, type, required, hasChildren, hint? }] }`

### Event: sessions.changed

- Trigger: session create/send/steer/abort/message, lifecycle phase changes
- Payload: `{ sessionKey, reason, ts, phase?, ...sessionRowSnapshot }`
- Session row snapshot includes: status, totalTokens, model, estimatedCostUsd, startedAt, endedAt, runtimeMs, etc.

### Event: session.message

- Trigger: complete message written to transcript
- Payload: `{ sessionKey, message, messageId?, messageSeq?, ...sessionRowSnapshot }`

### Event: session.tool

- Trigger: tool lifecycle events, mirrored for session subscribers
- Payload: same as agent tool event, scoped to session subscribers

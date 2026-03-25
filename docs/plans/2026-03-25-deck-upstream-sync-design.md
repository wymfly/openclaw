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

**Prerequisites:**

- Rebase `enhanced` onto latest `upstream/main` — required for `tools.effective` handler (`src/gateway/server-methods/tools-effective.ts` exists upstream but not yet in our branch)
- `sessions.steer` and `sessions.get` have handlers but are not listed in `src/gateway/server-methods-list.ts` BASE_METHODS upstream. They work at runtime (registered via `sessionsHandlers` spread), but may need to be added to BASE_METHODS for method enumeration consistency

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

Subsequent messages (always uses steer — safe for both idle and running):
  MessageInput → POST /api/chat/send
    → gatewayRequest("sessions.steer", { key, message, thinking?, attachments? })
    → returns { messageSeq, runId, status, interruptedActiveRun? }

Explicit abort (stop button):
  → gatewayRequest("sessions.abort", { key, runId? })

History load:
  → gatewayRequest("sessions.get", { key, limit })
  Large exports: GET /sessions/{key}/history?limit=1000&cursor=...
  Cursor format: numeric string (sequence number), pagination moves backward through transcript.
  Supports Accept: text/event-stream for SSE streaming mode.
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
3. **Reconnection**: after WebSocket reconnect, re-issue `sessions.subscribe` and any active `sessions.messages.subscribe` calls (connection ID changes on reconnect, so subscriptions must be re-established). Add a post-connect hook to the adapter's reconnection flow for this.

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
- Backward compatibility: existing sessions with old key format (`web-*`) continue to work — `loadSessionEntry` resolves legacy keys. New sessions use the new format. No migration needed for sidebar entries.

**Auto-steer behavior:**

- **Simplification: always use `sessions.steer`** for all message sends. `sessions.steer` is safe for idle sessions (no-op interrupt on idle, then sends normally). This eliminates the race condition where session status could change between the frontend check and the actual RPC call. The backend route always calls `sessions.steer` regardless of client-side status.
- No extra UI button; transparent to user
- The `interruptedActiveRun` field in the response tells the frontend whether a run was actually interrupted (for optional UI feedback like a toast)

**SessionState type extension:**

```typescript
interface SessionState {
  // existing fields retained...
  // NOTE: current `status: "idle" | "active"` is replaced by the lifecycle enum below.
  // The old `"active"` state maps to `"running"`. Update all consumers accordingly.

  // new lifecycle fields (replaces old 2-value status)
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

| Field                              | Display                                               | Interaction                                             |
| ---------------------------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| `status`                           | Top badge (colored by state)                          | Read-only, real-time                                    |
| `startedAt`/`endedAt`/`runtimeMs`  | Time info area                                        | Read-only                                               |
| `fastMode`                         | Session config area                                   | Editable toggle via `sessions.patch`                    |
| `model`                            | Session config area                                   | Editable dropdown via `sessions.patch`                  |
| `subagentRole`                     | Subagent info area (hidden for non-subagent sessions) | Read-only (loaded via `sessions.list`, not from events) |
| `subagentControlScope`             | Subagent info area                                    | Read-only (loaded via `sessions.list`, not from events) |
| `spawnedWorkspaceDir`              | Subagent info area                                    | Read-only (loaded via `sessions.list`, not from events) |
| `parentSessionKey`/`childSessions` | Session relationship area                             | Clickable navigation                                    |

**Note on subagent fields**: `subagentRole`, `subagentControlScope`, and `spawnedWorkspaceDir` exist on `SessionEntry` but are NOT included in `GatewaySessionRow` or the `sessions.changed` event snapshot. These must be loaded via `sessions.list` (which returns full entries) or by reading the session store directly. They are static after initial set (write-once), so no real-time updates needed.

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

- Params: `{ key, limit? }` (also accepts `sessionKey` as alias for `key`; default limit 200)
- Returns: `{ messages }` — session transcript messages (empty array if session not found, not an error)

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

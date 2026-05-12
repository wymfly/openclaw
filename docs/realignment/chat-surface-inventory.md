# Chat Surface Inventory

> Phase 3 realignment audit. This is a factual inventory of the current chat
> control surface. It does not propose target design or implementation changes.

## Scope

Audited surfaces:

- Gateway RPC methods and event schemas.
- deck-go contracts and generated artifacts.
- deck-go Go BFF routes and runtime adapter calls.
- `frontend-new` chat UI/API/store usage.
- Existing `.local` chat remediation evidence.

Out of scope:

- New `deck.*` RPC design.
- Product target-state brainstorming.
- Code fixes.
- OpenSpec proposal work.

## Gateway RPC Surface

### `chat.*`

Source files:

- `src/gateway/server-methods/chat-method-defs.ts`
- `src/gateway/server-methods/chat.ts`
- `src/gateway/protocol/schema/logs-chat.ts`
- `src/gateway/protocol/schema/logs-chat-extensions.ts`
- `src/gateway/server-methods/chat.module.ts`

Registered in generated module indexes:

- `src/gateway/server-methods/_modules.generated.ts`
- `src/gateway/server-methods/_method-defs.generated.ts`

Public method definitions:

| Method         | Scope | Params schema             | Result schema             | Handler notes                                                                                                                                                                                                                                          |
| -------------- | ----- | ------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `chat.history` | read  | `ChatHistoryParamsSchema` | `ChatHistoryResultSchema` | Loads session entry, reads transcript, strips envelopes/directive tags, canonicalizes transcript blocks, applies byte/char caps, returns `sessionKey`, `sessionId`, `messages`, `thinkingLevel`, `fastMode`, `verboseLevel`.                           |
| `chat.send`    | write | `ChatSendParamsSchema`    | `ChatSendResultSchema`    | Validates message/attachments/provenance, supports `/stop`, idempotency via `chat:<idempotencyKey>`, registers abort controller, responds with start ack, dispatches inbound message asynchronously, emits `chat` events, persists transcript updates. |
| `chat.abort`   | write | `ChatAbortParamsSchema`   | `ChatAbortResultSchema`   | Aborts active run by `runId` or all active runs for `sessionKey`, checks owner/admin authorization, can persist partial assistant text.                                                                                                                |

Unregistered handler:

- `chat.inject` exists in `src/gateway/server-methods/chat.ts` and
  `ChatInjectParamsSchema` exists in `src/gateway/protocol/schema/logs-chat.ts`,
  but `chat.inject` is not present in `chatMethodDefs` in
  `src/gateway/server-methods/chat-method-defs.ts`.

`chat.send` parameter shape:

- `sessionKey`
- `message`
- `thinking`
- `deliver`
- `originatingChannel`
- `originatingTo`
- `originatingAccountId`
- `originatingThreadId`
- `attachments`
- `timeoutMs`
- `systemInputProvenance`
- `systemProvenanceReceipt`
- `idempotencyKey`

`chat` event shape:

- Defined by `ChatEventSchema` in `src/gateway/protocol/schema/logs-chat.ts`.
- Event states: `delta`, `final`, `aborted`, `error`.
- Payload includes `runId`, `sessionKey`, `seq`, optional transcript `message`,
  optional error metadata, optional usage/stop reason, and optional media fields.

### Chat Events

Event registry:

- `src/gateway/event-defs.ts` registers `chat` with `ChatEventSchema`.

Emitters:

- `src/gateway/server-chat.ts` emits streaming `delta`, terminal `final`, and
  `error` events for agent bus runs linked to chat runs.
- `src/gateway/chat-abort.ts` emits `aborted` events.
- `src/gateway/server-methods/chat.ts` emits non-streaming `final`, `error`,
  `chat.side_result`, and injected final messages.
- `src/gateway/server-node-events.ts` maps voice transcript runs to chat run
  IDs by calling `addChatRun`.

Observation:

- `chat.side_result` is emitted by `src/gateway/server-methods/chat.ts` and
  consumed by clients such as `src/tui/tui.ts`, but it is not registered in
  `src/gateway/event-defs.ts`.

### `sessions.*` Chat-Adjacent RPC

Source files:

- `src/gateway/server-methods/sessions-method-defs.ts`
- `src/gateway/server-methods/sessions.ts`
- `src/gateway/protocol/schema/sessions.ts`

Chat-related methods:

| Method                                                                     | Scope       | Relationship to chat                                                                |
| -------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------- |
| `sessions.create`                                                          | write       | Creates session and may call `chat.send` when an initial message is provided.       |
| `sessions.send`                                                            | write       | Wraps `chat.send`, adds session message sequence and session change event handling. |
| `sessions.steer`                                                           | write       | Interrupts active run if needed, then wraps `chat.send`.                            |
| `sessions.abort`                                                           | write       | Wraps `chat.abort` after resolving canonical/active session key.                    |
| `sessions.get`                                                             | read        | Used by deck-go snapshot/detail path to fetch timeline.                             |
| `sessions.list`                                                            | read        | Used by deck-go session list and snapshot metadata.                                 |
| `sessions.preview`                                                         | read        | Used by deck-go sidebar preview overlay.                                            |
| `sessions.reset` / `sessions.clear` / `sessions.delete` / `sessions.patch` | admin       | Used by deck-go session maintenance actions.                                        |
| `sessions.compact` / `sessions.compaction.*`                               | write/admin | Used by deck-go compaction UI/actions.                                              |
| `sessions.messages.subscribe` / `unsubscribe`                              | read        | Used by deck-go session-scoped event subscription control.                          |

### `deck.*` Chat-Adjacent RPC

There is no current `deck.chat.*` Gateway namespace.

Current deck namespace files are under `src/gateway/server-methods/deck/` and
registered by:

- `src/gateway/server-methods/deck.module.ts`
- `src/gateway/server-methods/deck-post-agents.module.ts`
- `src/gateway/server-methods/deck/index.ts`

Chat-adjacent deck methods:

| Method                                                              | Source                                        | Notes                                                                                                                                               |
| ------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deck.commands.discover`                                            | `src/gateway/server-methods/deck/commands.ts` | Discovers built-in chat commands, skill commands for selected agent, and plugin commands.                                                           |
| `deck.threads.list`                                                 | `src/gateway/server-methods/deck/threads.ts`  | Lists persisted Discord thread bindings; marked deprecated/BFF-eligible in method metadata.                                                         |
| `deck.agents.*` preview/detail/eventStreams/toolPolicy/systemPrompt | `src/gateway/server-methods/deck/agents*.ts`  | Not chat RPC, but exposes agent fields that affect chat behavior such as event streams, tool policy, system prompt context, group chat, and skills. |

## deck-go Contract Surface

Contract source files:

- `deck-go/contracts/source/deck-api.contract.ts`
- `deck-go/contracts/source/deck-endpoints.contract.json`
- `deck-go/contracts/source/deck-streams.contract.json`
- `deck-go/contracts/source/deck-mutations.contract.json`
- `deck-go/contracts/source/deck-list-queries.contract.json`
- `deck-go/contracts/source/deck-live-projections.contract.json`
- `deck-go/contracts/source/deck-ui.contract.json`
- `deck-go/contracts/source/deck-api-dynamic-surfaces.contract.json`
- `deck-go/contracts/source/deck-exceptions.contract.json`

Generated artifacts checked by symbol presence:

- `deck-go/contracts/generated/ts/deck-api.generated.ts`
- `deck-go/backend/internal/deckapi/types.generated.go`
- `deck-go/contracts/generated/ts/gateway/protocol.ts`
- `deck-go/contracts/generated/ts/gateway/client.ts`
- `deck-go/backend/internal/gateway/generated/*`

Deck-facing DTOs include:

- `DeckGoChatSessionCreateRequest`
- `DeckGoChatSendRequest`
- `DeckGoChatAbortRequest`
- `DeckGoChatSteerRequest`
- `DeckGoChatSteerResponse`
- `DeckGoSessionCreateResponse`
- `DeckGoSessionSendResponse`
- `DeckGoSessionAbortResponse`
- `DeckGoSessionMutationResponse`
- `DeckGoSessionMeta`
- `DeckGoTranscript*`
- `DeckGoSessionDetailResponse`
- `DeckGoChatSnapshotResponse`
- `DeckGoChatHistoryResponse`
- `DeckGoSessionMessageStreamEvent`
- `DeckGoSessionToolStreamEvent`
- `DeckGoSessionsChangedStreamEvent`
- `DeckGoSessionEventsRequest`
- `DeckGoSessionEventsResponse`
- `DeckGoCompaction*`
- `DeckGoUsageSession*`
- `DeckGoApprovalRequest`
- `DeckGoCanvasBridge*`

Deck-facing endpoint inventory includes:

- `GET /sessions`
- `GET /chat/sessions`
- `POST /chat/sessions/preview`
- `GET /sessions/{sessionKey}`
- `GET /chat/snapshot`
- `GET /chat/history`
- `POST /chat/sessions/create`
- `POST /chat/send`
- `POST /chat/abort`
- `POST /chat/steer`
- session reset/clear/delete/patch
- compact/compaction/session-events/projection
- `POST /deck/canvas`
- `GET /stream`

Mutation inventory includes:

- `chat.session.create`
- `chat.send`
- `chat.abort`
- `chat.steer`
- `chat.session.reset`
- `chat.session.clear`
- `chat.session.delete`
- `chat.session.patch`
- `chat.compact`
- `chat.compaction.branch`
- `chat.compaction.restore`
- `chat.projection.persist`

List/query inventory includes:

- `sessions-list`
- `session-detail`
- `chat-history`
- `usage-sessions`
- `usage-session-logs`

Live projection inventory includes:

- `deck-main` SSE stream.
- `chat-session`, `session-list`, `activity-feed`, `approval-queue`
  projections.
- Chat stream events include `chat`, `agent`, `session.message`,
  `session.tool`, `sessions.changed`, legacy aliases `session-msg`,
  `session-tool`, `session-state`, approvals, `canvas`, `projection.gap`.

Contract observations:

- `deck-go/contracts/source/deck-ui.contract.json` marks the `sessions-chat`
  group as `migrationStatus: "partial"`.
- `deck-go/contracts/source/deck-ui.contract.json` lists chat endpoints but
  omits `POST /api/chat/sessions/create` and `POST /api/chat/steer`, both of
  which are used by frontend API wrappers.
- `deck-go/contracts/source/deck-ui.contract.json` lists
  `GET /api/chat/sessions`, while current frontend list usage includes
  `GET /api/sessions`.
- `sessions.compact` has `DeckGoSessionMutationResponse` in UI metadata, while
  mutation evidence uses `DeckGoCompactionActionResponse`.
- Path notation is mixed across contract sources: some use `/chat/...` and
  `/sessions/...`, while UI/route governance use `/api/chat/...` and
  `/api/sessions/...`.
- Several chat stream payloads are intentionally dynamic, including `chat`,
  `agent`, `canvas`, and `approval.resolved`; `deck-exceptions.contract.json`
  currently has an empty exceptions list.
- Go generation loosens some TS precision: `DeckGoTranscriptBlock` becomes
  `any`, `DeckGoChatCompactionRequest` becomes `map[string]any`, and open index
  signatures such as session patch/activity stream are not represented as
  extra-property maps.

## deck-go BFF Surface

### HTTP Routes

Primary route files:

- `deck-go/backend/internal/server/chat.go`
- `deck-go/backend/internal/server/chat_snapshot.go`
- `deck-go/backend/internal/api/http/admin.go`
- `deck-go/backend/internal/server/stream.go`
- `deck-go/backend/internal/server/session_events.go`
- `deck-go/backend/internal/server/chat_projection.go`

Routes in `deck-go/backend/internal/server/chat.go`:

| HTTP route                    | Runtime call                            | Gateway RPC reached through runtime  |
| ----------------------------- | --------------------------------------- | ------------------------------------ |
| `GET /chat/sessions`          | `managed.ListSessionsWithParams`        | `sessions.list`                      |
| `DELETE /chat/sessions`       | `managed.Delete`                        | `sessions.delete`                    |
| `GET /chat/history`           | `managed.ChatHistory`                   | `chat.history`                       |
| `POST /chat/sessions/preview` | `managed.Preview`                       | `sessions.preview`                   |
| `POST /chat/sessions/reset`   | `managed.Reset`                         | `sessions.reset`                     |
| `POST /chat/sessions/clear`   | `managed.Clear`                         | `sessions.clear`                     |
| `POST /chat/sessions/patch`   | `managed.Patch`                         | `sessions.patch`                     |
| `POST /chat/sessions/create`  | `managed.Create`                        | `sessions.create`                    |
| `POST /chat/send`             | `managed.Send`                          | `sessions.send`                      |
| `POST /chat/abort`            | `managed.Abort`                         | `sessions.abort`                     |
| `POST /chat/compact`          | `managed.Compact`                       | `sessions.compact`                   |
| `POST /chat/compaction`       | `managed.CompactionList/Branch/Restore` | `sessions.compaction.*`              |
| `POST /chat/steer`            | `managed.Steer`                         | `sessions.steer`                     |
| `POST /chat/projection`       | `storeChatProjectionState`              | BFF-local persisted projection state |

Routes in `deck-go/backend/internal/server/chat_snapshot.go`:

- `GET /chat/snapshot` calls `managed.GetTimelineWithParams`, then overlays
  BFF-local A2UI projection state from `loadChatProjectionState`.

Routes in `deck-go/backend/internal/api/http/admin.go`:

- `GET /stream` writes SSE events from `EventStreamProvider`.
- `POST /chat/session-events` subscribes/unsubscribes a Gateway session stream.
- `POST /chat/projection` currently validates `sessionKey` and returns
  `{ok:true}` in the admin route path.
- `GET /chat/snapshot` returns `messages`, `meta`, `activeApproval`,
  `a2uiState`.
- `POST /chat/compaction` delegates to `ChatCompatProvider.RunCompactionAction`.
- `POST /chat/steer` delegates to `ChatCompatProvider.SteerSession`.

### Runtime Adapter

Primary files:

- `deck-go/backend/internal/runtime/openclaw/session_commands.go`
- `deck-go/backend/internal/runtime/openclaw/session_queries.go`
- `deck-go/backend/internal/runtime/openclaw/gateway_queries.go`
- `deck-go/backend/internal/runtime/openclaw/managed_runtime.go`
- `deck-go/backend/internal/gateway/generated/methods.go`
- `deck-go/backend/internal/gateway/generated/types.go`
- `deck-go/backend/internal/gateway/generated/types_extra_2.go`

Runtime calls use generated typed Gateway clients for session/chat methods:

- `SessionQueries.ListSessionsWithParams` -> `typed.SessionsList`.
- `SessionQueries.GetTimelineWithParams` -> `typed.SessionsGet` +
  `typed.SessionsList`.
- `GatewayQueries.ChatHistory` -> `typed.ChatHistory`.
- `SessionCommands.Create` -> `typed.SessionsCreate`.
- `SessionCommands.Send` -> `typed.SessionsSend`.
- `SessionCommands.Abort` -> `typed.SessionsAbort`.
- `SessionCommands.Steer` -> `typed.SessionsSteer`.
- `SessionCommands.Compact` -> `typed.SessionsCompact`.
- `SessionCommands.Compaction*` -> `typed.SessionsCompaction*`.

Observation:

- The BFF `POST /chat/send` path is intentionally routed through
  `sessions.send`, not directly through `chat.send`.
- The BFF `GET /chat/history` path is routed directly through `chat.history`.
- The BFF snapshot path uses `sessions.get` + `sessions.list`, not
  `chat.history`.

## frontend-new Chat Surface

### Entry Points And Components

Source files:

- `deck-go/frontend-new/src/deck-ui/Shell.tsx`
- `deck-go/frontend-new/src/deck-ui/PanelHost.tsx`
- `deck-go/frontend-new/src/components/panels/chat/ChatPanel.tsx`
- `deck-go/frontend-new/src/components/panels/chat/SessionSidebar.tsx`
- `deck-go/frontend-new/src/components/panels/chat/MessageInput.tsx`
- `deck-go/frontend-new/src/components/panels/chat/ChatContextBar.tsx`
- `deck-go/frontend-new/src/components/panels/chat/MessageList.tsx`
- `deck-go/frontend-new/src/components/panels/chat/CanvasPanel.tsx`
- `deck-go/frontend-new/src/components/panels/chat/ChatStreamBridge.tsx`

Current UI behavior:

- `Shell.tsx` mounts `ChatStreamBridge` globally, so chat SSE handling can run
  outside the active chat panel.
- `PanelHost.tsx` renders `ChatPanel` when `activePanel === "chat"`.
- `ChatPanel.tsx` composes session sidebar, run/status bars, context bar,
  transcript search, message list, block filtering, steer dialog, tool progress,
  composer, canvas/artifact drawer.
- `SessionSidebar.tsx` exposes agent/session selection, preview overlay,
  search, rename, delete, and new session entry points.
- `MessageInput.tsx` exposes abort, slash commands, attachments, session
  creation, message send, and optimistic user messages.
- `ChatContextBar.tsx` exposes fast/thinking/usage/send policy/compact/context
  token UI.
- `MessageList.tsx` renders transcript blocks, compaction notices, run metadata,
  partial result, and message actions.
- `CanvasPanel.tsx` and `a2ui-bridge.ts` handle A2UI iframe and postMessage
  bridge behavior.

### Frontend API Usage

Primary API files:

- `deck-go/frontend-new/src/api.ts`
- `deck-go/frontend-new/src/components/panels/chat/chat-api.ts`
- `deck-go/frontend-new/src/data/modules/chat/queries.ts`
- `deck-go/frontend-new/src/data/modules/chat/mutations.ts`
- `deck-go/frontend-new/src/stores/chat.ts`
- `deck-go/frontend-new/src/stores/chat-types.ts`
- `deck-go/frontend-new/src/stores/chat-dispatchers.ts`
- `deck-go/frontend-new/src/components/panels/chat/useChatSSE.ts`

API wrapper surface in `deck-go/frontend-new/src/api.ts` includes:

- `/sessions`
- `/chat/sessions/preview`
- `/sessions/{key}`
- `/chat/snapshot`
- `/chat/history`
- `/chat/sessions/create`
- `/chat/send`
- `/chat/abort`
- `/chat/steer`
- reset/clear/delete/patch/compact/compaction
- `/chat/session-events`
- `/chat/projection`
- `/deck/canvas`
- `/stream`

React Query chat seam:

- `deck-go/frontend-new/src/data/modules/chat/queries.ts` covers snapshot.
- `deck-go/frontend-new/src/data/modules/chat/mutations.ts` covers
  session-events subscription.

Compatibility adapter:

- `deck-go/frontend-new/src/components/panels/chat/chat-api.ts` defines local
  raw response shims and normalizes metadata, preview, and snapshot data.

DTO observations:

- Generated DTO authority is in
  `deck-go/contracts/generated/ts/deck-api.generated.ts`.
- Store-owned view model types are in
  `deck-go/frontend-new/src/stores/chat-types.ts`.
- `a2uiState` is generated as `Record<string, unknown> | null`, while UI casts
  it to local `A2UIState`.
- Attachments UI only allows images and sends
  `attachments?: DeckGoChatAttachment[]`.
- Generated `DeckGoSessionCreateResponse.key` is optional, while
  `chat-api.ts` local `SessionCreateResponse.key` is required; call sites still
  guard against an empty key.

### Stream Handling

Primary files:

- `deck-go/frontend-new/src/components/panels/chat/useChatSSE.ts`
- `deck-go/frontend-new/src/components/panels/chat/ChatStreamBridge.tsx`
- `deck-go/frontend-new/src/stores/chat-dispatchers.ts`
- `deck-go/frontend-new/src/stores/chat.ts`

Current behavior:

- `useChatSSE.ts` calls `deckStream("/api/stream")`.
- It handles reconnect/offline/online, SSE status, and `projection.gap`.
- It dispatches `chat`, `agent`, `session.tool`/`session-tool`,
  `session.message`/`session-msg`, `sessions.changed`/`session-state`,
  approval, canvas, and `projection.gap`.
- `chat-dispatchers.ts` handles chat `delta`, `final`, `error`, `aborted`.
- After `final` or `aborted`, `chat-dispatchers.ts` reloads full content via
  `/api/chat/history` as the authority transcript.

Stream observation:

- `deck-go/contracts/source/deck-live-projections.contract.json` declares
  cursor storage and `gapPolicy: refresh` for the chat-session projection, but
  the current specialized chat SSE path uses direct `/api/stream` handling
  rather than the generic `streamEvents` cursor persistence path.

### Tests Present

Frontend chat tests exist under:

- `deck-go/frontend-new/src/components/panels/chat/__tests__/`
- `deck-go/frontend-new/src/stores/__tests__/chat-store.test.ts`
- `deck-go/frontend-new/src/stores/__tests__/chat-hooks.test.ts`
- `deck-go/frontend-new/src/stores/__tests__/chat-store-sse-status.test.ts`
- `deck-go/frontend-new/src/stores/__tests__/chat-store-slc3.test.ts`
- `deck-go/frontend-new/src/stores/__tests__/chat-abort.test.ts`
- `deck-go/frontend-new/src/stores/__tests__/chat-preferences.test.ts`
- `deck-go/frontend-new/src/deck-ui/PanelHost.chat-route.test.tsx`
- `deck-go/frontend-new/src/deck-ui/chat/chat-host-adapter.test.ts`

## End-To-End Call Chains

### Load Session List

1. Frontend calls `/api/sessions` or `/api/chat/sessions`.
2. BFF route calls `managed.ListSessionsWithParams`.
3. Runtime adapter calls Gateway `sessions.list`.
4. Projection normalizes to `DeckGoSessionMeta`.

Key files:

- `deck-go/frontend-new/src/api.ts`
- `deck-go/backend/internal/server/chat.go`
- `deck-go/backend/internal/runtime/openclaw/session_queries.go`
- `src/gateway/server-methods/sessions.ts`

### Open Snapshot

1. Frontend calls `/api/chat/snapshot?sessionKey=...`.
2. BFF calls `managed.GetTimelineWithParams`.
3. Runtime adapter calls Gateway `sessions.get` and `sessions.list`.
4. BFF overlays local `a2uiState` from chat projection storage.
5. Frontend normalizes into local chat store state.

Key files:

- `deck-go/frontend-new/src/components/panels/chat/chat-api.ts`
- `deck-go/backend/internal/server/chat_snapshot.go`
- `deck-go/backend/internal/runtime/openclaw/session_queries.go`

### Send Message

1. Frontend `MessageInput.tsx` sends through the API wrapper.
2. BFF `POST /chat/send` validates `sessionKey`, message/attachment presence,
   and image-only attachment support.
3. BFF calls `managed.Send`.
4. Runtime adapter calls Gateway `sessions.send`.
5. Gateway `sessions.send` wraps `chat.send`.
6. Gateway `chat.send` dispatches inbound message and emits chat events.
7. Frontend receives SSE events from `/api/stream`.
8. Frontend reloads transcript via `/api/chat/history` after final/abort.

Key files:

- `deck-go/frontend-new/src/components/panels/chat/MessageInput.tsx`
- `deck-go/backend/internal/server/chat.go`
- `deck-go/backend/internal/runtime/openclaw/session_commands.go`
- `src/gateway/server-methods/sessions.ts`
- `src/gateway/server-methods/chat.ts`
- `deck-go/frontend-new/src/components/panels/chat/useChatSSE.ts`
- `deck-go/frontend-new/src/stores/chat-dispatchers.ts`

### Abort Run

1. Frontend sends `POST /api/chat/abort`.
2. BFF calls `managed.Abort`.
3. Runtime adapter calls Gateway `sessions.abort`.
4. Gateway `sessions.abort` resolves abort session key and wraps `chat.abort`.
5. Gateway `chat.abort` emits `chat` aborted event and may persist partials.

Key files:

- `deck-go/frontend-new/src/stores/chat-abort.ts`
- `deck-go/backend/internal/server/chat.go`
- `deck-go/backend/internal/runtime/openclaw/session_commands.go`
- `src/gateway/server-methods/sessions.ts`
- `src/gateway/server-methods/chat.ts`
- `src/gateway/chat-abort.ts`

### Steer Active Run

1. Frontend sends `POST /api/chat/steer`.
2. BFF calls `managed.Steer`.
3. Runtime adapter calls Gateway `sessions.steer`.
4. Gateway interrupts active run if needed, then wraps `chat.send`.

Key files:

- `deck-go/frontend-new/src/components/panels/chat/SteerDialog.tsx`
- `deck-go/backend/internal/server/chat.go`
- `deck-go/backend/internal/runtime/openclaw/session_commands.go`
- `src/gateway/server-methods/sessions.ts`

## Remediation Evidence

Read-only `.local` audit found these chat-specific records:

- `deck-go/.local/chat-remediation-mock-visual/`
- `deck-go/.local/chat-remediation-real-e2e/`
- `deck-go/.local/chat-prototype-remediation-parity-report/`
- `deck-go/.local/chat-sse-bridge-verification/`
- `deck-go/.local/chat-command-real-e2e.log`

Evidence summary:

- `chat-remediation-mock-visual/.last-run.json` reports `passed`.
- `chat-remediation-real-e2e/.last-run.json` reports `passed`.
- Real E2E evidence includes bundled runtime 200, session start 200,
  abort/snapshot/history/preview/subscribe/unsubscribe/stream ok, and UI
  coverage across en/zh and dark/light states.
- `chat-sse-bridge-verification` records repeated gateway/chat navigation
  samples with no visible banner and no console errors.
- `chat-prototype-remediation-parity-report` records chat as
  `ready-for-review`, but the verdict is `unreviewed`.
- `chat-command-real-e2e.log` records an older Chromium/Playwright launch
  permission failure (`Permission denied (1100)` / `kill EPERM`), not a chat
  product assertion failure.

Repeated themes:

- Parity-style evidence can stop at `ready-for-review` / `unreviewed`; it is
  not equivalent to approved parity.
- Later mock visual and real E2E artifacts show passed runs, but older
  environment failures remain in `.local`.

## Observations

These are factual observations from the audit, not proposed fixes.

1. There is no `deck.chat.*` Gateway namespace today. deck-go chat product APIs
   mainly use BFF `/chat/*` routes over generic Gateway `sessions.*` and
   `chat.*` methods.
2. `chat.inject` exists as Gateway handler/schema code but is absent from
   public method metadata, so it is not part of the registered Gateway method
   surface.
3. Frontend, BFF, and contracts all treat chat as broader than raw message
   send: the current surface includes sessions, transcript history, snapshot,
   streaming, compaction, projection state, canvas/A2UI, approval mirror, and
   command discovery.
4. The send path and snapshot path use different Gateway authorities:
   send/abort/steer go through `sessions.*`, history goes through
   `chat.history`, and snapshot/detail goes through `sessions.get` +
   `sessions.list`.
5. Contracts and frontend disagree in several metadata-level places:
   missing `POST /api/chat/sessions/create` and `POST /api/chat/steer` in UI
   metadata, `/api` path notation drift, and `sessions.compact` response type
   drift.
6. Chat stream handling is specialized in frontend code and does not appear to
   use the generic stream cursor persistence path declared by the live
   projection contract.
7. Several stream/message payloads are deliberately dynamic or loosened across
   TS -> Go generation, especially transcript blocks and compaction/projection
   payloads.
8. Existing `.local` evidence suggests the module has passed later mock visual
   and real E2E runs, but prototype parity review was not recorded as approved.

## Phase 4 Inputs

Facts that should inform the next brainstorming phase:

- The current implemented control surface is already a chat/session workbench,
  not only a message composer.
- The minimal vertical slice can choose between at least three existing
  authority paths:
  - `POST /chat/send` -> `sessions.send` -> `chat.send` -> `chat` SSE ->
    `/chat/history`.
  - `POST /chat/sessions/create` -> `sessions.create` -> optional
    `chat.send`.
  - `GET /chat/snapshot` -> `sessions.get` + `sessions.list` -> BFF
    projection overlay.
- Any new `deck.*` RPC would be new surface area; none exists for chat today,
  so Rule R1 must be applied before adding one.

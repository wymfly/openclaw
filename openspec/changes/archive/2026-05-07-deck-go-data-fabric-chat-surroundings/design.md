## Context

The foundation, Agents reference, config/inventory, and live-workbench changes
already mounted Data Fabric and migrated most non-Chat panels. The live
workbench change deliberately excluded Chat because Chat has a specialized SSE
transcript dispatcher, local message reducer, command executor, A2UI/canvas
bridge, and transcript cache.

That exclusion should not leave Chat surrounding reads on ad hoc fetch
lifecycles. Current code truth shows these server-state paths still live outside
Data Fabric:

- `ChatPanel` uses component `useEffect` fetch lifecycles for:
  - session list: `fetchSessionList()` -> `GET /sessions`
  - active snapshot: `fetchChatSnapshot()` -> `GET /chat/snapshot`
  - active subscription selection: `setSessionMessageSubscription()` ->
    `POST /chat/session-events`
- `SessionSidebar` uses component `useEffect` fetch lifecycle for:
  - session previews: `fetchSessionPreviews()` ->
    `POST /chat/sessions/preview`
  - session rename/delete are imperative calls to `POST /chat/sessions/patch`
    and `DELETE /chat/sessions`
- `use-command-discovery` uses raw `deckFetch` against
  `POST /api/deck/commands/discover`, then handles `commands.changed` by
  manually refetching.
- `chat-dispatchers.reloadFullContent()` performs an imperative history
  recovery read from `/api/chat/history?sessionKey=...&limit=5`. That read is
  tied to transcript streaming seam recovery and must remain imperative, but it
  should use the typed API facade rather than constructing a raw fetch path.
- `useChatSSE` owns streaming transcript, agent/tool events, session projection
  events, approval events, canvas bridge events, reconnect recovery, and
  projection-gap recovery. It is not a generic query subscription and remains
  specialized.

### Implementation Baseline Recheck

The following code-truth sources were re-read before production edits:

- Contract sources:
  - `deck-go/contracts/source/deck-api.contract.ts`
  - `deck-go/contracts/source/deck-endpoints.contract.json`
  - `deck-go/contracts/source/deck-list-queries.contract.json`
  - `deck-go/contracts/source/deck-mutations.contract.json`
  - `deck-go/contracts/source/deck-live-projections.contract.json`
  - `deck-go/contracts/source/deck-route-governance.contract.json`
  - `deck-go/contracts/source/deck-streams.contract.json`
- Generated/front-end DTO facades:
  - `deck-go/contracts/generated/ts/deck-api.generated.ts`
  - `deck-go/contracts/generated/ts/gateway/protocol.ts`
  - `deck-go/contracts/generated/ts/deck-live-projections.generated.ts`
  - `deck-go/frontend-new/src/api-types.ts`
- BFF/API facades and current Chat code:
  - `deck-go/frontend-new/src/api.ts`
  - `deck-go/frontend-new/src/components/panels/chat/ChatPanel.tsx`
  - `deck-go/frontend-new/src/components/panels/chat/SessionSidebar.tsx`
  - `deck-go/frontend-new/src/components/panels/chat/chat-api.ts`
  - `deck-go/frontend-new/src/components/panels/chat/useChatSSE.ts`
  - `deck-go/frontend-new/src/hooks/use-command-discovery.ts`
  - `deck-go/frontend-new/src/stores/chat-dispatchers.ts`
- Existing Data Fabric modules:
  - `deck-go/frontend-new/src/data/modules/sessions/`
  - `deck-go/frontend-new/src/data/modules/approvals/`
  - `deck-go/frontend-new/src/data/modules/agents/`
  - `deck-go/frontend-new/src/data/modules/shared.ts`

Exact contract evidence used by this change:

| Area                       | BFF/front-end source                                     | Gateway RPC / contract authority                                                                | Data Fabric owner                                                                        | Freshness                       |
| -------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------- |
| Session list               | `GET /sessions` via `fetchSessions`                      | `sessions.list`; list contract `sessions-list`                                                  | existing `sessions` module                                                               | `live-workbench`                |
| Session previews           | `POST /chat/sessions/preview` via `fetchSessionPreviews` | `sessions.preview`                                                                              | existing `sessions` module                                                               | `lazy-detail`                   |
| Active Chat snapshot       | `GET /chat/snapshot` via `fetchChatSnapshot`             | BFF-shaped session/chat projection; underlying `sessions.get` + `chat.history`/projection state | new `chat` module                                                                        | `stream-driven`                 |
| Chat history recovery      | `GET /chat/history` via `fetchChatHistory`               | `chat.history`; list contract `chat-history`                                                    | existing `sessions` query options for React reads; imperative dispatcher uses API facade | `lazy-detail` / imperative seam |
| Session event subscription | `POST /chat/session-events`                              | stream control endpoint; maps to `sessions.messages.subscribe`/unsubscribe semantics            | new `chat` mutation                                                                      | no retry                        |
| Command discovery          | `POST /deck/commands/discover`                           | `deck.commands.discover` generated Gateway schema                                               | new `commands` module                                                                    | `inventory`                     |
| Command invalidation       | `commands.changed`, `projection.gap`                     | live projection `command-discovery`                                                             | new `commands` projection policy                                                         | refresh                         |
| Chat projection gap        | `chat-session` projection refresh endpoints              | `GET /chat/snapshot`, `GET /sessions`, `POST /chat/session-events`                              | new `chat` projection policy plus existing `useChatSSE` recovery                         | refresh                         |
| Session rename/delete      | `POST /chat/sessions/patch`, `DELETE /chat/sessions`     | mutation contract `chat.session.patch`, `chat.session.delete`; owner `sessions`                 | existing `sessions` mutations                                                            | no retry                        |
| Approvals in Chat          | `GET /approvals/pending`, `POST /approvals` where used   | `approval-queue` projection and approval mutation contracts                                     | existing `approvals` module/store bridge                                                 | live-workbench / no retry       |
| Canvas projection          | `POST /chat/projection`, `POST /deck/canvas`             | Deck-local projection/canvas bridge contracts                                                   | specialized Chat/canvas bridge; not query cache                                          | imperative                      |

## Goals / Non-Goals

**Goals:**

- Add `data/modules/chat` for active snapshot reads, session-event subscription
  mutation, and chat-session projection invalidation helpers.
- Add `data/modules/commands` for command discovery reads and
  `command-discovery` live invalidation.
- Migrate `ChatPanel` to consume `useSessionsListQuery()` and
  `useChatSnapshotQuery()` instead of component-owned fetch effects.
- Migrate `SessionSidebar` to consume `useSessionPreviewsQuery()` and existing
  sessions mutation wrappers for rename/delete while preserving sidebar search,
  collapsed state, edit state, delete confirmation, and local overlay merging.
- Migrate `useCommandDiscovery()` to Data Fabric query data plus registry
  side-effects; command registry remains local UI state, not server-state cache.
- Keep browser traffic behind deck-go backend routes and generated Gateway
  adapters; no direct Gateway browser requests.
- Preserve cached session/snapshot/command data during background refresh
  failures and avoid duplicate fresh reads on panel re-entry.
- Keep real-gateway validation bounded to read paths, run-scoped chat fixtures,
  and current command discovery/command samples.

**Non-Goals:**

- Do not move streaming transcript bytes into TanStack Query.
- Do not rewrite `useChatSSE` into a generic live projection subscriber.
- Do not move message reducer state, active transcript messages, tool progress,
  command execution state, canvas command queue, or artifact panel state into
  Data Fabric.
- Do not change command convergence semantics or add support for unimplemented
  slash commands. Command execution remains the command-convergence surface.
- Do not make automated real E2E perform destructive session reset/clear/delete
  unless the scenario owns a disposable run-scoped session and cleanup proof.
- Do not add mutation retry, offline queue, IndexedDB persistence, custom lint,
  or generated projection patch fields.

## Decisions

### 1. Data Module Shape

Add two module directories:

```text
frontend-new/src/data/modules/chat/
├── keys.ts
├── queries.ts
├── mutations.ts
├── projections.ts
└── index.ts

frontend-new/src/data/modules/commands/
├── keys.ts
├── queries.ts
├── projections.ts
└── index.ts
```

`chat` owns Chat-specific authoritative refresh surfaces. `commands` owns
command registry discovery because command discovery is not Chat-only long term,
even though Chat is the current consumer.

Existing `sessions` module remains the owner for session list, preview, detail,
history, usage, lineage, compaction, and session mutations. This avoids creating
a parallel Chat session cache.

### 2. Freshness

| Read                           | Tier             | Reason                                                                                  |
| ------------------------------ | ---------------- | --------------------------------------------------------------------------------------- |
| `GET /sessions`                | `live-workbench` | session inventory changes through active Chat and other panels                          |
| `POST /chat/sessions/preview`  | `lazy-detail`    | sidebar summary enhancement, not first-class transcript                                 |
| `GET /chat/snapshot`           | `stream-driven`  | stream reducer owns displayed transcript; snapshot is initial/gap authoritative refresh |
| `GET /chat/history`            | `lazy-detail`    | bounded transcript history, used by detail/recovery                                     |
| `POST /deck/commands/discover` | `inventory`      | command registry changes are uncommon and invalidated by `commands.changed`             |

For `stream-driven`, cached snapshot data remains valid until explicit
invalidation from chat-session projection gap, active session change, or manual
recovery. The UI must not refetch identical snapshot data on every panel mount.

### 3. ChatPanel Migration

`ChatPanel` keeps local UI state for block preferences, search, suggested text,
right panel mode, active artifact, and visual seed handling.

Server-state migration:

- Use `useSessionsListQuery({ agentId })` for session list.
- Translate `DeckGoSessionsListResponse.sessions` into store `SessionMeta`
  using exported Chat adapter helpers.
- Use `useChatSnapshotQuery({ sessionKey, agentId })` for active snapshot when:
  - visual-state seed is not active;
  - an active session exists;
  - the active session is not currently streaming.
- Keep the existing transcript cache read/write around active session changes,
  but let snapshot data come from Data Fabric.
- Use `useSessionEventsSubscriptionMutation()` for subscribe/unsubscribe effect
  on active session changes.

The side effects that write Data Fabric query results into the Chat store remain
UI synchronization effects, not server fetch lifecycles.

### 4. SessionSidebar Migration

`SessionSidebar` remains controlled-compatible for tests and visual fixtures.

Server-state migration:

- Use `useSessionPreviewsQuery(keys)` to load preview overlays.
- Translate preview payloads into `SessionPreviewOverlay` with exported Chat
  adapter helpers.
- Use `usePatchSessionMutation()` for rename.
- Use `useDeleteSessionMutation()` for delete.
- On mutation success, keep the existing local store updates so UI state remains
  immediately coherent; the mutation wrapper also invalidates session read
  models.

### 5. Command Discovery Migration

`useCommandDiscovery` becomes a registry adapter over Data Fabric:

- Add `discoverCommands(agentId?)` facade in `src/api.ts`, returning generated
  `DeckCommandsDiscoverResult` from the `POST /deck/commands/discover` route.
- Add `commandsDiscoveryQueryOptions()` and `useCommandsDiscoveryQuery()`.
- Add `useCommandDiscoveryInvalidation()` that subscribes to
  `command-discovery` metadata and invalidates command discovery keys on
  `commands.changed` and `projection.gap`.
- Keep `commandRegistry` as local UI state. A React effect may translate query
  data into registry entries and unregister discovered sources on cleanup, but
  it must not fetch.

### 6. Stream And History Boundary

`useChatSSE` remains specialized. Its gap recovery can continue to call a Chat
refresh helper, but any authoritative Chat snapshot/list reads introduced by
this change should have Data Fabric keys that can be invalidated.

`reloadFullContent()` remains an imperative seam because it runs inside the
stream dispatcher after a message finalizes and must merge authoritative history
text with locally collected tool blocks. It should call the existing
`fetchChatHistory()` API facade instead of constructing a raw `deckFetch` URL.

### 7. Projection Handling

Live projection handling stays invalidation-first:

- `command-discovery` invalidates `commands.discovery(agentId)` on
  `commands.changed` and `projection.gap`.
- `chat-session` invalidates:
  - `chat.snapshot(activeSessionKey, agentId)`
  - `sessions.list(...)`
  - `sessions.previews(keys)`
    according to the touched active session/list context.
- `useChatSSE` may still perform immediate store-level event reduction for
  transcript/tool/canvas/approval events. Data Fabric invalidation is the
  authoritative recovery layer, not the byte-by-byte renderer.

### 8. Verification Strategy

Focused code-level evidence:

- Data module tests for Chat/Commands keys, freshness tiers, command discovery
  cache reuse, snapshot cache reuse, mutation invalidation, and projection
  invalidation.
- Chat component/hook tests:
  - `chat-panel.active-entry`
  - `session-sidebar-rename`
  - `slash-commands` / command discovery-adjacent tests
  - `history-seam-guard`
  - `useChatSSE-visibility`
- Full frontend suite still runs. If unrelated failures remain, record exact
  files/assertions separately.

Browser evidence:

- L4 mock-functional:
  - `chat-visual.spec.ts`
  - optionally `sessions-visual.spec.ts` / `approvals-visual.spec.ts` only if
    shared boundary assertions are touched.
- L5 real Gateway:
  - `chat-real-gateway.spec.ts`
  - `chat-command-real-gateway.spec.ts`
  - real stack startup may circuit-break after two environment/startup failures
    with exact command output and handoff; deterministic checks remain
    mandatory.

## Risks / Trade-offs

- **Chat store synchronization effects remain** -> Acceptable because they
  translate query/cache data into local UI reducer state and do not own fetch
  lifecycles.
- **Command registry is not a React query consumer by itself** -> Keep registry
  local because it includes local commands, priority resolution, visibility, and
  command execution handlers.
- **Snapshot freshness can be too sticky with `stream-driven`** -> Projection
  invalidation and active-session key changes must be tested; manual recovery
  can invalidate query keys if needed.
- **Session mutations can be destructive** -> Automated real E2E must use
  existing run-scoped fixtures or route-shape checks; non-run-scoped deletes
  remain skipped-safe.
- **Full frontend suite has known Chat-adjacent failures from prior work** ->
  Since this change touches Chat, confirmed related failures must be fixed. Only
  failures proven outside this change can be recorded as unrelated.

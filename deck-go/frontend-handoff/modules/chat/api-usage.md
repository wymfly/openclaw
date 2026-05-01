# chat — api-usage

> **⚠️ Reverse-derived artifact.** Endpoints / payloads reconstructed from `chat-api.ts`, `api.ts`, `stream-contract.ts`, `lib/deck-client.ts`. Authoritative shapes live in those files; this doc is a navigation aid.

## Transport

- All requests/SSE go through the typed wrapper in `@/lib/deck-client` (`deckClient.<rpc>` typed methods over `@/lib/deck-transport-core` + `@/lib/deck-ws-transport`)
- HTTP fallback: when WS / SSE not available, REST endpoints below are used directly
- Base URL: relative `/api/...` (deck-go backend at `/api/*`; backend may proxy to upstream Gateway)
- Auth: cookie / token via `@/lib/deck-auth-storage` — out of scope for chat module

---

## Request endpoints

### `GET /api/sessions?agentId=<id>`

**Caller:** `fetchSessionList(agentId?: string)` in `chat-api.ts`
**Purpose:** populate `SessionSidebar` for an agent tab

**Response:**

```ts
type SessionListResponse = {
  sessions: SessionMeta[];
};
type SessionMeta = {
  key: string; // sessionKey, stable
  agentId: string;
  title: string;
  lastMessagePreview: string;
  updatedAt: number; // unix ms
  status: "idle" | "running" | "paused";
  unreadCount?: number;
};
```

### `POST /api/chat/sessions/preview`

**Caller:** `fetchSessionPreviews(keys: string[])`
**Purpose:** bulk overlay (live status, last 1-2 lines of streaming) for sidebar rows

**Request:**

```ts
{ keys: string[] }
```

**Response:**

```ts
type SessionPreviewResponse = {
  overlays: Record<string, SessionPreviewOverlay>;
};
type SessionPreviewOverlay = {
  status: "running" | "idle" | "errored";
  preview?: string; // streaming tail
  badge?: "compaction-soon" | "approval-pending" | null;
};
```

### `GET /api/chat/history?sessionKey=<key>`

**Caller:** `fetchChatSnapshot({ sessionKey })`
**Purpose:** hydrate transcript on session activation

**Response:**

```ts
type ChatSnapshot = {
  sessionKey: string;
  agentId: string;
  messages: ChatMessage[]; // see chat-types.ts
  runMetadata: Record<string, RunMetadata>;
  a2uiState: A2UIState | null;
  activeApproval: ApprovalRequest | null;
};
```

### `POST /api/chat/send`

**Caller:** composer submit + `chat-dispatchers`
**Purpose:** submit user message OR steer OR slash-command

**Request:**

```ts
type SendPayload = {
  sessionKey: string | null; // null = create new
  agentId: string;
  kind: "message" | "steer" | "slash";
  content: ContentBlock[]; // [{ kind: "text", text }, ...] for message
  attachments?: Attachment[];
  slashCommand?: { name: string; args: Record<string, unknown> };
};

type Attachment = {
  kind: "file" | "image";
  path: string; // post-upload path
  name: string;
  size: number;
  mimeType: string;
};
```

**Response:**

```ts
type SendResponse = {
  sessionKey: string; // populated when create-new
  runId: string; // for SSE correlation
  newMessage: ChatMessage; // optimistic echo
};
```

### `POST /api/chat/sessions/patch`

**Caller:** `patchSession(key, patch)`
**Purpose:** rename / archive / pin

**Request:**

```ts
type SessionPatch = {
  sessionKey: string;
  title?: string;
  archived?: boolean;
  pinned?: boolean;
};
```

**Response:** `{ session: SessionMeta }`

### `POST /api/chat/sessions/reset`

**Caller:** `resetChatSession(sessionKey)`
**Purpose:** clear transcript but keep session metadata

**Response:** `SessionMutationResponse = { ok: boolean; session: SessionMeta }`

### `POST /api/chat/sessions/clear`

**Caller:** `clearChatSession(sessionKey)`
**Purpose:** clear transcript AND reset metadata

**Response:** `SessionMutationResponse`

### `POST /api/chat/compact`

**Caller:** `fetchCompactionList(sessionKey)` + compact button
**Purpose:** trigger context compaction

**Request:**

```ts
{ sessionKey: string; checkpointId?: string }
```

**Response:**

```ts
type CompactionResponse = {
  sessionKey: string;
  checkpoints: CompactionCheckpoint[];
  applied: CompactionCheckpoint | null; // when triggering apply
};
```

### `GET /api/canvas/index?sessionKey=<key>`

**Purpose:** list available a2ui surfaces

### `GET /api/canvas/<surfaceId>`

**Purpose:** fetch a single a2ui surface payload

### `POST /api/canvas/preview`

**Request:** `{ surfaceId: string; props: unknown }`
**Purpose:** preview a2ui surface during edit

### `POST /api/media`

**Request:** multipart form with file
**Response:** `{ url: string; path: string; mimeType: string; size: number }`
**Purpose:** upload attachment

### `GET /api/deck/commands/discover?agentId=<id>`

**Caller:** `useCommandDiscovery` hook
**Purpose:** populate `SlashCommandPalette` suggestions

**Response:**

```ts
type CommandDiscovery = {
  commands: CommandDescriptor[];
};
type CommandDescriptor = {
  name: string; // e.g. "compact"
  description: string;
  args: ArgDescriptor[];
  scope: "session" | "global";
};
```

### `POST /api/chat/approval`

**Purpose:** approve / always-approve / deny a pending tool call

**Request:**

```ts
type ApprovalDecision = {
  sessionKey: string;
  approvalId: string; // from ApprovalRequest
  decision: "approve" | "approve-always" | "deny";
};
```

---

## SSE protocol — `GET /api/stream`

**Caller:** `setSessionMessageSubscription({ sessionKey, runId, signal })`
**Purpose:** push events for chat streaming

URL parameters: `sessionKey`, `runId` (optional, resume), `__deck_stream_attempt` (retry counter for transport debugging).

Event types (each `data:` line is JSON):

| Event `type`          | Payload                                     | Effect                                                                    |
| --------------------- | ------------------------------------------- | ------------------------------------------------------------------------- |
| `chunk_text`          | `{ msgId, delta: string, blockIdx }`        | Append text to message's block at `blockIdx`                              |
| `chunk_thinking`      | `{ msgId, delta: string }`                  | Append to thinking block                                                  |
| `tool_use`            | `{ msgId, tool_use_id, toolName, input }`   | Append `tool_use` block                                                   |
| `tool_result`         | `{ msgId, tool_use_id, content, isError }`  | Append matching `tool_result` block                                       |
| `approval_request`    | `ApprovalRequest`                           | Set `activeApproval`; ApprovalDialog opens                                |
| `approval_resolved`   | `{ approvalId, decision }`                  | Clear `activeApproval`                                                    |
| `run_metadata`        | `{ msgId, metadata: Partial<RunMetadata> }` | Update `runMetadata` for the message                                      |
| `run_started`         | `{ runId, sessionKey }`                     | Set `streaming = true`, `runId`                                           |
| `run_complete`        | `{ runId, sessionKey }`                     | Set `streaming = false`, `runId = null`                                   |
| `run_failed`          | `{ runId, error }`                          | Set `streaming = false`, `error`                                          |
| `run_killed`          | `{ runId }`                                 | Set `streaming = false`; banner "运行已被外部终止"                        |
| `session_meta`        | `SessionMeta`                               | Update sidebar (title change, status change, etc.)                        |
| `compaction_progress` | `{ sessionKey, percent }`                   | Update CompactionNotice                                                   |
| `compaction_summary`  | `CompactionSummary`                         | Open `CompactionSummaryModal`                                             |
| `a2ui_event`          | `A2UIEvent`                                 | Apply patch to `a2uiState` (canvas surface update)                        |
| `subagent_event`      | `{ msgId, lineage: SubagentLineageNode[] }` | Update SubagentTree rendering                                             |
| `transport_status`    | `{ status: SSEConnectionStatus }`           | Update `sseStatus` (informational; primary status from connection itself) |

### Reconnection semantics

- Client retries with exponential backoff (`1s`, `2s`, `4s`, `8s`, capped at `30s`)
- On reconnect, server resumes from last seen `runId`; missed chunks replayed
- `__deck_stream_attempt=N` in URL informs server of attempt count for telemetry
- After 3 failed attempts, client falls back to WebSocket transport (`@/lib/deck-ws-transport`)
- `sseStatus` transitions: `connected` → `reconnecting` (during retry) → `connected` (success) | `disconnected` (gave up after 5+ attempts and ws fallback also failed)

---

## Cross-cutting types (referenced above)

```ts
type RunMetadata = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  totalTokens: number;
  startedAt: number;
  finishedAt?: number;
  state: "running" | "complete" | "failed" | "killed";
};

type ApprovalRequest = {
  approvalId: string;
  sessionKey: string;
  msgId: string;
  toolName: string; // e.g. "shell_command"
  toolInput: unknown; // e.g. { command, cwd }
  agentId: string;
  expiresAt?: number; // unix ms
};

type A2UIState = {
  surfaces: SurfaceId[];
  active: SurfaceId | null;
  data: Record<SurfaceId, unknown>;
  status: "idle" | "loading" | "error";
};

type A2UIEvent = {
  surfaceId: SurfaceId;
  patch: Partial<unknown>;
};
```

---

## Error / contract drift handling

If a backend response shape diverges from the types above:

1. **Do not** silently bend the chat code to match. Per protocol-v1 enhancement #5 (后端契约协商), file `frontend-handoff/modules/chat/api-discrepancy.md` documenting the drift
2. The deck-go middleware (`deck-go/backend/internal/api/...`) is the proxy; backend changes should reflect in `deck-go/contracts/` schema and propagate via `make contracts-sync`
3. Contract source of truth: `deck-go/contracts/source/deck-api.contract.ts`

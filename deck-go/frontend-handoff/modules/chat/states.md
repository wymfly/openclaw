# chat — states

> **⚠️ Reverse-derived artifact.** Reconstructed from `frontend-new/src/stores/chat*.ts` + `chat-types.ts`.

## State store shape (`@/stores/chat`)

```ts
type ChatState = {
  // session-scoped state, keyed by sessionKey
  sessions: Map<string, SessionState>;

  // pointer to active session (sidebar selection + transcript focus)
  activeSessionKey: string | null;

  // per-agent session lists (for sidebar agent-tabs)
  sessionMetas: SessionMeta[];

  // SSE connection state — one per app, not per session
  sseStatus: SSEConnectionStatus; // "connected" | "reconnecting" | "disconnected"

  // selected agent for new-session creation + agent-tab filter
  activeAgentId: string | null;

  // per-session preview overlays (from sessionPreview RPC)
  previewOverlays: Map<string, SessionPreviewOverlay>;

  // mutators...
};

type SessionState = {
  messages: ChatMessage[];
  streaming: boolean;
  runId: string | null; // current SSE run identifier
  error: string | null;
  runMetadata: Map<string, RunMetadata>; // keyed by message id
  a2uiState: A2UIState | null; // canvas surface state
  activeApproval: ApprovalRequest | null; // 0|1 approval at a time
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  blocks: ContentBlock[];
  ts: number;
  // metadata fields (token counts, model, etc.) live in runMetadata side-table
};

type ContentBlock =
  | { kind: "text"; text: string }
  | { kind: "tool_use"; toolName: string; input: unknown; tool_use_id: string }
  | { kind: "tool_result"; tool_use_id: string; content: unknown; isError: boolean }
  | { kind: "thinking"; text: string }
  | { kind: "image"; url: string; alt?: string }
  | { kind: "bash_result"; stdout: string; stderr: string; exitCode: number }
  | { kind: "file"; path: string; content?: string }
  | { kind: "unknown"; raw: unknown };

type SSEConnectionStatus = "connected" | "reconnecting" | "disconnected";
```

Cross-module stores referenced by chat:

- `@/stores/agents` — agent list (for AgentTabs + activeAgent badge)
- `@/stores/approvals` — approvals across all panels (chat reads its slice)
- `@/stores/sessions` — global session index (chat-private metas live in `chat.sessionMetas`)
- `@/stores/notifications` — toast queue

## Lifecycle / transitions

### Session lifecycle

```
┌────────────┐  selectSession(key)          ┌──────────────┐
│            │ ─────────────────────────►   │ session       │
│ activeKey  │                               │ activated     │
│  = null    │                               │ (active in    │
│            │ ◄─────── deleteSession        │  sidebar +    │
└────────────┘          (key === active)     │  transcript)  │
                                              └──────┬────────┘
                                                     │ streaming events arrive
                                                     ▼
                                              ┌──────────────┐
                                              │ session       │
                                              │ streaming     │
                                              │ runId set     │
                                              └──────┬────────┘
                                                     │ run_complete | run_failed | run_killed
                                                     ▼
                                              ┌──────────────┐
                                              │ session       │
                                              │ idle          │
                                              │ runId = null  │
                                              └──────────────┘
```

### Streaming substates (per session)

- **idle** → user sends → **streaming** (runId set) → SSE chunks arrive → blocks accumulated
- **streaming** → tool_use chunk → ToolUseCard rendered → tool_result chunk → ToolPair rendered
- **streaming** → approval_request chunk → `activeApproval` set → ApprovalDialog opens
- **streaming** → run_complete | error | killed → **idle** (runId = null, error optionally set)
- **streaming** → user clicks abort → POST abort → SSE close → **idle** (sessionState.error = "aborted")
- **idle** → SSE reconnect with same runId → **streaming** resumed
- **streaming** → SSE timeout / disconnect → status banner shows "reconnecting" → exponential retry → reconnect or drop to "disconnected"

### Approval substate

`activeApproval` is **0 or 1** per session; while set, composer is enabled but **send is gated** by approval prompt. New approval requests during a pending approval queue in the upstream approvals store and surface only when the current one resolves.

- **none** → SSE `approval_request` arrives → **pending** (`activeApproval` set, ApprovalDialog renders)
- **pending** → user clicks 批准 (once) → POST approval → **none** → SSE resumes
- **pending** → user clicks 始终批准 (always) → POST + tool-allowlist update → **none** → SSE resumes
- **pending** → user clicks 拒绝 → POST denial → **none** → SSE may emit run_failed
- **pending** → SSE timeout (~30s) → **none** + warning banner ("approval expired")

---

## Edge cases (must be reproducible)

| Edge case                                                            | Expected behavior                                                                                                                                                          |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Empty session** (just created, no messages yet)                    | `EmptyState` rendered in transcript zone; composer enabled; no SSE attempt until first send                                                                                |
| **Empty session list** (no sessions for selected agent)              | sidebar shows empty banner; "新建会话" prominent                                                                                                                           |
| **History hydration in flight**                                      | transcript shows skeleton blocks; composer disabled; cancel-able                                                                                                           |
| **History hydration fails**                                          | Banner with retry; composer disabled until retry succeeds                                                                                                                  |
| **SSE reconnect mid-stream**                                         | partial stream preserved; on reconnect, server resends from last seen offset; `WaitingDots` stays visible                                                                  |
| **Run killed externally**                                            | SSE emits `run_killed` event → session moves to **idle**; banner: "运行已被外部终止"                                                                                       |
| **Tool result before tool_use** (out-of-order)                       | `ToolPair` renderer matches by `tool_use_id`; renders tool_result alone if no use within 500ms (anomaly indicator)                                                         |
| **Context near full (≥ 90%)**                                        | `CompactionNotice` above composer; "建议压缩或新建会话" link → opens compaction modal                                                                                      |
| **Context overflow (≥ 100%)**                                        | composer disabled; only "压缩" / "新建会话" actions allowed                                                                                                                |
| **Multiple sessions streaming simultaneously** (background sessions) | Only `activeSessionKey` renders transcript; background streaming shown in sidebar by italic title + ActivityDot; switching session takes user to that streaming transcript |
| **Compaction mid-stream**                                            | Disallowed; compact button disabled while `streaming === true`                                                                                                             |
| **Steer during stream**                                              | Steer dialog opens; submitting steer is a `chat/send` with `kind: "steer"` payload — does NOT abort current run; arrives as transcript message annotated 引导              |
| **Slash command palette open + Esc**                                 | palette closes; composer regains focus                                                                                                                                     |
| **Mention popover open + click outside**                             | popover closes via `use-click-outside`                                                                                                                                     |
| **Approval expires before user acts**                                | dialog closes; toast "审批已过期"; SSE may drop to **idle**                                                                                                                |
| **WebSocket fallback when SSE blocked**                              | Transport layer (`deck-ws-transport.ts`) auto-fallbacks; status banner shows "transport: ws"                                                                               |
| **Visual-state seed via URL** (`?deckVisualState=chat-rich`)         | dev mode only; `seedChatVisualState()` populates store with fixture sessions/messages for layout review                                                                    |
| **Visual-state seed empty** (`?deckVisualState=chat-empty`)          | dev mode only; sidebar empty + transcript empty for empty-state design review                                                                                              |

---

## State persistence

- **Sessions metadata** persisted in store via `chat-preferences` adapter (locale storage by sessionKey)
- **Last-active session per agent** persisted (LocalStorage `deck-chat-active-session-<agentId>`)
- **Block-filter preferences** persisted (LocalStorage `deck-chat-block-filter`)
- **Right-panel openness** (canvas / artifact) persisted (LocalStorage `deck-chat-right-panel`)
- **Sidebar collapse state** persisted (LocalStorage `deck-chat-sidebar-collapsed`)
- **Transcripts (messages)** are **session-scoped, not persisted** — re-fetched via `fetchChatSnapshot` on activation

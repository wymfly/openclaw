# agents — api-usage

> Endpoints, payload shapes, and **proposed protocol deltas** vs current `contracts/source/`. Per design scope option (a), shapes below are the **ideal contract** the design assumes; deltas list what must change.

## Transport

- All requests go through `@/lib/deck-client` (typed wrappers over Gateway protocol adapters where available, BFF REST otherwise)
- SSE: `GET /api/stream` (existing chat-shared channel) — agents subscribes a slice via `kind=activity.event`
- Base URL: `/api/...`
- Auth: cookie/token via `@/lib/deck-auth-storage`

---

## Request endpoints

### `gw.agents.list(query)` ← **Δ proposed v2 query params**

**Caller:** `useAgentsList()` hook + bootstrap

**Request (proposed):**

```ts
type AgentsListQuery = {
  search?: string;
  sortBy?: "name" | "lastActive" | "sessions";
  filter?: { status?: "idle" | "busy"; defaultOnly?: boolean };
  cursor?: string;
  limit?: number; // default 50
};
```

**Response:**

```ts
type AgentsListResponse = {
  agents: AgentSummary[];
  nextCursor: string | null;
  totalCount: number; // for list-meta chip "X of Y"
};
```

**Δ vs current contract:** today `gw.agents.list({})` takes empty payload. List is unfiltered & unsorted. **Action:** add the query param shape; backend can ignore unknown keys initially for forward compat.

### `AgentSummary` v2 ← **Δ proposed shape**

**Δ vs current contract:** today's `AgentSummary` is `{ id, name?, model?, ...openExtension }` with `[k: string]: unknown` — UI cannot stably render anything beyond id/name/model.

**Proposed v2:**

```ts
type AgentSummary = {
  id: string;
  name: string; // required (server falls back to id if needed)
  emoji?: string;
  avatar?: string; // image url, takes precedence over emoji when set
  model?: string;
  workspace?: string;
  status: "idle" | "busy";
  isDefault: boolean;
  sessionCount: number;
  bindingCount: number;
  lastActiveAtMs?: number;
  // explicitly: NO [k: string]: unknown — closed shape
};
```

### `GET /agents/{agentId}` ← unchanged

**Caller:** `fetchAgentDetail(id)` on detail nav entry

**Response:**

```ts
type AgentDetailResponse = {
  detail: AgentDetail;
  hashes: AgentConfigHashes; // see Δ below
};
type AgentDetail = AgentSummary & {
  systemPromptOverride?: string;
  identityNotes?: string;
  createdAtMs: number;
  createdBy?: string;
};
```

### `AgentConfigHashes` ← **Δ proposed composite**

**Δ vs current contract:** today skills/subagents/streams each carry a separate `configHash`; UI must thread three different hashes per save. Inconsistencies between surfaces produce half-saved states.

**Proposed:**

```ts
type AgentConfigHashes = {
  skills: string;
  subagents: string;
  eventStreams: string;
  identity: string;
  composite: string; // changes when any of the above changes
};
```

Mutation requests send the relevant per-surface hash; mutation response returns the full new bundle.

### `POST /agents` ← unchanged shape, payload uses v2

**Request:**

```ts
type AgentCreateRequest = {
  name: string;
  emoji?: string;
  model: string;
  workspace: string;
  skillMode: "inherit" | "explicit" | "none"; // ← Δ literal union
  skills?: string[]; // ids; required when skillMode === "explicit"
  allowedAgents?: string[]; // ids
  isDefault?: boolean;
};
```

**Response:** `{ agent: AgentDetail; hashes: AgentConfigHashes }`

### `PATCH /agents/{agentId}`

**Request:**

```ts
type AgentPatch = {
  name?: string;
  emoji?: string;
  model?: string;
  workspace?: string;
  isDefault?: boolean;
  identityHash: string; // optimistic lock
};
```

**Response:** `{ agent: AgentDetail; hashes: AgentConfigHashes }`

### `DELETE /agents?agentId={id}` ← unchanged

**Response:** `{ ok: true; deletedId: string }`

### `GET /agents/{agentId}/files` · `POST /agents/{agentId}/files` · `GET /agents/{agentId}/files/{name}`

```ts
type AgentFile = { name: string; sizeBytes: number; modifiedAtMs: number; mimeType: string };
type AgentFilesResponse = { files: AgentFile[] };
```

Upload is multipart-form. Single-file GET returns the raw bytes with appropriate Content-Type.

### `GET /deck/agents?agentId=X&kind=skills` · `POST /deck/agents` (kind=skills)

**GET response:**

```ts
type SkillsResponse = {
  agentId: string;
  skillMode: "inherit" | "explicit" | "none"; // ← Δ literal union
  skills: Array<{
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    args: Record<string, string | number | boolean> | null;
    argsSchema?: JsonSchema;
  }>;
  configHash: string; // == hashes.skills from AgentConfigHashes
};
```

**POST request:**

```ts
{
  kind: "skills";
  agentId: string;
  skillMode: "inherit" | "explicit" | "none";
  skills: Array<{ id: string; enabled: boolean; args?: Record<string, unknown> }>;
  expectedHash: string; // optimistic lock
}
```

**POST response:** `{ result: SkillsResponse; hashes: AgentConfigHashes }`

### `GET /deck/agents?agentId=X&kind=subagent` · `POST /deck/agents` (kind=subagent)

**GET response (Δ):**

```ts
type SubagentConfigResponse = {
  agentId: string;
  allAgents: Array<{
    id: string;
    name: string;
    emoji?: string;
    model?: string;
    allowed: boolean; // ← Δ replaces `allowedAgents: string[]`
  }>;
  configHash: string;
};
```

**Δ vs current:** today returns `allowedAgents: string[]` AND `allAgents: AgentSummary[]` — two sources of truth for "is X allowed". Collapsing into `allowed` per row removes the redundancy.

### `GET /deck/agents?agentId=X&kind=tool-policy-preview` (read-only)

```ts
type ToolPolicyPreview = {
  agentId: string;
  rules: Array<{
    verb: "allow" | "deny";
    pattern: string;
    source: string; // human-readable, e.g. "agent:main"
    sourcePath?: string; // file/anchor for tooltip, e.g. "/etc/deck/policy.toml#L24"
    layer: "default" | "global" | "workspace" | "agent";
  }>;
  computedAtMs: number;
};
```

### `GET /deck/agents?agentId=X&kind=system-prompt` (read-only)

```ts
type SystemPromptPreview = {
  agentId: string;
  sections: Array<{
    section: string; // markdown heading, e.g. "## Identity"
    body: string;
    source: "default" | "workspace" | "agent";
  }>;
  computedAtMs: number;
};
```

### `GET /deck/agents?agentId=X&kind=event-streams` · `POST /deck/agents` (kind=event-streams)

**GET response:**

```ts
type AgentEventStreamsResponse = {
  agentId: string;
  streams: Array<{ id: string; description: string; subscribed: boolean }>;
  configHash: string;
};
```

**POST request:** `{ kind: "event-streams"; agentId: string; subscribed: string[]; expectedHash: string }`

### `GET /agents/{agentId}/identity` ← unchanged

Reads identity overlay (used internally by the default-flag toggle when it conflicts with another agent's default).

---

## SSE — `activity.event` (slice of `GET /api/stream`)

**Δ vs current contract:** today `activity.event` payload is opaque envelope. UI cannot dispatch on event type without a discriminator.

**Proposed shape:**

```ts
type ActivityEvent =
  | { eventType: "agent.status"; agentId: string; status: "idle" | "busy"; tsMs: number }
  | { eventType: "agent.session-count"; agentId: string; sessionCount: number; tsMs: number }
  | { eventType: "agent.removed"; agentId: string; tsMs: number }
  | { eventType: "agent.health"; agentId: string; snapshot: AgentHealthSnapshot; tsMs: number };

type AgentHealthSnapshot = {
  // ← Δ replaces Record<string, unknown>
  cpuPct?: number;
  memMb?: number;
  pendingApprovals?: number;
  errorCount1m?: number;
  lastErrorMs?: number;
};
```

UI dispatches:

- `agent.status` → update list row dot + detail header dot
- `agent.session-count` → update list row counter
- `agent.removed` → see EC-2 (states.md)
- `agent.health` → reserved for future Activity panel; agents module ignores

---

## Δ summary (recap from README)

| #   | Surface                  | Current                       | Proposed                        | Why                                |
| --- | ------------------------ | ----------------------------- | ------------------------------- | ---------------------------------- |
| 1   | `AgentSummary`           | open extension `[k]: unknown` | closed v2 shape (this doc)      | List UI needs stable fields        |
| 2   | `gw.agents.list`         | empty body                    | search/sortBy/filter/cursor     | Server-side filter for scale       |
| 3   | `configHash` (×3)        | three parallel hashes         | `AgentConfigHashes` composite   | Single dirty/save state            |
| 4   | `skillMode`              | `string`                      | `"inherit"\|"explicit"\|"none"` | Type safety                        |
| 5   | `activity.event`         | opaque envelope               | typed `eventType` discriminator | Dispatch from UI                   |
| 6   | `AgentHealthSnapshot`    | `Record<string, unknown>`     | typed fields                    | Renderable                         |
| 7   | `POST /deck/agents`      | multiplexed by `kind`         | per-kind endpoints (later)      | Test/error simplicity (P2 — defer) |
| 8   | `SubagentConfigResponse` | `allowedAgents` + `allAgents` | `allAgents[].allowed`           | Single source of truth             |

Items 1–6 + 8 are **required** for the design to land cleanly. Item 7 is a P2 cleanup that can be deferred to a follow-up.

## Coordination

When Claude Code begins implementation, it should:

1. Open a contract PR adding the v2 shapes above to `contracts/source/deck-api.contract.ts` (additive, with feature-flag if needed)
2. Run `make contracts-sync` to regenerate TS + Go
3. If backend can't ship v2 immediately, write a thin client-side adapter in `@/lib/agent-config-merge` that synthesizes v2 from current responses (doc'd as a temporary shim with a removal date)

If a backend response shape diverges, file `frontend-handoff/modules/agents/api-discrepancy.md` per protocol-v1 enhancement #5.

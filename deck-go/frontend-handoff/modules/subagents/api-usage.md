# subagents — API usage

> Endpoint truth and DTO shapes are tracked in
> `deck-go/contracts/source/deck-api.contract.ts` and
> `deck-go/contracts/source/deck-endpoints.contract.json`.

## Source of truth

Subagents has TWO concerns layered into one panel:

1. **Runs / lifecycle** — operational live view via `subagents.list`, kill, steer.
2. **Permission config** — per-parent-agent allow-lists via `agents.subagent-config`.

The browser never calls Gateway directly. All flows through the deck-go Go BFF.

## Deck-facing API (runs)

### `GET /api/deck/subagents`

Wrapper: `fetchSubagents()`. Response: `DeckGoSubagentsListResponse`.

Returns recent runs across all sessions. Sort: backend already returns most recent first; the
panel re-sorts to push live runs (`running` / `stalled`) above ended ones.

### `GET /api/deck/subagents/lineage?session=<sessionKey>`

Wrapper: `fetchLineage(sessionKey)`. Response: `DeckGoSubagentsLineageResponse`.

Tree of all spawns rooted at `sessionKey`. Used by the **Lineage** tab.

### `POST /api/deck/subagents/<runId>/kill`

Wrapper: `killSubagent(runId)`. Response: `DeckGoSubagentKillResponse` (`ok`, `runId`,
`childSessionKey`).

Terminates the child session immediately. KillRunDialog drives this.

### `POST /api/deck/subagents/<runId>/steer`

Wrapper: `steerSubagent(runId, message)`. Response: `DeckGoSubagentSteerResponse` (`success`,
`dedupKey`, `deduped?`, `newRunId?`).

Injects a steering hint into the child's next iteration. SteerRunDialog drives this.

## Deck-facing API (permissions)

### `GET /api/deck/agents/<agentId>/subagent-config`

Wrapper: `fetchAgentSubagentConfig(agentId)`. Response: `DeckGoAgentSubagentConfigResponse`.

The panel collects this for every agent that appears as a parent in the runs list, plus any
agent the operator opens via the Permissions list mode.

### `POST /api/deck/agents/<agentId>/subagent-config`

Wrapper: `setAgentSubagentConfig(agentId, partial, prevHash)`. Response:
`DeckGoAgentSubagentConfigSetResponse`.

Mutates the allow-list / allowAny / model. PermissionsDialog drives this. Production should
pass the previous `configHash` for optimistic locking.

## DTO shapes (canonical)

```ts
type DeckGoSubagentRun = {
  runId: string;
  childSessionKey: string;
  childAgentId: string;
  childAgentName?: string;
  requesterSessionKey: string;
  requesterAgentId: string;
  requesterAgentName?: string;
  task?: string;
  label?: string;
  model?: string;
  spawnMode: string; // blocking | background | (open)
  depth: number;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  durationMs?: number;
  status: string; // running | succeeded | failed | killed | stalled | (open)
  outcome?: unknown;
};

type DeckGoSubagentsListResponse = {
  runs: DeckGoSubagentRun[];
  total: number;
};

type DeckGoSubagentLineageRoot = {
  sessionKey: string;
  agentId: string;
  agentName?: string;
};

type DeckGoSubagentLineageNode = {
  runId: string;
  sessionKey: string;
  agentId: string;
  agentName?: string;
  task?: string;
  depth: number;
  parentRunId: string;
  status: string;
  durationMs?: number;
};

type DeckGoSubagentsLineageResponse = {
  root: DeckGoSubagentLineageRoot;
  nodes: DeckGoSubagentLineageNode[];
};

type DeckGoSubagentKillResponse = {
  ok: boolean;
  runId: string;
  childSessionKey: string;
};

type DeckGoSubagentSteerResponse = {
  success: boolean;
  dedupKey?: string;
  deduped?: boolean;
  newRunId?: string;
};

type DeckGoAgentSubagentConfigResponse = {
  agentId?: string;
  allowAgents: string[];
  allowAny?: boolean;
  model?: string;
  effectiveMaxSpawnDepth?: number;
  effectiveMaxChildrenPerAgent?: number;
  effectiveThinking?: unknown;
  allowedAgents?: Array<{ id: string; name?: string }>;
  allAgents?: Array<{ id: string; name?: string }>;
  configHash: string;
};

type DeckGoAgentSubagentPermissionOption = {
  id: string;
  name?: string;
  allowed: boolean;
};

type DeckGoAgentSubagentConfigSetResponse = {
  ok?: boolean;
  agentId?: string;
  allowAgents?: string[];
  model?: string;
  configHash?: string;
};
```

## BFF projections (not part of the contract)

### `audit: SubagentAuditEvent[]`

```ts
interface SubagentAuditEvent {
  ts: number;
  actor: "system" | string;
  event: "spawned" | "started" | "ended" | "kill" | "steer" | string;
  note?: string;
}
```

BFF projection over the BFF mutation log + Gateway lifecycle events. Used by the **Audit** tab.

## Endpoint summary

| Endpoint                                     | Method | When                               | DTO                                    |
| -------------------------------------------- | ------ | ---------------------------------- | -------------------------------------- |
| `/api/deck/subagents`                        | GET    | Runs list                          | `DeckGoSubagentsListResponse`          |
| `/api/deck/subagents/lineage?session=…`      | GET    | Detail Lineage tab                 | `DeckGoSubagentsLineageResponse`       |
| `/api/deck/subagents/<runId>/kill`           | POST   | KillRunDialog confirm              | `DeckGoSubagentKillResponse`           |
| `/api/deck/subagents/<runId>/steer`          | POST   | SteerRunDialog send                | `DeckGoSubagentSteerResponse`          |
| `/api/deck/agents/<agentId>/subagent-config` | GET    | Permissions list / Detail Perm tab | `DeckGoAgentSubagentConfigResponse`    |
| `/api/deck/agents/<agentId>/subagent-config` | POST   | PermissionsDialog save             | `DeckGoAgentSubagentConfigSetResponse` |
| `/api/deck/subagents/<runId>/audit` (BFF)    | GET    | Detail Audit tab                   | `SubagentAuditEvent[]`                 |

## Backend chain

```
SubagentsPanel / subagent helper components
  → frontend-new/src/api/subagents.ts
  → deck-go Go BFF routes
    ├── Gateway RPC subagents.list / lineage / kill / steer
    ├── Gateway RPC agents.subagentConfig.get / set
    └── BFF projection (audit)
  → Gateway (only via the BFF / runtime boundary)
```

## Mock requirements

- 14+ runs covering all 5 statuses (running / succeeded / failed / killed / stalled) and both
  spawn modes (blocking / background) and depth 1 + depth 2.
- Lineage projection for the dominant root session; depth ≥ 2 to demonstrate sibling rendering.
- 3+ parent-agent configs (one with allowAny=false, one with empty allow-list, one with full
  permissive set).
- Audit projection for at least 3 runs covering all event types.

## Open contract assumptions

- **`status` enumeration.** Open per `DeckGoSubagentRun.status: string`. Prototype handles
  `running | succeeded | failed | killed | stalled`. Anything else co-groups under `stalled`
  (warn) or muted.
- **`spawnMode` enumeration.** Open. Prototype handles `blocking | background`. Other values
  fall through with a generic mode-pill render.
- **Stalled detection.** Prototype models `status: "stalled"` as a backend signal. If the
  backend only reports `lastProgressMs`, deck-go frontend computes stalled via a configurable
  threshold (e.g., > 60s no progress).
- **Lineage cross-session jumps.** Prototype loads lineage by `requesterSessionKey`. If a
  child spawns into a different session (recursive subagent in a fresh session), the lineage
  view should follow the cross-session edge — production needs a `lineageMap[childSessionKey]`
  fallback.
- **Permission config write hash.** Prototype omits `prevHash` parameter on save. Production
  must thread it for optimistic locking and retry on hash mismatch (409).
- **Kill cascade.** Prototype kills only the targeted run. Confirm whether backend cascades the
  kill to descendants automatically, or if the operator must walk lineage.
- **Steer dedupKey ergonomics.** Prototype shows server-generated dedupKey. Confirm if the deck
  client may pass one in for client-side idempotency.

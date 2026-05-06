# subagents — API usage

> Code truth is the authority. This handoff records the current contract chain after production
> implementation; future design work must re-check `deck-go/contracts/source/deck-api.contract.ts`,
> `deck-go/contracts/source/deck-endpoints.contract.json`, generated Gateway protocol types, and Go
> BFF routes before changing UI behavior.

## Source of truth

Subagents has two concerns layered into one panel:

1. **Runs / lifecycle** — operational live view via `deck.subagents.list`, lineage, kill, and steer.
2. **Permission config** — per-parent-agent allow-lists via `deck.agents.subagents.get/set`.

The browser never calls OpenClaw Gateway directly. Production routes are deck-go BFF routes, not the
prototype's REST-style paths.

## Deck-facing API (runs)

### `GET /api/deck/subagents`

Wrapper: `fetchSubagentRuns(params)`. Response: `DeckGoSubagentsListResponse`.

Supported query params are `status`, `agentId`, `requesterAgentId`, `limit`, and `offset`.
Current Gateway schema accepts status values: `active | completed | failed | timeout | all`.

### `POST /api/deck/subagents` with `{ action: "lineage", runId? , sessionKey? }`

Wrapper: `fetchSubagentLineage({ runId, sessionKey })`. Response:
`DeckGoSubagentsLineageResponse`.

### `POST /api/deck/subagents` with `{ action: "kill", runId }`

Wrapper: `killSubagentRun(runId)`. Response: `DeckGoSubagentKillResponse`.

This is a destructive live-session mutation. Real E2E treats it as skipped-safe unless a disposable
run fixture exists.

### `POST /api/deck/subagents` with `{ action: "steer", runId, instruction }`

Wrapper: `steerSubagentRun(runId, instruction)`. Response: `DeckGoSubagentSteerResponse`.

The client sends `instruction`; the server may return `dedupKey`, `deduped`, or `newRunId`.
Client-generated dedup keys are not part of the current contract.

## Deck-facing API (permissions)

### `POST /api/deck/agents` with `{ action: "subagents.get", agentId }`

Wrapper: `fetchAgentSubagentConfig(agentId)`. Response:
`DeckGoAgentSubagentConfigResponse`.

### `POST /api/deck/agents` with `{ action: "subagents.set", agentId, allowAgents, model?, baseHash }`

Wrapper: `updateAgentSubagentConfig(agentId, { allowAgents, model, baseHash })`. Response:
`DeckGoAgentSubagentConfigSetResponse`.

Production passes the previous `configHash` as `baseHash`. `allowAny` is represented by
`allowAgents: ["*"]`; there is no separate `allowAny` setter field in the current Gateway schema.

## DTO shapes

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
  spawnMode: string;
  depth: number;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  durationMs?: number;
  status: string;
  outcome?: unknown;
};

type DeckGoSubagentsListResponse = {
  runs: DeckGoSubagentRun[];
  total: number;
};

type DeckGoSubagentsLineageResponse = {
  root: { sessionKey: string; agentId: string; agentName?: string };
  nodes: Array<{
    runId: string;
    sessionKey: string;
    agentId: string;
    agentName?: string;
    task?: string;
    depth: number;
    parentRunId: string;
    status: string;
    durationMs?: number;
  }>;
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
```

## Endpoint summary

| Endpoint/action                    | Method | When                    | DTO                                    |
| ---------------------------------- | ------ | ----------------------- | -------------------------------------- |
| `/api/deck/subagents`              | GET    | Runs list               | `DeckGoSubagentsListResponse`          |
| `/api/deck/subagents` `lineage`    | POST   | Detail Lineage tab      | `DeckGoSubagentsLineageResponse`       |
| `/api/deck/subagents` `kill`       | POST   | Kill dialog confirm     | `DeckGoSubagentKillResponse`           |
| `/api/deck/subagents` `steer`      | POST   | Steer dialog send       | `DeckGoSubagentSteerResponse`          |
| `/api/deck/agents` `subagents.get` | POST   | Permissions list/detail | `DeckGoAgentSubagentConfigResponse`    |
| `/api/deck/agents` `subagents.set` | POST   | Permissions dialog save | `DeckGoAgentSubagentConfigSetResponse` |

## Unsupported prototype assumptions

- `/api/deck/subagents/<runId>/kill` and `/api/deck/subagents/<runId>/steer` are prototype-only route shapes.
- `/api/deck/agents/<agentId>/subagent-config` is prototype-only route shape.
- `/api/deck/subagents/<runId>/audit` is not declared.
- Prototype statuses `running | succeeded | killed | stalled` are visual assumptions. Current Gateway filter schema is `active | completed | failed | timeout | all`; unknown returned status strings render as fallback only.
- Kill cascade, stalled detection, and client-generated steer dedup keys are open product questions.

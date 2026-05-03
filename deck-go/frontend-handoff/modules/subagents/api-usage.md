# subagents api usage

## Browser API facade

Production view code uses these wrappers from `frontend-new/src/api.ts`:

- `fetchSubagentRuns({ status, agentId, requesterAgentId, limit, offset })`
- `fetchSubagentLineage({ runId, sessionKey })`
- `killSubagentRun(runId)`
- `steerSubagentRun(runId, instruction)`
- `fetchAgentsList()`
- `fetchAgentSubagentConfig(agentId)`
- `fetchDeckConfig()`
- `applyDeckConfig(raw, baseHash)`

Do not repeat raw endpoint strings in the panel. Endpoint/action literals belong
in the API facade and tests.

## BFF endpoints

`GET /deck/subagents`

- Query: `status`, `agentId`, `requesterAgentId`, `limit`, `offset`.
- Result: `DeckGoSubagentsListResponse`.
- Deterministic drift to fix in this change: the current BFF forwards
  `status` and `requesterAgentId`, but drops `agentId`, `limit`, and `offset`.

`POST /deck/subagents`

- `{ action: "lineage", runId? , sessionKey? }`
- `{ action: "kill", runId }`
- `{ action: "steer", runId, instruction }`

## Gateway/runtime truth

The Go BFF adapts to:

- `deck.subagents.list`
- `deck.subagents.lineage`
- `deck.subagents.kill`
- `deck.subagents.steer`

The runtime view supports `agentId`, `requesterAgentId`, `status`, `limit`, and
`offset` for list filtering. It builds list and lineage payloads from persisted
subagent runs plus `config.get` and `agents.list` context when upstream direct
data is unavailable.

## Mock visual fixture

The mock Gateway should provide contract-shaped payloads for:

- `deck.subagents.list`
- `deck.subagents.lineage`
- `deck.subagents.kill`
- `deck.subagents.steer`
- `deck.agents.subagents.get`
- `config.get` with `agents.defaults.subagents`

Mock visual evidence is not real Gateway/LLM evidence.

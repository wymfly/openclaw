# Activity API Usage

## Endpoint Chain

| UI need            | Frontend wrapper                        | BFF endpoint                    | Contract source                  |
| ------------------ | --------------------------------------- | ------------------------------- | -------------------------------- |
| Activity feed      | `fetchActivityEvents(limit)`            | `GET /api/activity?limit=100`   | `DeckGoActivityResponse`         |
| Monitor runs       | `fetchMonitorRuns(query)`               | `GET /api/monitor/runs`         | `DeckGoMonitorRunsResponse`      |
| Monitor run detail | `fetchMonitorRunDetail(runId)`          | `GET /api/monitor/runs/{runId}` | `DeckGoMonitorRunDetailResponse` |
| Monitor stats      | `fetchMonitorStats()`                   | `GET /api/monitor/stats`        | `DeckGoMonitorStatsResponse`     |
| Live activity      | `streamEvents()` via `useActivitySSE()` | shared BFF stream               | `activity.event` SSE payload     |

## Request Parameters

### `GET /api/activity`

- `limit`: integer, clamped by backend to a supported range. Production UI currently requests `100`.

### `GET /api/monitor/runs`

- `limit`: integer, production UI uses `50`.
- `agentId`: optional string from run agent filter.
- `sessionKey`: optional string from run session filter.
- `status`: optional `"running" | "completed" | "error"`; omitted for all statuses.
- `since`: optional ISO timestamp derived from time range.
- `until`: optional ISO timestamp; not used by this prototype.
- `cursor`: optional run id cursor for pagination.

## Response Fields Used

### Activity event

- `id`
- `timestamp`
- `type`
- `agentId`
- `agentName`
- `description`
- `details`

Missing optional agent fields render as `System`/`system` or are omitted. The panel must not fabricate a missing agent.

### Monitor run

- `runId`
- `agentId`
- `sessionKey`
- `firstEventAt`
- `lastEventAt`
- `eventCount`
- `status`
- `toolCalls`
- `modelCalls`
- `totalTokens`

### Monitor stats

- `totalRuns`
- `todayRuns`
- `avgDurationMs`
- `topAgents[]` with `agentId` and `runCount`

### Run detail

- `summary` fields drive selected-run metrics.
- `events[]` drives raw event rows and best-effort diagnostics.
- Event `data` is parsed only when it is JSON object text. Raw event rows remain visible because stream-specific payloads are not fully typed.

## SSE Usage

The panel subscribes through `useActivitySSE(onEvent)`. Only `activity.event` payloads with a valid object and event id should be merged. Merge rules:

- drop duplicate event ids before inserting the new event
- sort by newest timestamp first
- keep a bounded recent list
- if no event is selected, select the first available event

## Mock Visual Boundary

Mock visual E2E may use the existing mock Gateway event seeding and BFF projections. Evidence from this package is mock visual coverage, not real Gateway/LLM validation.

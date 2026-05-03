# gateway - api usage

## Source authority

Deck-facing DTO authority lives in:

- `contracts/source/deck-api.contract.ts`
- generated TypeScript: `contracts/generated/ts/deck-api.generated.ts`
- frontend re-exports: `frontend-new/src/api-types.ts`

Gateway protocol authority lives in:

- `contracts/generated/ts/gateway/protocol.ts`
- `backend/internal/gateway/generated/events.go`

Endpoint classification lives in:

- `contracts/source/deck-endpoints.contract.json`

## Frontend wrappers

`GatewayPanel` should continue using:

- `fetchRuntimeGatewayStatus()`
- `fetchCapabilities()` through `useCapabilities()`
- `fetchGatewayHealth()`
- `fetchGatewayStatus()`
- `fetchActivityEvents(limit)`
- `fetchMonitorRuns(params)`
- `fetchMonitorStats()`
- `fetchMonitorRunDetail(runId)`
- `refreshRuntimeSummary()` from `useDeckUI()`

## Backend routes

| UI need                   | Frontend wrapper                              | Deck route                                      | Notes                                       |
| ------------------------- | --------------------------------------------- | ----------------------------------------------- | ------------------------------------------- |
| bootstrap/runtime summary | `useDeckUI()` / `fetchRuntimeGatewayStatus()` | `GET /bootstrap/status`, `GET /runtime/gateway` | Runtime facade truth.                       |
| runtime mode capabilities | `useCapabilities()`                           | `GET /runtime/capabilities`                     | Determines bundled vs remote field set.     |
| Gateway health            | `fetchGatewayHealth()`                        | `GET /gateway/health`                           | BFF diagnostic route over Gateway `health`. |
| Gateway status            | `fetchGatewayStatus()`                        | `GET /gateway/status`                           | BFF diagnostic route over Gateway `status`. |
| activity evidence         | `fetchActivityEvents(20)`                     | `GET /activity?limit=20`                        | Backend projection over event bus.          |
| monitor runs              | `fetchMonitorRuns({ limit: 20 })`             | `GET /monitor/runs?limit=20`                    | Backend projection over event bus.          |
| monitor stats             | `fetchMonitorStats()`                         | `GET /monitor/stats`                            | Backend projection over aggregated runs.    |
| timeline detail           | `fetchMonitorRunDetail(runId)`                | `GET /monitor/runs/{runId}`                     | Backend projection over event bus.          |

## Mock fixture notes

The bundled mock Gateway already provides Gateway RPC methods such as
`health`, `status`, `gateway.describe`, `agents.list`, `channels.status`, and
logs/session helpers. Activity and monitor data are not normal Gateway RPC
responses; they are Deck backend projections over runtime events.

For L1 visual E2E, it is acceptable to seed contract-shaped mock events through
the mock Gateway subscription path so the backend event bus produces:

- activity rows
- monitor runs
- monitor stats
- selected run detail

This is mock visual coverage only. It does not prove real OpenClaw Gateway or
LLM behavior.

## Known uncertainty

- Real Gateway event coverage for every monitor projection is not yet audited in
  this module pass.
- Upstream result schemas for some Gateway health/status shapes remain partial.
- Runtime lifecycle action semantics are intentionally out of scope.

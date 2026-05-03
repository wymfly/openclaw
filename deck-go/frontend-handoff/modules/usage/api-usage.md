# API Usage

## Frontend Wrappers

Use only the existing wrappers from `frontend-new/src/api.ts`:

| Wrapper                         | Endpoint                       | Gateway method              |
| ------------------------------- | ------------------------------ | --------------------------- |
| `fetchModelUsageCost(days)`     | `GET /models/usage/cost?days=` | `usage.cost`                |
| `fetchModelUsageProviders()`    | `GET /models/usage/providers`  | `usage.status`              |
| `fetchUsageSessions(params)`    | `GET /usage/sessions`          | `sessions.usage`            |
| `fetchUsageSessionLogs(params)` | `GET /usage/sessions/logs`     | `sessions.usage.logs`       |
| `fetchUsageTimeseries(params)`  | `GET /usage/timeseries`        | `sessions.usage.timeseries` |

## DTOs

The production UI and mocks should remain shaped by:

- `DeckGoUsageCostResponse`
- `DeckGoUsageProvidersResponse`
- `DeckGoUsageSessionsResponse`
- `DeckGoUsageSessionLogsResponse`
- `DeckGoUsageTimeseriesResponse`
- `DeckGoContextWeightReport`

## Mock Fixture Requirements

The mock Gateway should include:

- at least three cost days with non-zero totals
- at least two providers and three quota windows
- one high-pressure quota window
- at least three sessions across different agents/channels/models
- aggregate daily and model-daily rows
- message/tool/latency behavior signals
- session logs and timeseries for expanded detail
- context-weight evidence for one session

## Drift Handling

Fix deterministic mock/API drift when the contract shape is clear. Do not infer
real Gateway billing, quota reset, session aggregation, or context-weight
semantics from mock data alone.

# usage — API usage (v2)

> Endpoint truth and DTO shapes are tracked in
> `deck-go/contracts/source/deck-api.contract.ts` and
> `deck-go/contracts/source/deck-endpoints.contract.json`.

## Source of truth

The usage module reads cost, providers, sessions, session logs, and per-session
timeseries from the deck-go BFF, which forwards to upstream OpenClaw `usage.*`
Gateway methods. Browser code never calls Gateway directly.

## Deck-facing API

### `GET /api/usage/cost`

Wrapper:

```ts
fetchModelUsageCost(days?: number): Promise<DeckGoUsageCostResponse>
```

Response:

```ts
type DeckGoUsageCostEntry = {
  date: string; // ISO date YYYY-MM-DD
  totalCost?: number; // canonical
  cost?: number; // legacy alias; wrapper normalizes to totalCost
};

type DeckGoUsageCostResponse = {
  updatedAt?: number;
  days?: number; // requested window
  daily: DeckGoUsageCostEntry[];
};
```

The frontend wrapper normalizes legacy `cost` → `totalCost` for backward-compat.
The chart treats either field as the displayed value.

### `GET /api/usage/providers`

Wrapper:

```ts
fetchModelUsageProviders(): Promise<DeckGoUsageProvidersResponse>
```

Response:

```ts
type DeckGoUsageProviderWindow = {
  label: string; // "5h Sonnet" | "Daily GPT-5.5" | etc.
  usedPercent: number; // 0-100
  resetAt?: number; // epoch ms; absent if quota policy unknown
};

type DeckGoUsageProviderStatus = {
  provider: string; // "anthropic" | "openai" | "google" | "local"
  displayName: string;
  plan?: string;
  error?: string; // e.g., "quota.unknown — last sync failed at 14:02"
  windows: DeckGoUsageProviderWindow[];
};

type DeckGoUsageProvidersResponse = {
  updatedAt?: number;
  providers: DeckGoUsageProviderStatus[];
};
```

The UI renders 4 known providers (anthropic / openai / google / local) with
typed icons. Unknown providers fall back to `IconShield`.

### `GET /api/usage/sessions`

Wrapper:

```ts
fetchUsageSessions(opts?: { startDate?: string; endDate?: string; limit?: number; range?: "24h" | "7d" | "14d" | "30d" }): Promise<DeckGoUsageSessionsResponse>
```

Response:

```ts
type DeckGoUsageSessionEntry = {
  key: string; // session row stable key
  label?: string; // human-readable name
  sessionId?: string; // canonical session id
  updatedAt?: number;
  agentId?: string;
  channel?: string;
  usage: { input?: number; output?: number; totalTokens?: number; totalCost?: number } | null;
  contextWeight?: DeckGoContextWeightReport | null;
};

type DeckGoUsageSessionsResponse = {
  updatedAt?: number;
  startDate?: string;
  endDate?: string;
  sessions: DeckGoUsageSessionEntry[];
  totals?: DeckGoUsageTotals;
  aggregates?: {
    byAgent?: DeckGoUsageAggregateEntry[];
    byChannel?: DeckGoUsageAggregateEntry[];
    byModel?: DeckGoUsageAggregateEntry[];
    byProvider?: DeckGoUsageAggregateEntry[];
    daily?: DeckGoUsageDailyAggregate[];
    dailyLatency?: Array<DeckGoUsageLatencyStats & { date: string }>;
    latency?: DeckGoUsageLatencyStats;
    messages?: DeckGoUsageMessageCounts;
    modelDaily?: DeckGoUsageDailyModelAggregate[];
    tools?: DeckGoUsageToolSummary;
  };
};
```

`aggregates` is server-computed. The UI uses:

- `daily[]` for the daily aggregate bars (cost or tokens depending on toggle).
- `latency` for the avg/p95/max stats.
- `messages` for the message count breakdown.
- `tools.tools[]` for the top-tools list.
- `byAgent` / `byChannel` / `byModel` / `byProvider` are reserved for
  future drill-down views (not surfaced in this v2 prototype).

### `GET /api/usage/sessions/logs`

Wrapper:

```ts
fetchUsageSessionLogs(sessionKey: string): Promise<DeckGoUsageSessionLogsResponse>
```

Response:

```ts
type DeckGoUsageSessionLogEntry = {
  timestamp: number;
  role: string; // "system" | "user" | "assistant" | "tool_call" | "tool_result"
  content: string;
  tokens?: number;
  cost?: number;
};

type DeckGoUsageSessionLogsResponse = {
  logs?: DeckGoUsageSessionLogEntry[];
};
```

Lazy-loaded on session selection. UI tolerates missing `tokens` / `cost`
(renders "—").

### `GET /api/usage/timeseries`

Wrapper:

```ts
fetchUsageTimeseries(sessionKey: string): Promise<DeckGoUsageTimeseriesResponse>
```

Response:

```ts
type DeckGoUsageTimePoint = {
  timestamp: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: number;
  cumulativeTokens: number;
  cumulativeCost: number;
};

type DeckGoUsageTimeseriesResponse = {
  sessionId?: string;
  points: DeckGoUsageTimePoint[];
};
```

Lazy-loaded on session selection. Detail Timeseries tab renders the stacked
area + a per-bucket table. Detail Overview also shows a mini cost-trajectory
chart sourced from `cumulativeCost`.

### `GET /api/bootstrap/status`

The usage module reads `bootstrap.ok` to surface the bootstrap pill in
the topbar. Read-only — no action gating (this panel has no mutations).

## DTO shapes (canonical)

```ts
type DeckGoUsageCostEntry = {
  /* see above */
};
type DeckGoUsageCostResponse = {
  /* see above */
};
type DeckGoUsageTotals = {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  totalTokens?: number;
  totalCost?: number;
  [key: string]: unknown;
};
type DeckGoUsageProviderWindow = {
  /* see above */
};
type DeckGoUsageProviderStatus = {
  /* see above */
};
type DeckGoUsageProvidersResponse = {
  /* see above */
};
type DeckGoUsageSessionEntry = {
  /* see above */
};
type DeckGoUsageSessionsResponse = {
  /* see above */
};
type DeckGoUsageSessionLogEntry = {
  /* see above */
};
type DeckGoUsageSessionLogsResponse = {
  /* see above */
};
type DeckGoUsageTimePoint = {
  /* see above */
};
type DeckGoUsageTimeseriesResponse = {
  /* see above */
};
type DeckGoContextWeightReport = {
  /* see above */
};
type DeckGoUsageAggregateEntry = {
  agentId?: string;
  channel?: string;
  model?: string;
  provider?: string;
  totals: DeckGoUsageTotals;
};
type DeckGoUsageMessageCounts = {
  total: number;
  user: number;
  assistant: number;
  toolCalls: number;
  toolResults: number;
  errors: number;
};
type DeckGoUsageToolSummary = {
  totalCalls: number;
  uniqueTools: number;
  tools: Array<{ name: string; count: number }>;
};
type DeckGoUsageLatencyStats = {
  count: number;
  avgMs: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
};
type DeckGoUsageDailyAggregate = {
  date: string;
  tokens: number;
  cost: number;
  messages: number;
  toolCalls: number;
  errors: number;
};
type DeckGoUsageDailyModelAggregate = {
  date: string;
  provider?: string;
  model?: string;
  tokens: number;
  cost: number;
  count: number;
};
```

## BFF projections (not part of the contract)

This panel is contract-pure — no BFF projections beyond what the contract
already exposes. The `aggregates` block on the sessions response IS
contract; the BFF computes it server-side from raw session data.

## Endpoint summary

| Endpoint                   | Method | When                                  | DTO                              |
| -------------------------- | ------ | ------------------------------------- | -------------------------------- |
| `/api/usage/cost`          | GET    | Initial load + Refresh + range change | `DeckGoUsageCostResponse`        |
| `/api/usage/providers`     | GET    | Initial load + Refresh                | `DeckGoUsageProvidersResponse`   |
| `/api/usage/sessions`      | GET    | Initial load + Refresh + range change | `DeckGoUsageSessionsResponse`    |
| `/api/usage/sessions/logs` | GET    | Per-session selection (lazy)          | `DeckGoUsageSessionLogsResponse` |
| `/api/usage/timeseries`    | GET    | Per-session selection (lazy)          | `DeckGoUsageTimeseriesResponse`  |
| `/api/bootstrap/status`    | GET    | Page load + 30s poll                  | `DeckGoBootstrapStatusResponse`  |

## Backend chain

```
UsageApp
  → frontend-new/src/api/usage.ts
  → deck-go Go BFF routes
    ├── deck-go/backend/internal/server/usage.go (cost / providers / sessions / logs / timeseries handlers)
    └── Gateway typed client: usage.cost / usage.status / sessions.usage / sessions.usage.logs / sessions.usage.timeseries
  → Gateway (only via the BFF / runtime boundary)
```

## Mock requirements

- 14 daily cost entries spanning 2026-04-21 → 2026-05-04. At least 1 spike
  (>+10%) and 1 dip (<-10%) to exercise both `vs yesterday` tone variants.
- 4 providers (anthropic/openai/google/local), 1 with `error: "quota.unknown"`
  (google), 1 with no `resetAt` (local "Concurrent slots"). Each provider
  has 1-4 windows covering all 3 status tones (HOT / WARM / OK).
- 8 sessions across 5 agentIds × 6 channels × usage shape variants. At
  minimum:
  - 1 session with full `contextWeight` report (exercises Context tab).
  - 1 session with `usage: null` (exercises "—" cells + no sparkline).
  - 1 system session (`agentId: "system"`) with dashed chip.
  - 1 session per channel kind for filter exercise.
- Per-session lazy fixtures:
  - Logs for 2 sessions (one rich, one minimal).
  - Timeseries (8 points each) for 1 session — exercises stacked area
    - per-bucket table.
- `aggregates.daily[]` covers 7 days. `aggregates.tools.tools[]` has
  ≥ 6 entries. `aggregates.messages.errors > 0` to exercise the error
  count cell.
- `bootstrap.ok === true` by default.

## Stack decisions punted to engineering

- **Chart library**: **`recharts` LOCKED** (see README §Stack decision).
  Engineering replaces hand-rolled SVG primitives with recharts on
  translation.
- **Date-range picker**: production may add a custom range alongside
  the 4 fixed presets. Not blocking.
- **Number formatting**: production should use `Intl.NumberFormat(locale)`
  once the i18n locale layer is wired up.
- **Per-session caching**: production should cache lazy-loaded logs +
  timeseries with `staleTime ≈ 60s`; prototype refetches on each selection.

## Unsupported claims

- Do not claim real billing accuracy.
- Do not claim provider quota policy beyond the contract's
  `usedPercent` + optional `resetAt`.
- Do not claim per-organization or multi-tenant accounting.
- Do not infer model pricing from cost-per-token math; the contract's
  `cost` is server-computed against the active pricing table.

## Open contract assumptions

- **Cost vs token aggregation period** — `cost.daily[]` is fixed-day
  buckets; `aggregates.daily[]` is per-session range. Should the
  contract align these to one canonical period?
- **`provider.error` enum** — currently a free-form string. Should the
  contract enum the known failure modes (`quota.unknown` /
  `auth.invalid` / `rate.exceeded`)?
- **`points[]` granularity** — server-controlled. Should the contract
  enumerate granularity (`minute` / `hour` / `auto`)?
- **`aggregates.byAgent` / `byChannel` / `byModel` / `byProvider` future
  use** — not surfaced in v2. Should the panel grow drill-down views
  (separate OpenSpec change), or do the topbar KPI strip + sessions
  table cover the operator's need?
- **Cost forecast field** — currently absent. Should the contract add
  `projectedTotalCost` so usage and budget can share a "warn-soon"
  signal? See US-013 budget open question §1.
- **`sessions.range` parameter** — the wrapper accepts `range` ∈
  `24h | 7d | 14d | 30d` but the contract endpoint may instead require
  `startDate` + `endDate`. Production wrapper translates range → dates
  client-side; should the contract gain `range` as a first-class
  parameter to keep the BFF/Gateway shape consistent?

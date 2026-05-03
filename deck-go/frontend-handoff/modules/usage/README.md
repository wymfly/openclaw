# usage — high-fidelity handoff (v2)

**Status:** `revised v2 — pending implementation`
**Protocol version:** `protocol-v1`
**Visual target:** [`./prototype.html`](./prototype.html) (multi-file Babel React)
**V1 archive:** [`./prototype-v1-codex.html`](./prototype-v1-codex.html)

`usage/` is the deck-go **cost & quota cockpit** — a single-page operations
dashboard answering: how much are we spending now, which provider quota window
is hot, which sessions explain the spend, and what's driving the context weight
of the agent runs.

The hard rule: this is a **read-only operations panel** built directly on
contract DTOs. No mutations. No marketplace. Range, refresh, session selection,
and tab switching are the only state the user can affect.

## File inventory

| File                      | Purpose                                                                                                                                                                                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prototype.html`          | ~22-line shell loading React + Babel + 6 jsx + 2 css.                                                                                                                                                                                                                      |
| `data.js`                 | Mock fixture: 14d cost trend + 4 providers × N quota windows + 8 sessions × usage + per-session lazy logs/timeseries + bootstrap + label maps.                                                                                                                             |
| `icons.jsx`               | 22+ SVG icons + per-provider icons (Anthropic / OpenAI / Google / Local) + `ProviderPill` + `AgentChip` + `ChannelChip` + `QuotaPill` + chart primitives (`AreaTrend` / `LineSpark` / `BarMini` / `QuotaBar` / `StackedAreaTimeseries` / `ContextWeightBar`) + formatters. |
| `session-table.jsx`       | Sessions list: search + agent / channel filters + 3-mode sort (recent / cost / tokens) + 9-col rows with sparkline.                                                                                                                                                        |
| `session-detail.jsx`      | Right-side drawer with 4 tabs (Overview / Timeseries / Context / Logs) + lazy load (`360-680ms` simulated) + 5% simulated error path.                                                                                                                                      |
| `app.jsx`                 | `UsageApp` orchestrator + topbar (KPI strip + range presets + ⌘K + Refresh) + cost trend section + provider rail + daily aggregate + sessions+detail two-pane row.                                                                                                         |
| `styles.css`              | ~620 lines single-page dashboard + 3 stacked rows + chart primitive CSS + density variants + light theme stub.                                                                                                                                                             |
| `tokens.css`              | Mirror of canonical `--ds-*` tokens.                                                                                                                                                                                                                                       |
| `tweaks-panel.jsx`        | Design-time state knobs (theme/density).                                                                                                                                                                                                                                   |
| `prototype-v1-codex.html` | Original Codex single-file prototype (482 lines).                                                                                                                                                                                                                          |

## Contract truth

```ts
// from deck-go/contracts/source/deck-api.contract.ts
export type DeckGoUsageCostEntry = { date: string; totalCost?: number; cost?: number };
export type DeckGoUsageCostResponse = {
  updatedAt?: number;
  days?: number;
  daily: DeckGoUsageCostEntry[];
};

export type DeckGoUsageProviderWindow = { label: string; usedPercent: number; resetAt?: number };
export type DeckGoUsageProviderStatus = {
  provider: string;
  displayName: string;
  plan?: string;
  error?: string;
  windows: DeckGoUsageProviderWindow[];
};
export type DeckGoUsageProvidersResponse = {
  updatedAt?: number;
  providers: DeckGoUsageProviderStatus[];
};

export type DeckGoUsageSessionEntry = {
  key: string;
  label?: string;
  sessionId?: string;
  updatedAt?: number;
  agentId?: string;
  channel?: string;
  usage: { input?: number; output?: number; totalTokens?: number; totalCost?: number } | null;
  contextWeight?: DeckGoContextWeightReport | null;
};
export type DeckGoUsageSessionsResponse = {
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

export type DeckGoUsageSessionLogEntry = {
  timestamp: number;
  role: string;
  content: string;
  tokens?: number;
  cost?: number;
};
export type DeckGoUsageSessionLogsResponse = { logs?: DeckGoUsageSessionLogEntry[] };

export type DeckGoUsageTimePoint = {
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
export type DeckGoUsageTimeseriesResponse = { sessionId?: string; points: DeckGoUsageTimePoint[] };

export type DeckGoContextWeightReport = {
  source: "run" | "estimate";
  generatedAt: number;
  sessionId?: string;
  provider?: string;
  model?: string;
  workspaceDir?: string;
  systemPrompt: { chars: number; projectContextChars: number; nonProjectContextChars: number };
  injectedWorkspaceFiles: Array<{
    name: string;
    path: string;
    missing: boolean;
    rawChars: number;
    injectedChars: number;
    truncated: boolean;
  }>;
  skills: { promptChars: number; entries: Array<{ name: string; blockChars: number }> };
  tools: {
    listChars: number;
    schemaChars: number;
    entries: Array<{
      name: string;
      summaryChars: number;
      schemaChars: number;
      propertiesCount?: number | null;
    }>;
  };
};
```

Endpoints (read-only):

- `GET /api/usage/cost` → `DeckGoUsageCostResponse`
- `GET /api/usage/providers` → `DeckGoUsageProvidersResponse`
- `GET /api/usage/sessions` → `DeckGoUsageSessionsResponse`
- `GET /api/usage/sessions/logs` → `DeckGoUsageSessionLogsResponse`
- `GET /api/usage/timeseries` → `DeckGoUsageTimeseriesResponse`

## Stack decision: chart library — RECHARTS (LOCKED)

This panel **triggers** the deck-go chart-lib stack decision. The PRD flagged
budget (US-013) as the trigger; budget turned out to be a CSS-only meter panel
with no time-series. Real time-series rendering lives **here** — daily cost
trend, daily aggregates, per-session stacked timeseries, and (future)
per-rule history for budget if added.

**Locked decision:** **`recharts` (v2.x)**.

**Why recharts:**

- Built on D3 internals, shipped as React components — matches our component
  composition idiom.
- Tree-shakeable: per-chart import keeps bundle delta < 90 kB gzipped for the
  4 chart types we need.
- Responsive container, axis tick formatters, tooltip+legend interaction,
  and brush selection all built-in. Hand-rolled SVG (this prototype) does
  none of these.
- Per-series animation, mouseover crosshair, and accessibility (`role="img"` +
  `aria-label`) are first-class.

**Alternatives considered:**

- `visx` — more flexible but more code per chart; over-engineered here.
- `chart.js` — Canvas-based; harder to inspect/test per-element; not React-idiomatic.
- `nivo` — heavier; SVG + Canvas hybrid; unnecessary complexity.
- Hand-rolled SVG (this prototype) — fine for prototype; **not extensible** to
  per-axis legend / responsive container / brush / tooltip / a11y.

**Engineering implementation note:** when translating to
`frontend-new/src/components/panels/usage/`, replace the prototype's `AreaTrend`
/ `LineSpark` / `BarMini` / `StackedAreaTimeseries` with `recharts` equivalents
(`AreaChart` + `Area` / `LineChart` + `Line` / `BarChart` + `Bar` /
`AreaChart` + multiple stacked `Area`). Keep the prototype's `QuotaBar` and
`ContextWeightBar` as plain CSS — they don't need recharts.

The same `recharts` install will serve any future budget-history view (US-013
flagged this in its open questions), gateway throughput chart (US-015), and
activity event-rate sparkline (US-006).

## Section model

```
┌─ Topbar (sticky)
│  ├─ Brand + endpoints hint
│  ├─ KPI strip (cost 14d / vs yesterday / tokens 7d / sessions count)
│  └─ Range presets + bootstrap pill + ⌘K + Refresh
├─ Cost trend (full-width row)
│  ├─ Cost / Tokens segmented toggle
│  └─ AreaTrend chart (1100 × 220, 14 daily points)
├─ Provider quota + Daily aggregate (two-col row)
│  ├─ Provider rail: per-provider card (icon + plan + error badge if quota.unknown)
│  │  └─ Per-window QuotaBar (HOT ≥ 90% / WARM ≥ 60% / OK)
│  └─ Daily aggregate: BarMini + 4-cell def grid (Messages / Latency / Top tools / Token mix)
└─ Sessions table + Session detail drawer (two-col row)
   ├─ SessionTable: search + agent / channel select + 3-mode sort + 9-col rows
   │  └─ Per-row LineSpark (token trajectory derived client-side)
   └─ SessionDetail (when selected): 4 tabs, lazy load with simulated 360-680ms
      ├─ Overview: 4-cell KPI + def grid + cost trajectory mini-area
      ├─ Timeseries: stacked-area (input/output/cache) + per-bucket table (9 cols)
      ├─ Context: ContextWeightBar (4-segment) + system/skills/tools/files breakdowns
      └─ Logs: chronological log list (timestamp / role / content / tokens · cost)
```

## Depends on canonical patterns / icons

`@/design-system/patterns`:

- `PageShell`, `EmptyState`, `KbdHint`, `SectionHeader` (the prototype's
  `SectionHeader` is local; production uses canonical).

`@/design-system/icons`:

- `IconRefresh`, `IconClose`, `IconAlert`, `IconCheck`, `IconCoin`,
  `IconArrowDown`, `IconArrowUp`, `IconSigma`, `IconUser`, `IconUsers`,
  `IconHash`, `IconClock`, `IconBolt`, `IconActivity`, `IconChart`,
  `IconBars`, `IconLayer`, `IconChevronDown`, `IconChevronRight`,
  `IconSearch`, `IconExternal`, `IconShield`, `IconBrain`, `IconWrench`,
  `IconWindow`.

Per-provider icons (`IconAnthropic` / `IconOpenAI` / `IconGoogle` / `IconLocal`)

- `ProviderPill` + `AgentChip` + `ChannelChip` + `QuotaPill` stay local to
  `usage/`. **`ProviderPill` and `QuotaBar` are strong promotion candidates** —
  gateway and channels both surface provider+quota info.

`recharts` lives in `frontend-new/src/lib/charts/` re-exports (production
implementation; not in this prototype).

## How to implement

1. Open `prototype.html` in a static server. Use the Tweaks panel to verify
   theme/density variants. Click sessions, cycle through 4 tabs, hit Refresh.
2. Translate to `frontend-new/src/components/panels/usage/` keeping the
   class-name shape (`usage-app__*`, `provider-card__*`, `quota-bar__*`,
   `session-table__*`, `session-detail__*`).
3. **Replace prototype's hand-rolled SVG charts with `recharts`**:
   - `AreaTrend` → `<AreaChart>` + `<Area>` + `<XAxis>` + `<YAxis>` + `<Tooltip>` + `<CartesianGrid>` + `<ResponsiveContainer>`
   - `BarMini` → `<BarChart>` + `<Bar>`
   - `LineSpark` → `<LineChart>` (no axes, no tooltip; bare sparkline)
   - `StackedAreaTimeseries` → `<AreaChart>` + 3 stacked `<Area stackId="1">` (input / output / cache)
4. Wire real fetcher in `frontend-new/src/api/usage.ts`:
   - `fetchModelUsageCost()` → `GET /api/usage/cost`
   - `fetchModelUsageProviders()` → `GET /api/usage/providers`
   - `fetchUsageSessions(range)` → `GET /api/usage/sessions?range=…`
   - `fetchUsageSessionLogs(sessionKey)` → `GET /api/usage/sessions/logs?key=…`
   - `fetchUsageTimeseries(sessionKey)` → `GET /api/usage/timeseries?key=…`
5. Range refresh drives `cost` + `sessions` queries. `providers` is global
   quota state (refreshed on `Refresh` only, not range).
6. Session detail tabs lazy-load on first selection. `logs` and `timeseries`
   are independent calls.
7. Hardcoded literal strings get extracted to `frontend-new/src/i18n/{en,zh}.json`.

## Stack decisions punted from this panel

- **Date-range picker**: prototype uses 4 fixed presets. Production may want
  custom range (`react-day-picker` / native `<input type="date">`). Not
  blocking; presets cover 95% of operator needs.
- **Tooltip / hover crosshair on charts**: recharts has these built-in;
  prototype uses native `<title>` SVG tooltips. Production should enable
  recharts tooltips on at least the cost trend chart.
- **Number formatting locale**: `formatTokens` and `formatCost` in
  `icons.jsx` are en-US conventions. Production should use
  `Intl.NumberFormat(locale)` once the i18n locale layer lands.

## Unsupported claims

- Do not claim real billing accuracy. The cost numbers are derived from
  Gateway's per-call cost estimates, which depend on provider pricing
  tables that may drift from real billing.
- Do not claim provider quota policy. The contract exposes `usedPercent` +
  optional `resetAt`; reset cadence and overage policy are not surfaced.
- Do not claim per-organization or per-tenant accounting.

## Open questions for follow-up

1. **Cost vs token aggregation period** — `cost.daily` is fixed-day buckets;
   `aggregates.daily` is per-session range. Should the contract align these?
2. **Provider quota policy** — when `error: "quota.unknown"`, the UI hides
   bars and shows the error inline. Should the contract gain a structured
   `errorCode` enum for known failure modes?
3. **Per-session timeseries granularity** — `points[]` granularity is
   server-controlled; the UI assumes ~8 points covers the session. Should
   the contract enumerate granularity (`minute` / `hour` / `auto`)?
4. **Context-weight stability** — `DeckGoContextWeightReport.source` is
   `run | estimate`. The UI shows it inline. Should `estimate` reports be
   surfaced differently (e.g., greyed labels) to manage operator trust?
5. **Cost forecast** — currently absent from the contract. Should the
   contract add `projectedTotalCost` (linear extrapolation against
   period budget rules) so usage and budget can share a "warn-soon"
   signal? See US-013 budget open question §1.

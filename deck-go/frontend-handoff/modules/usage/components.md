# usage — components (v2)

## Tree

```
UsageApp                                          [app.jsx]
├─ Topbar
│  ├─ brand block (eyebrow / title / endpoints hint)
│  ├─ KPI strip: cost-14d / vs-yesterday / tokens-7d / sessions-count
│  └─ actions: range presets · bootstrap pill · ⌘K · Refresh
├─ Cost trend row                                 [app.jsx]
│  ├─ row-head: title + hint + Cost/Tokens segmented toggle
│  └─ AreaTrend chart                             [icons.jsx — chart primitive]
├─ Provider + Aggregate row (two-col)             [app.jsx]
│  ├─ Provider rail
│  │  └─ ProviderCard × N
│  │     ├─ head: ProviderIcon + displayName + plan + error badge
│  │     └─ body: QuotaBar × N
│  └─ Daily aggregate
│     ├─ row-head: title + hint
│     ├─ BarMini × 1                              [icons.jsx]
│     └─ aggregate-def grid (4 cells: Messages / Latency / Top tools / Token mix)
└─ Sessions row (two-col, bottom)                 [app.jsx]
   ├─ SessionTable                                [session-table.jsx]
   │  ├─ filters: search input + agent select + channel select + 3-mode sort
   │  └─ grid (9 cols: session/agent/channel/in/out/total/cost/spark/open)
   └─ SessionDetail                               [session-detail.jsx]
      ├─ head: eyebrow + title + meta + close
      ├─ tab strip: Overview / Timeseries / Context / Logs
      └─ body (4 lazy-loaded sections)
```

## Chart primitives (local, in `icons.jsx`)

| Primitive               | Purpose                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `AreaTrend`             | Single-series filled area chart with grid lines + dot tooltips. Used by cost trend (large) + session detail cost trajectory (mini). |
| `LineSpark`             | Per-row sparkline (no axes / no tooltip). Used in session table token-trend column.                                                 |
| `BarMini`               | Daily aggregate bars with alternate x-axis labels. Used in daily aggregate card.                                                    |
| `QuotaBar`              | Horizontal progress bar with reset countdown footer + tone-coded fill. Used in provider rail.                                       |
| `StackedAreaTimeseries` | 3-layer stacked area (input / output / cache-read) for per-session timeseries tab.                                                  |
| `ContextWeightBar`      | 4-segment proportional bar for system / skills / tools / files chars distribution.                                                  |

**Production**: `recharts` is dependency-gated until explicitly approved. The
current implementation uses existing React/CSS chart primitives and records
tooltip/crosshair/brush fidelity as follow-up. If `recharts` is approved later,
replace `AreaTrend` / `LineSpark` / `BarMini` / `StackedAreaTimeseries` with
`recharts` equivalents (see `README.md` Stack decision). `QuotaBar` and
`ContextWeightBar` stay CSS-only.

## Local molecules

### ProviderPill

`<ProviderPill provider="anthropic" label="Anthropic" />` — color-coded per
provider (anthropic mustard, openai green, google blue, local violet). Inline
`ProviderIcon` + label. Promotion candidate (channels + gateway also surface
provider info).

### ProviderIcon

Resolves per-provider SVG: `IconAnthropic` (anthropic) / `IconOpenAI` (openai) /
`IconGoogle` (google) / `IconLocal` (local) / fallback `IconShield` for unknown.

### AgentChip

`<AgentChip agentId="main" label="Daisy 🌼" />` — color-coded per actor
prefix. `system` agents get a dashed dimmed border.

### ChannelChip

`<ChannelChip channel="cli" label="CLI" />` — terse mono badge with
per-channel tone (telegram / discord / slack / wecom / email / cli).

### QuotaPill

`<QuotaPill percent={92} />` — 3-tone label (HOT ≥ 90% / WARM ≥ 60% / OK)
with percent suffix. Used in QuotaBar head + can stand alone in compact rows.

## Per-section renderers

### Topbar

- **Brand block**: eyebrow + title + endpoints hint (`<code>` chips for the
  3 read endpoints).
- **KPI strip**: 4 cells. `cost-14d` (accent tone) / `vs yesterday` (delta
  with auto-tone: warn ≥ +10%, ok ≤ -10%, neutral) / `tokens-7d` /
  `sessions count`.
- **Actions cluster**: 4 range presets (24h / 7d / 14d default / 30d) +
  bootstrap pill (ok/err) + `⌘K` kbd hint + Refresh button.

### Cost trend

- Single `AreaTrend` chart with 14 daily points, ~1100 × 220.
- Cost / Tokens segmented toggle in row-head; affects the daily aggregate
  bar mode (not the trend chart, which is always cost).
- Hover `<title>` on each dot exposes `MM-DD: $X.XX`.

### Provider rail

- Stacked `ProviderCard` per provider.
- `error` field surfaces an inline error badge (e.g., "quota.unknown — last
  sync failed at 14:02") next to the head.
- `windows[]` rendered as stacked `QuotaBar` rows. Each row: label + percent
  pill (HOT/WARM/OK) + filled track + reset countdown ("resets in 30m" /
  "resets in 4d" / "no reset window known").
- Tone derivation: `usedPercent >= 90 → error`, `>= 60 → warn`, else `ok`.

### Daily aggregate

- `BarMini` for the 7-day daily aggregate (cost or tokens depending on
  segmented toggle in cost-trend row-head).
- 4-cell key/value grid:
  - **Messages**: total + per-role breakdown (user / assistant / toolCalls / errors).
  - **Latency**: avg + p95 + max (from `aggregates.latency`).
  - **Top tools**: top 6 from `aggregates.tools.tools[]` with per-tool count.
  - **Token mix**: input / output / cacheRead / cacheWrite from `totals`.

### Session table

- Filter bar: search + agent select + channel select + 3-button sort
  (recent / cost / tokens).
- 9-col grid: session label+id+relative time / AgentChip / ChannelChip /
  numeric cells (in / out / total / cost) / `LineSpark` / open chevron.
- Row click (or Enter / Space) toggles selection. Active row gets accent
  tinted background.
- Empty state: "No sessions match. Try clearing filters or extending the
  date range."

### Session detail

- 4-tab right-side drawer. Tabs: Overview / Timeseries / Context / Logs.
- Lazy load: 360-680ms simulated delay per session selection. 5% simulated
  error → retry button visible.
- **Overview tab**: 4-cell KPI grid (in / out / total / cost) + 8-row def
  list (sessionId / agent / channel / provider / model / workspace /
  updated / context source) + cost-trajectory mini-AreaTrend.
- **Timeseries tab**: `StackedAreaTimeseries` (640 × 220) + 3-item legend
  - 9-col per-bucket table.
- **Context tab**: `ContextWeightBar` + 4 sub-sections (System / Skills /
  Tools / Files) each with its own def list or inline table.
- **Logs tab**: chronological log list. Per-row: timestamp + role pill
  (5 tones: system/user/assistant/tool_call/tool_result) + content +
  per-row metric (tokens · cost).

## Props (production target)

```ts
type UsageAppProps = {};

type SessionTableProps = {
  sessions: DeckGoUsageSessionEntry[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  agentLabels: Record<string, string>;
  channelLabels: Record<string, string>;
};

type SessionDetailProps = {
  session: DeckGoUsageSessionEntry | null;
  agentLabels: Record<string, string>;
  channelLabels: Record<string, string>;
  modelLabels: Record<string, string>;
  providerLabels: Record<string, string>;
  onClose: () => void;
};

type AreaTrendProps = {
  points: Array<{ x: number; y: number; label?: string }>;
  width?: number;
  height?: number;
  tone?: "accent" | "success" | "warn";
  labelFmt?: (p: { x: number; y: number }) => string;
};

type QuotaBarProps = {
  percent: number;
  label: string;
  resetAt?: number;
};

type ContextWeightBarProps = {
  report: DeckGoContextWeightReport;
};
```

## Class-name intent

| Class                                                   | Purpose                                     |
| ------------------------------------------------------- | ------------------------------------------- |
| `.usage-app`                                            | Top-level vertical layout                   |
| `.usage-app__topbar`                                    | Sticky header with KPI strip                |
| `.usage-app__kpi--*`                                    | Per-tone KPI cell variants (accent/ok/warn) |
| `.usage-app__main`                                      | Stacked rows container                      |
| `.usage-app__row`                                       | Single row container                        |
| `.usage-app__row--two-col`                              | Two-column row variant                      |
| `.usage-app__row--bottom`                               | Sessions+detail row (1.5fr / 1fr)           |
| `.usage-app__trend-card`                                | Cost trend chart card                       |
| `.usage-app__bars`                                      | Daily aggregate bars card                   |
| `.usage-app__aggregate-def`                             | 4-cell key-value grid                       |
| `.area-trend`                                           | Filled area chart container                 |
| `.area-trend__fill / __stroke / __dot`                  | Chart sub-elements                          |
| `.line-spark / __stroke`                                | Sparkline                                   |
| `.bar-mini / __bar`                                     | Bar chart + bar element                     |
| `.chart-grid / .chart-tick`                             | Grid lines + axis tick text                 |
| `.quota-bar`                                            | Provider quota bar molecule                 |
| `.quota-bar__track--*`                                  | Per-tone fill track variants                |
| `.quota-pill--*`                                        | Per-tone status pill variants               |
| `.provider-rail__list`                                  | Stacked provider cards container            |
| `.provider-card`                                        | Per-provider card                           |
| `.provider-card__err`                                   | Inline quota.unknown error badge            |
| `.session-table`                                        | Sessions list section                       |
| `.session-table__grid`                                  | 9-col table                                 |
| `.session-row--on`                                      | Active row highlight                        |
| `.session-detail`                                       | Right-side drawer container                 |
| `.session-detail--empty`                                | "Pick a session" placeholder                |
| `.session-detail__tabs / __tab--on`                     | 4-tab strip                                 |
| `.kpi-cell`                                             | 4-cell KPI grid sub-cell                    |
| `.ctx-bar / __seg / __sw`                               | Context-weight 4-segment bar                |
| `.stacked-area / .stacked-area__layer--*`               | Stacked timeseries layers                   |
| `.log-row__role--*`                                     | Per-role log pill tones                     |
| `.provider-pill--* / .agent-chip--* / .channel-chip--*` | Per-domain chip tone variants               |

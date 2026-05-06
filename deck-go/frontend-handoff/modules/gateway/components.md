# gateway — components (v2)

## Production delta

`frontend-new/src/components/panels/gateway/GatewayPanel.tsx` implements the v2
structure as one React component file with local helper components. The batch
composer is inline rather than modal, and throughput uses inline SVG bars
instead of adding a chart dependency. Code truth remains the source authority;
this handoff describes the target structure and known prototype differences.

## Tree

```
GatewayApp                                        [app.jsx]
├─ Topbar (sticky)
│  ├─ brand block (eyebrow / title / runtime/heartbeat/ts subtitle)
│  ├─ health pill (OK/DOWN) + state pill + bootstrap pill
│  └─ Refresh button
├─ Hero card                                      [app.jsx]
│  ├─ 4-cell KPI grid (Sessions / Channels conn/total / Agents heartbeating / Health probe ms)
│  └─ 2 rails (two-col)
│     ├─ Channel summary rail
│     │  └─ ChannelPill × N (ConnDot + label + last-seen relative)
│     └─ Heartbeat agents rail
│        └─ AgentPill × N (agentId + every X + sessions count)
├─ Throughput card                                [app.jsx]
│  └─ 4-cell grid
│     ├─ Requests/min (count + SparkBar)          [icons.jsx — chart primitive]
│     ├─ Error rate % (count + SparkBar)
│     ├─ Latency p95 ms (count + SparkLine)
│     └─ Queued events (count + top-4 list)
└─ Tabs section                                   [app.jsx]
   ├─ tab strip (Methods & Events / Batch console / Activity)
   └─ tab body
      ├─ DescribeExplorer                         [describe-explorer.jsx]
      │  ├─ controls (mode tabs / search / scope filter)
      │  ├─ split-pane (filtered list + detail JSON)
      │  └─ untyped methods footer
      ├─ BatchConsole                             [batch-console.jsx]
      │  ├─ head (availability status + route/safety hint)
      │  ├─ batch rows (expandable per-call table)
      │  └─ inline read-only composer
      └─ ActivityList                             [app.jsx — local]
         └─ activity rows (ts / when / actor / method / status / meta)
```

## Local molecules

Prototype molecules live in `icons.jsx`; production equivalents are local to
`GatewayPanel.tsx` in this pass.

### ScopePill

`<ScopePill scope="operator.read" />` — color-coded per auth scope:

- `operator.read` → success (green)
- `operator.write` → warn (amber)
- `system` → neutral
- unknown / missing → dashed neutral

Strong promotion candidate — api-explorer (US-019), plugins (US-003)
both surface per-method scope.

### SinceTag

`<SinceTag since={3} />` → mono `v3` chip. Indicates the contract version
this method/event was introduced.

### ConnDot

`<ConnDot connected={true} />` — filled green dot with halo (connected) or
solid red dot (disconnected). 8px circle.

### SparkBar

Tiny bar sparkline (no axes, no tooltip). 240×36 default. Tones: accent /
ok / warn. Used for requests/min and error rate.

### SparkLine

Tiny line sparkline (no axes, no tooltip). 240×36 default. Used for
latency p95 trend.

Production currently renders compact inline SVG bars only; no shared chart
primitive is introduced.

## Per-section renderers

### Topbar

- Brand block (eyebrow + title + runtime version + heartbeat seconds + ts).
- Health pill: green OK / red DOWN with heart icon. Reflects
  `health.ok`.
- State pill: shows `status.state` (e.g., `running` / `stopped` /
  `degraded`).
- Bootstrap pill: ok = neutral; not-ready = error tone.
- Refresh button: refetches health + status.

### Hero

- 4-cell KPI grid:
  - **Sessions**: total session count + default model hint.
  - **Channels**: connected / total fraction.
  - **Agents heartbeating**: enabled / total fraction.
  - **Health probe**: `formatMs(durationMs)` of the last probe.
- 2 rails:
  - **Channel summary**: per-channel pill with ConnDot + label +
    last-seen relative. Disconnected channels get dashed border + reduced
    opacity. Link channel info in rail head (`label`, `authAgeMs`).
  - **Heartbeat agents**: per-agent pill with strong agentId + every-X +
    sessions count. Disabled agents get dashed border + reduced opacity.
    Default agent shown in rail head.

### Throughput

- 4-cell grid (BFF-projected, flagged in api-usage.md):
  - **Requests / min**: total + SparkBar over last 30m.
  - **Error rate**: percentage + SparkBar (tone shifts to warn if > 1%).
  - **Latency p95**: avg ms + SparkLine.
  - **Queued events**: count + top-4 event names (from
    `status.queuedSystemEvents`).

### Methods & Events tab (DescribeExplorer)

- Controls bar:
  - Mode segmented control (Methods / Events) with counts.
  - Search input (live filter on name + scope).
  - Scope filter (all / read / write / system) — only visible in
    Methods mode.
- Split-pane:
  - Left: filtered list. Per-row: monospace name + ScopePill (or event
    tag) + SinceTag.
  - Right: detail card with name + scope/event tag + 3 collapsible JSON
    sections (params / result / payload). "No schema published"
    fallback if all 3 absent.
- Untyped footer: when `describe.untyped` is non-empty, lists method
  names with a "use with caution" note.

### Batch console tab

- Head: title, safety hint, and available/locked status pill.
- Batch list: per-batch row with chevron + id + runtimeId + calls count
  - ok/err stat pills + duration + relative time. Click to expand.
- Expanded row body: options dump + per-call table (id / method / params
  / status pill / result-or-error). Failed rows show retryable hint
  inline.
- Inline composer:
  - One or more calls with method select and JSON params textarea.
  - Methods come from `gateway.describe`, filtered to read-only entries and
    excluding nested batch/subscription methods.
  - Submit calls `submitGatewayBatch(req, { runtimeId: "rt_local" })`.
  - Remote mode and unconfigured/no-safe-method states lock the composer.

### Activity tab (ActivityList)

- 6-col activity rows (BFF-projected audit log):
  - timestamp (mono) / relative when / actor (operator/system/automation)
    / method (mono) / status pill (ok/err) / meta (JSON-stringified).
- Failed rows get tinted background.

## Props (production target)

```ts
type GatewayAppProps = {};

type DescribeExplorerProps = {
  describeResp: DeckGoGatewayDescribeResponse;
};

type BatchConsoleProps = {
  recentBatches: Array<
    DeckGoGatewayBatchResponse & {
      requestedAt: number;
      durationMs: number;
      options?: DeckGoGatewayBatchOptions;
      calls: DeckGoGatewayBatchCall[];
    }
  >;
  safeMethods: DeckGoGatewayDescribeMethod[];
  runtimeMode: string;
  canSubmit: boolean;
};

type ActivityListProps = {
  entries: Array<{
    ts: number;
    actor: string;
    method: string;
    ok: boolean;
    meta?: Record<string, unknown>;
  }>;
};

type ScopePillProps = { scope?: string };
type SinceTagProps = { since?: number };
type ConnDotProps = { connected: boolean };
type SparkBarProps = {
  values: number[];
  width?: number;
  height?: number;
  tone?: "accent" | "ok" | "warn";
};
type SparkLineProps = { values: number[]; width?: number; height?: number; tone?: "accent" };
```

## Class-name intent

| Class                                | Purpose                                         |
| ------------------------------------ | ----------------------------------------------- |
| `.gateway-app`                       | Top-level vertical layout                       |
| `.gateway-app__topbar`               | Sticky header with health+state+bootstrap pills |
| `.gateway-app__health-pill--*`       | Per-tone health badge variants                  |
| `.gateway-app__hero`                 | Hero card with KPI + rails                      |
| `.gateway-app__kpi-grid`             | 4-cell KPI grid                                 |
| `.kpi-cell--accent`                  | Accent-tinted primary KPI                       |
| `.gateway-app__hero-rails`           | Two-col rails container                         |
| `.hero-rail`                         | Single rail (channels OR agents)                |
| `.channel-pill / --on / --off`       | Channel summary chip variants                   |
| `.agent-pill / --on / --off`         | Heartbeat agent chip variants                   |
| `.conn-dot--on / --off`              | Connection state dot                            |
| `.gateway-app__throughput`           | Throughput card container                       |
| `.throughput-card / --ok / --warn`   | Per-cell tone variants                          |
| `.spark-bar / spark-line`            | Sparkline primitives                            |
| `.gateway-app__tabs-section`         | Tab section wrapper                             |
| `.gateway-app__tab--on`              | Active tab variant                              |
| `.describe-explorer__split`          | Methods+Events split-pane                       |
| `.describe-row / --on`               | Selectable row in describe list                 |
| `.scope-pill--*`                     | Per-scope tone variants                         |
| `.event-tag`                         | "event" badge for events mode                   |
| `.since-tag`                         | Version chip                                    |
| `.json-block`                        | Code block for params/result/payload            |
| `.batch-row / --warn / --open`       | Recent batch row + state variants               |
| `.batch-row__head`                   | Clickable batch summary row                     |
| `.batch-row__stat--ok / --err`       | Per-status pill variants                        |
| `.modal-backdrop / .modal / --wide`  | Composer modal shell                            |
| `.composer / __input / __table`      | Batch composer form                             |
| `.phase--running / --done / --error` | Wizard phase strip variants                     |
| `.activity-row--err`                 | Failed audit row tint                           |
| `.activity-row__status--ok / --err`  | Per-status pill in activity                     |

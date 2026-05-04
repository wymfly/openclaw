# gateway — interactions (v2)

## Pointer

- **Topbar Refresh click** → bumps `health.ts` (production refetches health + status).
- **Tab click** → switches active tab. No refetch. Composer modal closes if was open.
- **DescribeExplorer mode tab click** → switches Methods ↔ Events; clears selection.
- **DescribeExplorer scope filter click** → updates filter; selection preserved if still in filter.
- **DescribeExplorer search input change** → live filter on name + scope.
- **DescribeExplorer row click** → selects entry; right pane reveals JSON.
- **DescribeExplorer row Enter / Space** → identical to click.
- **Batch row head click** → toggles expansion. Other batches stay collapsed.
- **Dry-run batch click** → opens BatchComposer modal.
- **Composer add-call click** → appends a new call with default method.
- **Composer remove-call click** → removes the call. Disabled during `running`.
- **Composer Submit click** → enters `running` phase; 720-1080ms timer; returns synthetic results.
- **Composer Cancel / backdrop click** → closes modal. Disabled during `running`.

## Keyboard

| Key                 | Context                      | Behavior                                                                                          |
| ------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `Enter` / `Space`   | focused describe row         | Select entry.                                                                                     |
| `Enter` / `Space`   | focused batch row head       | Toggle expansion.                                                                                 |
| `Esc`               | composer modal open          | Close modal (except `running` phase).                                                             |
| `Tab` / `Shift Tab` | within composer modal        | Cycle through method input → params input → status pill (read-only) → Add call → Submit / Cancel. |
| `Enter`             | composer method/params input | Submit (if valid + not running).                                                                  |

The composer modal's `running` phase is **non-cancellable** — Esc + backdrop
no-op while the simulated 720-1080ms timer is in flight.

## Hover

- **Topbar pills** — no hover (informational only).
- **Refresh / Dry-run button** — bg lifts to `--ds-bg-hover`; primary
  inverts to filled accent.
- **Channel pill / Agent pill** — no hover (informational only).
- **Throughput card** — no hover; spark `<title>` SVG tooltips
  (production with recharts: hover crosshair + tooltip).
- **Tab strip** — bg lifts on hover; active keeps accent inset shadow.
- **Describe row** — bg lifts; active keeps accent tint.
- **Batch row head** — bg lifts; active keeps border tone.
- **Composer remove-call button** — bg lifts on hover; disabled
  during `running`.

## Density

`compact` (default):

- Topbar padding `18px 28px`.
- Main row gap `18px`; row padding `18px 20px`.
- Describe row padding `7px 10px`.

`cozy`:

- Topbar padding `22px 32px`.
- Main row gap `22px`; row padding `22px 24px`.
- Describe row padding `9px 12px`.

The Tweaks panel toggles between the two via `data-density` on the root.

## Empty / loading / error

| Scenario                                | UI                                                           |
| --------------------------------------- | ------------------------------------------------------------ |
| `describe.methods` empty + Methods mode | Empty card "No entries match." Untyped footer hidden.        |
| Search filter clears all                | Empty card. Filters remain visible.                          |
| `recentBatches === []`                  | Batch list empty (head still shows summary stats).           |
| Composer phase = `running`              | Spinner row + composer locked + close disabled.              |
| Composer phase = `done`                 | Green badge with ok/err counts + per-call status updates.    |
| Activity audit empty                    | (production target) "No recent activity." inline.            |
| Bootstrap not ready                     | Bootstrap pill flips error tone.                             |
| Health probe slow (>1s)                 | KPI cell shows "1.2s" rather than ms (formatMs auto-scales). |

## Focus

- After tab click → focus stays on the tab.
- After Refresh → focus stays on Refresh.
- After describe row click → focus stays on the row.
- After batch row expand → focus stays on the head.
- After composer open → focus jumps to first method input (production target).
- After composer close → focus returns to the Dry-run trigger.

## A11y semantics

- **Topbar**: KPI pills have implicit role from their elements; no
  redundant `role` overrides.
- **Health pill** lives in topbar; production should add `aria-label`
  describing the OK/DOWN value (the icon alone isn't sufficient for
  screen readers).
- **Hero rails**: each rail has a descriptive `<h3>`.
- **Throughput cards**: each card has a `<span>` label + `<strong>`
  value; sparkline `<svg>` is decorative.
- **Tabs**: `role="tablist"` + per-tab `role="tab"` + `aria-selected`.
- **DescribeExplorer**:
  - Mode tabs use `role="tablist"`.
  - Scope filter tabs use `role="tablist"`.
  - List wrapped in `role="region" aria-label="Describe entries"`.
  - Per-row uses `role="listitem"` (rendered inside `role="list"`).
  - Detail wrapped in `role="region"`.
- **BatchConsole**:
  - Per-batch `<button>` head has `aria-expanded` reflecting state.
  - Expanded body uses standard `<table>`.
- **Composer modal**:
  - `role="dialog" aria-modal="true" aria-label="Batch composer"`.
  - Close button has `aria-label="Close composer"`.
  - Phase strip running uses `role="status"`.
  - Phase strip error uses `role="alert"` (production target).
- **Activity rows**: status pill text is sufficient for screen readers
  (icon + text; not icon-only).

## Tweaks-driven exploration

Design-time only. Tweaks panel exposes:

- `theme` ∈ `dark | light`
- `density` ∈ `compact | cozy`

Production translation drops the panel entirely.

## Read-only behavior + 1 mutation

This is a **read-only panel** with one exception: the `gateway.batch`
dry-run composer.

Read-only:

- Health, status, describe, throughput, activity audit are all snapshot
  reads.
- No "restart Gateway" or "kill connection" actions — those belong to
  the runtime control surface (settings panel US-011).
- No "edit method scope" — describe is purely informational.

Mutation:

- `gateway.batch` dry-run lets the operator compose a batch and submit
  it. In bundled mode the result is an actual batch run; in remote mode
  the composer trigger is hidden / disabled.

## Cross-section coupling

- **Gateway ↔ Settings** (US-011): runtime mode + bind/token live in
  settings; gateway panel surfaces the runtime version + heartbeat
  seconds for visibility.
- **Gateway ↔ Channels** (US-001): channel rail here is a summary
  view; the channels panel is the editable source.
- **Gateway ↔ Agents** (`agents` panel, already done in this batch):
  heartbeat agents here mirror the agents panel; heartbeat is a
  per-agent setting from agents.
- **Gateway ↔ Activity** (US-006): activity tab here is a gateway-scoped
  audit projection; activity panel surfaces the full event feed.
- **Gateway ↔ Subagents** (US-005): subagents.kill / steer methods
  appear in describe; subagents panel is where the operator triggers
  them.
- **Gateway ↔ API Explorer** (US-019): api-explorer is a richer
  cousin of describe — full schema browser + curl-style request
  builder. Describe is the lightweight view; api-explorer the
  power-user view.
- **Gateway ↔ Usage** (US-014): usage panel surfaces per-RPC cost; the
  gateway throughput card surfaces per-RPC frequency.

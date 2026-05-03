# usage — interactions (v2)

## Pointer

- **Range preset click** → updates `range`; production refetches cost +
  sessions. Prototype only updates state.
- **Cost / Tokens trend toggle** → updates `trendMode`; flips the daily
  aggregate bars between cost and tokens. Cost trend chart itself always
  renders cost.
- **Refresh click** → bumps `updatedAt` on all 3 snapshots (presentational).
- **Session row click** → toggles `selectedSessionKey`. Same key clicked
  twice closes the drawer.
- **Session row Enter / Space** → identical to click.
- **Detail tab click** → switches to the chosen tab. No re-fetch.
- **Detail close click** → clears `selectedSessionKey`.
- **Filter select change** (agent / channel) → live filters the session
  list. Empty result → empty card.
- **Search input change** → live filter on session label / id / agent /
  channel name.
- **Sort tab click** → updates sort key (recent / cost / tokens).

## Keyboard

| Key                 | Context                              | Behavior                                                                                                                             |
| ------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `⌘K` / `Ctrl K`     | anywhere                             | Focus the session-table search input.                                                                                                |
| `Enter` / `Space`   | focused session row                  | Toggle selection.                                                                                                                    |
| `Tab` / `Shift Tab` | within page                          | Cycle: range presets → kbd hint → Refresh → trend toggle → search → filter selects → sort tabs → session rows → detail tabs → close. |
| `Esc`               | session detail open                  | (production target) close detail drawer.                                                                                             |
| `Enter`             | range preset / sort tab / detail tab | Apply that selection.                                                                                                                |

The detail drawer is **non-modal** — it doesn't trap focus. Operators can
keep navigating the table while the drawer is open.

## Hover

- **Session row** — bg lifts to `--ds-bg-hover`. Active row keeps accent
  tinted background.
- **Chart dots / bars** — native SVG `<title>` tooltip exposes value
  (e.g., `MM-DD: $X.XX`). Production with recharts: hover crosshair +
  tooltip with all-series values + axis tick highlight.
- **Quota bar** — no hover effect; tone tells the story.
- **Buttons** (`ds-btn`) — bg-2 → bg-hover; primary inverts to filled
  accent; ghost gets bg lift.
- **Tab strip / sort tabs** — bg lifts; active tab keeps accent inset
  shadow.
- **Detail close** — bg lifts on hover; reads `aria-label="Close session detail"`.

## Density

`compact` (default):

- Topbar padding `18px 28px`.
- Main row gap `18px`; row padding `18px 20px`.
- Session table cell padding `10px 12px`.
- Detail tab padding `6px 8px`.

`cozy`:

- Topbar padding `24px 32px`.
- Main row gap `22px`; row padding `22px 24px`.
- Session table cell padding `12px 14px`.
- Detail tab padding `8px 10px`.

The Tweaks panel toggles between the two via `data-density` on the root.

## Empty / loading / error

| Scenario                                  | UI                                                                |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `selectedSessionKey === null`             | Detail placeholder card "Pick a session…"                         |
| Session table empty (no data + no filter) | Empty card "No sessions match." with hint to clear filters.       |
| Session table empty (filter cleared all)  | Same empty card. Filters remain visible.                          |
| Cost trend chart < 2 points               | Inline "No data." in chart card.                                  |
| Provider rail empty                       | (production target) "No providers configured." inline note.       |
| Detail loading                            | Centered spinner + "Loading…" with `role="status"`.               |
| Detail error (5% sim)                     | Inline error card with retry button + `role="alert"`.             |
| Detail Logs / Timeseries / Context empty  | Empty card with section-specific copy.                            |
| Bootstrap not ready                       | Topbar pill flips error tone; no action gating (read-only panel). |
| Provider quota.unknown                    | Inline error badge in provider card head; bars still render.      |

## Focus

- After session row click → focus stays on the row.
- After detail tab click → focus stays on the tab.
- After detail close → focus returns to the row that was selected.
- After Refresh → focus stays on Refresh.
- ⌘K → focus the session-table search input.
- After range preset click → focus stays on the preset.

## A11y semantics

- **Topbar**: `<header>` with `aria-label`-less; KPI strip wrapped in
  `role="group" aria-label="Usage KPI"`.
- **Range presets**: `role="tablist" aria-label="Date range"` + per-button
  `role="tab"` + `aria-selected`.
- **Trend toggle**: `role="tablist" aria-label="Trend mode"` + per-button
  `role="tab"`.
- **Provider rail**: each card has its own descriptive heading hierarchy.
  Quota bar exposes `<title>` tick labels.
- **Session table**: wrapped in `role="region" aria-label="Sessions table"`.
  Per-row `role="button" tabIndex={0} aria-pressed`. Sort tabs use
  `role="tablist" aria-label="Sort sessions"`.
- **Session detail**: wrapped in `<aside aria-label="Session ${name}">`.
  Tab strip uses `role="tablist" aria-label="Session detail tabs"`.
- **Charts**: each chart container has implicit role from `<svg>`. Chart
  ticks rely on `<title>` for hover; production should add explicit
  `<text aria-hidden>` for visual-only ticks and a separate `role="img"
aria-label` summary for screen readers.
- **Phase strip running**: `role="status"`. **Phase strip error**:
  `role="alert"`.
- **Context-weight bar**: `role="img"` with explicit
  `aria-label="Context split: system X% skills Y% tools Z% files W%"`.

## Tweaks-driven exploration

Design-time only. Tweaks panel exposes:

- `theme` ∈ `dark | light`
- `density` ∈ `compact | cozy`

Production translation drops the panel entirely.

## Read-only behavior

This is a **read-only** panel. There are no mutations:

- No "create budget rule" — that's the budget panel (US-013).
- No "kill session" — that's the subagents panel (US-005).
- No "rename session" — sessions are derived from agent runs.
- No "export to CSV" — punted to engineering decision.

The only state the user controls is: range / trend mode / selected session
/ tab inside detail / sort + filters in session table.

## Cross-section coupling

- **Usage ↔ Budget** (US-013): budget rules use the same dimension
  (cost / tokensIn / tokensOut / totalTokens) and reference the same
  underlying usage totals. A future "budget eval" overlay on the cost
  trend chart could show warn/over thresholds inline (see US-013 open
  question §1).
- **Usage ↔ Models** (US-002): per-model aggregates here surface the
  same models that appear in the models panel. A "go to model detail"
  action could deep-link.
- **Usage ↔ Sessions** (separate panel): session entries here can
  deep-link to the live session view (chat).
- **Usage ↔ Channels** (US-001): per-channel aggregates here use the
  same channel labels.
- **Usage ↔ Gateway** (US-015): gateway throughput chart will use the
  same recharts setup locked here.

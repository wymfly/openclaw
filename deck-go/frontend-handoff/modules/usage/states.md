# usage — states (v2)

## Top-level state

```ts
{
  // Server-side snapshots
  costResp: DeckGoUsageCostResponse,
  providersResp: DeckGoUsageProvidersResponse,
  sessionsResp: DeckGoUsageSessionsResponse,

  // Bootstrap (read on load)
  bootstrap: { ok: boolean },

  // Range + selection
  range: "24h" | "7d" | "14d" | "30d",   // default 14d
  trendMode: "cost" | "tokens",          // affects daily aggregate bars only
  selectedSessionKey: string | null,
}
```

Tweaks-driven (design-time only):

```ts
{
  theme: "dark" | "light",
  density: "compact" | "cozy",
}
```

Per-session lazy state (lives inside `SessionDetail`):

```ts
{
  phase: "idle" | "loading" | "ready" | "error",
  logs: DeckGoUsageSessionLogsResponse | null,
  timeseries: DeckGoUsageTimeseriesResponse | null,
}
```

## Loading / Empty / Error states

| Scenario                             | UI                                                                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Initial load (no fixture yet)        | (production target) full-width loading shell — prototype always seeds.                                                      |
| `cost.daily.length === 0`            | Cost trend card shows "No data." inline; KPI strip "—".                                                                     |
| `providers.length === 0`             | Provider rail shows "No providers configured." (production target).                                                         |
| `sessions.length === 0`              | Session table empty card "No sessions match. Try clearing filters."                                                         |
| `selectedSessionKey === null`        | SessionDetail placeholder card "Pick a session…"                                                                            |
| Session filter excludes all          | Session table empty card (filtered).                                                                                        |
| `bootstrap.ok === false`             | Topbar bootstrap pill flips to "bootstrap not ready" error tone. (Read-only panel — no action gating beyond visual signal.) |
| `provider.error === "quota.unknown"` | Provider card shows inline error badge; quota windows still render with whatever `usedPercent` data is available.           |
| `session.usage === null`             | Numeric cells show "—"; no sparkline rendered.                                                                              |
| `session.contextWeight === null`     | Detail Overview shows "(no report)" for context source; Context tab empty card.                                             |
| Detail tab fetch 5xx (5% sim)        | Detail body `phase--error` with retry button.                                                                               |
| Detail logs empty                    | Logs tab empty card.                                                                                                        |
| Detail timeseries empty (1 point)    | Timeseries tab empty card.                                                                                                  |

## Cost trend states

| Data shape                                        | UI                                                          |
| ------------------------------------------------- | ----------------------------------------------------------- |
| 14 days of contiguous data                        | Full chart with 4 grid lines + 14 dots + tick labels.       |
| 1-2 days of data                                  | "No data." (chart needs ≥ 2 distinct points to draw).       |
| Negative deltas                                   | KPI `vs yesterday` cell flips tone to `ok` if delta < -10%. |
| Spike day (delta > +10%)                          | KPI `vs yesterday` cell flips tone to `warn`.               |
| `cost` field used instead of `totalCost` (legacy) | Wrapper normalizes `cost` → `totalCost` before render.      |

## Provider quota states

| Window shape            | UI                                                  |
| ----------------------- | --------------------------------------------------- |
| `usedPercent < 60`      | OK pill + green fill.                               |
| `60 ≤ usedPercent < 90` | WARM pill + amber fill.                             |
| `usedPercent ≥ 90`      | HOT pill + red fill.                                |
| `resetAt` present       | Foot shows "resets in 30m" / "resets in 4d".        |
| `resetAt` absent        | Foot shows "no reset window known".                 |
| `provider.error` set    | Inline error badge in card head; bars still render. |

## Session detail lifecycle

```
selectedSessionKey changes
  → phase: "loading" → 360-680ms timer
    → 5% chance:    phase: "error" (shows retry button)
    → 95% chance:   phase: "ready" (logs + timeseries populated)
```

Notes:

- Switching tabs DOES NOT re-trigger the lazy load. Logs and timeseries are
  loaded once per selection.
- Closing the drawer (`onClose`) clears `selectedSessionKey` but DOES NOT
  invalidate the cached lazy state. Re-selecting the same session re-runs
  the simulated fetch in this prototype (production should cache).
- Production: per-session `staleTime` ≈ 60s; `refetchOnFocus` off.

## Range refresh states

| Action                                 | Effect                                                                                                                           |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| User picks a different range preset    | (production) Refetch `cost(range)` + `sessions(range)`. Prototype is presentational — preset just updates state without refetch. |
| User clicks Refresh                    | Bumps `updatedAt` on all 3 server snapshots; would refetch in production.                                                        |
| Range change while session detail open | Detail stays open; selected session may disappear from the new range — UI tolerates by showing detail until user closes.         |

## A11y / focus rules

- ⌘K → focus the first `input[type="search"]` (the session-table search).
- After session row click → focus stays on the row; the detail drawer
  becomes accessible by Tab order.
- After detail close → focus returns to the previously selected row in
  the session table.
- After Refresh → focus stays on the Refresh button.
- Tab-strip uses `role="tablist"` + per-tab `role="tab"` + `aria-selected`.
- Session rows are `role="button"` with `aria-pressed` reflecting selection.
- Detail body live-region: `phase--loading` uses `role="status"`;
  `phase--error` uses `role="alert"`.
- Range presets and trend toggle use `role="tablist"`.

## Boundary cases

- **Session with `usage === null`**: Renders row with "—" numeric cells +
  no sparkline + still selectable; detail Overview shows "—" KPIs.
- **Session with `contextWeight === null`**: Detail Overview shows
  "(no report)" for context source; Context tab empty card.
- **`cost.daily` with mixed `cost` and `totalCost` fields**: Production
  wrapper must normalize. Prototype seeds `totalCost` only.
- **Provider with 0 windows**: Rendered with empty body — production may
  want a "no quota windows reported" inline note.
- **All sessions filtered out**: Empty card; filters remain visible
  (so user can clear them).
- **`refetch` while detail loading**: Detail loader stays until its own
  timer resolves; topbar refresh and detail load are independent.

## Theme variants

- `data-theme="dark"` (default) — uses canonical `--ds-*` palette.
- `data-theme="light"` (Tweaks demo only) — overrides body via the
  `[data-theme="light"]` block.

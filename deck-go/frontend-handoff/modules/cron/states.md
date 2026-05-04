# cron — states (v2)

## Top-level state

```ts
{
  // Server-side snapshots
  jobs: DeckGoCronJob[],
  runs: DeckGoCronRunEntry[],
  status: DeckGoCronStatus,

  // UI state
  selectedId: string | null,
  enabledFilter: "all" | "enabled" | "disabled",
  query: string,
  sortBy: "nextRunAtMs" | "updatedAtMs" | "name",
  builder: { open: boolean; initial: DeckGoCronJob | null },
  refreshing: boolean,
}
```

JobDetail-internal state:

```ts
{
  tab: "overview" | "schedule" | "history" | "payload",
  confirmDelete: boolean,
  runNowPhase: "idle" | "running" | "done",
}
```

CronBuilder-internal state:

```ts
{
  draft: DeckGoCronJobInput & {
    failureAlert?: boolean;
    deleteAfterRun?: boolean;
  },
  phase: "idle" | "saving" | "done",
}
```

Tweaks-driven (design-time only):

```ts
{
  theme: "dark" | "light",
  density: "compact" | "cozy",
}
```

## Loading / Empty / Error states

| Scenario                      | UI                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| Initial load (no fixture yet) | (production target) skeleton table + 4-cell KPI placeholders. Prototype always seeds. |
| `jobs = []`                   | Empty card "No jobs match." Detail empty card with calendar icon.                     |
| Search + filter clears all    | Empty card "No jobs match."                                                           |
| `selectedId = null`           | Detail pane shows calendar icon + "Pick a job from the list."                         |
| Job has no runs               | History tab shows "No runs recorded yet." Last-run column shows "never".              |
| Run-now phase = `running`     | Run now button disabled + spinner; phase strip "running…" with `role="status"`.       |
| Run-now phase = `done`        | Green check + "triggered" for 800ms before reset.                                     |
| Builder save phase = `saving` | Save + Cancel disabled. Foot phase strip "Saving…" with `role="status"`.              |
| Builder save phase = `done`   | Green check + "Saved." for 600ms before modal closes.                                 |
| Builder validation fails      | Save disabled + "Required: name, schedule fields." muted hint.                        |
| Delete confirm modal open     | Modal-backdrop + dialog; click backdrop or Cancel to close.                           |
| `runs = []`                   | KPI Runs/Errors stay 0; History tab shows "No runs recorded yet."                     |
| Disabled job + Run now click  | Button disabled (cannot trigger).                                                     |

## Schedule kind states

| Kind    | Builder fields                                       | Display                         |
| ------- | ---------------------------------------------------- | ------------------------------- |
| `cron`  | expr (mono) + tz (default UTC)                       | `<expr> [(<tz>)]` if non-UTC    |
| `every` | everyMs (ms) + staggerMs (optional ms) + helper hint | `every <Nm/Nh/Nd> [±<jitter>s]` |
| `at`    | at (ISO) + helper hint about deleteAfterRun          | `at <local datetime>`           |

Schedule kind change wipes kind-specific fields and seeds defaults:

- cron → `expr: "0 6 * * *", tz: "UTC"`
- every → `everyMs: 5 * 60_000`
- at → `at: now + 1h`

## Run-now lifecycle

```
idle (Run now enabled if job.enabled)
  ─[click Run now]──▶ running (~720ms, spinner)
                         ─▶ done (~800ms, "triggered" check)
                              ─▶ idle (a new run entry prepended to runs)
```

Notes:

- Running locks the Run now button + Disable/Edit/Delete remain enabled.
- New run is synthetic in prototype: 92% ok / 8% error.

## Builder lifecycle

```
opened (draft = clone of initial OR blank, phase: idle)
  ─[Cancel / backdrop / Esc]──▶ closed (no save)
  ─[Save (valid)]──▶ saving (~600ms)
                       ─▶ done (~600ms)
                         ─▶ closed (job created OR updated, selection updated)
```

Notes:

- Cancel preserves the original (no in-place mutation; draft is a clone).
- Save validation: `name` required + schedule.kind-specific required field.
- Builder save replaces the whole job (matches `PUT /api/cron/jobs/:id`
  semantics).

## Delete lifecycle

```
idle
  ─[click Delete]──▶ confirm modal open
                       ─[Cancel / backdrop / Esc]──▶ closed (no delete)
                       ─[click Delete]──▶ delete fires
                                            ─▶ closed (job removed, selection moves to next)
```

Notes:

- No "saving" phase for delete in prototype; production may add a 400ms
  optimistic + rollback on error.

## Run status states

| `status`  | Visual + meaning                                                      |
| --------- | --------------------------------------------------------------------- |
| `ok`      | Green badge "ok"; History row default styling.                        |
| `error`   | Red badge "error"; History row tinted background; error string shown. |
| `skipped` | Amber badge "skipped"; History shows skip reason in muted small text. |
| (other)   | Neutral badge; defensive fallback.                                    |

## Countdown states

| Remaining | Tone     | Visual                         |
| --------- | -------- | ------------------------------ |
| `> 1h`    | later    | Neutral chip with clock icon.  |
| `< 1h`    | soon     | Info blue chip.                |
| `< 1m`    | imminent | Warn amber chip.               |
| `< 0`     | overdue  | Red chip with "overdue" label. |
| no target | —        | Muted "—".                     |

The CountdownTimer uses `setInterval(force, 1000)` for second-level
granularity. On unmount the interval clears.

## Sort states

| `sortBy`      | Behavior                                                           |
| ------------- | ------------------------------------------------------------------ |
| `nextRunAtMs` | Ascending; disabled jobs (null nextRun) sink to bottom (Infinity). |
| `updatedAtMs` | Ascending by default; flip with sortDir (production).              |
| `name`        | Lexicographic asc.                                                 |

## Filter states

| `enabledFilter` | Behavior                            |
| --------------- | ----------------------------------- |
| `all`           | Show all jobs.                      |
| `enabled`       | Show jobs with `enabled === true`.  |
| `disabled`      | Show jobs with `enabled === false`. |

Search query (`query`):

- Empty → no filtering.
- Non-empty → case-insensitive match on `name`, `id`, `schedule.expr`.

## A11y / focus rules

- Topbar New job: focus stays on button after click; modal opens with focus
  trap (production target).
- Topbar Refresh: focus stays on Refresh after click.
- Filter seg uses `role="tablist"` + per-button `role="tab"` + `aria-selected`.
- Search input has implicit role from `<input type="text">`.
- Table uses `role="table"` + per-row `role="row"` + per-cell `role="cell"`.
- Each row has `aria-selected` reflecting selection state + `tabIndex={0}`.
- Detail tabs use `role="tablist"` + `role="tab"` + `aria-selected`.
- Builder dialog: `role="dialog" aria-modal="true"` + close has `aria-label`.
- Delete confirm: `role="dialog" aria-modal="true"` + Delete is destructive.
- Run-now phase strip uses `role="status"`.

## Boundary cases

- **Job with `nextRunAtMs = null`** (disabled): row shows "—"; detail meta cell shows "disabled".
- **Job with `payload.kind` outside the union**: render kind as raw string; payload tab shows raw JSON.
- **Job with `delivery` undefined**: payload tab omits the delivery section.
- **Run with `durationMs = 0`**: history row shows "0ms" (defensive).
- **Run with `runAtMs = undefined`**: production target — fall back to `ts - durationMs`.
- **Cron expr with invalid syntax**: prototype trusts; production validator should flag.

## Theme variants

- `data-theme="dark"` (default) — uses canonical `--ds-*` palette.
- `data-theme="light"` (Tweaks demo only) — overrides body via the
  `[data-theme="light"]` block.

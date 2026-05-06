# cron — high-fidelity handoff (v2)

**Status**: implemented (sha d7ab0bb9b612ca120ec1d1e7ced6bef92e8f2508)
**Protocol version:** `protocol-v1`
**Visual target:** [`./prototype.html`](./prototype.html) (multi-file Babel React)
**V1 archive:** [`./prototype-v1-codex.html`](./prototype-v1-codex.html)

`cron/` is the deck-go **scheduled job control panel** — operators inspect
all cron-style jobs, see live countdowns to next run, drill into per-job
history, run-now, enable/disable, edit, or delete. New jobs are composed
through the 3-mode CronBuilder (cron expression / every-interval / one-shot).

## File inventory

| File                      | Purpose                                                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prototype.html`          | ~22-line shell loading React + Babel + 6 jsx + 2 css.                                                                                                                                      |
| `data.js`                 | Mock fixture: 9 jobs spanning 3 schedule kinds + 26 run entries + status + KPI stats + bootstrap.                                                                                          |
| `icons.jsx`               | 17 SVG icons + `ScheduleBadge` (3 kinds) + `ScheduleSummary` + `RunStatusBadge` (3 tones) + `CountdownTimer` (live ticking, **promoted from approvals**) + `EnabledToggle` + 3 formatters. |
| `jobs-list.jsx`           | Left pane: filters (enabled seg / search / sort) + 7-col table (job / schedule / next-run / last-run / target / state / chev).                                                             |
| `job-detail.jsx`          | Right pane: hero + actions row (Run now / Disable / Edit / Delete) + 4 tabs (Overview / Schedule / History / Payload) + Delete confirm modal.                                              |
| `cron-builder.jsx`        | Modal for `DeckGoCronJobInput`: identity + 3-tab schedule kind builder + target/wake + payload + behavior toggles.                                                                         |
| `app.jsx`                 | `CronApp` orchestrator + topbar (4-cell KPI + scheduler state pill + New + Refresh) + 2-pane main + builder modal.                                                                         |
| `styles.css`              | ~620 lines control-plane dashboard + 7-col grid + countdown + run table + builder modal + density variants + light theme stub.                                                             |
| `tokens.css`              | Mirror of canonical `--ds-*` tokens.                                                                                                                                                       |
| `tweaks-panel.jsx`        | Design-time state knobs (theme/density).                                                                                                                                                   |
| `prototype-v1-codex.html` | Original Codex single-file prototype (482 lines).                                                                                                                                          |

## Contract truth

```ts
// from deck-go/contracts/source/deck-api.contract.ts (lines 1374-1457)

export type DeckGoCronSchedule = {
  kind: "at" | "every" | "cron";
  at?: string;
  everyMs?: number;
  anchorMs?: number;
  expr?: string;
  tz?: string;
  staggerMs?: number;
};

export type DeckGoCronJob = {
  id: string;
  name: string;
  schedule: DeckGoCronSchedule;
  sessionTarget?: string;
  wakeMode?: string;
  payload: { kind: "systemEvent" | "agentTurn"; [key: string]: unknown };
  delivery?: unknown;
  failureAlert?: boolean;
  agentId?: string;
  description?: string;
  enabled: boolean;
  deleteAfterRun?: boolean;
  nextRunAtMs?: number;
  updatedAtMs?: number;
  createdAtMs?: number;
};

export type DeckGoCronJobInput = {
  name: string;
  schedule: DeckGoCronSchedule;
  sessionTarget: string;
  wakeMode: string;
  payload: { kind: "systemEvent" | "agentTurn"; [key: string]: unknown };
  agentId?: string;
  description?: string;
  enabled?: boolean;
};

export type DeckGoCronRunEntry = {
  id: string;
  jobId: string;
  status: "ok" | "error" | "skipped";
  ts: number;
  runAtMs?: number;
  durationMs?: number;
  delivery?: unknown;
  error?: string;
};

export type DeckGoCronStatus = {
  running: boolean;
  jobCount?: number;
  nextRunAtMs?: number;
};

export type DeckGoCronJobsResponse = { jobs?: DeckGoCronJob[] };
export type DeckGoCronRunsResponse = { entries?: DeckGoCronRunEntry[] };
```

Endpoints (read + 4 mutations). Code truth uses the current deck-go BFF route
family below; older `/api/cron/jobs*` names are prototype shorthand only and
must not be implemented against.

- `GET    /api/cron/status` → `DeckGoCronStatus`
- `GET    /api/cron` → `DeckGoCronJobsResponse` (with `DeckGoCronJobsParams` filters)
- `POST   /api/cron` → create (body: `DeckGoCronJobInput`)
- `PATCH  /api/cron/:id` → update (body: partial `DeckGoCronJobInput`)
- `DELETE /api/cron/:id` → delete
- `POST   /api/cron/:id/run` → trigger now (body: `DeckGoCronRunParams` `{ mode: "due" | "force" }`)
- `GET    /api/cron/:id/runs` → `DeckGoCronRunsResponse` (with `DeckGoCronRunsParams` filters)

## Section model

```
┌─ Topbar (sticky)
│  ├─ Brand (eyebrow + title + scheduler state + runtime version + global next-run countdown)
│  ├─ KPI strip (Total jobs / Enabled / Runs 1h / Errors 1h)
│  └─ New job + Refresh
├─ Main 2-pane
│  ├─ JobsList (left ~560-620px)
│  │  ├─ Filters (enabled seg + search + sort)
│  │  └─ 7-col table (job / schedule / next-run / last-run / target / state / chev)
│  └─ JobDetail (right)
│     ├─ Hero (ScheduleBadge + id + EnabledToggle + alerts pill + title + desc + 4 meta cells)
│     ├─ Actions (Run now / Disable/Enable / Edit / Delete)
│     ├─ Tabs (Overview / Schedule / History / Payload)
│     └─ Delete confirm modal
└─ CronBuilder modal (New job / Edit)
   ├─ Identity (name + description)
   ├─ Schedule (3-tab kind builder)
   ├─ Target & wake
   ├─ Payload (kind + topic-or-prompt)
   └─ Behavior (3 toggles)
```

## Decision-critical mutations

This panel exposes 4 mutation surfaces:

| Surface            | Mutation                                           |
| ------------------ | -------------------------------------------------- |
| New job button     | `POST /api/cron` with `DeckGoCronJobInput`.        |
| Edit (CronBuilder) | `PATCH /api/cron/:id` with partial input.          |
| Run now            | `POST /api/cron/:id/run` with `{ mode: "force" }`. |
| Disable / Enable   | `PATCH /api/cron/:id` with `{ enabled }`.          |
| Delete             | `DELETE /api/cron/:id`.                            |

Delete is gated by an explicit confirm dialog. Run-now disabled when the
job is disabled.

## Depends on canonical patterns / icons

`@/design-system/patterns`: `PageShell`, `EmptyState`, `KbdHint`, `SectionHeader`, `ConfirmDialog`.

`@/design-system/icons`:

- `IconClock`, `IconRefresh`, `IconPlus`, `IconClose`, `IconCheck`, `IconAlert`,
  `IconPlay`, `IconPause`, `IconEdit`, `IconTrash`, `IconChevronR`, `IconChevronD`,
  `IconSearch`, `IconCalendar`, `IconRotate`, `IconBolt`, `IconLayers`, `IconAt`.

`CountdownTimer` was promoted from approvals (US-016) — it's now usable
across cron next-runs, webhook retry windows (US-018), session expiry
banners. Stays in `frontend-new/src/components/molecules/` once
production-ized (not domain-bound to cron).

`ScheduleBadge` / `ScheduleSummary` / `RunStatusBadge` / `EnabledToggle`
stay local to cron (highly domain-specific).

## How to implement

1. Open `prototype.html` in a static server. Click jobs in the table. Run
   one. Disable one. Edit one. Create a new job through the builder.
2. Translate to `frontend-new/src/components/panels/cron/` keeping
   class-name shape (`cron-app__*`, `jobs-row__*`, `job-detail__*`,
   `builder-*`).
3. Wire real fetchers through `frontend-new/src/api.ts`:
   - `fetchCronStatus()` → `GET /api/cron/status`
   - `fetchCronJobs(params)` → `GET /api/cron`
   - `createCronJob(input)` → `POST /api/cron`
   - `updateCronJob(id, input)` → `PATCH /api/cron/:id`
   - `deleteCronJob(id)` → `DELETE /api/cron/:id`
   - `runCronJob(id, mode)` → `POST /api/cron/:id/run`
   - `fetchCronRuns(jobId, params)` → `GET /api/cron/:id/runs`
4. Hardcoded literal strings get extracted to
   `frontend-new/src/i18n/{en,zh}.json`.
5. CronBuilder cron-expression input: production should add a humanized
   "next 5 fires" preview using a cron parser (e.g., `cron-parser`). Not
   in prototype — flagged in stack-decisions punted.

## Stack decisions punted from this panel

- **Cron expression validator** — prototype trusts the operator's input.
  Production needs `cron-parser` or equivalent to validate + show "next
  5 fires" preview.
- **Live countdown granularity** — prototype uses 1s setInterval. For sub-1s
  resolution use requestAnimationFrame; for >1m resolution use setTimeout
  chained on actual `nextRunAtMs`.
- **Run history pagination** — prototype shows last 20 per job. Production
  needs offset-based pagination via `DeckGoCronRunsParams.offset`.
- **Bulk actions** — prototype is one-at-a-time. Bulk enable/disable/delete
  is a real ops need; not in current contract.

## Unsupported claims

- Do not claim `nextRunAtMs` is real-time — the server computes it from
  schedule; UI countdown is best-effort against local clock.
- Do not claim deletion is reversible — it isn't. Confirm dialog is the
  only safety rail.
- Do not claim `delivery` field shape is stable — it's untyped in the
  contract (`unknown`); each job kind defines its own.

## Open questions for follow-up

1. **Cron expression preview** — should the contract publish a typed
   `cron.preview(expr)` RPC returning next-N-fires?
2. **Pagination shape** — `DeckGoCronRunsParams` has limit/offset. Should
   it also support cursor-based for infinite-scroll history?
3. **Stagger semantics** — `staggerMs` on `every` schedules: random jitter
   or fixed offset? Contract is silent.
4. **Run-now modes** — `due` vs `force`: force overrides currently-running
   instance? Contract doesn't specify isolation.
5. **Job-history relationship** — should there be a `cron.history.subscribe`
   stream so the UI can push new run entries without polling?

## Reverse sign-off

| Field                          | Value                                                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Final sign-off status          | `needs-revision`                                                                                                            |
| Reviewer                       | Codex                                                                                                                       |
| Date                           | 2026-05-06                                                                                                                  |
| Prototype reference            | `frontend-handoff/modules/cron/prototype.html`                                                                              |
| Production reference           | `frontend-new/src/components/panels/cron/`                                                                                  |
| Mock functional evidence       | `frontend-handoff/audit/module-evidence-manifest.json` (`cron`, `mock-functional`, verdict: `recorded-by-visual-spec`)      |
| Mock prototype parity evidence | `frontend-handoff/audit/module-evidence-manifest.json` (`cron`, `mock-prototype-parity`, verdict: `unreviewed`)             |
| Real Gateway evidence          | `frontend-handoff/audit/module-evidence-manifest.json` (`cron`, `real-gateway`, status: `recorded-in-implementation-notes`) |
| Accepted exceptions            | See `frontend-handoff/audit/module-evidence-manifest.json` and `frontend-handoff/modules/cron/implementation-notes.md`.     |

This reverse sign-off is a current-code evidence index. It does not upgrade `unreviewed` prototype parity verdicts to visual acceptance; those remain explicit in the manifest.

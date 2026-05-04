# cron — components (v2)

## Tree

```
CronApp                                           [app.jsx]
├─ Topbar (sticky)
│  ├─ brand block (eyebrow + title + scheduler state + global next-run countdown)
│  ├─ KPI strip (4 cells: Total / Enabled / Runs 1h / Errors 1h)
│  └─ actions (New job / Refresh)
├─ Main 2-pane                                    [app.jsx]
│  ├─ JobsList                                    [jobs-list.jsx]
│  │  ├─ head (title + count badge)
│  │  ├─ filters (enabled seg + search + sort)
│  │  └─ 7-col table (job / schedule / next-run / last-run / target / state / chev)
│  └─ JobDetail                                   [job-detail.jsx]
│     ├─ hero (ScheduleBadge + id + EnabledToggle + alerts pill + title + desc + 4 meta cells)
│     ├─ actions (Run now / Disable/Enable / Edit / Delete)
│     ├─ tabs (overview / schedule / history / payload)
│     ├─ tab body (OverviewTab / ScheduleTab / HistoryTab / PayloadTab)
│     └─ Delete confirm modal (modal-backdrop + modal)
└─ CronBuilder (modal)                            [cron-builder.jsx]
   ├─ Identity (BuilderField name + description)
   ├─ Schedule (3-tab kind builder + per-kind fields)
   ├─ Target & wake (BuilderField + BuilderSelect × 3)
   ├─ Payload (BuilderSelect kind + topic-or-prompt input)
   └─ Behavior (3 ToggleRow)
```

## Local molecules (in `icons.jsx`)

### ScheduleBadge

`<ScheduleBadge schedule={schedule} />` — color-coded per schedule kind:

- `cron` → info (blue) with calendar icon
- `every` → accent (purple) with rotate icon
- `at` → warn (amber) with @-style icon

### ScheduleSummary

`<ScheduleSummary schedule={schedule} />` — mono compact human-readable:

- cron → `<expr> [(<tz>)]` if non-UTC tz
- every → `every <Nm/Nh/Nd> [±<jitter>s]`
- at → `at <local datetime>`

### RunStatusBadge

`<RunStatusBadge status="ok" />` — 3 tones for run history:

- `ok` → green
- `error` → red
- `skipped` → amber

Strong promotion candidate — webhook deliveries (US-018) need the same
3-tone status.

### CountdownTimer

`<CountdownTimer targetMs={1234567890} prefix="in " />` — live-ticking
countdown to a future ms timestamp. **Promoted from approvals (US-016).**

Tones based on remaining time:

- `< 60s` → imminent (warn amber)
- `< 1h` → soon (info blue)
- `> 1h` → later (neutral)
- past → overdue (red, "overdue" label)

Format auto-scales: seconds < 60s, minutes < 60m, hours < 24h, days otherwise.

### EnabledToggle

`<EnabledToggle enabled={true} />` — pill with dot:

- enabled → green dot + green pill
- disabled → grey dot + grey pill

Visual-only here; mutations happen through the Disable/Enable button in
JobDetail's actions row.

## Per-section renderers

### Topbar

- Brand block (eyebrow + title + scheduler state code + runtime version
  - global next-run CountdownTimer).
- KPI strip — 4 cells:
  - **Total jobs**: integer count.
  - **Enabled**: `enabled / total` fraction (warn if all disabled).
  - **Runs (1h)**: count of runs in last hour.
  - **Errors (1h)**: count of error runs in last hour (warn if > 0, ok otherwise).
- New job button (primary tone).
- Refresh button (spinner animation while refreshing).

### JobsList (left pane)

- Filters bar:
  - Enabled segmented filter (all / enabled / disabled) with per-tab counts.
  - Search input (live filter on name + id + cron expr).
  - Sort select (next-run / updated / name).
- 7-col grid:
  - Job (name + id mono).
  - Schedule (ScheduleBadge + ScheduleSummary).
  - Next-run (CountdownTimer or `—` if disabled).
  - Last-run (RunStatusBadge + relative time, or "never").
  - Target (sessionTarget mono).
  - State (EnabledToggle).
  - Chevron (right indicator).
- Disabled rows: opacity 0.65 + muted name.
- Selected row: 4px accent left inset shadow.

### JobDetail (right pane)

#### Hero

- Head: ScheduleBadge + id chip + EnabledToggle + (optional) failure-alert pill.
- Title: human job name (h2).
- Description (if present, fg-2).
- 4 meta cells:
  - Next: countdown (or `disabled`)
  - Target: sessionTarget
  - Wake: wakeMode
  - Agent: agentId (if set)

#### Actions row

- **Run now** (primary): triggers `POST /api/cron/jobs/:id/run`. Disabled when job disabled.
  - Phase: idle → running (spinner ~720ms) → done ("triggered" check ~800ms) → idle.
- **Disable / Enable**: toggles `enabled` field.
- **Edit**: opens CronBuilder pre-filled with current job.
- **Delete** (danger tone): opens confirm dialog.

#### Tabs (4)

- **overview** — Recent run stats grid (OK / Errors / Skipped / Last duration) + Lifecycle list (created / updated / self-deleting flag / failure alerts).
- **schedule** — Schedule grid (kind / kind-specific fields / next-run countdown) + raw JSON.
- **history** — Last 20 runs table (when / status / duration / error-or-delivery).
- **payload** — Payload kind + raw JSON + (optional) delivery hint JSON.

#### Delete confirm modal

- Standard modal with title "Delete job?" + body "This will permanently
  delete X" + foot Cancel + Delete (danger).
- Click backdrop to close.

### CronBuilder (modal)

- xWide modal (max 880px, max-height 85vh).
- Head: title + close button.
- Body 5 sections:
  1. **Identity**: name + description.
  2. **Schedule**: 3-tab kind builder (cron expression / every interval / one-shot) + kind-specific inputs.
  3. **Target & wake**: sessionTarget + wakeMode + agentId.
  4. **Payload**: kind dropdown + topic (systemEvent) or prompt (agentTurn).
  5. **Behavior**: 3 toggles (Enabled / Failure alerts / Delete after run).
- Foot: phase indicator + Cancel + Save (Create job / Save changes).
- Save: 600ms simulated delay → done indicator → 600ms close.
- Validation: name + schedule fields required; Save disabled if invalid.

## Props (production target)

```ts
type CronAppProps = {};

type JobsListProps = {
  jobs: DeckGoCronJob[];
  runs: DeckGoCronRunEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  query: string;
  onQuery: (q: string) => void;
  enabledFilter: "all" | "enabled" | "disabled";
  onEnabledFilter: (f: "all" | "enabled" | "disabled") => void;
  sortBy: "nextRunAtMs" | "updatedAtMs" | "name";
  onSortBy: (s: "nextRunAtMs" | "updatedAtMs" | "name") => void;
};

type JobDetailProps = {
  job: DeckGoCronJob | null;
  runs: DeckGoCronRunEntry[];
  onAction: (id: string, action: "run" | "enable" | "disable" | "delete") => void;
  onEdit: (job: DeckGoCronJob) => void;
};

type CronBuilderProps = {
  initial: DeckGoCronJob | null;
  onClose: () => void;
  onSave: (
    input: DeckGoCronJobInput & {
      failureAlert?: boolean;
      deleteAfterRun?: boolean;
    },
  ) => void;
};

type ScheduleBadgeProps = { schedule?: DeckGoCronSchedule };
type ScheduleSummaryProps = { schedule?: DeckGoCronSchedule };
type RunStatusBadgeProps = { status: "ok" | "error" | "skipped" | string };
type CountdownTimerProps = { targetMs?: number; prefix?: string };
type EnabledToggleProps = { enabled: boolean };
```

## Class-name intent

| Class                                                                                 | Purpose                       |
| ------------------------------------------------------------------------------------- | ----------------------------- |
| `.cron-app`                                                                           | Top-level vertical layout     |
| `.cron-app__topbar`                                                                   | Sticky header                 |
| `.cron-app__btn / --primary / --spin`                                                 | Topbar button + spinner state |
| `.cron-app__main`                                                                     | 2-pane main grid              |
| `.kpi-cell / --warn / --err / --ok`                                                   | KPI cell tone variants        |
| `.jobs-list`                                                                          | Left pane container           |
| `.jobs-list__table-head / .jobs-row`                                                  | Grid table head + row         |
| `.jobs-row / --on / --disabled`                                                       | Selectable row state variants |
| `.jobs-row__name / __id / __schedule / __next / __last / __target / __state / __chev` | Per-cell containers           |
| `.seg-filter / __btn / --on`                                                          | Enabled segmented control     |
| `.search-input / .sort-select`                                                        | Filter controls               |
| `.schedule-badge / --cron / --every / --at`                                           | Per-kind badge variants       |
| `.schedule-summary`                                                                   | Mono compact schedule string  |
| `.run-status-badge / --ok / --err / --warn`                                           | Run status variants           |
| `.countdown-chip / --imminent / --soon / --later / --overdue`                         | Live countdown variants       |
| `.enabled-toggle / --on / --off`                                                      | Enabled pill variants         |
| `.failure-alert-badge`                                                                | Hero alerts pill              |
| `.job-detail / --empty`                                                               | Right pane                    |
| `.job-detail__btn / --primary / --danger / --spin`                                    | Action button variants        |
| `.job-detail__action-phase / --done`                                                  | Run-now phase strip           |
| `.job-detail__tab / --on`                                                             | Tab variants                  |
| `.overview-grid / .overview-cell / --ok / --err / --warn`                             | Overview tab grid             |
| `.schedule-grid / .schedule-pair`                                                     | Schedule tab grid             |
| `.run-table / __row / --err`                                                          | History tab grid              |
| `.json-block`                                                                         | Pretty-printed JSON pre       |
| `.modal-backdrop / .modal / --xwide`                                                  | CronBuilder modal shell       |
| `.builder-section / __title`                                                          | Builder section wrapper       |
| `.builder-grid`                                                                       | Builder field grid (auto-fit) |
| `.builder-field / __label / __input / --mono`                                         | Builder text field            |
| `.builder-tabs / .builder-tab / --on`                                                 | Schedule kind builder tabs    |
| `.toggle-row / __label / __text`                                                      | Behavior toggle row           |

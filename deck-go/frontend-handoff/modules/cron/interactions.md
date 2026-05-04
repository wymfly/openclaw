# cron — interactions (v2)

## Pointer

- **Topbar New job click** → opens CronBuilder modal (initial: null).
- **Topbar Refresh click** → spinner animates 720ms; production refetches
  jobs + runs + status.
- **JobsList row click** → selects job; right pane shows detail.
- **JobsList row Enter / Space** → identical to click (focused row).
- **JobsList enabled filter button click** → updates `enabledFilter`; rows refilter.
- **JobsList search input change** → live filter on name + id + cron expr.
- **JobsList sort select change** → updates sort key.
- **JobDetail tab click** → switches active tab. No refetch.
- **JobDetail Run now click** → 720ms running spinner → 800ms "triggered"
  done indicator → new run row appears. Disabled when job disabled.
- **JobDetail Disable / Enable click** → toggles job.enabled (no confirm).
- **JobDetail Edit click** → opens CronBuilder modal pre-filled.
- **JobDetail Delete click** → opens delete-confirm modal.
- **Delete confirm Cancel / backdrop click** → closes without delete.
- **Delete confirm Delete click** → fires delete; selection moves to next job.
- **CronBuilder schedule kind tab click** → switches kind + seeds defaults.
- **CronBuilder field change** → updates draft.
- **CronBuilder Save click (valid)** → 600ms saving phase → done → 600ms close.
- **CronBuilder Cancel / backdrop click** → closes without save.

## Keyboard

| Key                 | Context                   | Behavior                                                                       |
| ------------------- | ------------------------- | ------------------------------------------------------------------------------ |
| `Enter` / `Space`   | focused jobs row          | Select job.                                                                    |
| `Tab` / `Shift Tab` | within page               | Cycle: filter seg → search → sort → table rows → action buttons → detail tabs. |
| `Esc`               | CronBuilder modal open    | Close modal (except `saving` phase).                                           |
| `Esc`               | Delete confirm modal open | Close modal (cancel delete).                                                   |
| `Tab` / `Shift Tab` | within CronBuilder        | Cycle through fields → kind tabs → fields → toggles → footer.                  |

The CronBuilder's `saving` phase is **non-cancellable** — Esc + backdrop
no-op while the simulated 600ms timer is in flight. Same for JobDetail's
Run now `running` phase (~720ms).

## Hover

- **Topbar KPI cells** — no hover (informational only).
- **Topbar New job button** — bg lifts to accent-1.
- **Topbar Refresh button** — bg lifts; spinner animates while refreshing.
- **Filter seg button** — bg lifts; active keeps accent inset.
- **Search input** — no hover (focus only).
- **Sort select** — native dropdown.
- **JobsList row** — bg lifts to ds-bg-hover; selected keeps accent left inset shadow.
- **JobDetail tab** — color shifts to fg-1; active keeps accent border.
- **JobDetail Run now** — bg lifts; disabled shows muted style.
- **JobDetail Delete** — red tint bg.
- **CronBuilder kind tab** — bg lifts; active keeps accent.
- **ToggleRow** — checkbox + label clickable.

## Density

`compact` (default):

- Topbar padding `18px 28px`.
- Main row gap `18px`; row padding `18px 20px`.
- Jobs row padding `14px 18px`.
- Jobs list min-width `560px`.

`cozy`:

- Topbar padding `22px 32px`.
- Main row gap `22px`; row padding `22px 24px`.
- Jobs row padding `18px 22px`.
- Jobs list min-width `620px`.

The Tweaks panel toggles between the two via `data-density` on the root.

## Empty / loading / error

| Scenario                       | UI                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------- |
| `jobs = []`                    | Empty card "No jobs match." Detail empty card with calendar icon.               |
| Search filters all out         | Empty card "No jobs match."                                                     |
| `selectedId = null`            | Detail pane shows calendar icon + "Pick a job from the list."                   |
| Job has no runs                | History tab shows "No runs recorded yet." Last-run column shows "never".        |
| Run-now phase = `running`      | Run now button disabled + spinner; phase strip "running…" with `role="status"`. |
| Run-now phase = `done`         | Green check + "triggered" for 800ms.                                            |
| Builder save phase = `saving`  | Save + Cancel disabled. Foot phase strip "Saving…" with `role="status"`.        |
| Builder save phase = `done`    | Green check + "Saved." for 600ms.                                               |
| Builder validation fails       | Save disabled + "Required: name, schedule fields." muted hint.                  |
| Bootstrap not ready            | Subtitle shows "runtime v—".                                                    |
| Stream disconnect (production) | Topbar pill flips warn tone "Stream offline — Refresh to refetch."              |

## Focus

- After tab click → focus stays on the tab.
- After Refresh → focus stays on Refresh.
- After New job → focus stays on button until modal opens; focus trap on
  modal mount (production target).
- After Edit → focus jumps to first builder field (production target).
- After jobs row click → focus stays on the row.
- After Run now done → focus stays on Run now button.
- After delete confirm Delete click → focus moves to next selected row
  (production target).
- After CronBuilder save → focus returns to New job (or Edit) trigger.

## A11y semantics

- **Topbar**: KPI cells have implicit role from elements.
- **JobsList**:
  - Filter seg uses `role="tablist"` + `role="tab"` + `aria-selected`.
  - Table uses `role="table"` + per-row `role="row"` + per-cell `role="cell"`.
  - Each row has `aria-selected` + `tabIndex={0}`.
- **JobDetail**:
  - Tab strip uses `role="tablist"` + `role="tab"` + `aria-selected`.
  - Run-now phase strip uses `role="status"`.
- **CronBuilder modal**:
  - `role="dialog" aria-modal="true" aria-label="New job" | "Edit job · <name>"`.
  - Close button has `aria-label="Close builder"`.
  - Schedule kind tabs use `role="tablist"`.
  - Phase strip saving uses `role="status"`.
- **Delete confirm modal**:
  - `role="dialog" aria-modal="true" aria-label="Delete job confirm"`.
  - Close has `aria-label="Close confirm"`.
- **CountdownTimer**: production should expose remaining time via
  `aria-live="polite"` on a hidden span.

## Tweaks-driven exploration

Design-time only. Tweaks panel exposes:

- `theme` ∈ `dark | light`
- `density` ∈ `compact | cozy`

Production translation drops the panel entirely.

## Decision-critical mutations

This is a **mutation-heavy** panel. Every interaction with primary actions
either creates, updates, or removes a job — no draft state outside the
CronBuilder modal:

- **Run now**: synchronous trigger, recorded as new run entry.
- **Disable / Enable**: mutates `enabled`, persists immediately.
- **Edit**: opens CronBuilder; commit through Save.
- **Delete**: requires confirm dialog; non-reversible.

The CronBuilder is the only "draft" surface — you can edit fields without
committing until Save. Cancel discards.

## Cross-section coupling

- **Cron ↔ Activity** (US-006): each run emits a `cron.run` event that the
  activity panel surfaces in its full audit feed.
- **Cron ↔ Approvals** (US-016): exec approvals in jobs targeting commands
  may surface here as well; the contract for cron payloads doesn't gate
  exec approval — that's a runtime check at run-time.
- **Cron ↔ Agents** (`agents` panel): `agentId` field references agents
  registry; production should validate agent existence on Save.
- **Cron ↔ Sessions** (`sessions` panel): `sessionTarget` references session
  store keys; production should provide an autocomplete from session list.
- **Cron ↔ Webhooks** (US-018): both share the `delivery` field shape (untyped);
  semantics for cron may differ — worth aligning.
- **Cron ↔ Gateway** (US-015): describe lists `cron.*` methods; gateway is
  the canonical source for cron RPC truth.
- **Cron ↔ Alerts** (`alerts` panel): `failureAlert: true` jobs emit alert
  events that surface in alerts panel.

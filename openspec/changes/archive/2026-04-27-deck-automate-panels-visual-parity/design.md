## Context

Automate panels govern scheduled work, inbound/outbound automation, approval gates, and skill installation/configuration. The old Deck component tree encoded important workflow affordances that are not visible in the simplified Vite panels.

| Panel     | Old Deck evidence                                                                                                 | Current Vite evidence      | Meaning                                                                                         |
| --------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------- |
| Cron      | `CronPanel`, `JobForm`, `JobList`, `RunHistory`, `RunNowButton`                                                   | `CronPanel`                | Old job management workflow is collapsed.                                                       |
| Scheduler | `SchedulerPanel`, `HeartbeatConfig`, `JobForm`, `JobList`, `NextExecutionCountdown`, `RunHistory`, `RunNowButton` | no separate scheduler tree | Scheduler parity needs mapping into current Cron/scheduling surface or restored panel identity. |
| Webhooks  | `WebhooksPanel`, `WebhookForm`, `DeliveryHistory`                                                                 | `WebhooksPanel`            | Old form/history structure is reduced.                                                          |
| Approvals | `ApprovalsPanel`, `PendingList`, `PluginApprovalList`, `PolicyEditor`, `PathAllowlist`, `useApprovalsSSE`         | `ApprovalsPanel`           | Old policy and realtime pending workflows are collapsed.                                        |
| Skills    | `SkillsPanel`, `SkillList`, `SkillHubTab`, `SkillInfoTab`, `SkillConfig`, `SkillMatrixTab`, `InstallSkillDialog`  | `SkillsPanel`              | Old multi-tab skill management UI is not restored.                                              |

## Goals / Non-Goals

**Goals:**

- Restore old Automate panel visual structure and interaction flows.
- Preserve policy-sensitive approval behavior and real-time state.
- Keep Gateway/Go as runtime authority while fixing Go backend parity gaps required by old workflows.
- Make Automate panel visible copy EN/ZH-complete.

**Non-Goals:**

- Do not introduce new automation features that old Deck and Gateway do not support.
- Do not merge scheduler/cron semantics without documenting old-to-new mapping.
- Do not fake approval or delivery state.

## Decisions

### D1: Scheduler maps into the current Cron surface

Old Deck had both Cron and Scheduler component trees. The current shell has only the Cron automation entry, and this proposal's parallel-worktree scope should not change navigation, registry, or shell structure unless a Gateway capability requires it.

Decision: restore Scheduler affordances inside the current Cron panel as old-equivalent top-level sections:

- **Cron jobs**: old Cron job list, form, run history, run-now, empty/loading/error states.
- **Heartbeat / scheduling status**: old Scheduler heartbeat/countdown affordances where Gateway/Go data exists.

Unsupported Scheduler heartbeat controls must render as an explicit unavailable or read-only state and be recorded in `backend-gaps.md`; they must not be faked in the frontend.

### D2: Approvals preserves realtime and policy affordances

Approvals parity requires pending approvals, plugin approvals, policy editor, path allowlist, and SSE/stream status behavior. A static list is not enough.

### D3: Skills restores tabbed management

Skills must regain old hub/info/config/matrix/list/install-dialog affordances before visual parity can be claimed.

### D4: Backend gaps are fixed per automation workflow

If Go lacks old Node+Next service behavior for job CRUD, run history, run-now, webhook delivery history, approval stream/policy, or skill install/config data, the owning panel migration must fix the Go backend/API adapter or record a Gateway-unsupported exception.

### D5: Automate owns only its panel surfaces in parallel worktrees

Automate may run in a separate worktree from baseline `341d965a36`.

Owned implementation surfaces:

- `deck-go/frontend/src/components/panels/cron/**`
- `deck-go/frontend/src/components/panels/webhooks/**`
- `deck-go/frontend/src/components/panels/approvals/**`
- `deck-go/frontend/src/components/panels/skills/**`
- Automate panel tests and `openspec/changes/deck-automate-panels-visual-parity/**`

Shared-file rules:

- `deck-go/frontend/src/i18n/en.json` and `deck-go/frontend/src/i18n/zh.json` may be extended only with Automate panel-local keys.
- `deck-go/frontend/src/api.ts` and Go backend files may be changed only after the relevant row is added to `backend-gaps.md`.
- Cron/Scheduler mapping must be resolved inside this proposal before adding navigation, registry, or shell-level changes.
- Approval and skill side effects require targeted tests before merge.

### D6: Playwright E2E is deferred to the integration branch

This worktree must not run Playwright E2E. Automate visual parity work here is validated with source evidence, OpenSpec strict validation, TypeScript/build checks when implementation begins, and targeted unit/component tests for the affected panels. Browser traversal and full Playwright E2E are deferred until the parallel worktrees merge back to the integration/local branch.

### D7: Shared backend and shell gaps are follow-ups by default

Automate may fix panel-owned adapter/projection gaps after recording the row in `backend-gaps.md`. Shared Gateway protocol changes, shared Gateway handlers, shell/nav/registry changes, and broad Go service contracts are not absorbed into this worktree by default. If an old Deck workflow needs one of those broader changes, this proposal must render an explicit unsupported/unavailable state and record the follow-up.

### D8: Non-Playwright parity evidence uses old-to-new checklists

Because this worktree defers Playwright E2E, every Automate panel must maintain `parity-checklists.md` as the local visual/interaction evidence artifact. The checklist maps old authority components to new Vite targets and tracks layout, actions, loading/empty/error states, EN/ZH copy, light/dark coverage, and unsupported runtime capabilities.

## Risks / Trade-offs

- **Risk: Cron/Scheduler names do not map one-to-one in Go.** → Make the mapping explicit before implementation, treat Scheduler-in-Cron as this worktree's merge-safety mapping, and keep visible copy consistent with old Deck where possible.
- **Risk: approval policy changes are sensitive.** → Add targeted tests around policy editor and approval actions.
- **Risk: skills may depend on local filesystem/plugin state.** → Treat missing backend projections as explicit Go service gaps, not frontend omissions.
- **Risk: no Playwright in this branch lowers visual confidence.** → Use old-to-new parity checklists plus targeted tests/build/OpenSpec, then run browser/E2E after merge.

## Migration Plan

1. Keep Scheduler inside the current Cron panel and document any unavailable heartbeat controls in `backend-gaps.md`.
2. Restore Cron/Scheduler job list/form/history/run-now/countdown/heartbeat UI.
3. Restore Webhooks form and delivery history UI.
4. Restore Approvals pending/plugin/policy/path allowlist/realtime UI.
5. Restore Skills list/hub/info/config/matrix/install UI.
6. Complete `parity-checklists.md` entries and run group-level i18n, light/dark, targeted action tests, OpenSpec validation, and backend gap validation in this worktree.
7. Defer browser traversal and Playwright E2E to the post-merge integration branch.

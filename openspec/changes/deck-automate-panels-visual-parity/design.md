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

### D1: Cron and Scheduler need an explicit mapping

Old Deck had both Cron and Scheduler component trees. The Vite migration must document whether Scheduler is restored as a separate panel, folded into Cron with old-equivalent sections, or intentionally unavailable due to Gateway capability.

### D2: Approvals preserves realtime and policy affordances

Approvals parity requires pending approvals, plugin approvals, policy editor, path allowlist, and SSE/stream status behavior. A static list is not enough.

### D3: Skills restores tabbed management

Skills must regain old hub/info/config/matrix/list/install-dialog affordances before visual parity can be claimed.

### D4: Backend gaps are fixed per automation workflow

If Go lacks old Node+Next service behavior for job CRUD, run history, run-now, webhook delivery history, approval stream/policy, or skill install/config data, the owning panel migration must fix the Go backend/API adapter or record a Gateway-unsupported exception.

## Risks / Trade-offs

- **Risk: Cron/Scheduler names do not map one-to-one in Go.** → Make the mapping explicit before implementation and keep visible copy consistent with old Deck where possible.
- **Risk: approval policy changes are sensitive.** → Add targeted tests around policy editor and approval actions.
- **Risk: skills may depend on local filesystem/plugin state.** → Treat missing backend projections as explicit Go service gaps, not frontend omissions.

## Migration Plan

1. Decide and document Cron/Scheduler panel mapping.
2. Restore Cron/Scheduler job list/form/history/run-now/countdown/heartbeat UI.
3. Restore Webhooks form and delivery history UI.
4. Restore Approvals pending/plugin/policy/path allowlist/realtime UI.
5. Restore Skills list/hub/info/config/matrix/install UI.
6. Run group-level i18n, light/dark, browser traversal, action tests, and backend gap validation.

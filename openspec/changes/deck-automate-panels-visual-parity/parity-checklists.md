# Automate Old-to-New Parity Checklists

Use this file as the non-Playwright visual/interaction evidence artifact for this worktree. Mark items only after implementation verifies the old authority file and the new Vite target.

## Cron / Scheduler

Old authority:

- `dashboard/src/components/panels/cron/CronPanel.tsx`
- `dashboard/src/components/panels/cron/JobForm.tsx`
- `dashboard/src/components/panels/cron/JobList.tsx`
- `dashboard/src/components/panels/cron/RunHistory.tsx`
- `dashboard/src/components/panels/cron/RunNowButton.tsx`
- `dashboard/src/components/panels/scheduler/SchedulerPanel.tsx`
- `dashboard/src/components/panels/scheduler/HeartbeatConfig.tsx`
- `dashboard/src/components/panels/scheduler/NextExecutionCountdown.tsx`

New target:

- `deck-go/frontend/src/components/panels/cron/**`

Checklist:

- [x] Sidebar/list affordance restored for scheduled jobs.
- [x] Create/edit form restored with old-equivalent schedule, payload, target, enabled, and action feedback fields.
- [x] Run history restored with loading/empty/error states.
- [x] Run-now action restored and covered by targeted tests.
- [x] Next execution countdown restored from available job/status data.
- [x] Heartbeat/Scheduler config renders a real control only when backed by Go/Gateway; otherwise it renders explicit read-only/unavailable state.
- [x] EN/ZH visible copy is wired through i18n.
- [x] Light/dark classes and old-equivalent density are checked without Playwright.

## Webhooks

Old authority:

- `dashboard/src/components/panels/webhooks/WebhooksPanel.tsx`
- `dashboard/src/components/panels/webhooks/WebhookForm.tsx`
- `dashboard/src/components/panels/webhooks/DeliveryHistory.tsx`

New target:

- `deck-go/frontend/src/components/panels/webhooks/**`

Checklist:

- [x] Sidebar/list affordance restored for webhooks.
- [x] Detail/form/delivery modes restored.
- [x] Create/edit/delete/test actions preserve current Go API payloads.
- [x] Validation and action feedback are visible.
- [x] Delivery history renders current status, response, error, and timing fields when available.
- [x] Missing old-only delivery metadata renders as unavailable instead of fake data.
- [x] EN/ZH visible copy is wired through i18n.
- [x] Light/dark classes and old-equivalent density are checked without Playwright.

## Approvals

Old authority:

- `dashboard/src/components/panels/approvals/ApprovalsPanel.tsx`
- `dashboard/src/components/panels/approvals/PendingList.tsx`
- `dashboard/src/components/panels/approvals/PluginApprovalList.tsx`
- `dashboard/src/components/panels/approvals/PolicyEditor.tsx`
- `dashboard/src/components/panels/approvals/PathAllowlist.tsx`
- `dashboard/src/components/panels/approvals/useApprovalsSSE.ts`

New target:

- `deck-go/frontend/src/components/panels/approvals/**`

Checklist:

- [x] Pending approvals tab/list restored.
- [x] Plugin approvals tab/list restored.
- [x] Policy editor restored with defaults and per-agent policy editing.
- [x] Path allowlist editor restored.
- [x] Realtime stream status and add/remove behavior preserved.
- [x] Allow once / allow always / deny / plugin approve-deny actions preserve current semantics.
- [x] EN/ZH visible copy is wired through i18n.
- [x] Light/dark classes and old-equivalent density are checked without Playwright.

## Skills

Old authority:

- `dashboard/src/components/panels/skills/SkillsPanel.tsx`
- `dashboard/src/components/panels/skills/SkillList.tsx`
- `dashboard/src/components/panels/skills/SkillHubTab.tsx`
- `dashboard/src/components/panels/skills/SkillInfoTab.tsx`
- `dashboard/src/components/panels/skills/SkillConfig.tsx`
- `dashboard/src/components/panels/skills/SkillMatrixTab.tsx`
- `dashboard/src/components/panels/skills/InstallSkillDialog.tsx`

New target:

- `deck-go/frontend/src/components/panels/skills/**`

Checklist:

- [x] Installed skills list restored with search/filter/status affordances.
- [x] Hub tab restored with bins/search/detail/install/update affordances.
- [x] Info tab restored for selected skill metadata.
- [x] Config tab restored and preserves current update payloads.
- [x] Matrix tab restored and preserves current agent skill update payloads.
- [x] Install dialog restored for local/managed install options that Go/Gateway supports.
- [x] Unsupported install/hub metadata renders as unavailable instead of fake data.
- [x] EN/ZH visible copy is wired through i18n.
- [x] Light/dark classes and old-equivalent density are checked without Playwright.

## Verification Notes

- Component-level old-to-new parity was checked against the old authority files listed above and the new Vite targets.
- Density/theme parity is checked through the existing `deckgo-*` shell classes and panel-local `deck-ui-*` classes; browser screenshot traversal is intentionally deferred to the merged integration branch.

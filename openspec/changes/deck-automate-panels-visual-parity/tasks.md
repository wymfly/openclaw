## 0. Parallel Worktree Readiness

- [x] 0.1 Confirm this worktree starts from `341d965a36` or a documented descendant shared-baseline commit.
- [x] 0.2 Create and maintain `backend-gaps.md` before changing Go backend/API adapter files.
- [x] 0.3 Create `parity-checklists.md` as the non-Playwright old-to-new visual/interaction evidence artifact.
- [x] 0.4 Keep shared frontend edits panel-local, namespaced, and recorded in the task evidence.

## 1. Cron / Scheduler

- [x] 1.1 Map old `dashboard/src/components/panels/cron` and `dashboard/src/components/panels/scheduler` files to Vite targets.
- [x] 1.2 Decide and document whether Scheduler restores a separate panel identity or maps into the current Cron surface.
- [x] 1.3 Extract current Vite Cron state/actions into composable props without changing API payloads.
- [x] 1.4 Restore `JobList`, `JobForm`, `RunHistory`, `RunNowButton`, `NextExecutionCountdown`, and `HeartbeatConfig` component boundaries under `deck-go/frontend/src/components/panels/cron/**`.
- [x] 1.5 Rebuild the current Cron panel into old-equivalent Cron jobs + heartbeat sections, preserving loading/empty/error states.
- [x] 1.6 Fix or classify Go backend/API gaps for job CRUD, scheduler heartbeat, next execution, run history, and run-now behavior.
- [x] 1.7 Remove hardcoded Cron/Scheduler visible copy by using Automate-local EN/ZH i18n keys.
- [x] 1.8 Validate Cron/Scheduler with targeted component tests and `parity-checklists.md`.

## 2. Webhooks

- [x] 2.1 Map old `dashboard/src/components/panels/webhooks` files to Vite targets.
- [x] 2.2 Extract current Vite Webhooks state/actions into composable props without changing API payloads.
- [x] 2.3 Restore old-equivalent `WebhookForm` and `DeliveryHistory` component boundaries plus sidebar/detail/form/delivery views.
- [x] 2.4 Preserve validation, create/edit/delete/test action feedback, delivery status, and selected-webhook behavior.
- [x] 2.5 Fix or classify Go backend/API gaps for webhook create/edit/delete/test and delivery history projections.
- [x] 2.6 Remove hardcoded Webhooks visible copy by using Automate-local EN/ZH i18n keys.
- [x] 2.7 Validate Webhooks with targeted component tests and `parity-checklists.md`.

## 3. Approvals

- [x] 3.1 Map old `dashboard/src/components/panels/approvals` files to Vite targets.
- [x] 3.2 Extract current Vite approval normalization, policy sanitization, and stream handling into panel-local helpers/hooks.
- [x] 3.3 Restore `PendingList`, `PluginApprovalList`, `PolicyEditor`, `PathAllowlist`, and approval stream status component boundaries.
- [x] 3.4 Preserve pending approval navigation, allow/deny actions, plugin approval actions, policy save/reset behavior, and realtime add/remove updates.
- [x] 3.5 Fix or classify Go backend/API gaps for approval pending state, plugin approval state, policy read/write, path allowlist, and SSE/stream events.
- [x] 3.6 Remove hardcoded Approvals visible copy by using Automate-local EN/ZH i18n keys.
- [x] 3.7 Validate Approvals with targeted policy/action/stream component tests and `parity-checklists.md`.

## 4. Skills

- [x] 4.1 Map old `dashboard/src/components/panels/skills` files to Vite targets.
- [x] 4.2 Extract current Vite skill normalization, hub, config, install, update, and agent-matrix state/actions into composable props.
- [x] 4.3 Restore `SkillList`, `SkillHubTab`, `SkillInfoTab`, `SkillConfig`, `SkillMatrixTab`, and `InstallSkillDialog` component boundaries.
- [x] 4.4 Preserve installed/hub modes, info/config tabs, hub search/detail/install/update, local install options, and agent skill matrix toggles.
- [x] 4.5 Fix or classify Go backend/API gaps for skill listing, install, config, metadata, and matrix/projection behavior.
- [x] 4.6 Remove hardcoded Skills visible copy by using Automate-local EN/ZH i18n keys.
- [x] 4.7 Validate Skills with targeted component tests and `parity-checklists.md`.

## 5. Cross-Automate Validation

- [x] 5.1 Run targeted Automate panel tests with `cd deck-go/frontend && npm run test:deck-ui -- src/components/panels/cron/CronPanel.test.tsx src/components/panels/webhooks/WebhooksPanel.test.tsx src/components/panels/approvals/ApprovalsPanel.test.tsx src/components/panels/skills/SkillsPanel.test.tsx`.
- [x] 5.2 Run `cd deck-go/frontend && npm run build` after implementation touches TypeScript/component boundaries.
- [x] 5.3 Run `openspec validate deck-automate-panels-visual-parity --strict`.
- [x] 5.4 Confirm every Automate panel has old authority files, current target files, backend gap classification, and completed `parity-checklists.md` entries.
- [x] 5.5 Defer browser plugin traversal and Playwright E2E until all parallel worktrees merge back to the integration/local branch.

## Evidence

- Targeted Automate panel tests passed: `npm run test:deck-ui -- src/components/panels/cron/CronPanel.test.tsx src/components/panels/webhooks/WebhooksPanel.test.tsx src/components/panels/approvals/ApprovalsPanel.test.tsx src/components/panels/skills/SkillsPanel.test.tsx` (`4 passed`, `22 passed`).
- Production build passed: `cd deck-go/frontend && npm run build` (`check:deck-ui-host`, `tsc -b`, and `vite build` all passed).
- OpenSpec validation passed: `openspec validate deck-automate-panels-visual-parity --strict`.
- Browser plugin traversal and Playwright E2E remain intentionally deferred until this worktree is merged back to the integration/local branch.

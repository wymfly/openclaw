## 0. Parallel Worktree Readiness

- [ ] 0.1 Confirm this worktree starts from `341d965a36` or a documented descendant shared-baseline commit.
- [ ] 0.2 Create and maintain `backend-gaps.md` before changing Go backend/API adapter files.
- [ ] 0.3 Keep shared frontend edits panel-local, namespaced, and recorded in the task evidence.

## 1. Cron / Scheduler

- [ ] 1.1 Map old `dashboard/src/components/panels/cron` and `dashboard/src/components/panels/scheduler` files to Vite targets.
- [ ] 1.2 Decide and document whether Scheduler restores a separate panel identity or maps into the current Cron surface.
- [ ] 1.3 Restore job form, job list, run history, run-now button, next execution countdown, heartbeat config, and loading/empty/error states.
- [ ] 1.4 Fix or classify Go backend/API gaps for job CRUD, scheduler heartbeat, next execution, run history, and run-now behavior.
- [ ] 1.5 Validate Cron/Scheduler EN/ZH, light/dark, list/form/history/run-now screenshots.

## 2. Webhooks

- [ ] 2.1 Map old `dashboard/src/components/panels/webhooks` files to Vite targets.
- [ ] 2.2 Restore webhook form, validation, delivery history, status, and action feedback surfaces.
- [ ] 2.3 Fix or classify Go backend/API gaps for webhook create/edit/delete/test and delivery history projections.
- [ ] 2.4 Validate Webhooks EN/ZH, light/dark, form/history screenshots.

## 3. Approvals

- [ ] 3.1 Map old `dashboard/src/components/panels/approvals` files to Vite targets.
- [ ] 3.2 Restore pending list, plugin approval list, policy editor, path allowlist, approval stream state, and action feedback.
- [ ] 3.3 Fix or classify Go backend/API gaps for approval pending state, plugin approval state, policy read/write, path allowlist, and SSE/stream events.
- [ ] 3.4 Validate Approvals EN/ZH, light/dark, pending/plugin/policy/allowlist screenshots.

## 4. Skills

- [ ] 4.1 Map old `dashboard/src/components/panels/skills` files to Vite targets.
- [ ] 4.2 Restore skill list, hub tab, info tab, config tab, matrix tab, install dialog, and loading/empty/error states.
- [ ] 4.3 Fix or classify Go backend/API gaps for skill listing, install, config, metadata, and matrix/projection behavior.
- [ ] 4.4 Validate Skills EN/ZH, light/dark, list/hub/info/config/matrix/install screenshots.

## 5. Cross-Automate Validation

- [ ] 5.1 Run targeted Automate panel tests.
- [ ] 5.2 Run browser plugin traversal for all Automate panels.
- [ ] 5.3 Confirm every Automate panel has old authority files, current target files, backend gap classification, and screenshot evidence.

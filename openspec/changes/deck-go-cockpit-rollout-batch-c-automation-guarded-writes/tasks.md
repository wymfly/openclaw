## 1. Baseline

- [x] 1.1 Read the head cockpit rollout matrix and Batch C proposal/design/specs.
- [x] 1.2 Confirm Webhooks, Cron, and Approvals remain partial-fit and no new pattern is required.

## 2. Webhooks Migration

- [x] 2.1 Replace Webhooks root/topbar/KPI/status/pill/surface chrome with existing cockpit patterns.
- [x] 2.2 Keep receiver rows, event subscription controls, receiver form, delivery evidence rows, test result seam, and raw payload disclosure local.

## 3. Cron Migration

- [x] 3.1 Replace Cron root/topbar/KPI/status/pill/surface chrome with existing cockpit patterns.
- [x] 3.2 Keep job rows, schedule forms, heartbeat details, run-history rows, and manual-run evidence local.

## 4. Approvals Migration

- [x] 4.1 Replace Approvals root/topbar/KPI/status/pill/surface chrome with existing cockpit patterns.
- [x] 4.2 Keep decision controls, policy defaults, allowlist rows, plugin approval rows, stream evidence, and raw policy/action disclosure local.

## 5. Readiness And Hygiene

- [x] 5.1 Update the cockpit rollout readiness matrix with Batch C implementation status and evidence.
- [x] 5.2 Run style hygiene checks for stale aliases, copied cockpit CSS, and local reimplementation of migrated structures.

## 6. Verification

- [x] 6.1 Run `openspec validate deck-go-cockpit-rollout-batch-c-automation-guarded-writes --type change --strict`.
- [x] 6.2 Run `cd deck-go && make frontend-build`.
- [x] 6.3 Run `cd deck-go && make e2e-mock-module MODULE=webhooks`.
- [x] 6.4 Run `cd deck-go && make e2e-mock-module MODULE=cron`.
- [x] 6.5 Run `cd deck-go && make e2e-mock-module MODULE=approvals`.
- [x] 6.6 Run `git diff --check`.

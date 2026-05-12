## 1. Baseline

- [x] 1.1 Read the head cockpit rollout artifacts and Batch A proposal/design/specs.
- [x] 1.2 Confirm Budget and Alerts are direct-fit and Threads remains deferred for this batch.

## 2. Budget Migration

- [x] 2.1 Replace Budget root/header/KPI/status/pill/surface chrome with existing cockpit patterns.
- [x] 2.2 Remove Budget CSS that duplicates cockpit-owned root/header/KPI/metric/status/pill/surface styling.
- [x] 2.3 Keep Budget rule rows, threshold progress, forms, evaluation cards, local changes, and confirmation flows local.

## 3. Alerts Migration

- [x] 3.1 Replace Alerts root/header/KPI/status/pill/surface chrome with existing cockpit patterns.
- [x] 3.2 Remove Alerts CSS that duplicates cockpit-owned root/header/KPI/metric/status/pill/surface styling.
- [x] 3.3 Keep Alerts rule rows, forms, fired history, condition cards, audit/test seams, and confirmation flows local.

## 4. Readiness And Hygiene

- [x] 4.1 Update the cockpit rollout readiness matrix with Batch A implementation status and evidence.
- [x] 4.2 Run style hygiene checks for stale aliases, copied cockpit CSS, and local reimplementation of migrated structures.

## 5. Verification

- [x] 5.1 Run `openspec validate deck-go-cockpit-rollout-batch-a-control-policy --type change --strict`.
- [x] 5.2 Run `cd deck-go && make frontend-build`.
- [x] 5.3 Run `cd deck-go && make e2e-mock-module MODULE=budget`.
- [x] 5.4 Run `cd deck-go && make e2e-mock-module MODULE=alerts`.
- [x] 5.5 Run `git diff --check`.

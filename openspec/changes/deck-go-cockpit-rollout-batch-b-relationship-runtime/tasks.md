## 1. Baseline

- [x] 1.1 Read the head cockpit rollout matrix and Batch B proposal/design/specs.
- [x] 1.2 Confirm Identity, Subagents, and Channels remain partial-fit and no new pattern is required.

## 2. Identity Migration

- [x] 2.1 Replace Identity root/topbar/KPI/status/pill/surface chrome with existing cockpit patterns.
- [x] 2.2 Keep hash chips, channel pills, peer mapping rows, link/unlink dialogs, base-hash guard, and raw payload disclosure local.

## 3. Subagents Migration

- [x] 3.1 Replace Subagents root/topbar/KPI/status/pill/surface chrome with existing cockpit patterns.
- [x] 3.2 Keep run queue rows, lineage tree/timeline, defaults grid, permissions, and action results local.

## 4. Channels Migration

- [x] 4.1 Replace Channels shared list/detail header/KPI/status/surface chrome with existing cockpit patterns where it matches.
- [x] 4.2 Keep channel inventory rows, diagnostics, probe badges, WeCom controls, routing handoff, and throughput chart local.

## 5. Readiness And Hygiene

- [x] 5.1 Update the cockpit rollout readiness matrix with Batch B implementation status and evidence.
- [x] 5.2 Run style hygiene checks for stale aliases, copied cockpit CSS, and local reimplementation of migrated structures.

## 6. Verification

- [x] 6.1 Run `openspec validate deck-go-cockpit-rollout-batch-b-relationship-runtime --type change --strict`.
- [x] 6.2 Run `cd deck-go && make frontend-build`.
- [x] 6.3 Run `cd deck-go && make e2e-mock-module MODULE=identity`.
- [x] 6.4 Run `cd deck-go && make e2e-mock-module MODULE=subagents`.
- [x] 6.5 Run `cd deck-go && make e2e-mock-module MODULE=channels`.
- [x] 6.6 Run `git diff --check`.

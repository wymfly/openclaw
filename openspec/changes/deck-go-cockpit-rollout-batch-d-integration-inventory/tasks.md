## 1. Baseline

- [x] 1.1 Read the head cockpit rollout matrix and Batch D proposal/design/specs.
- [x] 1.2 Confirm Skills, Plugins, and Nodes remain partial-fit and no new pattern is required.

## 2. Skills Migration

- [x] 2.1 Replace Skills root/header/KPI/status/pill/surface chrome with existing cockpit patterns.
- [x] 2.2 Keep skill inventory rows, requirement evidence, config editors, install option rows, ClawHub catalog, and agent matrix local.

## 3. Plugins Migration

- [x] 3.1 Replace Plugins root/header/KPI/status/pill/surface chrome with existing cockpit patterns.
- [x] 3.2 Keep plugin inventory rows, capability/action evidence, diagnostics, related-channel handoff, and lifecycle notices local.

## 4. Nodes Migration

- [x] 4.1 Replace Nodes root/header/KPI/status/pill/surface chrome with existing cockpit patterns.
- [x] 4.2 Keep lifecycle strips, pairing rows, dynamic command forms, pending-work queue, and permission/capability chips local.

## 5. Readiness And Hygiene

- [x] 5.1 Update the cockpit rollout readiness matrix with Batch D implementation status and evidence.
- [x] 5.2 Run style hygiene checks for stale aliases, copied cockpit CSS, and local reimplementation of migrated structures.

## 6. Verification

- [x] 6.1 Run `openspec validate deck-go-cockpit-rollout-batch-d-integration-inventory --type change --strict`.
- [x] 6.2 Run `cd deck-go && make frontend-build`.
- [x] 6.3 Run `cd deck-go && make e2e-mock-module MODULE=skills`.
- [x] 6.4 Run `cd deck-go && make e2e-mock-module MODULE=plugins`.
- [x] 6.5 Run `cd deck-go && make e2e-mock-module MODULE=nodes`.
- [x] 6.6 Run `git diff --check`.

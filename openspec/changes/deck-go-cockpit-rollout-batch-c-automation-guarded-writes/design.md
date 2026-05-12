## Context

Batch C follows the verified Batch A and Batch B migrations. Webhooks, Cron,
and Approvals are automation/control panels. Their shared panel chrome can move
to cockpit patterns, but the guarded write flows are the highest-risk user
paths and must remain local.

## Goals / Non-Goals

**Goals:**

- Replace matching Webhooks, Cron, and Approvals root/header/KPI/status/pill/
  surface chrome with existing cockpit pattern components.
- Keep receiver delivery, scheduler, approval, policy, stream, confirmation,
  and raw payload molecules local.
- Preserve runtime behavior, data fetching, mutations, i18n keys, and tests.
- Extend the style hygiene evidence from Batches A and B to guarded-write
  panels.

**Non-Goals:**

- No new `GuardedWritePanel`, `DecisionGroup`, `RunHistory`, or delivery
  evidence pattern in this batch.
- No change to `PanelCockpit` props, variants, or CSS contract.
- No backend/BFF/Gateway/contract/dependency changes.

## Decisions

### Decision 1: Guarded writes stay local

Batch C SHALL migrate only structures expressible by existing cockpit APIs.
Webhook receiver/test flows, Cron scheduler forms/manual runs, and Approvals
decision/policy flows stay module-local.

### Decision 2: Safety semantics are not visual primitives

Confirmation dialogs, destructive states, base-hash guarded saves, approval
decision controls, and stream evidence SHALL NOT be promoted or normalized
during this visual rollout. They need separate source-truth and safety analysis.

### Decision 3: Style hygiene remains mandatory

Touched modules SHALL NOT introduce old token alias fallbacks, module-private
font systems, copied cockpit CSS, or local reimplementations of migrated
header/KPI/status/surface structures.

## Verification Plan

- `openspec validate deck-go-cockpit-rollout-batch-c-automation-guarded-writes --type change --strict`
- `cd deck-go && make frontend-build`
- `cd deck-go && make e2e-mock-module MODULE=webhooks`
- `cd deck-go && make e2e-mock-module MODULE=cron`
- `cd deck-go && make e2e-mock-module MODULE=approvals`
- `git diff --check`
- Focused style hygiene scans for stale aliases and copied cockpit CSS in
  Webhooks, Cron, and Approvals.

## Rollback

Rollback is a clean revert of Batch C runtime and documentation changes. No
persisted data or contract migration is involved.

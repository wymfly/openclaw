## Why

The cockpit rollout head program classified Webhooks, Cron, and Approvals as
partial-fit panels. They repeat workbench root/header, KPI, status/pill, and
selected entity shell anatomy, but their receiver delivery, scheduler,
approval, policy, stream, and guarded mutation surfaces remain module-specific.

## What Changes

- Migrate Webhooks shared cockpit chrome to existing `PanelCockpit` APIs.
- Migrate Cron shared cockpit chrome to existing `PanelCockpit` APIs.
- Migrate Approvals shared cockpit chrome to existing `PanelCockpit` APIs.
- Keep receiver forms, delivery/test seams, scheduler forms, run history,
  approval decisions, policy controls, stream evidence, confirmation flows, and
  raw action payloads module-local.
- Update cockpit rollout readiness evidence after verification.

## Out Of Scope

- No global token value changes.
- No design-system atom public API changes.
- No `PanelCockpit` API changes.
- No backend, BFF, Gateway, generated contract, dependency, routing, data
  loading, or mutation behavior changes.
- No promotion of guarded write, scheduler, delivery, stream, or security
  decision molecules into the design system.

## Impact

- Runtime frontend:
  - `deck-go/frontend-new/src/components/panels/webhooks/**`
  - `deck-go/frontend-new/src/components/panels/cron/**`
  - `deck-go/frontend-new/src/components/panels/approvals/**`
- Documentation/evidence:
  - `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cockpit-rollout-readiness-matrix.md`
- OpenSpec artifacts:
  - `openspec/changes/deck-go-cockpit-rollout-batch-c-automation-guarded-writes/**`

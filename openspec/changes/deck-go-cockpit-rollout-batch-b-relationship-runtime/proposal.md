## Why

The cockpit rollout head program classified Identity, Subagents, and Channels
as partial-fit panels. They repeat root/topbar, KPI, status/pill, selected
detail, and panel surface anatomy, but their relationship, lineage, diagnostics,
provider access, and routing handoff molecules remain module-specific.

## What Changes

- Migrate Identity shared cockpit chrome to existing `PanelCockpit` APIs.
- Migrate Subagents shared cockpit chrome to existing `PanelCockpit` APIs.
- Migrate Channels shared cockpit chrome where the current list/detail anatomy
  matches existing cockpit APIs.
- Keep identity hash/channel chips, link/unlink dialogs, Subagents lineage and
  permission grids, Channels diagnostics/probe/WeCom/routing handoff, and
  throughput charts module-local.
- Update cockpit rollout readiness evidence after verification.

## Out Of Scope

- No global token value changes.
- No design-system atom public API changes.
- No `PanelCockpit` API changes.
- No backend, BFF, Gateway, generated contract, dependency, routing, data
  loading, or mutation behavior changes.
- No promotion of relationship, lineage, access-control, or diagnostics
  molecules into the design system.

## Impact

- Runtime frontend:
  - `deck-go/frontend-new/src/components/panels/identity/**`
  - `deck-go/frontend-new/src/components/panels/subagents/**`
  - `deck-go/frontend-new/src/components/panels/channels/**`
- Documentation/evidence:
  - `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cockpit-rollout-readiness-matrix.md`
- OpenSpec artifacts:
  - `openspec/changes/deck-go-cockpit-rollout-batch-b-relationship-runtime/**`

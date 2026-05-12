## Why

The cockpit rollout head program classified Budget and Alerts as direct-fit
panels for the existing cockpit pattern set. Both panels still carry local
copies of shared panel chrome: root spacing, section headers, KPI strips,
metric cards, status pills, and top-level panel surfaces. That duplicates the
validated Sessions/Usage/Logs cockpit primitives and increases the chance that
later modules mix design-system and private styling inconsistently.

## What Changes

- Migrate Budget shared panel chrome to existing cockpit patterns.
- Migrate Alerts shared panel chrome to existing cockpit patterns.
- Keep Budget rule rows, threshold progress, scoped rule forms, evaluation
  cards, local change rows, and destructive confirmation flows local.
- Keep Alerts rule rows, trigger/action forms, fired-history fallback,
  condition cards, audit/test preview seams, and destructive confirmation flows
  local.
- Remove or reduce module CSS that reimplements cockpit-owned root/header/KPI/
  metric/status/pill/surface structures.
- Update cockpit rollout readiness evidence after verification.

## Out Of Scope

- Threads migration. It remains deferred until Budget and Alerts validate the
  direct-fit rollout shape.
- No global token value changes.
- No design-system atom public API changes.
- No `PanelCockpit` API changes.
- No backend, BFF, Gateway, generated contract, dependency, or data-loading
  changes.
- No promotion of Budget or Alerts business molecules into design-system
  patterns.

## Impact

- Runtime frontend:
  - `deck-go/frontend-new/src/components/panels/budget/**`
  - `deck-go/frontend-new/src/components/panels/alerts/**`
- Documentation/evidence:
  - `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cockpit-rollout-readiness-matrix.md`
- OpenSpec artifacts:
  - `openspec/changes/deck-go-cockpit-rollout-batch-a-control-policy/**`

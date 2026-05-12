## Why

The cockpit rollout head program classified Skills, Plugins, and Nodes as
partial-fit panels. They repeat page header, KPI, status/pill, surface, and
selected entity shell anatomy, but their marketplace, plugin lifecycle,
remote-control, pairing, permission, and trust semantics are module-specific.

## What Changes

- Migrate Skills shared cockpit chrome to existing `PanelCockpit` APIs.
- Migrate Plugins shared cockpit chrome to existing `PanelCockpit` APIs.
- Migrate Nodes shared cockpit chrome to existing `PanelCockpit` APIs.
- Keep skill install/config/catalog, plugin capability/lifecycle evidence, and
  node pairing/remote command/pending-work molecules module-local.
- Update cockpit rollout readiness evidence after verification.

## Out Of Scope

- No global token value changes.
- No design-system atom public API changes.
- No `PanelCockpit` API changes.
- No backend, BFF, Gateway, generated contract, dependency, routing, data
  loading, or mutation behavior changes.
- No promotion of marketplace, install, lifecycle, pairing, remote-control,
  permission, trust, or command-schema molecules into the design system.

## Impact

- Runtime frontend:
  - `deck-go/frontend-new/src/components/panels/skills/**`
  - `deck-go/frontend-new/src/components/panels/plugins/**`
  - `deck-go/frontend-new/src/components/panels/nodes/**`
- Visual mock E2E:
  - `deck-go/test/e2e/skills-visual.spec.ts`
  - `deck-go/test/e2e/plugins-visual.spec.ts`
  - `deck-go/test/e2e/nodes-visual.spec.ts`
- Documentation/evidence:
  - `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cockpit-rollout-readiness-matrix.md`
- OpenSpec artifacts:
  - `openspec/changes/deck-go-cockpit-rollout-batch-d-integration-inventory/**`

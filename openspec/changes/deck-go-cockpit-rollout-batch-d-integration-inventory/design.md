## Context

Batch D follows the verified Batch A, Batch B, and Batch C migrations. Skills,
Plugins, and Nodes are integration/inventory panels. Their shared panel chrome
can move to cockpit patterns, but the high-risk operational semantics stay
local.

## Goals / Non-Goals

**Goals:**

- Replace matching Skills, Plugins, and Nodes root/header/KPI/status/pill/
  surface chrome with existing cockpit pattern components.
- Keep skill inventory rows, requirement evidence, config editors, install
  options, ClawHub catalog, plugin inventory/capability/action evidence,
  lifecycle limitation notices, node lifecycle strips, pairing rows, dynamic
  command forms, pending-work queues, and permission/capability chips local.
- Preserve runtime behavior, data fetching, mutations, i18n keys, and tests.
- Extend style hygiene evidence to integration/inventory panels.

**Non-Goals:**

- No new `MarketplaceCard`, `LifecycleEvidence`, `RemoteCommandPanel`,
  `PairingQueue`, or `PermissionChipCluster` pattern in this batch.
- No change to `PanelCockpit` props, variants, or CSS contract.
- No backend/BFF/Gateway/contract/dependency changes.

## Decisions

### Decision 1: Operational trust semantics stay local

Skills install/config, Plugins lifecycle evidence, and Nodes remote-control or
pairing flows SHALL remain module-local. They require source-truth and safety
analysis before any design-system promotion.

### Decision 2: Shared chrome only uses existing APIs

Batch D SHALL use only `PanelRoot`, `PanelSurface`, `PanelSectionHeader`,
`PanelStatusRow`, `PanelPill`, `KpiStrip`, and `PanelMetric`. If a structure
needs a different abstraction, this batch SHALL record a follow-up rather than
expanding the design system.

### Decision 3: Style hygiene remains mandatory

Touched modules SHALL NOT introduce old token alias fallbacks, module-private
font systems, copied cockpit CSS, or local reimplementations of migrated
header/KPI/status/surface structures.

## Verification Plan

- `openspec validate deck-go-cockpit-rollout-batch-d-integration-inventory --type change --strict`
- `cd deck-go && make frontend-build`
- `cd deck-go && make e2e-mock-module MODULE=skills`
- `cd deck-go && make e2e-mock-module MODULE=plugins`
- `cd deck-go && make e2e-mock-module MODULE=nodes`
- `git diff --check`
- Focused style hygiene scans for stale aliases and copied cockpit CSS in
  Skills, Plugins, and Nodes.

## Rollback

Rollback is a clean revert of Batch D runtime and documentation changes. No
persisted data or contract migration is involved.

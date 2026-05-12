## Context

Batch B follows Batch A after Budget and Alerts proved the direct-fit rollout
mechanics. Identity, Subagents, and Channels are partial-fit surfaces. The
shared panel chrome can move to cockpit patterns, but each module's central
domain molecules must remain local.

## Goals / Non-Goals

**Goals:**

- Replace matching Identity, Subagents, and Channels root/header/KPI/status/
  pill/surface chrome with existing cockpit pattern components.
- Keep relationship, lineage, diagnostics, access control, forms, and handoff
  molecules local.
- Preserve runtime behavior, data fetching, mutations, i18n keys, and tests.
- Extend the style hygiene evidence from Batch A to partial-fit modules.

**Non-Goals:**

- No new `DetailHero`, `StatusTimeline`, `SelectableQueueRow`, or diagnostics
  pattern in this batch.
- No change to `PanelCockpit` props, variants, or CSS contract.
- No backend/BFF/Gateway/contract/dependency changes.

## Decisions

### Decision 1: Partial fit means shell migration only

Batch B SHALL migrate only structures expressible by existing cockpit APIs.
Identity canonical relationship rows, Subagents run queue and lineage, and
Channels provider/WeCom diagnostics stay module-local.

### Decision 2: Channels keeps provider-specific surfaces local

Channels has shared KPI/header/detail shell anatomy, but its probe result badges,
WeCom access controls, routing handoff, and throughput chart are not cockpit
patterns. The batch SHALL NOT generalize those surfaces.

### Decision 3: Style hygiene remains mandatory

Touched modules SHALL NOT introduce old token alias fallbacks, module-private
font systems, copied cockpit CSS, or local reimplementations of migrated
header/KPI/status/surface structures.

## Verification Plan

- `openspec validate deck-go-cockpit-rollout-batch-b-relationship-runtime --type change --strict`
- `cd deck-go && make frontend-build`
- `cd deck-go && make e2e-mock-module MODULE=identity`
- `cd deck-go && make e2e-mock-module MODULE=subagents`
- `cd deck-go && make e2e-mock-module MODULE=channels`
- `git diff --check`
- Focused style hygiene scans for stale aliases and copied cockpit CSS in
  Identity, Subagents, and Channels.

## Rollback

Rollback is a clean revert of Batch B runtime and documentation changes. No
persisted data or contract migration is involved.

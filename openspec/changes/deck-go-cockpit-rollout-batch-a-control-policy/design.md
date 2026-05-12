## Context

The head change `deck-go-panel-cockpit-rollout-program` establishes the rule
that broad cockpit rollout must consume existing cockpit APIs first. Budget and
Alerts are the lowest-risk direct-fit candidates because their repeated chrome
matches the validated `PanelRoot`, `PanelSurface`, `PanelSectionHeader`,
`PanelStatusRow`, `PanelPill`, `KpiStrip`, and `PanelMetric` APIs.

## Goals / Non-Goals

**Goals:**

- Replace Budget and Alerts local root/header/KPI/status/pill/surface chrome
  with existing cockpit pattern components where the anatomy matches.
- Keep business-specific controls, rows, forms, cards, and dangerous-write
  flows module-local.
- Establish a style hygiene template for later cockpit rollout batches.
- Preserve all data fetching, mutation behavior, routing, i18n keys, and
  contract paths.

**Non-Goals:**

- No Threads runtime migration in this batch.
- No new pattern proposal or `PanelCockpit` API extension.
- No canonical token value, atom API, backend, BFF, Gateway, generated
  contract, or dependency changes.
- No visual claim for real billing accuracy, alert delivery, webhook delivery,
  escalation, or production incident assurance.

## Decisions

### Decision 1: Start with Budget and Alerts only

Budget and Alerts provide enough direct-fit evidence to validate the rollout
mechanics. Threads remains classified as direct-fit but deferred because its
relationship-map and cross-panel handoff surfaces would widen the first batch.

### Decision 2: Use cockpit patterns for shared chrome only

The batch SHALL use existing cockpit patterns for root spacing, section headers,
status rows, pills, KPI strips, metric cards, and simple panel surfaces. It
SHALL NOT add style escape hatches, variants, or new pattern APIs.

### Decision 3: Keep local molecules local

Budget-specific rule forms, threshold progress, evaluation cards, definition
rows, and local change rows remain local. Alerts-specific rule table, condition
cards, fired history, entity/action form tiles, audit/test preview, and modal
content remain local.

### Decision 4: Style hygiene is a gate

The batch SHALL remove local CSS that duplicates cockpit-owned structures and
SHALL NOT introduce old token alias fallbacks such as `--text-primary`,
`--text-muted`, `--text-faint`, `--danger`, `--warn`, or `--font-sans`.
Monospace styling must use the design-system token vocabulary.

## Verification Plan

- `openspec validate deck-go-cockpit-rollout-batch-a-control-policy --type change --strict`
- `cd deck-go && make frontend-build`
- `cd deck-go && make e2e-mock-module MODULE=budget`
- `cd deck-go && make e2e-mock-module MODULE=alerts`
- `git diff --check`
- Focused style hygiene scans for stale token aliases and duplicated
  cockpit-owned local selectors.

## Rollback

Rollback is a clean revert of the Batch A runtime and documentation changes. No
persisted data or contract migration is involved.

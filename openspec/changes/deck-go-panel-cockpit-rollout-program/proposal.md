## Why

Sessions, Usage, and Logs now prove that the cockpit pattern set fixes repeated
panel-level visual drift without changing global token values or atom APIs.
The remaining Deck panels still contain many local header, KPI, status-row, and
hero structures, so the next step needs a program-level rollout plan rather than
one proposal per module or one unsafe all-module rewrite.

## What Changes

- Add a cockpit rollout head change that governs how `PanelCockpit` patterns
  are evaluated and rolled out across the remaining `deck-go/frontend-new`
  panels.
- Require a full panel readiness matrix before batch implementation begins,
  classifying each panel as `direct-fit`, `partial-fit`, `needs-new-pattern`, or
  `stay-local`.
- Define batch implementation rules so 2-5 structurally similar panels can be
  migrated in one proposal when their shared cockpit anatomy is clear.
- Require every batch proposal to preserve module-specific molecules locally
  unless those molecules pass the existing reuse-analysis gate.
- Require program-level closure after all target panels are either migrated or
  explicitly classified with evidence.
- Keep global token values, existing atom APIs, backend/BFF/Gateway contracts,
  generated contracts, and dependencies out of scope.

## Capabilities

### New Capabilities

- `deck-go-panel-cockpit-rollout-governance`: Defines the rollout inventory,
  readiness classifications, batch grouping rules, and program closure standard
  for cockpit pattern convergence.

### Modified Capabilities

- `design-system-cross-module-readiness`: Adds the readiness matrix and batch
  evidence requirements for cockpit rollout after the third validation sample.
- `design-system-patterns`: Adds rules for consuming existing cockpit patterns
  during broad rollout and for deferring new patterns to separate proposals.

## Impact

- OpenSpec artifacts:
  - `openspec/changes/deck-go-panel-cockpit-rollout-program/**`
  - follow-up batch changes created from this program
- Documentation/evidence:
  - `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`
  - optional program matrix under the same design-bundle or a cockpit rollout
    evidence document
- Future frontend implementation:
  - `deck-go/frontend-new/src/components/panels/**`
  - focused tests and visual smoke/parity tests for each migrated batch
- No direct runtime code, backend, BFF, Gateway, generated contract, dependency,
  or global token-value impact in this head change.

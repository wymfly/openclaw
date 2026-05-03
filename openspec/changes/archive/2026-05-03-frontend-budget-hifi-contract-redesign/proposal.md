## Why

Budget is an existing Control panel backed by Deck-local policy contracts, but the UI still uses the old generic control shell and has no mock/local visual E2E coverage. The module needs to join the contract-led high-fidelity rollout so operators can inspect spend/token guardrails, threshold state, scope targeting, and CRUD consequences before the remaining Control panels are rebuilt.

## What Changes

- Create a complete high-fidelity Budget handoff package under `deck-go/frontend-handoff/modules/budget/`.
- Redesign `deck-go/frontend-new/src/components/panels/budget/` into a compact budget governance workbench:
  - rule inventory with scope, period, dimension, enabled state, and evaluation status
  - selected rule detail with current usage, warning/over thresholds, progress evidence, and edit/delete actions
  - rule editor for global, per-agent, and per-task budgets using existing threshold and period contracts
  - deterministic empty, loading, error, validation, create, edit, delete, and evaluation states
- Preserve the current frontend API wrapper behavior for `fetchBudgetRules`, `evaluateBudgetRules`, `createBudgetRule`, `updateBudgetRule`, and `deleteBudgetRule`; browser code continues to call the Go BFF routes only.
- Confirm deterministic mock/local visual E2E data for `GET /usage/budget`, `GET /usage/budget/evaluate`, `POST /usage/budget`, `PATCH /usage/budget/{id}`, and `DELETE /usage/budget/{id}`; fix only deterministic mock drift needed for visual coverage.
- Move obsolete generic Budget styling into module-local CSS using design-system tokens and stable responsive constraints where needed.
- Add focused mock/local visual E2E covering ready budget workspace and at least one rule mutation state.
- Update cross-module readiness evidence with Budget-specific findings and budget/status/form molecule candidates.

## Capabilities

### New Capabilities

- `frontend-budget-hifi-redesign`: Covers the Budget handoff package, production UI rewrite, mock/local visual verification, and local contract/drift findings for budget rules, threshold evaluation, rule CRUD, and scoped budget governance workflows.

### Modified Capabilities

- `design-system-cross-module-readiness`: Adds Budget implementation evidence and classifies whether budget metrics, rule inventory rows, threshold progress bars, scoped rule forms, status evidence, and destructive confirmation controls remain local, need a dedicated atom/pattern proposal, or stay as follow-up.

## Impact

- `deck-go/frontend-handoff/modules/budget/`
- `deck-go/frontend-new/src/components/panels/budget/`
- `deck-go/frontend-new/src/theme.css` Budget global styling removal or narrowing if present
- `deck-go/test/fixtures/mock-gateway.mjs` or E2E setup only if deterministic mock visual gaps are found
- `deck-go/test/e2e/` focused Budget mock/local visual coverage
- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`
- `openspec/specs/frontend-budget-hifi-redesign/spec.md`
- `openspec/specs/design-system-cross-module-readiness/spec.md`

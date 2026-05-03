## Why

Alerts is an existing Control panel backed by Deck-local alert configuration contracts, but the UI still uses the old tabbed `deck-ui-alerts` shell and has no mock/local visual E2E coverage. The module needs to join the contract-led high-fidelity rollout so operators can inspect alert rules, enabled/action state, cooldowns, mutation outcomes, and the explicit fired-history limitation before the remaining Control panels are rebuilt.

## What Changes

- Create a complete high-fidelity Alerts handoff package under `deck-go/frontend-handoff/modules/alerts/`.
- Redesign `deck-go/frontend-new/src/components/panels/alerts/` into a compact alert policy workbench:
  - alert rule inventory with entity type, condition, threshold, action, enabled state, cooldown, and last-fired evidence
  - selected rule detail with trigger expression, delivery action, cooldown, timestamps, and edit/toggle/delete actions
  - rule editor for usage, cron, approval, and agent alert rules using existing action and threshold contracts
  - fired-history fallback that clearly states Gateway-backed fired alert history is not exposed yet
  - deterministic empty, loading, error, validation, create, edit, toggle, delete, and fired-fallback states
- Preserve the current frontend API wrapper behavior for `fetchAlertRules`, `createAlertRule`, `updateAlertRule`, and `deleteAlertRule`; browser code continues to call the Go BFF routes only.
- Confirm deterministic mock/local visual E2E data for `GET /alerts`, `POST /alerts`, `PATCH /alerts/{id}`, and `DELETE /alerts/{id}`; fix only deterministic mock/local drift needed for visual coverage.
- Move obsolete global `deck-ui-alerts*` styling into module-local CSS using design-system tokens and stable responsive constraints.
- Add focused mock/local visual E2E covering ready alert workspace, validation, mutation, and fired-history fallback where feasible.
- Update cross-module readiness evidence with Alerts-specific findings and alert/rule/status/form molecule candidates.

## Capabilities

### New Capabilities

- `frontend-alerts-hifi-redesign`: Covers the Alerts handoff package, production UI rewrite, mock/local visual verification, and local contract/drift findings for alert rules, CRUD, toggle, fired-history fallback, and alert policy workflows.

### Modified Capabilities

- `design-system-cross-module-readiness`: Adds Alerts implementation evidence and classifies whether alert metrics, rule inventory rows, trigger expression cards, policy forms, fired-history fallback, and destructive controls remain local, need a dedicated atom/pattern proposal, or stay as follow-up.

## Impact

- `deck-go/frontend-handoff/modules/alerts/`
- `deck-go/frontend-new/src/components/panels/alerts/`
- `deck-go/frontend-new/src/theme.css` Alerts global styling removal or narrowing
- `deck-go/test/e2e/` focused Alerts mock/local visual coverage
- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`
- `openspec/specs/frontend-alerts-hifi-redesign/spec.md`
- `openspec/specs/design-system-cross-module-readiness/spec.md`

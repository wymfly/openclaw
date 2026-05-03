# Budget Module Handoff

Status: implemented-awaiting-archive

## Contract Truth

- Deck DTO authority: `deck-go/contracts/source/deck-api.contract.ts`
  - `DeckGoBudgetRule`
  - `DeckGoBudgetEvaluation`
  - `DeckGoBudgetRulesResponse`
  - `DeckGoBudgetEvaluationsResponse`
- Browser API facade: `deck-go/frontend-new/src/api.ts`
  - `fetchBudgetRules()`
  - `evaluateBudgetRules()`
  - `createBudgetRule(input)`
  - `updateBudgetRule(id, input)`
  - `deleteBudgetRule(id)`
- Public BFF routes:
  - `GET /api/usage/budget`
  - `GET /api/usage/budget/evaluate`
  - `POST /api/usage/budget`
  - `PATCH /api/usage/budget/{ruleId}`
  - `DELETE /api/usage/budget/{ruleId}`
- Runtime source: Deck-local budget rule store plus usage totals from the managed runtime adapter.

## Product Intent

Budget is a governance workbench for guardrail rules. It is not a billing dashboard, quota ledger, invoice view, or predictive forecast. The UI should make the current contract clear: operators can define local spend/token thresholds, inspect the current evaluation, and mutate rules through Deck BFF routes.

## Workflow Constraints

- Browser code must use the existing frontend API wrappers only.
- Missing evaluation fields render as unavailable evidence, not invented values.
- Rule mutations refresh rules and evaluations through the same contract path.
- Mock/local visual evidence does not prove production billing accuracy, usage enforcement, or quota assurance.

## Files

- `prototype.html` - high-fidelity static reference for the Budget workbench.
- `components.md` - production component breakdown and prop contracts.
- `states.md` - state model and edge cases.
- `interactions.md` - keyboard, focus, mutation, and accessibility rules.
- `api-usage.md` - endpoint and DTO usage notes.

## Open Questions

- Real enforcement semantics are not contractually proven by this panel; this remains a backend/runtime audit item.
- Usage aggregation precision depends on the current runtime adapter and pricing source.
- Organization/team budget scoping is not in the current DTO and must not be implied in the UI.

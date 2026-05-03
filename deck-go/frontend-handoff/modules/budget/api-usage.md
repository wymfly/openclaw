# Budget API Usage

## Source Of Truth

All production UI behavior must follow `DeckGoBudget*` DTOs from `deck-go/contracts/source/deck-api.contract.ts` and generated frontend types. The browser must not call Gateway directly.

## Read

### `fetchBudgetRules()`

Route: `GET /api/usage/budget`

Expected response:

```ts
type DeckGoBudgetRulesResponse = {
  rules: DeckGoBudgetRule[];
};
```

Used for the rule inventory, selected rule detail, enabled count, and form seed values.

### `evaluateBudgetRules()`

Route: `GET /api/usage/budget/evaluate`

Expected response:

```ts
type DeckGoBudgetEvaluationsResponse = {
  evaluations: DeckGoBudgetEvaluation[];
};
```

The frontend wrapper normalizes legacy `currentValue` into `current`. Evaluation data drives status pills, threshold progress, current value, warning count, and over-limit count.

## Mutations

### `createBudgetRule(input)`

Route: `POST /api/usage/budget`

Input omits `id`, `createdAt`, and `updatedAt`. Required practical fields are `name` and `dimension`; the form also provides `scope`, `period`, `enabled`, and optional thresholds.

### `updateBudgetRule(id, input)`

Route: `PATCH /api/usage/budget/{ruleId}`

The UI sends the current full rule draft through the existing wrapper. After success, the panel refreshes rules and evaluations.

### `deleteBudgetRule(id)`

Route: `DELETE /api/usage/budget/{ruleId}`

The UI uses inline two-step confirmation. After success, the panel refreshes rules and evaluations.

## Unsupported Claims

- Do not claim real billing accuracy.
- Do not claim production quota enforcement.
- Do not claim organization or workspace billing policy.
- Do not infer model/provider cost rules beyond what usage totals expose.

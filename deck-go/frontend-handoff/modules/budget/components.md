# Budget Components

## Production Tree

```txt
BudgetPanel
├── BudgetMetric
├── RuleList
├── RuleForm
└── BudgetStatus
```

## `BudgetPanel`

Owns data loading, selected rule state, form mode, confirmation state, mutation state, and refresh behavior.

Inputs: none.

Contract dependencies:

- `DeckGoBudgetRule[]`
- `DeckGoBudgetEvaluation[]`
- `BudgetRuleInput`

Required behavior:

- Load rules and evaluations together.
- Keep a valid selected rule when data refreshes.
- Refresh after create, update, and delete.
- Keep invalid form drafts local.
- Show unavailable evidence for missing evaluation fields.

## `BudgetMetric`

Small local metric molecule for rule count, enabled count, warning count, and over-limit count.

Props:

```ts
{
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "warning" | "danger";
}
```

This remains local until multiple Control modules share a stable metric API.

## `RuleList`

Selectable inventory of budget rules with evaluation status, scope, period, dimension, enabled state, and current value when available.

Props:

```ts
{
  rules: DeckGoBudgetRule[];
  evaluations: DeckGoBudgetEvaluation[];
  selectedRuleId: string | null;
  onSelect(rule: DeckGoBudgetRule): void;
}
```

## `RuleForm`

Scoped rule editor for global, per-agent, and per-task budgets. It preserves the current validation behavior:

- name required
- per-agent scope requires agent id
- per-task scope requires task id
- thresholds must be finite nonnegative numbers when provided

## `BudgetStatus`

Evaluation list with status pills, current value, thresholds, and `<progress>` elements. It exports local formatting helpers used by the selected-rule detail:

- `formatBudgetValue`
- `budgetProgressPercent`
- `budgetStatusClass`

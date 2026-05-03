# Budget States

## Loading

- Header and metrics remain mounted.
- Rule inventory shows loading copy when no rules are present.
- Refresh button is disabled while the current refresh is in flight.

## Ready With Rules

- Metrics show total rules, enabled rules, warning evaluations, and over-limit evaluations.
- Left inventory lists rules with status and current value when evaluation data exists.
- Right pane shows selected rule evidence, threshold progress, thresholds, current value, and updated timestamp.

## Ready Empty

- Metrics show zero rules.
- Inventory shows the empty copy.
- Detail pane explains that a rule can be created.
- The create action remains visible.

## Form Mode

- Create mode starts with an empty global monthly total-token rule draft.
- Edit mode starts from the selected rule.
- Cancel returns to the list/detail workbench without saving.
- Save refreshes rules and evaluations after a successful mutation.

## Validation

- Validation errors render in the form.
- No mutation wrapper is called while validation fails.
- Invalid thresholds stay visible so the operator can correct them.

## Delete Confirmation

- Delete is inline and two-step.
- The first click exposes the confirm action.
- The second click calls `deleteBudgetRule`.
- Cancel hides confirmation and keeps the form open.

## Error

- Load errors and mutation errors render as top-level error evidence.
- Existing rule data is not fabricated after a failed refresh.

## Mock Visual

Mock/local visual states seed budget rules through public BFF routes and rely on the mock Gateway only for usage totals. Evidence is UI convergence only, not billing accuracy or enforcement proof.

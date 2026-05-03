# Budget Interactions

## Selection

- Clicking a rule selects it and keeps the operator in the list/detail workspace.
- The Edit button opens form mode for the selected rule.
- Selection should survive refresh when the rule still exists.

## Create

- The Create button opens form mode with an empty draft.
- Saving calls `createBudgetRule`.
- Successful create refreshes and selects the created rule.

## Edit

- Editing a selected rule calls `updateBudgetRule`.
- Successful update refreshes and selects the updated rule.
- Disabled rules remain visible with muted evidence and no evaluation status unless the backend evaluates them.

## Delete

- Delete uses inline confirmation in edit mode.
- Successful delete refreshes the list and returns to list/detail mode.

## Keyboard And Focus

- Buttons, segmented controls, switch, text inputs, and number inputs must expose visible focus.
- Segmented controls use `aria-pressed` for selected values.
- The enabled toggle uses `role="switch"` and `aria-checked`.
- The progress element has an accessible label with the rule name.

## Layout

- Long rule names, agent ids, task ids, timestamps, and error messages wrap or truncate inside constrained regions.
- No nested decorative cards.
- The first viewport should expose the header, metrics, inventory, selected-rule evidence, and at least part of the evaluation list on desktop.

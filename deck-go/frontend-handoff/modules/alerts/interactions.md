# Alerts Interactions

## Keyboard And Focus

- All inventory rows are buttons and keep visible focus rings.
- Header actions are real buttons: refresh, fired history, add rule.
- Inline delete confirmation has two buttons: destructive confirmation and
  cancel.
- Form submit and cancel are keyboard reachable.
- The enabled control in the form is a `role="switch"` button with
  `aria-checked`.

## Selection

Selecting a rule exits form/fired mode and shows selected detail. Selection
should preserve the current rule after refresh when the rule still exists.

## Create/Edit

`Add Rule` opens a blank form. `Edit Rule` opens the selected rule in the same
form surface. Cancel returns to selected detail without mutation.

## Toggle

Toggle happens from selected detail and calls `updateAlertRule` with only the
enabled patch. It should be disabled while saving.

## Delete

First click shows the inline destructive confirmation. Mutation occurs only when
the operator clicks the confirmation button. `window.confirm` is not used.

## Fired History

Opening fired history does not change selected rule. It shows a clear
unsupported-history notice and any rule-level `lastFiredAt` fallback evidence.

## Visual Constraints

- No horizontal overflow at 1440px or mobile widths.
- Long rule names and timestamps wrap or truncate inside stable regions.
- No nested decorative cards.
- Mock/local evidence must not be labeled as real delivery assurance.

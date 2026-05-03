# Alerts States

## Load States

- `idle`: no rules loaded yet or load failed before a ready response.
- `loading`: request is in progress.
- `ready`: current rules came from `fetchAlertRules()`.

## View Modes

- `detail`: selected rule evidence and mutation actions.
- `form`: create or edit form.
- `fired`: unsupported fired-history fallback.

## Empty State

When `rules.length === 0`, show the inventory empty message and a selected-detail
empty surface. Do not show mock rules.

## Error State

Errors are displayed as inline text above the workspace. The current rule list
is preserved when possible.

## Validation State

The form rejects:

- missing rule name
- missing condition
- nonnumeric threshold
- negative or nonnumeric cooldown minutes

Validation failure must not call `createAlertRule` or `updateAlertRule`.

## Mutation States

- Create: call `createAlertRule`, refresh, select returned rule when present,
  display last action `created`.
- Edit: call `updateAlertRule`, refresh, select returned rule when present,
  display last action `updated`.
- Toggle: call `updateAlertRule(id, { enabled })`, refresh, display last action
  `toggled`.
- Delete: first click arms inline confirmation; second click calls
  `deleteAlertRule`, refreshes, clears confirmation, and displays last action
  `deleted`.

## Fired-History Fallback

The fired view must state that Gateway-backed fired history is unavailable. It
may render rows derived from rule-level `lastFiredAt`, but those rows are not a
durable incident timeline.

## Mock/Local Visual States

The visual E2E should cover:

- ready workbench with seeded rules
- form validation
- create mutation success
- fired-history fallback

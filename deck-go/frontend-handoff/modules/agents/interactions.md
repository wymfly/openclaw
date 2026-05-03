# agents - interactions

## Keyboard

- `Cmd/Ctrl+K` focuses search when no detail form field is active.
- `/` focuses search from the list when the event target is not text input.
- `Cmd/Ctrl+N` opens create agent.
- `Escape` returns from detail to list when no modal is open.
- List rows support ArrowUp/ArrowDown plus Enter/Space to open.
- Detail sections support number keys `1` through `7` and `j`/`k` when focus is not inside a text field.
- `Cmd/Ctrl+S` saves the active editable section.
- Dialogs trap focus through the existing Modal behavior.

## Pointer

- Clicking a row opens detail.
- Clicking section nav changes hash/section without reloading list data.
- Delete always opens confirmation before calling the destructive API.
- Create close/cancel leaves existing list/detail state unchanged.

## Focus and a11y

- Panel root has an accessible label.
- The list uses table or grid semantics with column headers.
- Active detail section exposes `aria-current="page"`.
- Status dots include an accessible status label through the surrounding Badge.
- Loading and empty states use `role="status"`.
- Error states use Banner/alert semantics where practical.
- Modal actions have explicit button labels.

## Visual behavior

- Hover and focus states use `--ds-bg-hover`, `--ds-border`, and visible outline/focus treatment.
- Busy status can pulse locally, but animation must not resize rows.
- Missing optional counters render as `-` in mono text.
- Row heights, section nav entries, and metric tiles keep stable dimensions across state changes.

## Responsive behavior

- Desktop: list and detail appear side by side.
- Medium width: list/detail stack while preserving detail section nav.
- Mobile: table headers can collapse; rows become two-column or one-column blocks.

## Mock visual review

The Playwright visual test should cover:

- ready workbench with selected detail
- empty state
- error state
- create dialog

It should fail on unexpected console errors and page errors.

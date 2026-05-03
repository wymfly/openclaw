# logs - interactions

## Pointer

- Refresh tail calls `fetchLogsTail({ cursor: tail?.cursor, limit: 200, maxBytes: 65536 })`.
- Pause stream toggles the local stream switch off and aborts the stream
  controller.
- Resume stream reconnects with the persisted last event id.
- Clear local logs clears local `tail.lines`, `logEvents`, `liveTape`, and export
  preview only. It does not delete Gateway logs.
- Prepare export builds copyable text from filtered rows.

## Keyboard

- Level toggles are native checkboxes and must be reachable by Tab.
- Source filter is a native select.
- Session filter is a native input.
- Buttons use canonical button focus styles.
- Long code areas are scrollable without trapping focus.

## Hover and focus

- Log rows may strengthen the border/background on hover.
- Focus-visible outlines must use `--ds-accent`.
- Action buttons must preserve canonical design-system states.

## Loading

- Keep previous rows visible while refresh is loading.
- Use a small spinner only in the header or status strip; do not replace the
  whole workbench with a blocking loader.

## Empty

- Empty rows state uses the existing localized `noLogLines` string.
- Empty live tape and stream events use existing localized strings.

## Error

- Tail or stream errors render as compact status banners.
- Errors must wrap long messages and must not break the two-column workbench.

## Responsive

- Desktop: metrics across the top; tail card left; stream sidecar right.
- Mid-width: stack sidecar below tail card.
- Narrow: metrics and filters collapse to one column; code areas keep stable
  max-height and scroll.

# sessions - interactions

## Pointer

- Refresh sessions calls `refreshSessionsInventory` with current selection
  preserved.
- Refresh detail calls `refreshSelectedSession(selectedSessionKey)`.
- Search/type/time filters update local filter state and reload inventory where
  the API wrapper currently supports query params.
- Inventory row click selects the session and loads detail/history.
- Parent/child relation buttons select the related session key.
- Open Subagents calls `navigateToPanel(ui, "subagents")`.
- Transcript match buttons cycle through local search matches.
- Export buttons prepare local JSON/Markdown previews.
- Reset/clear/patch buttons call the existing wrappers.
- Compact/delete buttons require a second confirmation click before calling the
  existing wrappers.
- Compaction branch/restore actions call compaction wrappers.

## Keyboard

- All action controls are reachable by Tab and use canonical focus styles.
- Inventory rows should be buttons or contain a clear button target.
- Select controls use native select behavior.
- Confirmation gates must be keyboard-operable and not rely on hover.
- Transcript export previews must be scrollable by keyboard.

## Hover and focus

- Inventory rows may strengthen border/background on hover.
- Selected inventory row uses a stable left accent or equivalent low-noise
  selected state.
- Focus-visible outlines use `--ds-accent`.
- Destructive actions use danger styling.

## Loading

- Keep previous inventory/detail visible while refresh is loading.
- Use compact badges/spinners; do not block the whole panel.

## Empty

- No sessions: show a compact empty inventory state.
- No preview overlays: show a compact empty disclosure body.
- No transcript messages: disable export and show transcript empty copy.
- No context weight: show the existing localized empty copy.
- No compaction checkpoints: show checkpoint empty copy only when compaction
  count is positive.

## Error

- Inventory errors render in the inventory column.
- Detail/history errors render in the detail column.
- Usage/compaction/lineage errors render within their local sections.
- Mutation errors render in the action column.

## Responsive

- Desktop: inventory left, selected-session evidence center, actions right.
- Mid-width: actions stack below detail.
- Narrow: columns collapse; inventory remains above selected evidence.

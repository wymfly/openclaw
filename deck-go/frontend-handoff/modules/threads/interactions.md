# Interactions

## Filters

- Agent and channel filters debounce before applying.
- Status applies immediately and uses only `active` or `all`.
- Manual refresh applies the current draft filters.
- All filter values are trimmed before request.

## Selection

- Clicking a thread inventory row selects that thread.
- Refresh preserves selected thread if it remains in the new result.
- If the selected thread disappears, select the first sorted result.

## Handoff Actions

- Copy session key writes `targetSessionKey` to the clipboard.
- Clipboard failure shows a visible session-key fallback.
- Open session calls the shared session navigation helper with
  `targetSessionKey`.
- Open agent calls the shared agent navigation helper with `agentId`.

## Keyboard And Focus

- Inventory rows are buttons and must remain keyboard-focusable.
- Focus state must be visible on filters, rows, and action buttons.
- Collapsible payload disclosure uses native `details/summary` behavior.

## Empty And Error Recovery

- Empty state keeps filters and refresh controls available.
- Error state keeps retry available.
- Loading state must not blank the panel when a prior result exists.

## Visual QA

- Verify desktop and tablet widths.
- Long thread/session/channel/account identifiers must not overlap adjacent
  controls.
- Mock visual evidence must be labeled as mock-only, not real Gateway/LLM
  evidence.

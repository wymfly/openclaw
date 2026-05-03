# Docs Interactions

## Keyboard And Focus

- All category filters and actions are buttons with visible focus rings.
- Search is a plain text input; typing updates visible rows immediately.
- Pressing a document row button selects it and clears delete confirmation.
- Source session and source agent buttons call existing panel-navigation helpers.
- Details disclosure uses native `summary` focus behavior through `JsonDetails`.

## Hover / Selected

- Category chips show a subtle category-color border/background on hover.
- Active category chip uses a filled state.
- Document rows show a quiet elevated hover and left accent when selected.
- Destructive delete confirmation uses a visible danger state but does not resize controls.

## Actions

1. Refresh:
   - Calls `fetchDocs`.
   - Preserves selected document when it still exists.

2. Extract active session:
   - Disabled without active session.
   - Calls `extractDocs(activeSessionKey)`.
   - Refreshes inventory after success.
   - Shows raw result evidence.

3. Delete:
   - First click sets confirmation for the selected document.
   - Cancel clears confirmation.
   - Confirm calls `deleteDoc(selectedDoc.id)`.
   - Success refreshes inventory and clears confirmation.

4. Filter:
   - Category and query combine with AND semantics.
   - No-match state is distinct from empty registry state.

## Visual Acceptance

- The first viewport shows inventory, filters, active session/extract control, selected detail metadata, Markdown reader, and payload disclosure.
- No text overlaps at desktop or mobile widths.
- Long IDs, keywords, Markdown code, and JSON payloads wrap or scroll within bounded regions.
- Mock/local visual screenshots must not imply real Gateway/LLM or production extraction assurance.

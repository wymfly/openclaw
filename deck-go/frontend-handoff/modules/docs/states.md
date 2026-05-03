# Docs States

## Load States

- `idle`: initial state or failed load before a successful response.
- `loading`: document inventory request in flight.
- `ready`: latest document inventory response succeeded.
- `error`: represented by non-empty error copy, not a separate enum.

## Inventory States

- `empty`: `docs.length === 0`; show local registry empty copy.
- `ready`: `docs.length > 0`; show category counts and list rows.
- `no-match`: filters produce zero rows while the registry contains documents.
- `selected`: selected row matches `selectedDocId`.
- `detail-loading`: selected list doc exists but detail cache has not returned yet; list-level data remains visible.

## Action States

- `extracting`: `extractDocs(activeSessionKey)` in flight.
- `delete-pending-confirmation`: selected document ID matches confirmation state.
- `deleting`: confirmed delete call in flight.
- `last-action`: raw extract/delete result is visible after success.

## Error States

- List load failure: show error copy in the inventory column and keep previous rows if any.
- Detail load failure: show error copy while preserving selected list doc.
- Extract failure: show error copy, keep inventory unchanged.
- Delete failure: show error copy, keep confirmation state unless selection changes.
- Active session missing: block extraction before network submit.

## Edge Cases

- Missing `sourceSession`: source tile renders `n/a` and no session navigation button.
- Missing `sourceAgent`: source tile renders `n/a` and no agent navigation button.
- Empty `keywords`: omit keyword strip or render no-keyword evidence without fabricating values.
- Invalid timestamps: render the raw timestamp string.
- Long Markdown/code/payload: constrain with wrapping and bounded scroll.
- Detail route returns a richer content field than list route: detail cache replaces selected list content.

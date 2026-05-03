# Config States

## Loading

- Shell renders immediately.
- Raw editor can show empty or retained value.
- Apply/reset controls are disabled until data is ready.

## Ready

- Snapshot hash/baseHash, top-level keys, schema sections, raw JSON, selected section, structured fields, and lookup payload evidence are visible.

## Dirty Draft

- Dirty metric and status strip show unsaved changes.
- Apply preview and reset become available.
- Browser beforeunload guard stays active.

## Invalid Raw JSON

- Apply preview is blocked.
- Error copy states raw config must be a JSON object.

## Diff Preview

- Shows changed paths with old/new values and change type.
- Confirm apply calls `applyDeckConfig(raw, baseHash)`.
- Cancel returns to dirty draft without backend mutation.

## Conflict

- Shows remote-vs-local diff when backend reports stale hash/baseHash.
- Offers reload latest and retry local with latest hash.
- Does not invent a new endpoint.

## Structured Edit

- Boolean/string/number/enum edits update the raw JSON draft.
- JSON field apply/reset updates only the local raw draft.
- Sensitive fields stay masked until toggled.

## Mock/Local Visual

- Visual fixtures must include:
  - multiple top-level sections
  - schema lookup children with string, boolean, enum, number, JSON, and sensitive fields
  - stable hash
  - deterministic apply result

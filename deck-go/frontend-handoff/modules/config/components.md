# Config Components

## Workbench Shell

- Header with title, BFF contract evidence, refresh, apply preview, and reset.
- Metrics for key count, schema path, hash/baseHash, and dirty state.
- Two-column workspace: raw governance rail plus schema/structured editor detail.

## Raw Governance Rail

- Status and action strip.
- Diff preview surface.
- Conflict recovery surface.
- Raw JSON textarea with mono typography and stable height.

## Schema Navigator

- Filterable schema section buttons.
- Lookup input and lookup action.
- Selected section hero with key count and schema child count.

## Structured Field Cards

- Field label, path, type, and sensitivity marker.
- Boolean, string, number, enum, and JSON editor variants.
- Sensitive reveal/hide control remains local display state.
- JSON field apply/reset only mutates the raw draft.

## Payload Disclosure

- Selected section payload.
- Schema lookup payload.
- Last apply result.
- Payloads are debugging evidence, not editing surfaces.

## Local Molecules

Keep these module-local for this proposal:

- config metric tile
- schema section chips
- structured field card
- diff preview row
- conflict recovery strip
- raw JSON editor shell
- payload disclosure seam

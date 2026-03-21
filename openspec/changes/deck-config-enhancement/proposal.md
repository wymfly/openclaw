## Why

The Config panel exists with basic SchemaForm rendering (string/number/boolean/enum/object/array), but the schema-parser only handles simple JSON Schema types. Many OpenClaw config fields use `oneOf`/`anyOf` unions and `additionalProperties` records from Zod-to-JSON-Schema conversion, which render as raw JSON or fail silently. Additionally, `config.apply` always sends the full config — there's no incremental patch path, and array deletion via `config.patch` (JSON Merge Patch) is a known limitation (`null` means delete, not "set to null"). The `uiHints` envelope (sensitive, advanced, placeholder) is returned by the API but completely ignored by the frontend. This proposal closes these gaps to make Config a reliable catch-all for all 200+ config fields.

## What Changes

- **Extend schema-parser** to handle `oneOf`/`anyOf` union types, `additionalProperties`/`patternProperties` record types, `format` keywords (uri, email), and array `items` schemas for item-level editing
- **Map uiHints** from the `config.schema` envelope: `sensitive` → password/masked input, `advanced` → collapsed-by-default section, `placeholder` → input hint text
- **Add change diff preview** before saving — show a structured diff of old vs new values so users confirm what they're about to write
- **Implement smart write strategy** in the config store: use `config.patch` for incremental scalar/object changes, fall back to `config.set`/`config.apply` for structural changes (array deletion, reorder, type changes)
- **Add client-side field validation** using schema constraints (`minLength`, `maxLength`, `minimum`, `maximum`, `pattern`) with inline error feedback
- **Migrate Gateway Panel diagnostics** to a Monitor/Health section — remove gateway as an independent nav panel, retain the HeaderBar status indicator with enhanced click-to-expand health details

## Capabilities

### New Capabilities

- `config-schema-advanced`: Advanced schema type handling (union, record, format, array items) in schema-parser and SchemaForm field widgets
- `config-uihints`: uiHints mapping from API envelope to form rendering (sensitive masking, advanced collapsing, placeholder hints)
- `config-diff-preview`: Change diff preview dialog before config save, showing structured old→new comparison
- `config-write-strategy`: Smart write strategy that chooses between config.patch (incremental) and config.apply (structural) based on change type

### Modified Capabilities

<!-- No existing openspec specs to modify — openspec/specs/ is empty -->

## Impact

**Frontend files:**

- `dashboard/src/lib/schema-parser.ts` — major extension (new type handlers, uiHints integration, validation extraction)
- `dashboard/src/components/panels/config-editor/SchemaForm.tsx` — new field widgets (UnionField, RecordField, ArrayItemsField, PasswordField), inline validation
- `dashboard/src/components/panels/config-editor/ConfigPanel.tsx` — diff preview dialog, write strategy selection
- `dashboard/src/stores/config.ts` — uiHints state, patch vs apply logic, draft persistence
- `dashboard/src/components/layout/HeaderBar.tsx` — enhanced gateway indicator (click-to-expand health popover)
- `dashboard/src/i18n/{en,zh}.json` — new translation keys for field validation, array operations, diff preview

**Backend dependencies (read-only, no changes needed):**

- `config.patch` RPC already exists in gateway allowlist
- `config.schema` already returns `uiHints` envelope
- No backend changes required — all enhancements are frontend-only

**Risk:** config.patch uses JSON Merge Patch (RFC 7396) — setting a field to `null` deletes it. The write strategy must detect array mutations and route them through `config.apply` instead.

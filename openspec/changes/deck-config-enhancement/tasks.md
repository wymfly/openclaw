## 1. Schema Parser Extension

- [x] 1.1 Add `union` type to `FormField` interface — extend type union, add `discriminator`, `variants` fields
- [x] 1.2 Implement union detection in `parseSchemaNode()` — detect `oneOf`/`anyOf`, apply discriminated vs simple vs fallback heuristic
- [x] 1.3 Add `record` type to `FormField` interface — extend type union, add `valueSchema` field
- [x] 1.4 Implement record detection in `parseSchemaNode()` — detect `additionalProperties` with schema value
- [x] 1.5 Implement array `items` parsing — when `items` is present, parse item schema recursively and attach to FormField
- [x] 1.6 Extract `format` keyword from string schemas — include in FormField for specialized rendering
- [x] 1.7 Extract validation constraints (`minLength`, `maxLength`, `minimum`, `maximum`, `pattern`) — add `validation` property to FormField
- [x] 1.8 Write unit tests for schema-parser: union types (discriminated, simple, fallback), records, typed arrays, format, validation constraints

## 2. uiHints Integration

- [x] 2.1 Extend config store to fetch and store `uiHints` from `config.schema` response
- [x] 2.2 Implement uiHints path matcher — support dot-path matching with `*` wildcard segments, exact path precedence
- [x] 2.3 Create `applyUiHints(fields: FormField[], uiHints)` post-processor — decorate fields with `sensitive`, `collapsed`, `placeholder`
- [x] 2.4 Write unit tests for uiHints path matching (exact, wildcard, precedence, empty hints)

## 3. SchemaForm Field Widgets

- [x] 3.1 Implement `UnionField` component — discriminator dropdown + dynamic subform switching, value cleanup on variant change
- [x] 3.2 Implement `RecordField` component — key-value list with Add Entry / Remove controls, value inputs from value schema
- [x] 3.3 Implement `TypedArrayField` component — item-level forms from items schema, Add / Remove / Reorder (up/down buttons) controls
- [x] 3.4 Implement `PasswordField` component — masked input with show/hide toggle for sensitive fields
- [x] 3.5 Add advanced section collapsing — render `collapsed: true` fields inside a collapsible "Show advanced" toggle
- [x] 3.6 Apply `placeholder` hints to string/number inputs
- [x] 3.7 Add inline validation — validate on blur against FormField.validation constraints, show error text below field
- [x] 3.8 Block save when validation errors exist — disable Save button, scroll to first error field on attempt
- [x] 3.9 Add i18n keys for new field operations (Add Entry, Remove, Add Item, Move Up/Down, Show Advanced, validation messages)

## 4. Diff Preview

- [x] 4.1 Implement `computeConfigDiff(oldConfig, newConfig)` utility — recursive deep diff producing `{path, oldValue, newValue, type}` entries
- [x] 4.2 Create `DiffPreviewDialog` component — modal showing structured field-level changes grouped by section, collapsible sections
- [x] 4.3 Add color-coded value display — red/strikethrough for old, green for new, "added"/"removed" badges
- [x] 4.4 Implement session-scoped opt-out — "Don't show again this session" checkbox, stored in sessionStorage
- [x] 4.5 Implement single-field inline confirmation — compact toast near Save button for single-field changes
- [x] 4.6 Wire diff preview into ConfigPanel save flow — intercept Save click, show preview, proceed on confirm

## 5. Write Strategy

- [x] 5.1 Implement `classifyChanges(oldConfig, newConfig)` — detect array length/order changes, return `"patch-safe"` or `"apply-required"`
- [x] 5.2 Implement `computeMergePatch(oldConfig, newConfig)` — produce JSON Merge Patch object for patch-safe changes
- [x] 5.3 Add `config.patch` RPC call to config store — send merge patch with baseHash, handle success response (update rawConfig + baseHash)
- [x] 5.4 Implement patch-to-apply fallback — if `config.patch` returns error, auto-retry with `config.apply`
- [x] 5.5 Wire write strategy into save flow — after diff preview confirm, classify changes and route to patch or apply
- [x] 5.6 Ensure baseHash conflict detection works for both patch and apply paths
- [x] 5.7 Write unit tests for classifyChanges (scalar only, array deletion, array reorder, mixed, no changes)
- [x] 5.8 Write integration test for patch→apply fallback

## 6. Verification

- [x] 6.1 Type-check: `pnpm build` (tsc --noEmit) passes with no errors
- [x] 6.2 Lint/format: `pnpm check` passes
- [x] 6.3 Full test suite: `pnpm test` passes
- [ ] 6.4 Manual verification: load Config panel, edit a union field, record field, typed array — confirm all render correctly
- [ ] 6.5 Manual verification: edit a sensitive field (apiKey) — confirm password masking works
- [ ] 6.6 Manual verification: save with diff preview — confirm dialog shows correct changes
- [ ] 6.7 Manual verification: save a single scalar — confirm patch RPC is used (check network tab)
- [ ] 6.8 Manual verification: delete an array item and save — confirm apply RPC is used

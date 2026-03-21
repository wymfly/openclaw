## 1. Schema Parser Extension

- [ ] 1.1 Add `union` type to `FormField` interface — extend type union, add `discriminator`, `variants` fields
- [ ] 1.2 Implement union detection in `parseSchemaNode()` — detect `oneOf`/`anyOf`, apply discriminated vs simple vs fallback heuristic
- [ ] 1.3 Add `record` type to `FormField` interface — extend type union, add `valueSchema` field
- [ ] 1.4 Implement record detection in `parseSchemaNode()` — detect `additionalProperties` with schema value
- [ ] 1.5 Implement array `items` parsing — when `items` is present, parse item schema recursively and attach to FormField
- [ ] 1.6 Extract `format` keyword from string schemas — include in FormField for specialized rendering
- [ ] 1.7 Extract validation constraints (`minLength`, `maxLength`, `minimum`, `maximum`, `pattern`) — add `validation` property to FormField
- [ ] 1.8 Write unit tests for schema-parser: union types (discriminated, simple, fallback), records, typed arrays, format, validation constraints

## 2. uiHints Integration

- [ ] 2.1 Extend config store to fetch and store `uiHints` from `config.schema` response
- [ ] 2.2 Implement uiHints path matcher — support dot-path matching with `*` wildcard segments, exact path precedence
- [ ] 2.3 Create `applyUiHints(fields: FormField[], uiHints)` post-processor — decorate fields with `sensitive`, `collapsed`, `placeholder`
- [ ] 2.4 Write unit tests for uiHints path matching (exact, wildcard, precedence, empty hints)

## 3. SchemaForm Field Widgets

- [ ] 3.1 Implement `UnionField` component — discriminator dropdown + dynamic subform switching, value cleanup on variant change
- [ ] 3.2 Implement `RecordField` component — key-value list with Add Entry / Remove controls, value inputs from value schema
- [ ] 3.3 Implement `TypedArrayField` component — item-level forms from items schema, Add / Remove / Reorder (up/down buttons) controls
- [ ] 3.4 Implement `PasswordField` component — masked input with show/hide toggle for sensitive fields
- [ ] 3.5 Add advanced section collapsing — render `collapsed: true` fields inside a collapsible "Show advanced" toggle
- [ ] 3.6 Apply `placeholder` hints to string/number inputs
- [ ] 3.7 Add inline validation — validate on blur against FormField.validation constraints, show error text below field
- [ ] 3.8 Block save when validation errors exist — disable Save button, scroll to first error field on attempt
- [ ] 3.9 Add i18n keys for new field operations (Add Entry, Remove, Add Item, Move Up/Down, Show Advanced, validation messages)

## 4. Diff Preview

- [ ] 4.1 Implement `computeConfigDiff(oldConfig, newConfig)` utility — recursive deep diff producing `{path, oldValue, newValue, type}` entries
- [ ] 4.2 Create `DiffPreviewDialog` component — modal showing structured field-level changes grouped by section, collapsible sections
- [ ] 4.3 Add color-coded value display — red/strikethrough for old, green for new, "added"/"removed" badges
- [ ] 4.4 Implement session-scoped opt-out — "Don't show again this session" checkbox, stored in sessionStorage
- [ ] 4.5 Implement single-field inline confirmation — compact toast near Save button for single-field changes
- [ ] 4.6 Wire diff preview into ConfigPanel save flow — intercept Save click, show preview, proceed on confirm

## 5. Write Strategy

- [ ] 5.1 Implement `classifyChanges(oldConfig, newConfig)` — detect array length/order changes, return `"patch-safe"` or `"apply-required"`
- [ ] 5.2 Implement `computeMergePatch(oldConfig, newConfig)` — produce JSON Merge Patch object for patch-safe changes
- [ ] 5.3 Add `config.patch` RPC call to config store — send merge patch with baseHash, handle success response (update rawConfig + baseHash)
- [ ] 5.4 Implement patch-to-apply fallback — if `config.patch` returns error, auto-retry with `config.apply`
- [ ] 5.5 Wire write strategy into save flow — after diff preview confirm, classify changes and route to patch or apply
- [ ] 5.6 Ensure baseHash conflict detection works for both patch and apply paths
- [ ] 5.7 Write unit tests for classifyChanges (scalar only, array deletion, array reorder, mixed, no changes)
- [ ] 5.8 Write integration test for patch→apply fallback

## 6. Verification

- [ ] 6.1 Type-check: `pnpm build` (tsc --noEmit) passes with no errors
- [ ] 6.2 Lint/format: `pnpm check` passes
- [ ] 6.3 Full test suite: `pnpm test` passes
- [ ] 6.4 Manual verification: load Config panel, edit a union field, record field, typed array — confirm all render correctly
- [ ] 6.5 Manual verification: edit a sensitive field (apiKey) — confirm password masking works
- [ ] 6.6 Manual verification: save with diff preview — confirm dialog shows correct changes
- [ ] 6.7 Manual verification: save a single scalar — confirm patch RPC is used (check network tab)
- [ ] 6.8 Manual verification: delete an array item and save — confirm apply RPC is used

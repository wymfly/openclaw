## Context

The openclaw-deck Config panel (`dashboard/src/components/panels/config-editor/`) provides a SchemaForm-driven editor for OpenClaw gateway configuration. The current schema-parser (`dashboard/src/lib/schema-parser.ts`) handles 6 basic JSON Schema types: string, number, boolean, enum, array (as raw JSON textarea), and nested object. The config store (`dashboard/src/stores/config.ts`) only supports `config.apply` (full replacement) — no incremental patching.

The backend already returns a `uiHints` envelope from `config.schema` (with `sensitive`, `advanced`, `placeholder` metadata per field path), but the frontend ignores it entirely. The gateway also exposes `config.patch` (JSON Merge Patch / RFC 7396) which is in the allowlist but unused by the dashboard.

OpenClaw configs use Zod schemas that produce complex JSON Schema: `oneOf`/`anyOf` unions, `additionalProperties` records, `items` array schemas, and `format` keywords. These currently render as untyped JSON textareas or fail silently.

## Goals / Non-Goals

**Goals:**

- Support all Zod-generated JSON Schema patterns in the form renderer (union, record, format, typed arrays)
- Render uiHints-driven field behavior (password masking, collapsed sections, placeholder text)
- Show a structured diff preview before writing config changes
- Choose the optimal write path (patch vs apply) based on the nature of changes
- Provide client-side field validation using schema constraints

**Non-Goals:**

- Config panel visual redesign or layout changes (keep existing SchemaForm + SectionNav structure)
- RBAC / per-field permissions
- Config versioning / history / rollback UI
- Backend RPC changes (all enhancements are frontend-only)
- Gateway Panel removal from NavRail (deferred — keep gateway indicator in HeaderBar only)

## Decisions

### D1: Union type rendering — discriminated select + subform

**Decision:** Render `oneOf`/`anyOf` unions as a discriminator dropdown that switches the visible subform based on the selected variant.

**Rationale:** Most OpenClaw unions are discriminated (e.g., model provider config with `type: "openai" | "anthropic" | ...`). A select-to-switch pattern is familiar from form builders and handles the common case well.

**Detection heuristic:** If all `oneOf` variants are objects sharing a common property with `const`/`enum` values, use that as the discriminator. If variants are simple types (string | number), render as a type selector with corresponding input. Fallback: raw JSON editor for truly ambiguous unions.

**Alternative considered:** Render all variants simultaneously with radio selection — rejected because it clutters the form for variants with many fields.

### D2: Record type rendering — key-value editor with add/remove

**Decision:** Render `additionalProperties` / `patternProperties` schemas as a key-value list with "Add Entry" / "Remove" controls. Keys are text inputs; values render using the `additionalProperties` schema.

**Rationale:** Records are common in OpenClaw for things like environment variables, custom headers, and label maps. A dynamic key-value list is the natural UI for open-ended maps.

**Alternative considered:** Render as raw JSON — rejected because it's the current behavior and the explicit goal is to improve it.

### D3: Array rendering — item-level CRUD instead of JSON textarea

**Decision:** When the schema provides an `items` definition, render each array element as an individual form (using the items schema), with add/remove/reorder controls. Fall back to JSON textarea only when `items` is absent or the schema is too complex.

**Rationale:** The current JSON textarea for arrays is the single biggest UX pain point. Item-level editing with type-aware forms makes arrays as usable as object fields.

**Reorder mechanism:** Drag-and-drop via `@dnd-kit/core` (already in project deps for other panels). If not available, simple up/down arrow buttons.

### D4: Write strategy — detect change type, choose patch vs apply

**Decision:** Analyze the diff between old and new config to classify changes:

- **Scalar/object property changes** (add, update) → `config.patch` (JSON Merge Patch)
- **Array mutations** (deletion, reorder, splice) → `config.apply` (full replacement)
- **Mixed changes** → `config.apply` (safe fallback)

**Rationale:** JSON Merge Patch (RFC 7396) cannot express array element deletion (setting to `null` means delete the key, not the array element) or reorder. By detecting array mutations, we can use the efficient patch path for the common case (editing a single scalar) while falling back to apply for structural changes.

**Implementation:** Compare `oldConfig` vs `newConfig` as deep objects. If any changed path involves an array where length changed or elements were reordered, use apply. Otherwise, compute the merge patch and send via `config.patch`.

### D5: Diff preview — structured tree diff in a confirmation dialog

**Decision:** Before saving, show a modal dialog with a tree-structured diff (collapsible sections matching the SectionNav structure). Changed fields show old → new values with color coding (red/green). The user can confirm or cancel.

**Rationale:** Users currently save blindly — they can't see what changed across multiple sections. A structured diff (not raw text diff) is more useful for config because it respects the hierarchical structure.

**Library:** Use `deep-diff` or a lightweight custom recursive diff — no heavy dependency. Output is a list of `{path, oldValue, newValue, type: 'add'|'change'|'remove'}` entries.

### D6: uiHints mapping — decorator pattern on FormField

**Decision:** After schema-parser produces `FormField[]`, apply a post-processing pass that matches field paths against the `uiHints` map and decorates fields with rendering hints:

- `sensitive: true` → `fieldType: "password"` (toggle visibility)
- `advanced: true` → `collapsed: true` (hidden by default, expandable)
- `placeholder: string` → `placeholder` prop on input

**Rationale:** Keeping uiHints as a post-processing step (not baked into the parser) maintains separation between schema structure and rendering behavior. The parser stays pure JSON Schema → FormField; uiHints is a rendering concern.

### D7: Client-side validation — extract constraints during parsing

**Decision:** Extend `FormField` with optional `validation` property containing constraints extracted from the schema: `minLength`, `maxLength`, `minimum`, `maximum`, `pattern`, `format`. SchemaForm validates on blur and shows inline error text below the field.

**Rationale:** Currently there's no client-side validation — errors only surface after a failed save. Inline validation provides immediate feedback and reduces failed save attempts.

## Risks / Trade-offs

**[Risk] Union detection heuristic may misclassify complex schemas**
→ Mitigation: Fallback to JSON editor for any union that doesn't match the discriminated pattern. Log unhandled patterns to console for iterative improvement.

**[Risk] config.patch may behave differently across gateway versions**
→ Mitigation: Always verify patch success response. If patch returns an error, automatically retry with config.apply. The strategy selector is a client-side optimization, not a hard requirement.

**[Risk] Diff preview adds friction to the save flow**
→ Mitigation: Make diff preview skippable (checkbox "Don't show again this session"). For single-field changes, show inline confirmation instead of full dialog.

**[Risk] @dnd-kit dependency may not be available**
→ Mitigation: Check if already in deps; if not, use simple up/down arrow buttons for array reorder. Drag-and-drop is a nice-to-have, not a blocker.

**[Risk] Large configs (200+ fields) may cause slow diff computation**
→ Mitigation: Diff only the changed sections (compare top-level keys first, then recurse into changed subtrees). Lazy render collapsed sections in the diff dialog.

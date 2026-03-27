## 1. Dependencies & Setup

- [ ] 1.1 Install RJSF packages: `@rjsf/core`, `@rjsf/shadcn`, `@rjsf/validator-ajv8`, `@rjsf/utils` in `dashboard/package.json`
- [ ] 1.2 Install TanStack Table: `@tanstack/react-table` in `dashboard/package.json`
- [ ] 1.3 Verify `@rjsf/shadcn` theme renders correctly with project's Tailwind + shadcn design tokens (build a minimal test form)

## 2. Schema Registry (ui-hints-rjsf-bridge)

- [ ] 2.1 Create `dashboard/src/lib/schema-registry.ts` — client-side cache for `gateway.describe` response with sync access API
- [ ] 2.2 Implement `schemaVersion` mismatch detection on reconnect (invalidate + re-fetch)
- [ ] 2.3 Add static schema fallback mode (load from `dist/protocol.schema.json` when gateway.describe unavailable)
- [ ] 2.4 Create `dashboard/src/lib/ui-hints-rjsf.ts` — `uiHintsToRjsfSchema()` bridge function mapping Gateway UiHints to RJSF uiSchema

## 3. Schema-Driven Form (MethodForm)

- [ ] 3.1 Create `dashboard/src/components/schema-ui/MethodForm.tsx` — RJSF wrapper that fetches schema from registry and renders params form
- [ ] 3.2 Implement `fieldOverrides` prop for per-field uiSchema customization
- [ ] 3.3 Implement static `schema` prop fallback (no registry dependency)
- [ ] 3.4 Wire form submission to typed client (`gw.*`) with validation error display
- [ ] 3.5 Add i18n support for field labels, help text, and validation messages

## 4. Schema-Driven Table (DataTable + ResultView)

- [ ] 4.1 Create `dashboard/src/components/schema-ui/DataTable.tsx` — TanStack Table wrapper that auto-generates ColumnDef from result JSON Schema
- [ ] 4.2 Implement column type inference (boolean → icon, number → right-align, object → summary badge)
- [ ] 4.3 Implement `columns` prop for column visibility/ordering override
- [ ] 4.4 Add sorting and filtering support
- [ ] 4.5 Create `dashboard/src/components/schema-ui/ResultView.tsx` — auto-select DataTable / detail card / JSON tree based on result schema type

## 5. Generic Panel Layout

- [ ] 5.1 Create `dashboard/src/components/schema-ui/MasterDetailLayout.tsx` — reusable split-pane with configurable sidebar width, empty state, responsive collapse
- [ ] 5.2 Create `dashboard/src/components/schema-ui/MethodPanel.tsx` — declarative CRUD panel generator from method namespace
- [ ] 5.3 Implement method auto-discovery (namespace → `.list`, `.detail`, `.create`, `.update`, `.delete`)
- [ ] 5.4 Implement read-only mode detection (no create/update/delete methods → hide mutation buttons)
- [ ] 5.5 Implement `customWidgets` prop for domain-specific field renderers

## 6. Validation & Integration Test

- [ ] 6.1 Build a proof-of-concept panel using MethodPanel (e.g., Cron Jobs panel or a mock `deck.plugins.*` panel)
- [ ] 6.2 Verify RJSF handles all schema patterns used in Gateway: nested objects, optional fields, typed arrays, oneOf/discriminated unions, enum
- [ ] 6.3 Verify responsive behavior of MasterDetailLayout at 375px / 768px / 1024px breakpoints
- [ ] 6.4 Verify dark mode rendering of all schema-ui components
- [ ] 6.5 Run `pnpm tsc --noEmit` and `pnpm check` — zero errors

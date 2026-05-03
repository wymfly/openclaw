## Context

`frontend-new` already contains a functional `ApiExplorerPanel` under the `api-explorer` panel id. It calls `fetchGatewayDescribe()`, which reaches `GET /api/gateway/describe`; the Go BFF invokes the managed runtime `gateway.describe` query with schemas included. The Deck-facing DTO authority is `DeckGoGatewayDescribeResponse`, with optional `methods`, `events`, and `untyped` fields.

The current panel loads, groups methods by domain, filters by name/scope, switches between methods/events, selects the first method, renders params/result schemas recursively, and renders first-run not-configured state. The main gaps are visual convergence and mock-verification quality: the layout is a dense two-card shell using global `deck-ui-api-*` CSS in `theme.css`, and the bundled mock Gateway currently returns only version/protocol fields for `gateway.describe`, leaving API Explorer without deterministic method/event data for visual E2E.

## Goals / Non-Goals

**Goals:**

- Produce a complete API Explorer handoff package.
- Rewrite API Explorer into a high-fidelity contract catalog workspace aligned with the current design-system posture.
- Preserve fetch, load/error/not-configured handling, method grouping, search, tab switching, selected-method stability, schema rendering, schema collapse/expand, event payload rendering, and untyped method visibility.
- Add contract-shaped `gateway.describe` mock data needed for visual E2E.
- Add focused mock visual coverage for ready and interaction states.
- Record API Explorer-specific design-system feedback without silently promoting atoms or patterns.

**Non-Goals:**

- No arbitrary Gateway RPC execution UI.
- No new Gateway method or BFF route.
- No browser-side direct Gateway RPC.
- No new dependencies, schema editors, JSON-schema libraries, virtualization libraries, or table libraries.
- No canonical design-system atom/pattern promotion inside this module change.
- No guarantee that every upstream Gateway method has schemas; missing or untyped entries remain visible as contract evidence.

## Decisions

1. **Treat API Explorer as a contract catalog, not a request console.**
   The panel should help operators inspect what the live Gateway exposes, where schemas exist, and where untyped gaps remain. Executing arbitrary RPCs would expand the safety and governance scope and belongs in a separate proposal.

2. **Preserve `fetchGatewayDescribe()` and the BFF boundary.**
   The frontend already respects the contract boundary by calling the Go BFF. The rewrite should not introduce a direct Gateway transport.

3. **Use module-local molecules for catalog rows, schema trees, inventory metrics, and untyped detail.**
   These molecules overlap with Docs/Config/Gateway detail patterns, but API Explorer has schema-specific semantics. Any promotion to design-system patterns waits for a separate proposal.

4. **Render absence of schema as first-class contract truth.**
   `params`, `result`, or `payload` may be missing. The UI should show "no schema described" rather than hiding gaps or fabricating generic object schemas.

5. **Fix deterministic mock describe drift.**
   The mock Gateway should return realistic `methods`, `events`, and `untyped` fields for `gateway.describe` so the frontend can exercise the normal BFF path. This is fixture correction, not a production contract change.

## Risks / Trade-offs

- **Risk: Visual rewrite regresses method selection or schema collapse behavior.** -> Keep focused unit tests for grouping/search/select/tabs/schema collapse and visual E2E for ready plus interaction states.
- **Risk: Schema tree overstates JSON-schema support.** -> Render only object properties/items/enum/type from the current DTO payload and keep raw/untyped visibility.
- **Risk: Global CSS cleanup affects unrelated legacy panels.** -> Move only `deck-ui-api-*` API Explorer styling to module-local CSS and verify focused tests plus frontend build.
- **Risk: Mock describe data hides real Gateway schema gaps.** -> Keep untyped methods visible and label E2E as mock visual coverage, not real Gateway schema completeness evidence.

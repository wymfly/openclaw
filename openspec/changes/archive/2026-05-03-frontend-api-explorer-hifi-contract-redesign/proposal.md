## Why

API Explorer is the contract inspection panel for live `gateway.describe` data, but the current UI is still a legacy dense two-card shell with global `deck-ui-api-*` styling. It also cannot be meaningfully verified through the bundled mock Gateway because the mock `gateway.describe` payload does not include contract-shaped methods/events/untyped data.

This change applies the contract-led high-fidelity workflow to API Explorer so mock + frontend converge around the existing `gateway.describe` chain while preserving the current read-only inspection boundary.

## What Changes

- Create a complete high-fidelity API Explorer handoff package under `deck-go/frontend-handoff/modules/api-explorer/`.
- Redesign `deck-go/frontend-new/src/components/panels/api-explorer/` into a compact contract catalog workspace:
  - live describe health, method/event/untyped counts, and refresh controls
  - method search, domain grouping, selected method stability, and schema inspection
  - event payload schema inspection and untyped method visibility
  - recursive schema property rows with required/enum/type evidence
  - empty, loading, error, first-run not-configured, and mock-ready states
- Preserve the current API wrapper behavior for `fetchGatewayDescribe()` and browser-only BFF access; do not call Gateway directly from browser code.
- Preserve API Explorer as a read-only contract browser; do not add arbitrary RPC execution in this module pass.
- Add contract-shaped `gateway.describe` data to the bundled mock Gateway if visual E2E cannot exercise the normal frontend API path.
- Move obsolete global `deck-ui-api-*` styling into module-local CSS using design-system tokens and stable responsive constraints.
- Add focused mock visual E2E covering the ready API Explorer workspace and meaningful interaction states.
- Update cross-module readiness evidence with API Explorer-specific findings and schema/tree/catalog molecule candidates.

## Capabilities

### New Capabilities

- `frontend-api-explorer-hifi-redesign`: Covers the API Explorer handoff package, production UI rewrite, contract-shaped mocks, focused mock visual evidence, and local design-system feedback.

### Modified Capabilities

- `design-system-cross-module-readiness`: Adds API Explorer implementation evidence and classifies whether contract catalog rows, schema tree rows, tabbed event/method inventory, and raw/untyped payload detail molecules remain local, need a dedicated atom/pattern proposal, or stay as follow-up.

## Impact

- `deck-go/frontend-handoff/modules/api-explorer/`
- `deck-go/frontend-new/src/components/panels/api-explorer/`
- `deck-go/frontend-new/src/theme.css` API Explorer global styling removal or narrowing
- `deck-go/frontend-new/src/i18n/en.json` and `deck-go/frontend-new/src/i18n/zh.json`
- `deck-go/test/fixtures/mock-gateway.mjs` for contract-shaped describe fixture data
- `deck-go/test/e2e/` focused API Explorer mock visual coverage
- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`
- `openspec/specs/frontend-api-explorer-hifi-redesign/spec.md`
- `openspec/specs/design-system-cross-module-readiness/spec.md`

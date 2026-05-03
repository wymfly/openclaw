# API Explorer

**Status**: ready-for-implementation
**Design completed**: 2026-05-03
**Designer**: Codex single-agent replacement workflow
**Depends on atoms**: Button, Input, Select/Segmented control, Badge/Pill, Card, Code/Json detail, Status, Spinner
**New atoms needed**: none
**New tokens needed**: none
**Backend endpoints used**: see `api-usage.md`

## What this module does

API Explorer is a read-only contract catalog for the live Gateway `gateway.describe` payload. It lets an operator inspect method domains, scopes, params/result schemas, event payload schemas, and untyped method gaps without leaving the Deck operations UI.

This package is a high-fidelity handoff for `deck-go/frontend-new/src/components/panels/api-explorer/`. It is based on the current deck-go contract chain and production behavior. Code and contracts remain the source of truth; this prototype is an implementation guide.

## Contract truth

- Frontend wrapper: `fetchGatewayDescribe()`.
- BFF endpoint: `GET /api/gateway/describe`.
- Backend source: managed runtime `Describe(ctx, true)` -> upstream Gateway `gateway.describe`.
- DTO authority: `DeckGoGatewayDescribeResponse`.
- Fields used: `methods`, `events`, `untyped`, method `scope`, `params`, `result`, `since`, event `payload`, `since`.
- Browser code must continue to call the Go BFF wrapper only; it must not call Gateway directly.

## How to implement

1. Open `prototype.html` and inspect the contract catalog layout, schema tree density, selected method detail, event tab, and untyped visibility.
2. Read `components.md` for module-local component structure and data boundaries.
3. Read `states.md` for loading, empty, not-configured, error, and no-schema states.
4. Read `interactions.md` for method search, tab switching, selection, schema collapse/expand, and refresh behavior.
5. Read `api-usage.md` and preserve the current read-only BFF path.
6. Translate prototype classes into `ApiExplorerPanel.tsx` + `api-explorer-panel.css`, keeping strings in i18n and behavior covered by tests.

## Open questions for implementation

- Some upstream Gateway methods may intentionally lack schemas. These must remain visible as no-schema or untyped evidence rather than hidden.
- This module is not an RPC execution surface. Any request console needs a separate security/governance proposal.
- Recursive schema rendering is intentionally bounded; deeper schemas should stay inspectable through raw contract payloads in a future dedicated enhancement if needed.

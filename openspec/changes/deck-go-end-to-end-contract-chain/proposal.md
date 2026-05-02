## Why

Deck Go needs a single, inspectable contract chain from the OpenClaw Gateway source protocol through the Go service and into the frontend-facing API surface. Today the Gateway typed chain is mostly in place, but the Deck-facing API still has duplicated DTOs, hand-written frontend types, and weak UI semantics, which makes future frontend design depend on code archaeology instead of a clear contract.

This change makes the contract chain the product boundary: Gateway source APIs remain the upstream authority, the Go service owns a stable BFF contract, and frontend/UI work can consume generated types plus UI metadata to build interfaces that match runtime behavior.

## What Changes

- Establish a source-to-UI contract authority chain:
  - OpenClaw Gateway method registry, schemas, and event definitions remain the upstream protocol source.
  - Deck Go imports/adapts that source into generated Go and TypeScript Gateway protocol artifacts.
  - Deck Go defines its own BFF API/SSE contracts once under `deck-go/contracts/source/` and generates frontend TypeScript plus backend Go DTOs.
  - Contract metadata exposes UI-facing field semantics, actions, states, filters, capabilities, and safety hints for future frontend design.
- Expand the Deck-facing API contract beyond the current partial `deck-api.contract.ts` coverage so modules no longer define `DeckGo*` DTOs ad hoc in `deck-go/frontend/src/api.ts`.
- Classify every Deck Go endpoint as one of:
  - Gateway protocol adapter
  - Deck Go BFF/control-plane API
  - stream/binary/upload endpoint
  - documented exception
- Add governance gates for drift, missing DTOs, duplicate frontend types, untyped Gateway passthroughs, and contract metadata coverage.
- Keep dynamic or upstream-schema-missing methods possible, but require explicit documented exceptions with owners, reasons, and exit criteria.
- Prefer additive evolution and migration shims over breaking frontend behavior during the transition.

## Capabilities

### New Capabilities

- `deck-go-contract-authority-chain`: Defines the authoritative source order and adapter boundaries from Gateway protocol source to Go runtime adapters to Deck-facing API contracts.
- `deck-go-api-contract-surface`: Defines the Deck Go BFF API/SSE contract source, generated TypeScript/Go DTOs, endpoint classification, and migration rules for all current modules.
- `deck-go-ui-contract-metadata`: Defines UI-ready metadata carried by or alongside contracts so future frontend work can derive strongly matching panels, forms, tables, actions, empty states, and safety affordances.
- `deck-go-contract-governance`: Defines drift detection, coverage reporting, exception tracking, and CI gates that prevent contract-chain regressions.

### Modified Capabilities

- `gateway-communication`: Extend the existing typed Gateway communication requirements to Deck Go's end-to-end source protocol ingestion and adapter boundary.
- `upstream-result-schemas`: Extend schema completeness expectations from legacy dashboard needs to all Deck Go-consumed Gateway methods and events.
- `unified-error-model`: Extend typed error behavior through the Go service and Deck-facing generated contracts, not only legacy dashboard helpers.

## Impact

- **Affected code**:
  - `deck-go/contracts/source/deck-api.contract.ts`
  - `deck-go/contracts/scripts/*`
  - `deck-go/contracts/generated/ts/*`
  - `deck-go/backend/internal/deckapi/*`
  - `deck-go/backend/internal/gateway/generated/*`
  - `deck-go/backend/internal/runtime/openclaw/*`
  - `deck-go/backend/internal/handlers/*`
  - `deck-go/frontend/src/api.ts`
  - `deck-go/frontend/src/services/*`
  - `deck-go/frontend/src/**/*` modules currently importing hand-written `DeckGo*` DTOs
  - `deck-go/docs/*contract*`, `deck-go/docs/*gateway*`, and new coverage/exception reports
- **APIs**:
  - Deck-facing API DTOs become generated contract artifacts instead of frontend-local types.
  - Gateway adapter methods use generated protocol types wherever upstream schemas exist.
  - Dynamic passthroughs remain available only through documented exception contracts.
  - UI metadata becomes a stable generated/validated contract surface for future frontend design.
- **Dependencies**:
  - No new runtime dependency is required by default.
  - Generator enhancements may use existing Node/TypeScript tooling already present under `deck-go/contracts/scripts/`.
- **Risks**:
  - Broad migration touches many frontend modules because `deck-go/frontend/src/api.ts` currently mixes transport functions and numerous hand-written DTOs.
  - Some Gateway methods still lack upstream result schemas; forcing those into strict contracts too early would create false precision.
  - UI metadata can become stale if it is not generated, validated, or reviewed with the DTOs it describes.
  - Backend handlers may expose real payload mismatches once generated Go DTOs replace `map[string]any` or `any` passthroughs.

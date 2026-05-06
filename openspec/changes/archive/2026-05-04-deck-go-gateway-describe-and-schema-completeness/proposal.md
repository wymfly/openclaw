## Why

The head contract-chain audit identified a P0 gap: deck-go generates Gateway clients from static metadata, while real environments expose capability truth through `gateway.describe`. These two surfaces can drift, and current checks do not explicitly prove method, event, params-schema, and result-schema completeness across both surfaces.

## What Changes

- Add a Gateway describe/schema completeness contract for deck-go.
- Compare side-effect-free static Gateway metadata with runtime `gateway.describe` evidence.
- Distinguish method membership, typed params coverage, typed result coverage, event payload coverage, and documented dynamic exceptions.
- Add a check/report that fails on undocumented drift between generated metadata, runtime describe output, and deck-go exception records.
- Preserve existing known dynamic Gateway methods as exceptions for the next hardening proposal instead of adding new Gateway APIs in this change.
- Update the head audit matrix status for this child proposal.

## Capabilities

### New Capabilities

- `deck-go-gateway-describe-schema-completeness`: Defines deck-go's Gateway describe/schema completeness evidence model and drift gates.

### Modified Capabilities

- None.

## Impact

- Affected Gateway protocol metadata and describe checks under `src/gateway/`.
- Affected deck-go contract scripts, generated protocol checks, and docs under `deck-go/contracts/` and `deck-go/docs/`.
- No new production dependency is expected.
- No new Gateway API/method/event is expected; the change hardens evidence around existing Gateway surfaces.

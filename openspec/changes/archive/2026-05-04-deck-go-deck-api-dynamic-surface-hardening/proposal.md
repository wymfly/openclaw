## Why

The head audit still shows Deck-facing API DTOs with broad `Record<string, unknown>` and `unknown` leaves on surfaces that frontend panels treat as stable product fields. This weakens the contract chain because generated TS/Go artifacts can stay synchronized while still hiding product-level drift from tests and UI implementation.

## What Changes

- Audit Deck-facing dynamic fields from `deck-api.contract.ts`, generated DTOs, backend adapters, frontend facades, and module evidence.
- Classify each dynamic field as either an intentional envelope or a stable product DTO gap.
- Narrow deterministic stable gaps to named DTO fields where code truth and Gateway support are clear.
- Keep legitimate extension/plugin/passthrough payloads dynamic but document them as explicit envelopes rather than accidental unknowns.
- Regenerate Deck-facing TS/Go artifacts and contract reports.
- Update the head matrix with the resolved and deferred dynamic-surface evidence.

## Capabilities

### New Capabilities

- `deck-go-deck-api-dynamic-surface-hardening`: Governs how Deck-facing DTOs use dynamic leaves, when they must be narrowed, and how intentional dynamic envelopes are documented.

### Modified Capabilities

- None.

## Impact

- Affected contract source: `deck-go/contracts/source/deck-api.contract.ts`.
- Affected generated artifacts: `deck-go/contracts/generated/ts/deck-api.generated.ts` and `deck-go/backend/internal/deckapi/types.generated.go`.
- Affected backend adapters/facades where deterministic DTO narrowing requires code changes.
- Affected frontend facades where return types should reference generated DTOs instead of broad records.
- Affected reports: contract inventory and head contract-chain audit matrix.

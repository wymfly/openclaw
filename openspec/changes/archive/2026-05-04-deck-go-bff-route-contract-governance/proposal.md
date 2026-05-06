## Why

The head audit shows that endpoint classification is necessary but not sufficient: a Deck Go BFF route can be classified while still lacking an explicit owner, Deck-facing DTO/stream/exception authority, frontend facade ownership, and mock/real evidence. This weakens the contract chain because frontend work may call a route that looks accepted but is not tied back to a verifiable product contract.

## What Changes

- Add route-level governance for registered Deck Go BFF routes.
- Require each product route to link to an owner/module, route category, contract authority, frontend facade or intentional non-frontend transport, and evidence.
- Generate a machine-checkable route governance report from the source registry and discovered Go route registrations.
- Fail contract governance when a new route is registered without a route governance record.
- Fix deterministic route governance drift found during implementation.
- Update the head matrix with archived evidence for this child proposal.

## Capabilities

### New Capabilities

- `deck-go-bff-route-contract-governance`: Governs how Deck Go BFF routes are registered, classified, tied to Deck-facing contracts, and backed by frontend/mock/real evidence.

### Modified Capabilities

- None.

## Impact

- Affected source contracts: `deck-go/contracts/source/deck-endpoints.contract.json` and any new route-governance source introduced by this change.
- Affected generated reports: endpoint classification, contract inventory, route governance report, and head contract-chain audit matrix.
- Affected backend surface: Go route registrations under `deck-go/backend/internal/server/`.
- Affected frontend surface: `deck-go/frontend-new/src/api.ts`, streaming helpers, and documented intentional non-frontend routes.
- No new Gateway APIs are introduced; this is Deck-side governance over the BFF/product contract layer.

## Why

Budget, Alerts, and Webhooks are already real-fixture verified Deck-local
control surfaces, but their head-matrix follow-up remains deferred because a
few product claims and mutation/read DTO details still need final contract-chain
closure. Current code truth also shows two deterministic drifts: Budget
evaluation responses use `currentValue` even though the Deck DTO names
`current`, and webhook test-delivery mutation evidence expects `ok=true` even
though the BFF returns `success=true`.

## What Changes

- Re-audit Budget, Alerts, and Webhooks against current Gateway support, Deck
  BFF routes, Deck-facing DTOs, localstore ownership, frontend facades, mutation
  evidence metadata, and mock/real E2E evidence.
- Align Budget evaluation Go responses with the `DeckGoBudgetEvaluation.current`
  DTO while keeping frontend compatibility for any older `currentValue` wire
  shape.
- Add a typed Deck-facing webhook test-delivery response DTO and update mutation
  evidence so `webhook.test-delivery` recognizes `success=true`.
- Correct visible Alerts fallback wording so unsupported fired-history is
  attributed to the Alerts/control contract boundary rather than a missing
  Gateway RPC.
- Update implementation notes, the contract-chain matrix, generated matrix
  Markdown, head verification evidence, and focused tests.
- Keep Budget forecast/enforcement/period-specific aggregation, durable Alerts
  fire/audit history, webhook retry/retention/stats/event-catalog/live-push, and
  broader notification routing as unsupported/deferred product contracts unless
  future Gateway or Deck-local contracts explicitly add them.

## Capabilities

### New Capabilities

- `deck-go-budget-alerts-webhooks-contract-completion`: Completes Budget,
  Alerts, and Webhooks contract-chain closure by aligning deterministic DTO and
  mutation-evidence drift, preserving fixture-safe real verification evidence,
  and documenting remaining product-level unsupported/deferred leaves.

### Modified Capabilities

- None.

## Impact

- Affected Deck-facing contracts and generated artifacts:
  `deck-go/contracts/source/deck-api.contract.ts`,
  `deck-go/contracts/source/deck-mutations.contract.json`,
  generated Deck API TS/Go artifacts, generated mutation evidence metadata, and
  generated docs.
- Affected Go BFF/runtime code:
  Budget evaluation responses in the server and legacy admin runtime.
- Affected frontend code/tests:
  webhook test-delivery facade typing, Alerts fallback copy, focused mutation
  evidence/API/panel tests, and mock visual copy assertion.
- No new Gateway API, new frontend dependency, webhook retry engine, alert
  evaluator/history store, or budget enforcement engine is introduced.

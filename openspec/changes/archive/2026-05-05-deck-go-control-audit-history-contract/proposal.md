## Why

Config write-safety now records which writes lack audit/history support, and the head matrix identifies audit/history as deck-go product value rather than a Gateway RPC migration. Operators need a product-level mutation history so control-side writes can be inspected without depending on OpenClaw Gateway to add a new audit API.

## What Changes

- Add deck-go in-process control audit history for authenticated `/api` mutation requests.
- Record request id, actor, method/path, action, target, status/result, duration, and retention metadata.
- Expose a read-only Deck BFF route for recent audit entries.
- Add Deck-facing DTOs, generated TS/Go artifacts, frontend facade access, endpoint classification, route governance, and backend tests.
- Keep before/after summaries intentionally minimal for the first contract; richer field-level diffs remain a future safe-mutation/product proposal.

## Capabilities

### New Capabilities

- `deck-go-control-audit-history-contract`: Product-level control mutation audit history with retention rules and Deck-facing DTOs.

### Modified Capabilities

- None.

## Impact

- Affected areas: `deck-go/backend/internal/platform/audit`, `deck-go/backend/internal/server`, Deck API contracts/generated artifacts, route/endpoint governance, frontend API facade, tests, matrix artifacts, and this OpenSpec change.
- No new OpenClaw Gateway APIs or upstream protocol changes are introduced.

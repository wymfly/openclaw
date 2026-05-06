## 1. Explore Route Contract Truth

- [x] 1.1 Inventory registered Go BFF routes, current endpoint classification, contract inventory output, frontend-new facades, and matrix evidence.
- [x] 1.2 Identify stale legacy frontend references and deterministic route governance drift.
- [x] 1.3 Decide whether governance metadata belongs in `deck-endpoints.contract.json` or a companion source.

## 2. Route Governance Source And Report

- [x] 2.1 Add or update route governance metadata with owner, category, contract authority, frontend facade/non-frontend rationale, mock evidence, and real evidence/deferred rationale.
- [x] 2.2 Add or update a generated route governance JSON/Markdown report and check.
- [x] 2.3 Wire route governance check into `contract-gate`.
- [x] 2.4 Correct deterministic stale `frontend/` references to active `frontend-new` references.

## 3. Drift Fixes And Consumers

- [x] 3.1 Fix deterministic route-contract drift found by the new check.
- [x] 3.2 Update backend route tests if typed adapter behavior changed route evidence.
- [x] 3.3 Update frontend facade references only where governance reveals active route drift.
- [x] 3.4 Refresh endpoint classification, contract inventory, and head matrix evidence.

## 4. Verification

- [x] 4.1 Run `openspec validate --type change deck-go-bff-route-contract-governance --strict`.
- [x] 4.2 Run focused route governance report/check verification.
- [x] 4.3 Run focused backend/frontend tests for changed route consumers.
- [x] 4.4 Run `cd deck-go && make contract-gate`.
- [x] 4.5 Run `git diff --check`.
- [x] 4.6 Confirm archive readiness with verification evidence.

Verification evidence:

- `openspec validate --type change deck-go-bff-route-contract-governance --strict` passed.
- `cd deck-go && make route-governance-check` passed with 136 governed routes.
- `cd deck-go && make contracts-check` passed.
- `cd deck-go/backend && go test ./internal/deckapi ./internal/server` passed.
- `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/api-explorer/ApiExplorerPanel.test.tsx src/api.chat-helpers.test.ts` passed with 2 files / 55 tests.
- `cd deck-go/frontend-new && npm run build` passed.
- `cd deck-go && make contract-gate` passed.
- `git diff --check` passed.

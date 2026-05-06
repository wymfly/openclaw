## 1. Explore Dynamic Deck API Surfaces

- [x] 1.1 Inventory dynamic leaves in `deck-api.contract.ts`, generated TS/Go artifacts, backend adapters, frontend facades, and existing matrix evidence.
- [x] 1.2 Classify each dynamic leaf as stable DTO gap, intentional envelope, or deferred module/product decision.
- [x] 1.3 Identify deterministic stable gaps that can be narrowed safely in this proposal.

## 2. Governance And Contract Source

- [x] 2.1 Add or update a Deck API dynamic-surface classification source.
- [x] 2.2 Add or update generated dynamic-surface report/check evidence.
- [x] 2.3 Narrow deterministic stable DTO gaps in `deck-api.contract.ts`.
- [x] 2.4 Keep legitimate plugin/config/schema/action/canvas envelopes dynamic with owner, reason, and exit criteria.

## 3. Generated Artifacts And Consumers

- [x] 3.1 Regenerate Deck API TS and Go artifacts.
- [x] 3.2 Update backend adapters/tests if DTO narrowing changes Go types.
- [x] 3.3 Update frontend facades to use generated DTO types where routes are no longer intentionally dynamic.
- [x] 3.4 Refresh contract inventory and head matrix evidence.

## 4. Verification

- [x] 4.1 Run `openspec validate --type change deck-go-deck-api-dynamic-surface-hardening --strict`.
- [x] 4.2 Run focused dynamic-surface report/check verification.
- [x] 4.3 Run focused backend/frontend tests for changed consumers.
- [x] 4.4 Run `cd deck-go && make contract-gate`.
- [x] 4.5 Run `git diff --check`.
- [x] 4.6 Confirm archive readiness with verification evidence.

## 1. Explore Audit Surface

- [x] 1.1 Confirm current audit package is only a placeholder and no existing child proposal/archive owns this change.
- [x] 1.2 Identify the lowest-risk Deck-owned audit scope: authenticated `/api` mutation metadata, in-memory retention, typed read route, no body capture.

## 2. Backend Audit Implementation

- [x] 2.1 Implement bounded in-memory audit log types, retention behavior, and middleware.
- [x] 2.2 Register mutation audit middleware and `GET /api/audit/events`.
- [x] 2.3 Add backend tests for mutation recording, GET exclusion, request-id handling, and retention eviction.

## 3. Contract Chain

- [x] 3.1 Add Deck-facing audit DTOs to `contracts/source/deck-api.contract.ts` and regenerate TS/Go artifacts.
- [x] 3.2 Add frontend API facade access for audit history.
- [x] 3.3 Update endpoint classification and route governance metadata for the audit route.

## 4. Verification And Archive

- [x] 4.1 Update the head proposal matrix JSON and generated Markdown so `deck-go-control-audit-history-contract` reflects the completed/archived lifecycle.
- [x] 4.2 Run `openspec validate --type change deck-go-control-audit-history-contract --strict`.
- [x] 4.3 Run focused backend and contract checks.
- [x] 4.4 Run `git diff --check`.
- [x] 4.5 Archive this child change after tasks and validation pass, syncing the spec delta into top-level specs as needed.

## 1. Contract Source And Generation

- [x] 1.1 Add a Deck-owned list query source contract for current list endpoints and their pagination/search/filter/sort semantics.
- [x] 1.2 Add a sync/check generator that validates referenced endpoints and writes Markdown docs plus frontend TypeScript metadata.
- [x] 1.3 Wire list query contract sync/check/test targets into the deck-go Makefile and contract gate.

## 2. Frontend Facade Convergence

- [x] 2.1 Add shared frontend list query serialization helpers backed by the generated contract metadata.
- [x] 2.2 Refactor representative list facade builders in `frontend-new/src/api.ts` to use the shared helper without changing wire query names.
- [x] 2.3 Add focused frontend tests proving representative URL serialization and unknown-field suppression.

## 3. Verification And Matrix Closure

- [x] 3.1 Run focused contract/frontend/build checks for list query contract and facade helpers.
- [x] 3.2 Update the contract-chain audit matrix item and head proposal evidence for this child.
- [x] 3.3 Validate, archive the OpenSpec change, and ensure the archived spec is valid.

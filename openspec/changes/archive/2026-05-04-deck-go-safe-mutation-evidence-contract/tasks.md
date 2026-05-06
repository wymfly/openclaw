## 1. Contract Source And Generation

- [x] 1.1 Add a Deck-owned mutation evidence source contract for current representative mutation actions and deferred unsafe classes.
- [x] 1.2 Add a sync/check generator that validates required mutation evidence fields and writes Markdown docs plus frontend TypeScript metadata.
- [x] 1.3 Wire mutation evidence sync/check/test targets into the deck-go Makefile and contract gate.

## 2. Frontend Evidence Helpers

- [x] 2.1 Add shared frontend mutation evidence helpers backed by generated metadata.
- [x] 2.2 Refactor representative budget, alert, and webhook mutation facades or tests to use the shared helper without changing wire response DTOs.
- [x] 2.3 Add focused frontend tests proving success evidence, unknown action failure, target id extraction, and conservative conflict/error handling.

## 3. Verification And Matrix Closure

- [x] 3.1 Run focused contract/frontend/build checks for mutation evidence contract and helpers.
- [x] 3.2 Update the contract-chain audit matrix item and head proposal evidence for this child.
- [x] 3.3 Validate, archive the OpenSpec change, and ensure the archived spec is valid.

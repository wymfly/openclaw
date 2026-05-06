## Why

Docs and Memory are already implemented and real-read-path verified, but the
head matrix still marks them degraded because search/extraction and memory
actions need clearer contract closure. Explore found one deterministic contract
gap: Docs extract/delete writes are production-visible but lack action-level
mutation evidence. Memory search is intentionally degraded until a LanceDB
adapter exists, and the current GET route should be kept single-response.

## What Changes

- Re-audit Docs and Memory against current Deck-facing DTOs, BFF/runtime routes,
  frontend facades, list-query metadata, mutation evidence, panel behavior, and
  mock/real E2E evidence.
- Add a typed Deck-facing docs delete response DTO.
- Add mutation evidence for Docs extract and delete actions, with skipped-safe
  fixture status until disposable extraction/delete fixtures are proven.
- Route the frontend Docs extract/delete facades through mutation evidence
  helpers without changing panel behavior.
- Confirm `GET /api/memory/search` keeps a single explicit unavailable response
  while semantic search remains degraded.
- Update Docs/Memory implementation notes, the contract-chain matrix, generated
  matrix Markdown, and head verification evidence.
- Keep Memory semantic search degraded until a LanceDB-backed adapter exists,
  and keep mutating dream actions skipped/deferred until disposable memory
  fixtures and per-agent Gateway semantics are proven.

## Capabilities

### New Capabilities

- `deck-go-docs-memory-contract-completion`: Completes Docs and Memory
  contract-chain closure by typing Docs delete/extract mutation evidence,
  confirming Memory search keeps one explicit degraded response, and documenting
  remaining semantic-search and mutating-dream limits.

### Modified Capabilities

- None.

## Impact

- Affected contracts/generated artifacts:
  `deck-go/contracts/source/deck-api.contract.ts`,
  `deck-go/contracts/source/deck-mutations.contract.json`, generated Deck API
  TS/Go artifacts, generated mutation evidence metadata, and generated docs.
- Affected backend/tests:
  `deck-go/backend/internal/server/memory.go` GET search handler evidence.
- Affected frontend/tests:
  Docs extract/delete facade typing, mutation evidence tests, API helper tests,
  Docs/Memory focused tests if needed.
- No new Gateway method, LanceDB adapter, Markdown dependency, memory mutation
  fixture, or docs soft-delete/archive policy is introduced.

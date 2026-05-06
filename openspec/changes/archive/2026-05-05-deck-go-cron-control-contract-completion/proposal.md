## Why

Cron already has read-path and UI evidence, but the head matrix still marks it
degraded because scheduler writes and manual runs are only class-level deferred.
Explore also found a deterministic Gateway schema drift: `cron.run` can return
`reason: "invalid-spec"` but the result schema does not advertise that value.

## What Changes

- Re-audit Cron against Gateway cron methods, Deck BFF routes, Deck-facing DTOs,
  list-query metadata, dynamic-surface metadata, mutation evidence, frontend
  facades, panel behavior, and mock/real evidence.
- Add Deck-facing DTOs for Cron delete and manual-run responses.
- Add action-level mutation evidence for Cron create/update/delete/run, with
  deferred or skipped-safe real fixture status until disposable scheduler state
  and cleanup safety are proven.
- Route Cron create/update/delete/run frontend facades through the shared
  mutation evidence helper.
- Align `cron.run` Gateway result schema with the existing `invalid-spec` runtime
  response and regenerate Gateway protocol artifacts.
- Keep Cron payload/delivery dynamic surfaces intentional and documented.
- Update Cron implementation notes, the contract-chain matrix, generated matrix
  Markdown, mutation-evidence docs, dynamic-surface docs if needed, and head
  verification evidence.

## Capabilities

### New Capabilities

- `deck-go-cron-control-contract-completion`: Completes Cron contract-chain
  closure by typing Cron write/run response DTOs, recording Cron mutation
  evidence, fixing `cron.run` schema drift, and documenting remaining scheduler
  fixture and delivery-payload limits.

### Modified Capabilities

- None.

## Impact

- Affected contracts/generated artifacts:
  `deck-go/contracts/source/deck-api.contract.ts`,
  `deck-go/contracts/source/deck-mutations.contract.json`,
  `src/gateway/protocol/schema/cron-extensions.ts`, generated Deck API TS/Go
  artifacts, generated Gateway TS/Go protocol artifacts, mutation evidence
  metadata/docs, and contract-chain matrix docs.
- Affected frontend/tests:
  Cron create/update/delete/run facade typing and mutation evidence wrapping,
  mutation/API tests, focused Cron panel tests if needed.
- Affected backend/tests:
  Cron BFF route shape tests and generated Gateway protocol schema tests.
- No cron expression preview, bulk operation, live run-history stream,
  optimistic concurrency, or real scheduler mutation fixture is introduced.

## Why

The describe/schema completeness child change made dynamic Gateway surfaces visible and confirmed the documented P0 set that deck-go depends on. The next step is to narrow those upstream-schema-missing methods so stable control UI claims are backed by generated Gateway contracts or explicit typed envelopes.

## What Changes

- Add or wire Gateway method metadata for the documented P0 dynamic methods used by deck-go control surfaces.
- Reuse existing Gateway protocol schemas where they already exist for logs, commands, tools, and node pending work.
- Introduce typed outer result envelopes where payloads are intentionally dynamic, such as node invocation.
- Add list-result schemas for exec and plugin approval queues.
- Regenerate deck-go Gateway TS/Go artifacts and update completeness/exception reports.
- Remove resolved untyped exception records from the deck-go exception contract.

## Capabilities

### New Capabilities

- `deck-go-untyped-gateway-method-hardening`: Hardens the documented P0 untyped Gateway methods used by deck-go into generated contracts or typed dynamic envelopes.

### Modified Capabilities

- None.

## Impact

- Affected Gateway protocol schema files and method metadata under `src/gateway/`.
- Affected generated deck-go Gateway protocol artifacts under `deck-go/contracts/generated/ts/gateway/` and `deck-go/backend/internal/gateway/generated/`.
- Affected deck-go exception/completeness docs under `deck-go/contracts/source/` and `deck-go/docs/`.
- No new Gateway method or product route is expected.

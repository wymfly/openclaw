## Why

Deck Go list-style endpoints currently use module-specific query conventions for `limit`, `cursor`, `offset`, search, filters, sort, and date ranges. This makes frontend product work hard to reason about because each panel has to rediscover whether the list is cursor-based, offset-based, bounded-only, or filter-only.

## What Changes

- Add a Deck-owned list query contract that classifies list endpoints by pagination mode, supported filters, search parameter, sort fields, date-range fields, default/max limits, and response collection/cursor fields.
- Generate Markdown documentation and frontend-readable TypeScript metadata from the source contract.
- Add shared frontend query-building helpers and migrate current facade builders for representative list endpoints to use the shared semantics.
- Keep Gateway behavior unchanged; this proposal documents and adapts current Deck BFF behavior rather than adding new upstream methods.
- Update the contract-chain audit matrix and head proposal evidence when the child is archived.

## Capabilities

### New Capabilities

- `deck-go-list-query-contracts`: Product-level contract for Deck Go list/search/filter/sort/pagination semantics.

### Modified Capabilities

- None.

## Impact

- Affected contracts: new list query source contract, generated docs, generated TypeScript metadata, and contract gate.
- Affected frontend: query string helpers and `frontend-new/src/api.ts` list facade builders for sessions, logs, activity/monitor, usage, docs, webhooks/plugins/skills where currently applicable.
- Affected tests: contract generator tests, frontend API/helper tests, focused build/contract checks.
- No new dependencies and no new Gateway APIs.

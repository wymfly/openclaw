## 1. Usage / Logs / Observability Contract Audit

- [x] 1.1 Re-read Usage, Logs, and Activity/Monitor matrix rows, implementation notes, Gateway schemas/method metadata, generated Gateway artifacts, Deck DTOs, list-query/live-projection/dynamic-surface contracts, BFF routes, frontend facades, and mock/real E2E specs.
- [x] 1.2 Confirm visible workflows are supported, read-like, intentionally dynamic, unsupported, or stale with source evidence.

## 2. Generated Protocol And Contract Closure

- [x] 2.1 Align usage logs/timeseries method metadata with the narrow usage-result schemas used by runtime handlers.
- [x] 2.2 Regenerate Gateway protocol TS/Go artifacts.
- [x] 2.3 Add regression assertions that generated usage logs/timeseries envelopes remain typed and logs tail stays typed.
- [x] 2.4 Update focused frontend/API tests only if generated contract narrowing requires facade or fixture changes.

## 3. Evidence And Verification

- [x] 3.1 Update Usage, Logs, and Activity/Monitor implementation notes, contract-chain audit matrix rows, generated matrix Markdown, and head verification evidence.
- [x] 3.2 Run focused protocol, contract, frontend, build, OpenSpec, and diff checks.
- [x] 3.3 Archive the OpenSpec change and validate the archived spec.

## 1. Cron Contract Audit

- [x] 1.1 Re-read Cron matrix row, implementation notes, Deck-facing contracts, generated artifacts, Gateway schema, list-query metadata, mutation evidence metadata, dynamic-surface metadata, BFF/runtime routes, frontend facades, and mock/real E2E specs.
- [x] 1.2 Confirm supported, degraded, skipped-safe, unsupported, or deferred workflows with source evidence.

## 2. Contract And Protocol Alignment

- [x] 2.1 Add Deck-facing Cron delete/run response DTOs and regenerate Deck API artifacts.
- [x] 2.2 Add Cron create/update/delete/run mutation evidence and regenerate mutation evidence artifacts.
- [x] 2.3 Add `invalid-spec` to the `cron.run` result schema and regenerate Gateway protocol artifacts.
- [x] 2.4 Route Cron create/update/delete/run frontend facades through mutation evidence helpers and update focused frontend tests.

## 3. Evidence And Verification

- [x] 3.1 Update Cron implementation notes, contract-chain audit matrix row, generated matrix Markdown, dynamic-surface/mutation docs, and head verification evidence.
- [x] 3.2 Run focused contract, protocol, backend, frontend, build, OpenSpec, and diff checks.
- [x] 3.3 Archive the OpenSpec change and validate the archived spec.

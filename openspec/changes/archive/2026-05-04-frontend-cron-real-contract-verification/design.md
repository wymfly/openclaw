## Context

Cron already has a handoff package, production panel, frontend wrappers, mock visual E2E, Go BFF route tests, and a hifi spec. The refreshed v2 prototype is richer than the current production UI: it uses a sticky topbar with KPI evidence, a filterable seven-column job inventory, selected-job detail tabs, a builder modal, explicit enable/disable/run/edit/delete actions, and a guarded delete dialog.

The current contract chain is:

1. `frontend-new/src/api.ts` wrappers for `fetchCronStatus`, `fetchCronJobs`, `createCronJob`, `updateCronJob`, `deleteCronJob`, `runCronJob`, and `fetchCronRuns`
2. Deck-facing DTOs `DeckGoCronSchedule`, `DeckGoCronJob`, `DeckGoCronJobInput`, `DeckGoCronRunEntry`, `DeckGoCronStatus`, `DeckGoCronJobsResponse`, `DeckGoCronRunsResponse`, and parameter DTOs
3. Endpoint classification in `contracts/source/deck-endpoints.contract.json`
4. Go BFF routes under `/api/cron`, `/api/cron/{jobId}`, `/api/cron/{jobId}/run`, `/api/cron/{jobId}/runs`, and `/api/cron/status`
5. Runtime facade/Gateway calls to `cron.list`, `cron.add`, `cron.update`, `cron.remove`, `cron.run`, `cron.runs`, and `cron.status`

## Goals / Non-Goals

**Goals:**

- Align production Cron with the fresh v2 handoff where the prototype is backed by the true BFF/Gateway contract.
- Preserve browser-to-BFF-only access and avoid direct Gateway calls from frontend code.
- Verify status, inventory, search/filter/sort, selected detail, run history, raw payload evidence, create/update/run/delete affordances, safe delete confirmation, empty/error states, and route behavior.
- Fix clear Cron drift directly, including stale route names in handoff docs, stale UI tests, unsupported claims, and browser-native confirmation where the handoff requires a guarded dialog.
- Record capability gaps in `frontend-handoff/modules/cron/implementation-notes.md`.

**Non-Goals:**

- Add a cron-expression parser dependency, schedule preview RPC, next-N-fire preview, bulk operations, cursor pagination, optimistic concurrency, or live run-history stream.
- Claim real Gateway cron scheduler semantic correctness beyond bounded route-chain/API/UI evidence.
- Add new runtime scheduler behavior or mutate real jobs in L2 unless the operation is disposable and safe in the current environment.
- Add new UI dependencies or persistence layers without explicit approval.

## Decisions

1. **Current route truth wins over handoff shorthand.** The prototype README names `/api/cron/jobs*`; code truth is `/api/cron`, `/api/cron/{jobId}`, `/api/cron/{jobId}/run`, `/api/cron/{jobId}/runs`, and `/api/cron/status`. Handoff docs and tests must be reconciled with code truth.

2. **Gateway field normalization remains in the frontend API facade.** Generated Gateway payloads can expose `job.state.nextRunAtMs`, `status.jobs`, and `status.nextWakeAtMs`; the browser panel consumes normalized Deck-facing DTOs only.

3. **Production UI follows the v2 workbench without unsupported backend expansion.** Search, filter, sort, KPI aggregation, and selected detail can be browser-side over loaded contract data. Cron preview, bulk actions, live history, and optimistic concurrency stay documented gaps.

4. **Mutations are supported but real E2E is safety-gated.** L1 mock visual coverage can exercise create/update/run/delete. L2 real stack may verify read paths and UI rendering, and may classify mutations as skipped-safe or handoff-blocked when no disposable scheduler state is available.

5. **Delete uses an explicit in-app confirm dialog.** `window.confirm` is a deterministic UI drift from the handoff and should be replaced with a low-risk in-app dialog in the module.

6. **Circuit breaker applies to real Gateway scheduler variation.** If real Gateway cron methods are missing, empty, environment-specific, or unsafe for mutation after bounded attempts, record degraded/skipped-safe evidence and continue after static review plus L1 evidence.

## Risks / Trade-offs

- **Real Gateway may have no cron jobs or may reject mutations** -> L2 tests assert route shape, UI resilience, and BFF-only browser access; unsafe mutations can be skipped-safe with evidence.
- **Prototype route names differ from code truth** -> Update handoff docs to avoid frontenders implementing against nonexistent routes.
- **Cron expression validation is not available client-side** -> Keep native input validation minimal and document backend/contract-blocked preview work.
- **KPI aggregation is client-side over the loaded run window** -> Label as loaded-window evidence rather than global scheduler analytics.
- **Open payload and delivery fields are untyped** -> Render raw JSON evidence and avoid specialized semantics.

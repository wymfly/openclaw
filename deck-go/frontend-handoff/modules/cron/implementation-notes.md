# Cron Implementation Notes

## Production Migration

- Implemented the real-contract v2 pass under `deck-go/frontend-new/src/components/panels/cron/`.
- Production now follows the handoff's control-plane workbench shape where contract-backed: sticky topbar with scheduler/KPI evidence, filterable/sortable job inventory, selected-job hero, action row, detail tabs, builder modal, guarded delete dialog, run history, scheduler heartbeat detail, and raw last-action evidence.
- Browser code still uses `frontend-new/src/api.ts` wrappers only; no direct Gateway HTTP/WebSocket access was introduced.
- The builder supports contract-backed input fields only: name, schedule kind/value, session target, wake mode, payload kind/value, agent id, description, and enabled state.
- Delete now uses an in-app confirmation dialog instead of `window.confirm`.

## Contract Drift Fixed

- Route truth corrected in README/api-usage: current BFF routes are `GET/POST /api/cron`, `PATCH/DELETE /api/cron/:id`, `POST /api/cron/:id/run`, `GET /api/cron/:id/runs`, and `GET /api/cron/status`. Older `/api/cron/jobs*` names were prototype shorthand.
- Existing frontend normalization remains the adapter seam for Gateway fields such as `job.state.nextRunAtMs`, `status.jobs`, and `status.nextWakeAtMs`.
- Mock visual E2E now targets the v2 production UI labels and modal states instead of the older inline form.
- Focused unit tests now assert builder create/edit envelopes, enable/disable mutation, run-now, in-app delete confirmation, filters, detail tabs, and Chinese rendering.

## Contract Chain Matrix

| Workflow                  | Frontend wrapper                            | BFF route                | Gateway method          | Classification                                                                                                |
| ------------------------- | ------------------------------------------- | ------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| Scheduler status          | `fetchCronStatus()`                         | `GET /api/cron/status`   | `cron.status`           | supported                                                                                                     |
| Job inventory             | `fetchCronJobs(params)`                     | `GET /api/cron`          | `cron.list`             | supported                                                                                                     |
| Search/filter/sort        | `fetchCronJobs` params + client-side filter | `GET /api/cron`          | `cron.list`             | supported; production also filters loaded rows client-side                                                    |
| Create                    | `createCronJob(input)`                      | `POST /api/cron`         | `cron.add`              | supported; L1 exercised; L2 create is fixture-safe for disabled/far-future run-scoped jobs with cleanup proof |
| Update / enable / disable | `updateCronJob(id, patch)`                  | `PATCH /api/cron/:id`    | `cron.update`           | supported; L1 exercised; L2 update is fixture-safe only for current-run Cron fixtures                         |
| Run now                   | `runCronJob(id, { mode })`                  | `POST /api/cron/:id/run` | `cron.run`              | supported; L1 exercised, L2 mutation skipped-safe                                                             |
| Delete                    | `deleteCronJob(id)`                         | `DELETE /api/cron/:id`   | `cron.remove`           | supported with in-app confirmation; L2 delete is fixture-safe only for current-run Cron fixture cleanup       |
| Run history               | `fetchCronRuns(jobId, params)`              | `GET /api/cron/:id/runs` | `cron.runs`             | supported when a job id exists; empty-valid otherwise                                                         |
| Scheduler detail          | `fetchCronStatus()`                         | `GET /api/cron/status`   | `cron.status`           | supported as read-only evidence                                                                               |
| Raw job/action evidence   | loaded DTO/action payload                   | current BFF wrappers     | current Gateway methods | supported                                                                                                     |
| Cron next-fire preview    | none                                        | none                     | none                    | backend-contract-blocked                                                                                      |
| Bulk operations           | none                                        | none                     | none                    | unsupported                                                                                                   |
| Live run-history stream   | none                                        | none                     | none                    | unsupported                                                                                                   |
| Optimistic concurrency    | none                                        | none                     | none                    | unsupported / last-write-wins                                                                                 |
| Stable delivery semantics | raw `delivery?: unknown`                    | current payload          | current Gateway payload | degraded; render raw only                                                                                     |

## Verification Evidence

- Prototype smoke: `deck-go/frontend-handoff/modules/cron/prototype.html` loaded with title `Scheduled jobs`, opened the New Job dialog, and reported no console/page errors.
- `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/cron/CronPanel.test.tsx src/api.chat-helpers.test.ts` -> 52 tests passed.
- `cd deck-go/backend && go test ./internal/server ./internal/runtime/openclaw ./internal/api/http -run 'TestGatewayFacade_CronRoutes|TestGatewayQueriesTyped|TestMountRuntimeRoutes|TestNewHandlerWithDependencies_ExposesStage2RuntimeRoutes|TestManagedRuntime|TestLegacyInventorySurface|TestAdapterCron'` -> passed.
- `cd deck-go && pnpm exec playwright test test/e2e/cron-visual.spec.ts --config playwright.config.ts` -> 1 passed. This is L1 mock/local visual coverage only.
- `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/cron-real-gateway.spec.ts --config playwright.config.ts` -> 2 passed. This is bounded L2 BFF/Gateway route-chain and UI/BFF-boundary evidence; it does not prove full scheduler semantics.
- `openspec validate frontend-cron-real-contract-verification --strict` -> valid.
- `cd deck-go && make endpoint-classification-check` -> passed.
- `cd deck-go && make frontend-build` -> passed.

## Contract-Chain Completion Closeout — 2026-05-05

- Added Deck-facing `DeckGoCronDeleteResponse` and `DeckGoCronRunResponse`; `/api/cron/status` now normalizes Gateway `enabled/jobs/nextWakeAtMs/storePath` into the Deck-facing Cron status DTO.
- Added action-level mutation evidence for `cron.create`, `cron.update`, `cron.delete`, and `cron.run`; create/update/delete started as deferred and manual run remains skipped-safe until a no-op execution lane proves workload safety.
- Routed `createCronJob`, `updateCronJob`, `deleteCronJob`, and `runCronJob` through `acknowledgeMutationResponse` so frontend write facades fail fast when evidence metadata drifts.
- Fixed Gateway protocol schema drift by allowing `cron.run` result `reason: "invalid-spec"`, matching the existing handler behavior.
- Preserved `payload` and `delivery` as documented dynamic surfaces; delivery-kind DTOs, cron preview, bulk actions, live run-history streams, and optimistic concurrency remain unsupported/deferred product work.

## Prototype Parity Remediation Closeout — 2026-05-05

- Active visual target: `deck-go/frontend-handoff/modules/cron/prototype.html`.
- Mock fixture density now matches the prototype intent more closely: the mock Gateway exposes nine contract-shaped jobs across `cron`, `every`, and `at` schedules plus `ok`, `error`, and `skipped` run histories.
- Production i18n drift was fixed for the load-state pill: English shows `Cron ready`, while Chinese now shows `Cron 就绪`.
- Mock visual E2E now covers dark/en, dark/zh, light/en, and light/zh, search empty state, sort, History, Scheduler, New Job, Run Now, and Delete confirmation.
- Structured visual verdict: `pass-with-exceptions`, score `91`. Accepted exceptions are Deck shell chrome, static prototype copy/data, simpler contract-backed row badges, selected-job-only real history, unsupported cron preview/bulk/live stream/optimistic concurrency, and skipped-safe real run-now.
- Real Gateway E2E now creates a disabled run-scoped Cron job through `POST /api/cron`, patches it through `PATCH /api/cron/:id`, verifies filtered list and `GET /api/cron/:id/runs`, navigates Chat -> Cron, covers all four theme/locale variants, interacts with Schedule/History/Scheduler tabs plus builder/edit/delete dialogs, proves disabled run-now fallback, checks BFF-only browser transport, and deletes only the current run-scoped job.
- `cron.create`, `cron.update`, and `cron.delete` mutation evidence is now fixture-safe for disabled/far-future run-scoped jobs with cleanup proof. `cron.run` remains skipped-safe because it can trigger operator workload.

## Residual Risks

- Real Gateway cron inventory may be empty before the test fixture; the real test now creates and cleans a disabled run-scoped job to avoid empty-state-only evidence.
- Cron expression preview and validation remain contract/dependency-blocked; production trusts the current backend route to validate or reject schedule input.
- KPI run/error counts are computed over the currently loaded selected-job run window, not a global scheduler analytics endpoint.
- `delivery` remains an untyped field and is rendered only as raw evidence.

## 1. Contract Truth And Baseline

- [x] 1.1 Re-read scoped contract sources and generated DTO/client types, then record the exact BFF endpoints, Gateway adapter paths, list-query metadata, mutation evidence, route governance, stream metadata, and live projection metadata used by this change.
- [x] 1.2 Inventory current server-state lifecycles in scoped panels and child components, separating server state from local UI state, stream-owned state, and transient command/action state.
- [x] 1.3 Confirm module boundaries and exclusions in `proposal.md`/`design.md` still match code truth before editing production code, especially the SessionsPanel vs ChatPanel boundary.

## 2. Data Module Foundation For Scoped Live Workbench Modules

- [x] 2.1 Add Data Fabric modules for `sessions`, `approvals`, `activity`, `gateway`, `usage`, `logs`, `alerts`, `budget`, `cron`, `threads`, and `webhooks` with stable keys and index barrels.
- [x] 2.2 Add query hooks/options for scoped reads with explicit source metadata and freshness tiers.
- [x] 2.3 Add mutation wrappers for scoped writes with conservative defaults, declared invalidation targets, fixture-safe guards where applicable, and draft-preserving error behavior.
- [x] 2.4 Add projection policies for `activity-feed`, `approval-queue`, `session-list`, `log-tail`, and `usage-observability` without requiring generated patch fields.
- [x] 2.5 Add focused tests for keys, freshness mapping, shared-source reuse, cached return, background refresh error preservation, mutation invalidation, fixture-safe guards, and projection invalidation.

## 3. Historical And Diagnostic Read Modules

- [x] 3.1 Migrate `ActivityPanel` to Data Fabric reads for activity events and migrate the current activity/monitor read surfaces through Data Fabric while preserving filters, selected run state where present, and current UI.
- [x] 3.2 Migrate `GatewayPanel` to Data Fabric reads/actions for gateway health, status, describe, and diagnostic batch/RPC action results while preserving selected method, payload drafts, and BFF-only transport checks.
- [x] 3.3 Migrate `UsagePanel` and usage child surfaces to Data Fabric reads for cost, providers, sessions, session logs, and timeseries while preserving date filters, selected session state, and current UI.
- [x] 3.4 Migrate `LogsPanel` to Data Fabric reads for `GET /logs` while preserving existing log stream rendering, cursor behavior, selected line state, and current UI.
- [x] 3.5 Migrate `ThreadsPanel` to Data Fabric reads while preserving local filters, selected thread state, empty/degraded behavior, and current UI.
- [x] 3.6 Update focused panel tests for activity/gateway/usage/logs/threads to use `DataFabricTestProvider` and prove first-load, ready, empty, error, cached return, and cached-data-preserved-on-refresh-error states where applicable.

## 4. Queue And Session Workbench Modules

- [x] 4.1 Migrate `ApprovalsPanel` and approval stream handling to Data Fabric reads/mutations/projection policy while preserving policy drafts, selected approval/plugin approval state, live event display, and decision actions.
- [x] 4.2 Migrate `SessionsPanel` and session child components to Data Fabric reads/mutations for session list, previews, detail, history, usage details, compaction checkpoints, subagent lineage, and session mutations while preserving local filters, selected session, delete/reset/clear/patch safety, compaction branch/restore actions, and current UI.
- [x] 4.3 Update focused panel tests for approvals and sessions to use `DataFabricTestProvider` and prove live invalidation, first-load/ready/error states, cached return, and mutation invalidation.

## 5. Fixture-Safe Write Modules

- [x] 5.1 Migrate `AlertsPanel` and alert form/list child components to Data Fabric reads/mutations while preserving filters, drafts, validation, toggle/delete flows, and current UI.
- [x] 5.2 Migrate `BudgetPanel` and budget form/list child components to Data Fabric reads/mutations while preserving evaluation state, drafts, toggle/delete flows, and current UI.
- [x] 5.3 Migrate `WebhooksPanel` and child components to Data Fabric reads/mutations while preserving selected webhook, delivery history, drafts, test delivery, delete confirmation, and current UI.
- [x] 5.4 Migrate `CronPanel` to Data Fabric reads/mutations while preserving selected job, runs tab, builder draft, run/toggle/delete flows, skipped-safe real write guards, and current UI.
- [x] 5.5 Update focused panel tests for alerts/budget/webhooks/cron to use `DataFabricTestProvider` and prove first-load, ready, empty, error, cached return, mutation invalidation, and fixture-safe destructive guards where applicable.

## 6. Verification

- [x] 6.1 Run `openspec validate deck-go-data-fabric-live-workbench --type change --strict` and fix all proposal/spec/task validation issues.
- [x] 6.2 Run focused Data Fabric/module/panel tests for all scoped modules.
- [x] 6.3 Run `cd deck-go/frontend-new && npm run test:deck-ui`; if unrelated failures remain, record exact failing files/assertions separately from this change.
- [x] 6.4 Run `cd deck-go && make frontend-build`.
- [x] 6.5 Run `cd deck-go && make contract-gate`.
- [x] 6.6 Run L4 mock-functional browser evidence for the scoped modules: `sessions`, `approvals`, `activity`, `gateway`, `usage`, `logs`, `alerts`, `budget`, `cron`, `threads`, and `webhooks`.
- [x] 6.7 Run L5 real Gateway evidence for the scoped modules against the isolated real stack; after two environment/startup failures without new narrowing evidence, record a circuit-breaker handoff while keeping deterministic checks green.
- [x] 6.8 Create or update `verification.yaml` with command evidence, known unrelated failures, circuit-breaker handoffs if any, and archive readiness.
- [x] 6.9 Sync accepted spec deltas into main specs, rerun change validation, confirm all tasks are checked only after fresh evidence, and archive the change when ready.

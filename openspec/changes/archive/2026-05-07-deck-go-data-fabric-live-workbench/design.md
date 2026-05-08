## Context

The previous Data Fabric changes added the shared query provider, runtime
summary migration, Agents reference shape, and config/inventory module
migrations. The remaining high-churn panels still mostly own server state inside
the panel layer:

- `SessionsPanel` and child usage/compaction components call session, preview,
  history, lineage, usage, and compaction facades directly.
- `ApprovalsPanel` loads three approval surfaces and keeps a panel-local live
  stream hook.
- `ActivityPanel`, `GatewayPanel`, `UsagePanel`, `LogsPanel`, `AlertsPanel`,
  `BudgetPanel`, `CronPanel`, `ThreadsPanel`, and `WebhooksPanel` use local
  load/refresh/action functions around `frontend-new/src/api.ts` facades.
- There are no Data Fabric modules yet for `sessions`, `approvals`, `activity`,
  `gateway`, `usage`, `logs`, `alerts`, `budget`, `cron`, `threads`, or
  `webhooks`.

Contract truth for this slice:

| Module      | Primary read sources                                                                                                                                                                                   | Mutation/write sources                                                                                           | Live/list metadata                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `sessions`  | `GET /sessions`, `POST /chat/sessions/preview`, `GET /sessions/{sessionKey}`, `GET /chat/history`, `GET /usage/sessions`, `GET /usage/sessions/logs`, `POST /chat/compaction`, subagent lineage facade | `DELETE /chat/sessions`, reset/clear/patch/compaction branch/restore where already exposed by current panel code | `sessions-list`, `session-detail`, `session-list` projection                   |
| `approvals` | `GET /approvals/policy`, `GET /approvals/pending`, `GET /approvals/plugins`                                                                                                                            | `POST /approvals`, `POST /approvals/plugins`, `PUT /approvals/policy`                                            | `approval-queue` projection                                                    |
| `activity`  | `GET /activity`, `GET /monitor/runs`, `GET /monitor/runs/{runId}`, `GET /monitor/stats`, audit history facade                                                                                          | read-only in this slice                                                                                          | `activity-events`, `activity-feed` projection                                  |
| `gateway`   | `GET /gateway/health`, `GET /gateway/status`, `GET /gateway/describe`, gateway batch/RPC adapter actions already mediated by BFF                                                                       | Gateway batch/RPC diagnostic submits stay user-triggered and non-retried                                         | route governance `gateway-diagnostics`; runtime-liveness/read-only diagnostics |
| `usage`     | `GET /usage/cost`, `GET /usage/providers`, `GET /usage/sessions`, `GET /usage/sessions/logs`, `GET /usage/timeseries`                                                                                  | read-only in this slice                                                                                          | `usage-sessions`, `usage-session-logs`, `usage-observability` refresh-only     |
| `logs`      | `GET /logs`                                                                                                                                                                                            | read-only; stream remains specialized                                                                            | `logs-tail`, `log-tail`, `deck-logs` stream                                    |
| `alerts`    | `GET /alerts`                                                                                                                                                                                          | `POST /alerts`, `PATCH /alerts/{id}`, `DELETE /alerts/{id}`                                                      | route governance + mutation evidence, no live projection                       |
| `budget`    | `GET /usage/budget`, `GET /usage/budget/evaluate`                                                                                                                                                      | `POST /usage/budget`, `PATCH /usage/budget/{id}`, `DELETE /usage/budget/{id}`                                    | route governance + mutation evidence, no live projection                       |
| `cron`      | `GET /cron`, `GET /cron/status`, `GET /cron/{jobId}/runs`                                                                                                                                              | `POST /cron`, `PATCH /cron/{jobId}`, `DELETE /cron/{jobId}`, `POST /cron/{jobId}/run`                            | `cron-jobs`, `cron-runs`                                                       |
| `threads`   | `GET /deck/threads`                                                                                                                                                                                    | no writes in current panel                                                                                       | route governance `identity-routing`, no live projection                        |
| `webhooks`  | `GET /webhooks`, `GET /webhooks/{id}/deliveries`                                                                                                                                                       | `POST /webhooks`, `PATCH /webhooks/{id}`, `DELETE /webhooks/{id}`, `POST /webhooks/{id}/test`                    | route governance + mutation evidence, no live projection                       |

### Implementation Baseline Recheck

The following code-truth sources were re-read before production edits:

- Contract sources:
  - `deck-go/contracts/source/deck-api.contract.ts`
  - `deck-go/contracts/source/deck-endpoints.contract.json`
  - `deck-go/contracts/source/deck-list-queries.contract.json`
  - `deck-go/contracts/source/deck-mutations.contract.json`
  - `deck-go/contracts/source/deck-live-projections.contract.json`
  - `deck-go/contracts/source/deck-route-governance.contract.json`
  - `deck-go/contracts/source/deck-streams.contract.json`
- Generated/front-end DTO facades:
  - `deck-go/contracts/generated/ts/deck-api.generated.ts`
  - `deck-go/contracts/generated/ts/deck-live-projections.generated.ts`
  - `deck-go/frontend-new/src/api-types.ts`
- BFF facades:
  - `deck-go/frontend-new/src/api.ts`
- Current panel lifecycles:
  - `deck-go/frontend-new/src/components/panels/{sessions,approvals,activity,gateway,usage,logs,alerts,budget,cron,threads,webhooks}/`

Exact contract evidence used by this change:

| Module      | BFF facade methods                                                                                                                                                                                                              | List/query metadata                                                       | Mutation evidence                                                                                                                                                                                                                                                         | Projection/stream evidence                                                                          | Route governance                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `sessions`  | `fetchSessions`, `fetchSessionPreviews`, `fetchSessionDetail`, `fetchChatHistory`, `fetchUsageSessions`, `fetchUsageSessionLogs`, `fetchSubagentLineage`, `fetchCompactionCheckpoints`, session mutation and compaction facades | `sessions-list`, `session-detail`, `usage-sessions`, `usage-session-logs` | `chat.session.reset`, `chat.session.clear`, `chat.session.delete`, `chat.session.patch`, `chat.compact`, `chat.compaction.branch`, `chat.compaction.restore`; all are gateway-backed and deferred for automated real writes unless disposable session fixtures are proven | `session-list` projection refreshes `GET /sessions`; Chat transcript stream stays excluded          | `chat-sessions` owner covers `/api/chat` and `/api/sessions`       |
| `approvals` | `fetchApprovalsPolicy`, `fetchPendingApprovals`, `fetchPluginApprovals`, `resolveApproval`, `resolvePluginApproval`, `updateApprovalsPolicy`                                                                                    | none beyond endpoint DTOs                                                 | `approvals.policy.save` is config-write-safety/deferred; `approvals.exec.resolve` and `approvals.plugin.resolve` are skipped-safe unless disposable pending approval fixtures exist                                                                                       | `approval-queue` projection refreshes `GET /approvals/pending` and `GET /approvals`                 | `approvals` owner covers `/api/approvals` and `/api/exec/approval` |
| `activity`  | `fetchActivityEvents`, `fetchMonitorRuns`, `fetchMonitorStats`, `fetchMonitorRunDetail`, audit facade where used                                                                                                                | `activity-events`, `monitor-runs`                                         | read-only in this slice                                                                                                                                                                                                                                                   | `activity-feed` projection refreshes `GET /activity`, `GET /monitor/runs`, and `GET /monitor/stats` | `activity-monitor` owner covers `/api/activity` and `/api/monitor` |
| `gateway`   | `fetchGatewayHealth`, `fetchGatewayStatus`, `fetchGatewayDescribe`, `submitGatewayBatch`, `invokeGatewayMethod`                                                                                                                 | endpoint DTOs only                                                        | diagnostic batch/RPC actions remain user-triggered, non-retried, and BFF-mediated                                                                                                                                                                                         | no module projection; gateway liveness events are handled by foundation runtime invalidation        | `gateway-diagnostics` owner covers `/api/gateway`                  |
| `usage`     | `fetchModelUsageCost`, `fetchModelUsageProviders`, `fetchUsageSessions`, `fetchUsageSessionLogs`, `fetchUsageTimeseries`                                                                                                        | `usage-sessions`, `usage-session-logs`                                    | read-only in this slice                                                                                                                                                                                                                                                   | `usage-observability` declares no events and is manual/refresh-only                                 | `usage` owner covers `/api/usage`                                  |
| `logs`      | `fetchLogsTail`                                                                                                                                                                                                                 | `logs-tail`                                                               | read-only in this slice                                                                                                                                                                                                                                                   | `log-tail` owns `GET /logs` metadata; `deck-logs` stream remains specialized with `gapPolicy: none` | `logs` owner covers `/api/logs`                                    |
| `alerts`    | `fetchAlertRules`, `createAlertRule`, `updateAlertRule`, `deleteAlertRule`                                                                                                                                                      | endpoint DTOs only                                                        | `alert.rule.create`, `alert.rule.update`, `alert.rule.delete` are deck-local, validation-only/unsupported conflicts, fixture-safe only for run-scoped rules                                                                                                               | no live projection                                                                                  | `alerts` owner covers `/api/alerts`                                |
| `budget`    | `fetchBudgetRules`, `evaluateBudgetRules`, `createBudgetRule`, `updateBudgetRule`, `deleteBudgetRule`                                                                                                                           | endpoint DTOs only                                                        | `budget.rule.create`, `budget.rule.update`, `budget.rule.delete` are deck-local, validation-only/unsupported conflicts, fixture-safe only for run-scoped rules                                                                                                            | no live projection                                                                                  | `budget` owner covers `/api/usage/budget`                          |
| `cron`      | `fetchCronJobs`, `fetchCronStatus`, `fetchCronRuns`, `createCronJob`, `updateCronJob`, `runCronJob`, `deleteCronJob`                                                                                                            | `cron-jobs`, `cron-runs`                                                  | `cron.create`, `cron.update`, `cron.delete` are fixture-safe only for run-scoped jobs; `cron.run` is skipped-safe unless a disposable workload fixture exists                                                                                                             | no live projection                                                                                  | `cron` owner covers `/api/cron`                                    |
| `threads`   | `fetchThreads`                                                                                                                                                                                                                  | endpoint DTOs only                                                        | read-only in this slice                                                                                                                                                                                                                                                   | no live projection                                                                                  | `identity-routing` owner covers `/api/deck/threads`                |
| `webhooks`  | `fetchWebhooks`, `fetchWebhookDeliveries`, `createWebhook`, `updateWebhook`, `deleteWebhook`, `testWebhook`                                                                                                                     | endpoint DTOs only                                                        | `webhook.create`, `webhook.update`, `webhook.delete`, and `webhook.test-delivery` are deck-local fixture-safe only for run-scoped webhooks                                                                                                                                | no live projection                                                                                  | `webhooks` owner covers `/api/webhooks`                            |

Current server-state lifecycle inventory:

- `ActivityPanel`, `GatewayPanel`, `UsagePanel`, `LogsPanel`, `ThreadsPanel`,
  `ApprovalsPanel`, `AlertsPanel`, `BudgetPanel`, `CronPanel`,
  `WebhooksPanel`, `SessionsPanel`, `SessionUsageDetails`, and
  `SessionCompactionHistory` still own one or more component-local
  `useEffect(fetch*)` lifecycles around `src/api.ts`.
- Local UI state that must not move into query cache includes filters, tabs,
  selected ids, selected log lines, selected session/job/webhook/run,
  request/JSON drafts, policy/form drafts, confirmation dialogs, and transient
  command/action output.
- Existing stream-owned state remains specialized: Logs continues to own the
  SSE log tail renderer and cursor behavior; Chat transcript streaming,
  ChatPanel dispatcher/input/canvas state, and chat sidebar session sync remain
  excluded for the later `deck-go-data-fabric-chat-surroundings` change.

## Goals / Non-Goals

**Goals:**

- Create module-local Data Fabric directories for every scoped module with
  stable keys, query options/hooks, mutation wrappers where writes exist, and
  projection policies where metadata exists.
- Migrate scoped panels to consume Data Fabric hooks or query option factories
  for server state while retaining local UI state in React state.
- Use freshness tiers according to source semantics:
  - `live-workbench` for actively changing queues/status/workbench reads.
  - `historical` for log, usage, monitor history, audit, and run history.
  - `runtime-liveness` for Gateway health/status.
  - `lazy-detail` for selected detail, deliveries, history, compaction, batch
    action results, and diagnostic command reads.
  - `stream-driven` only where an existing reducer/stream owns the displayed
    bytes and query cache is only the authoritative refresh model.
- Preserve cached data during background refresh errors and show non-blocking
  stale/error state instead of returning to first-load skeletons.
- Keep mutation wrappers conservative: no automatic mutation retry, no offline
  queue, no optimistic update unless exact rollback is proven in tests.
- Keep browser traffic behind deck-go backend routes and current API facades.
- Prove each module through focused tests plus L4 mock-functional and L5 real
  Gateway module evidence.

**Non-Goals:**

- Do not migrate chat transcript streaming, chat dispatcher state, chat input
  commands, canvas bridge, or chat sidebar session sync. Those belong to
  `deck-go-data-fabric-chat-surroundings`.
- Do not add a second server-state framework or new dependency.
- Do not redesign panel UI beyond changes needed to preserve existing behavior
  under Data Fabric.
- Do not add generated live projection `patchStrategy` / `patchKeys` fields.
- Do not make Logs abandon its specialized tail stream; this change only wraps
  the authoritative tail read and invalidation boundary.
- Do not make real E2E perform unsafe writes against non-run-scoped objects.

## Decisions

### 1. Module Shape

Each scoped module SHALL follow the same shape used by Agents and
config/inventory modules:

```text
frontend-new/src/data/modules/<module>/
├── keys.ts
├── queries.ts
├── mutations.ts      # only when writes exist
├── projections.ts    # only when live metadata exists
└── index.ts
```

Query option factories are required even when panels use hooks. Panels may use
`queryClient.fetchQuery(<module>QueryOptions(...))` only for explicit
user-triggered detail/action reads or one-off command results; first-load and
background-refresh reads must use hooks.

### 2. Freshness And Cache Behavior

The module matrix chooses freshness by product semantics rather than route name:

| Tier               | Modules/reads                                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `runtime-liveness` | Gateway health/status                                                                                                                          |
| `live-workbench`   | approvals queues, sessions list, cron status/jobs, active monitor runs, selected Gateway diagnostics that represent current runtime state      |
| `historical`       | activity history, monitor history/stats, usage history, usage session logs, log tail snapshot, cron runs, webhook deliveries                   |
| `inventory`        | threads list, alerts rules, budget rules, webhooks list where data is stable enough to avoid refetch on every mount                            |
| `lazy-detail`      | session detail/history, compaction checkpoints, selected monitor run detail, gateway describe, webhook test result, diagnostics/action results |
| `stream-driven`    | existing Logs tail stream and future chat transcript stream only when a stream reducer owns rendering                                          |

Tests must prove fresh navigation/cache reuse for at least representative
modules from each class and cached-data preservation after background refresh
failure.

### 3. Live Projection Handling

Live metadata stays invalidation-first:

- `activity-feed` invalidates `activity` events, monitor runs, monitor stats,
  and selected monitor run detail on known events or `projection.gap`.
- `approval-queue` invalidates approval pending/list/plugin-policy-related reads
  on `approval.pending`, `approval.resolved`, or `projection.gap`.
- `session-list` invalidates the Sessions panel session list and related
  previews on `sessions.changed`, `session-state`, or `projection.gap`.
- `usage-observability` is refresh-only because current contract declares no
  stream events.
- `log-tail` keeps the current stream boundary. Data Fabric owns the `GET /logs`
  query key and may invalidate/refetch it on manual refresh/reset, but must not
  invent gap behavior because `gapPolicy` is `none`.

Projection hooks may wrap `useLiveProjectionSubscription` inside the module
boundary. Panels must not import `useLiveProjectionSubscription` directly for
migrated live metadata.

### 4. Mutation Wrappers

Mutations are grouped by safety class:

- Fixture-safe Deck-local writes: alerts, budget, webhooks. Real E2E may create,
  update, test, and delete run-scoped fixtures when existing specs already do so.
- Gateway-backed/conflict-sensitive writes: approvals policy/decisions and
  session mutations. Preserve upstream errors and drafts; do not retry.
- Scheduler writes: cron create/update/delete/run. Keep current skipped-safe
  real E2E behavior unless the test owns a run-scoped job fixture.
- Diagnostic Gateway batch/RPC actions: user-triggered only, no automatic
  retry, no background execution.

Every mutation wrapper invalidates the smallest module key set that keeps
current UI correct. If a response contains the full authoritative object, the
wrapper may set that exact query data only when a test proves it.

### 5. Panel Migration Order

Implement in vertical slices to limit blast radius:

1. Historical/read-heavy modules: `activity`, `gateway`, `usage`, `logs`,
   `threads`.
2. Queue/live modules: `approvals`, `sessions`.
3. Deck-local write modules: `alerts`, `budget`, `webhooks`.
4. Scheduler workbench: `cron`.

Each slice adds module tests before or with panel migration, then runs focused
panel tests before broad verification.

## Risks / Trade-offs

- **Large scope across 11 panels** -> Keep edits vertical by module and use
  focused tests after each migration.
- **Sessions overlaps with chat surroundings** -> Limit this change to the
  Sessions panel and its child details. Do not move ChatPanel dispatcher,
  chat input, or sidebar session sync until the chat-surroundings proposal.
- **Logs stream may be over-migrated** -> Keep the stream renderer specialized;
  only migrate `GET /logs` query/invalidation and tests.
- **Real E2E writes can affect operator data** -> Only use existing
  run-scoped/disposable fixtures or skipped-safe assertions. If a real write
  cannot be isolated after two fresh attempts, record the module handoff and
  keep deterministic checks green.
- **Full frontend suite has known unrelated chat/api failures** -> Continue to
  run it and record exact unrelated failures. Scoped module tests, build,
  contract gate, L4, and L5 evidence remain mandatory.

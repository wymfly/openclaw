# Frontend Data State Clarity Audit

Change: `deck-go-frontend-data-state-clarity`
Date: 2026-05-08

## Scope Correction

This audit was promoted from `openspec/follow-ups/2026-05-08-frontend-filter-empty-state-audit.md`.
The original incident was Plugins showing an apparently empty page even though the real BFF returned
rows. This change keeps the implementation scope to frontend list-state clarity. No Gateway, BFF, or
Deck-facing contract source was changed.

All data-backed panels under `deck-go/frontend-new/src/components/panels/` were scanned for local
search/filter/list state. Code changes were limited to the high-risk panel set in the proposal:
Plugins, Skills, Models, Channels, Subagents, Approvals, Budget, Alerts, Cron, and Webhooks.

## State Convention

| State            | Meaning                                                                       | Required UI behavior                                                           |
| ---------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `first-load`     | No cached/source rows exist and the authoritative read is pending.            | Show a stable loading state.                                                   |
| `refreshing`     | Source rows exist and a refetch is pending.                                   | Keep current rows visible and show non-blocking refresh evidence.              |
| `error-empty`    | No usable rows exist and the read failed.                                     | Show error copy and retry/reload affordance where the panel supports retry.    |
| `error-stale`    | Rows exist, but the latest refetch failed.                                    | Keep stale rows visible and surface non-blocking error evidence.               |
| `true-empty`     | Authoritative read succeeded and the source collection is empty.              | Explain the empty source/configuration domain.                                 |
| `filtered-empty` | Source collection has rows, but local search/filter/tab state hides all rows. | Show active criteria plus clear-filter recovery.                               |
| `ready`          | Visible rows exist.                                                           | Render normal list/workbench state with count/selection evidence.              |
| `degraded`       | Data is intentionally partial or unsupported by current contract.             | Explain the unsupported/degraded capability instead of silently omitting data. |

No shared helper was introduced. The changed panels reuse existing local panel structures and existing
design-system atoms/classes rather than adding a parallel list library.

## Filter Policy Matrix

| Panel     | Filter group             | Policy                 | Implementation evidence                                                                                                         |
| --------- | ------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Plugins   | origin                   | Counted stable options | `deck-go/frontend-new/src/components/panels/plugins/PluginsPanel.tsx` keeps origin filters and reports active origin criteria.  |
| Plugins   | capability kind          | Derived options        | `PluginsPanel.tsx` derives capability filters from current plugin payload and clears impossible values.                         |
| Skills    | status                   | Counted stable options | `deck-go/frontend-new/src/components/panels/skills/SkillsPanel.tsx` counts `all/ready/needs-setup/disabled`.                    |
| Skills    | source                   | Derived options        | `SkillsPanel.tsx` derives visible source filters from the current skill payload and resets stale source state.                  |
| Models    | model flags              | Counted stable options | `deck-go/frontend-new/src/components/panels/models/ModelsPanel.tsx` counts `all/default/fallback/reasoning/local`.              |
| Channels  | enabled/alerts           | Counted stable options | `deck-go/frontend-new/src/components/panels/channels/ChannelsPanel.tsx` keeps stable filters with counts.                       |
| Channels  | WeCom                    | Derived options        | `ChannelsPanel.tsx` only exposes WeCom when the current payload contains WeCom channel evidence.                                |
| Subagents | run status               | Counted stable options | `deck-go/frontend-new/src/components/panels/subagents/SubagentsPanel.tsx` counts status tabs from current run payload.          |
| Subagents | spawn mode               | Counted stable options | `SubagentsPanel.tsx` counts blocking/background runs and treats zero-result selection as filtered-empty.                        |
| Approvals | approval kind            | Counted stable options | `deck-go/frontend-new/src/components/panels/approvals/ApprovalsPanel.tsx` counts exec/plugin queues and explains kind mismatch. |
| Budget    | rule status              | Counted stable options | `deck-go/frontend-new/src/components/panels/budget/BudgetPanel.tsx` passes active criteria to `RuleList`.                       |
| Alerts    | action/enabled           | Counted stable options | `deck-go/frontend-new/src/components/panels/alerts/AlertsPanel.tsx` counts action and enabled filters.                          |
| Alerts    | entity filter            | Derived options        | `AlertsPanel.tsx` derives list filter entities from payload; `RuleForm` keeps stable create/edit entity options separate.       |
| Cron      | enabled                  | Counted stable options | `deck-go/frontend-new/src/components/panels/cron/CronPanel.tsx` counts enabled/disabled jobs and renders criteria.              |
| Webhooks  | enabled/disabled/failing | Counted stable options | `deck-go/frontend-new/src/components/panels/webhooks/WebhooksPanel.tsx` counts stable receiver filters.                         |

## High-Risk Panel Audit

| Panel     | Data source / query path                                                                                 | Local state risk                                                                                     | Required fix                                                                                            | Final status |
| --------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------ |
| Plugins   | `usePluginsListQuery`, `useChannelsListQuery` in `PluginsPanel.tsx`                                      | Static capability choices could hide real scoped plugin rows.                                        | Derived capability filters, active criteria, and clear recovery.                                        | `fixed`      |
| Skills    | `useSkillsListQuery`, `useSkillApprovalsQuery` in `SkillsPanel.tsx`                                      | Static source/status filters could outlive current skill payload.                                    | Count status filters, derive source filters, reset stale source, distinguish true-empty/filtered-empty. | `fixed`      |
| Models    | `useModelsConfigQuery`, `useModelsConfiguredQuery`, catalog/auth/usage queries in `ModelsPanel.tsx`      | Stable model flags can all be zero while models exist.                                               | Count stable filters, show criteria, clear recovery.                                                    | `fixed`      |
| Channels  | `channelsListQueryOptions`, throughput/routing lookups in `ChannelsPanel.tsx`                            | WeCom could be selectable without WeCom rows; search/filter hidden rows looked like empty inventory. | Derive WeCom availability, count stable filters, clear recovery.                                        | `fixed`      |
| Subagents | `useSubagentRunsQuery`, `useAgentsListQuery`, `useConfigSnapshotQuery` in `SubagentsPanel.tsx`           | Empty run history, empty permissions, and filtered rows shared similar empty copy.                   | Separate no runs/no agents from filtered-empty; keep criteria and clear recovery.                       | `fixed`      |
| Approvals | `usePendingApprovalsQuery`, `usePluginApprovalsQuery`, `useApprovalsPolicyQuery` in `ApprovalsPanel.tsx` | Exec/plugin queues could hide pending items in another source; selected detail could be stale.       | Kind/search-specific empty copy, criteria, clear recovery, visible selection alignment.                 | `fixed`      |
| Budget    | `budgetRulesQueryOptions`, `budgetEvaluationsQueryOptions` in `BudgetPanel.tsx`                          | True empty rules and filtered rules were not explicitly distinct.                                    | `RuleList` receives source count, criteria, and clear recovery.                                         | `fixed`      |
| Alerts    | `alertRulesQueryOptions` in `AlertsPanel.tsx`                                                            | Action/entity/enabled filters could hide existing rules without explaining why.                      | Count stable filters, derive list entity filter, keep form entity options separate, clear recovery.     | `fixed`      |
| Cron      | `cronJobsQueryOptions`, `cronStatusQueryOptions`, `cronRunsQueryOptions` in `CronPanel.tsx`              | Existing jobs hidden by search/enabled filters used generic empty state.                             | Criteria and clear recovery for filtered-empty jobs.                                                    | `fixed`      |
| Webhooks  | `webhooksListQueryOptions`, `webhookDeliveriesQueryOptions` in `WebhooksPanel.tsx`                       | Receivers hidden by search/status filters looked like no receivers.                                  | Count filters, criteria, clear recovery.                                                                | `fixed`      |

## Wider Data-Backed Panel Baseline

| Panel path                              | Data source evidence                                           | Classification       | Reason                                                                                                                         |
| --------------------------------------- | -------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `agents/AgentsPanel.tsx`                | Agent Data Fabric list/detail queries and local search/filter. | `already-ok`         | Search empty uses explicit no-search copy and clear-search recovery; no code change required.                                  |
| `docs/DocsPanel.tsx`                    | Docs list/detail queries and local search/category filters.    | `already-ok`         | Search result overlay and category/content empty states are already distinct; clear search is available in the search control. |
| `settings/SettingsPanel.tsx`            | Settings, endpoint, version, device queries.                   | `already-ok`         | Settings section search shows `No sections match.` without hiding server data, and this panel is not a row inventory.          |
| `identity/IdentityPanel.tsx`            | Identity links query and local canonical/peer filters.         | `deferred-uncertain` | Has empty and loading states, but a deeper identity-specific state audit was outside this change.                              |
| `activity/ActivityPanel.tsx`            | Activity feed query and local family/severity/search filters.  | `deferred-uncertain` | It distinguishes loading/error/empty, but filtered-empty recovery was not changed in this high-risk pass.                      |
| `logs/LogsPanel.tsx`                    | Log tail query plus live stream.                               | `deferred-uncertain` | Log streaming has different stale/reconnect semantics; needs a stream-specific pass if symptoms appear.                        |
| `sessions/SessionsPanel.tsx`            | Sessions list/detail/lineage queries plus transcript search.   | `deferred-uncertain` | Session inventory search is server-parameterized and should be audited with real workspace data separately.                    |
| `threads/ThreadsPanel.tsx`              | Threads query and local filters.                               | `deferred-uncertain` | Tests cover empty/error states, but this change did not audit filtered recovery deeply.                                        |
| `usage/UsagePanel.tsx`                  | Usage summary/session/provider queries.                        | `deferred-uncertain` | Usage is chart/table-oriented and needs usage-specific empty-vs-filtered treatment.                                            |
| `config/ConfigPanel.tsx`                | Config snapshot/schema lookup queries.                         | `deferred-uncertain` | Config search empty states exist, but write/conflict semantics deserve a separate config pass.                                 |
| `gateway/GatewayPanel.tsx`              | Gateway diagnostics/describe/monitor queries.                  | `deferred-uncertain` | Has not-configured and diagnostic states; Gateway monitoring needs separate real-stack validation.                             |
| `memory/MemoryPanel.tsx`                | Memory queries.                                                | `deferred-uncertain` | Not part of the original high-risk incident and not edited.                                                                    |
| `nodes/NodesPanel.tsx`                  | Node/pairing/detail queries.                                   | `deferred-uncertain` | Has loading/error/empty states, but node capability filters were not in this pass.                                             |
| `routing/RoutingPanel.tsx`              | Routing bindings/activity/simulation queries.                  | `deferred-uncertain` | Routing has its own product workflow and was not touched by this list-state pass.                                              |
| `api-explorer/ApiExplorerPanel.tsx`     | API/describe query state.                                      | `empty-valid`        | Empty method/schema states are a valid contract-discovery result, not a row inventory bug.                                     |
| `chat/ChatPanel.tsx` and chat subpanels | Chat/SSE/session queries and streaming state.                  | `degraded`           | Chat streaming and command states were handled by earlier chat-specific work, not by this list-state change.                   |

## Verification Evidence

Fresh focused component test evidence:

```bash
cd deck-go/frontend-new && pnpm test:deck-ui \
  src/components/panels/plugins/PluginsPanel.test.tsx \
  src/components/panels/skills/SkillsPanel.test.tsx \
  src/components/panels/models/ModelsPanel.test.tsx \
  src/components/panels/channels/ChannelsPanel.test.tsx \
  src/components/panels/subagents/SubagentsPanel.test.tsx \
  src/components/panels/approvals/ApprovalsPanel.test.tsx \
  src/components/panels/budget/BudgetPanel.test.tsx \
  src/components/panels/alerts/AlertsPanel.test.tsx \
  src/components/panels/cron/CronPanel.test.tsx \
  src/components/panels/webhooks/WebhooksPanel.test.tsx
```

Result: 10 test files passed, 75 tests passed.

Real-stack evidence is recorded separately in `verification.yaml`. If the isolated real stack is not
available in the current session, the real scenario is allowed to circuit-break per the OpenSpec task,
but the deterministic frontend component and build evidence remains mandatory.

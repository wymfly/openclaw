# Deck-Go Cockpit Rollout Follow-Ups

## FU-001: API Explorer contract catalog and schema tree patterns

- **Status**: candidate
- **Source**: `deck-go-panel-cockpit-rollout-program`; Batch D incubator review on 2026-05-11.
- **Classification**: next-openspec
- **Fact baseline**: `deck-go/frontend-new/src/components/panels/api-explorer/ApiExplorerPanel.tsx` still owns `api-explorer-panel__tree`, `api-explorer-panel__catalog`, `api-explorer-panel__method-row`, `api-explorer-panel__event-row`, and recursive `api-explorer-panel__schema*` structures. The cockpit rollout matrix classifies API Explorer as `needs-new-pattern`.
- **Why not now**: The repeated visual gap is dominated by contract catalog and schema-tree behavior, not just panel chrome. Extending `PanelCockpit` inside a batch would blur data-shape, disclosure, tree-navigation, and method/event semantics.
- **Suggested next step**: Create a reuse-analysis OpenSpec proposal for `ContractCatalog` and `ContractSchemaTree`, using API Explorer as the reference and checking Gateway describe/batch surfaces before promotion.
- **Acceptance hints**: Focused component tests for method/event catalog selection and nested schema expansion; `cd deck-go && make frontend-build`; `cd deck-go && make e2e-mock-module MODULE=api-explorer`.
- **Links**: `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cockpit-rollout-readiness-matrix.md`; `deck-go/frontend-new/src/components/panels/api-explorer/ApiExplorerPanel.tsx`.

## FU-002: Gateway runtime evidence and status timeline patterns

- **Status**: candidate
- **Source**: `deck-go-panel-cockpit-rollout-program`; Batch D incubator review on 2026-05-11.
- **Classification**: next-openspec
- **Fact baseline**: `deck-go/frontend-new/src/components/panels/gateway/GatewayPanel.tsx` still owns runtime topbar/hero metrics plus `gateway-card__header`, describe explorer rows, batch console/result rows, activity rows, and runtime evidence rails. The cockpit rollout matrix classifies Gateway as `needs-new-pattern`.
- **Why not now**: Gateway combines runtime status, describe/batch contract evidence, monitor/activity timelines, and operational diagnostics. These need a separate API boundary from cockpit shell primitives.
- **Suggested next step**: Create a reuse-analysis proposal for `RuntimeEvidenceCard` and `StatusTimeline`, comparing Gateway with Logs, Activity, and API Explorer before deciding shared APIs.
- **Acceptance hints**: Gateway describe/batch/activity component coverage, mock visual E2E, and real Gateway smoke only if the proposal touches runtime contract behavior.
- **Links**: `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cockpit-rollout-readiness-matrix.md`; `deck-go/frontend-new/src/components/panels/gateway/GatewayPanel.tsx`.

## FU-003: Memory file tree, search result, and detail sidecar patterns

- **Status**: candidate
- **Source**: `deck-go-panel-cockpit-rollout-program`; Batch D incubator review on 2026-05-11.
- **Classification**: next-openspec
- **Fact baseline**: `deck-go/frontend-new/src/components/panels/memory/MemoryPanel.tsx` owns `memory-topbar`, `memory-browser__tree`, `memory-tree__row`, search result rows, health pills, dream action controls, and viewer/detail disclosure. The cockpit rollout matrix classifies Memory as `needs-new-pattern`.
- **Why not now**: Memory is a content/file-browser and search workspace. Its major drift requires tree, search-result, and detail-sidecar decisions rather than only cockpit shell migration.
- **Suggested next step**: Create a proposal for `TreeView`, `SearchResultRow`, and `DetailSidecar` after comparing Memory with Docs and any future file-like module.
- **Acceptance hints**: Browse/search/health/dreams component coverage, mock visual E2E, and explicit destructive-action checks for dream reset flows.
- **Links**: `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cockpit-rollout-readiness-matrix.md`; `deck-go/frontend-new/src/components/panels/memory/MemoryPanel.tsx`.

## FU-004: Models inventory table, provider tree, and quota trend patterns

- **Status**: candidate
- **Source**: `deck-go-panel-cockpit-rollout-program`; Batch D incubator review on 2026-05-11.
- **Classification**: next-openspec
- **Fact baseline**: Models is split across `ModelsPanel.tsx`, `parts/CatalogHeader.tsx`, `parts/ModelRow.tsx`, `parts/ProviderListSection.tsx`, and `parts/UsagePolicyOverview.tsx`; it owns provider rails/tree-like selection, model rows, usage policy rows, secret drawers, provider wizard, and quota/cost evidence. The cockpit rollout matrix classifies Models as `needs-new-pattern`.
- **Why not now**: Models needs data-table, provider-tree, secret/auth evidence, and quota trend analysis before shared extraction. Moving only header/KPI chrome would leave the dominant product surface inconsistent.
- **Suggested next step**: Create a proposal for `DataTable`, `TreeView`, and `QuotaTrend` with Models as one reference and Budget/Usage as comparison modules.
- **Acceptance hints**: Model/provider selection tests, secret drawer safety tests, mock visual E2E, and real Gateway evidence only if auth/contract behavior changes.
- **Links**: `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cockpit-rollout-readiness-matrix.md`; `deck-go/frontend-new/src/components/panels/models/`.

## FU-005: Routing selectable queue, detail hero, and simulator timeline patterns

- **Status**: candidate
- **Source**: `deck-go-panel-cockpit-rollout-program`; Batch D incubator review on 2026-05-11.
- **Classification**: next-openspec
- **Fact baseline**: `deck-go/frontend-new/src/components/panels/routing/RoutingPanel.tsx` still owns `routing-panel__header`, `routing-panel__metrics`, `routing-binding-row`, `routing-detail`, simulator result/tier rows, validation rows, and routing activity rows. The cockpit rollout matrix classifies Routing as `needs-new-pattern`.
- **Why not now**: Routing combines selectable binding queues, selected binding detail, guarded mutation, simulation timeline, and validation output. These need a shared pattern proposal separate from `PanelCockpit`.
- **Suggested next step**: Create a proposal for `SelectableQueueRow`, `DetailHero`, and `StatusTimeline`, comparing Routing with Identity, Nodes, and Activity.
- **Acceptance hints**: Binding selection/mutation/simulation tests; `cd deck-go && make frontend-build`; `cd deck-go && make e2e-mock-module MODULE=routing`.
- **Links**: `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cockpit-rollout-readiness-matrix.md`; `deck-go/frontend-new/src/components/panels/routing/RoutingPanel.tsx`.

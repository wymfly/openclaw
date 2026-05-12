# Cockpit Rollout Readiness Matrix

**Maintainer:** deck-go-panel-cockpit-rollout-program
**Audit date:** 2026-05-11
**Head change:** `openspec/changes/deck-go-panel-cockpit-rollout-program/`
**Reference consumers:** Sessions, Usage, Logs
**Cockpit pattern authority:** `deck-go/frontend-new/src/design-system/patterns/PanelCockpit.tsx`

This matrix is the program gate for extending the cockpit panel visual system
outside Sessions, Usage, and Logs. The head change is documentation and
governance only. It does not migrate runtime panel JSX/CSS, change tokens, add
atoms, change backend/BFF/Gateway contracts, or modify dependencies.

## Evidence

The classifications below were produced from these source-truth checks:

- Panel inventory: `find deck-go/frontend-new/src/components/panels -maxdepth 2 -name '*Panel.tsx' | sort`
- Anatomy scan: `rg -n "className=.*(topbar|header|kpi|metric|hero|pill|status|toolbar|detail)" deck-go/frontend-new/src/components/panels -g '*.tsx'`
- Local alias scan: `rg -l -g '*.css' -- "--font-mono|--text-primary|--text-muted|--text-faint|--danger|--warn" deck-go/frontend-new/src/components/panels`
- Mock visual coverage inventory: `find deck-go/test/e2e -maxdepth 1 -name '*visual.spec.ts' | sort`
- Historical design-system readiness: `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`

## Classification Legend

| Classification      | Meaning                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `direct-fit`        | Root/header/status/KPI structures can consume the existing cockpit patterns with minimal local compatibility CSS.                                    |
| `partial-fit`       | Some cockpit structures can migrate, but module-specific hero, detail, editor, row, chart, timeline, or dangerous-write molecules stay local.        |
| `needs-new-pattern` | Repeated anatomy exists, but current cockpit APIs are insufficient for a meaningful migration. A separate reuse-analysis proposal should come first. |
| `stay-local`        | The panel has no meaningful cockpit rollout target, or it is governed by a more specific surface contract.                                           |

## Classification Summary

| Classification      | Panels                                                                                             | Count |
| ------------------- | -------------------------------------------------------------------------------------------------- | ----- |
| `direct-fit`        | Alerts, Budget, Logs, Sessions, Threads, Usage                                                     | 6     |
| `partial-fit`       | Activity, Agents, Approvals, Channels, Cron, Identity, Nodes, Plugins, Skills, Subagents, Webhooks | 11    |
| `needs-new-pattern` | API Explorer, Gateway, Memory, Models, Routing                                                     | 5     |
| `stay-local`        | Chat, Config, Docs, Settings                                                                       | 4     |

## Panel Matrix

| Panel        | Classification      | Evidence                                                                                                                                                                                                                                                                                  | Matching cockpit anatomy                                                                                                                                                             | Local-only molecules                                                                                                          | Batch                              | Narrow verification                                                                                                           | Blockers or notes                                                                                                                                                                             |
| ------------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activity     | `partial-fit`       | `deck-go/frontend-new/src/components/panels/activity/ActivityPanel.tsx`, `deck-go/frontend-new/src/components/panels/activity/activity-panel.css`, `deck-go/test/e2e/activity-visual.spec.ts`                                                                                             | Page header, KPI strip, toolbar, grouped feed headers                                                                                                                                | Grouped timeline rows, monitor run rows, top-agent shortcuts, selected event/run diagnostics, raw payload disclosure          | Batch E, observability follow-up   | `cd deck-go && make frontend-build`; `cd deck-go && make e2e-mock-module MODULE=activity`                                     | Defer deeper convergence until `StatusTimeline` or `ObserveTimeline` reuse analysis.                                                                                                          |
| Agents       | `partial-fit`       | `deck-go/frontend-new/src/components/panels/agents/AgentsPanel.tsx`, `deck-go/test/e2e/agents-visual.spec.ts`                                                                                                                                                                             | Toolbar, selected detail hero, section headers, status dots                                                                                                                          | Agent avatar, model policy rows, preview/file/permission rows, create/edit dialogs                                            | Batch E, runtime-control follow-up | `cd deck-go && make frontend-build`; `cd deck-go && make e2e-mock-module MODULE=agents`                                       | Avoid folding model-policy or permission semantics into cockpit primitives.                                                                                                                   |
| Alerts       | `direct-fit`        | `deck-go/frontend-new/src/components/panels/alerts/AlertsPanel.tsx`, `deck-go/frontend-new/src/components/panels/alerts/alerts-panel.css`, `deck-go/test/e2e/alerts-visual.spec.ts`                                                                                                       | Migrated by `deck-go-cockpit-rollout-batch-a-control-policy`: `PanelRoot`, `PanelSectionHeader`, `KpiStrip`, `PanelMetric`, `PanelSurface`, `PanelStatusRow`, `PanelPill`            | Rule inventory rows, trigger/action form, fired-history fallback, condition cards, audit/test seams, destructive confirmation | Batch A, migrated                  | `cd deck-go && make frontend-build` passed; `cd deck-go && make e2e-mock-module MODULE=alerts` passed                         | No global token value, atom API, `PanelCockpit` API, backend, contract, generated artifact, or dependency change.                                                                             |
| API Explorer | `needs-new-pattern` | `deck-go/frontend-new/src/components/panels/api-explorer/ApiExplorerPanel.tsx`, `deck-go/frontend-new/src/components/panels/api-explorer/api-explorer-panel.css`, `deck-go/test/e2e/api-explorer-visual.spec.ts`                                                                          | Topbar, metrics, method hero, status pills                                                                                                                                           | Method/event catalog rows, schema tree rows, tabbed inventory, untyped/raw payload disclosure                                 | Pattern incubator, tracked         | `cd deck-go && make frontend-build`; `cd deck-go && make e2e-mock-module MODULE=api-explorer`                                 | Needs `ContractCatalog` or `ContractSchemaTree` analysis before a meaningful cockpit migration. Tracked in `openspec/follow-ups/2026-05-11-deck-go-cockpit-rollout-follow-ups.md`.            |
| Approvals    | `partial-fit`       | `deck-go/frontend-new/src/components/panels/approvals/ApprovalsPanel.tsx`, `deck-go/frontend-new/src/components/panels/approvals/approvals-panel.css`, `deck-go/test/e2e/approvals-visual.spec.ts`                                                                                        | Migrated by `deck-go-cockpit-rollout-batch-c-automation-guarded-writes`: `PanelRoot`, `PanelSectionHeader`, `KpiStrip`, `PanelMetric`, `PanelSurface`, `PanelStatusRow`, `PanelPill` | Decision controls, policy defaults, allowlist rows, plugin approval rows, stream evidence, raw policy/action disclosure       | Batch C, migrated                  | `cd deck-go && make frontend-build` passed; `cd deck-go && make e2e-mock-module MODULE=approvals` passed                      | No global token value, atom API, `PanelCockpit` API, backend, contract, generated artifact, or dependency change. Guarded mutation and security semantics stay local.                         |
| Budget       | `direct-fit`        | `deck-go/frontend-new/src/components/panels/budget/BudgetPanel.tsx`, `deck-go/frontend-new/src/components/panels/budget/BudgetStatus.tsx`, `deck-go/frontend-new/src/components/panels/budget/budget-panel.css`, `deck-go/test/e2e/budget-visual.spec.ts`                                 | Migrated by `deck-go-cockpit-rollout-batch-a-control-policy`: `PanelRoot`, `PanelSectionHeader`, `KpiStrip`, `PanelMetric`, `PanelSurface`, `PanelStatusRow`, `PanelPill`            | Rule rows, threshold progress, scoped rule forms, evaluation cards, local change rows, destructive confirmation               | Batch A, migrated                  | `cd deck-go && make frontend-build` passed; `cd deck-go && make e2e-mock-module MODULE=budget` passed                         | No global token value, atom API, `PanelCockpit` API, backend, contract, generated artifact, or dependency change.                                                                             |
| Channels     | `partial-fit`       | `deck-go/frontend-new/src/components/panels/channels/ChannelsPanel.tsx`, `deck-go/frontend-new/src/components/panels/channels/views/ChannelsListView.tsx`, `deck-go/frontend-new/src/components/panels/channels/views/ChannelsDetailView.tsx`, `deck-go/test/e2e/channels-visual.spec.ts` | Migrated by `deck-go-cockpit-rollout-batch-b-relationship-runtime`: `PanelRoot`, `PanelSectionHeader`, `KpiStrip`, `PanelMetric`, `PanelSurface`, `PanelStatusRow`, `PanelPill`      | Channel inventory rows, diagnostics, probe result badges, WeCom access controls, routing handoff, throughput chart            | Batch B, migrated                  | `cd deck-go && make frontend-build` passed; `cd deck-go && make e2e-mock-module MODULE=channels` passed                       | No global token value, atom API, `PanelCockpit` API, backend, contract, generated artifact, or dependency change. Provider/access-control molecules remain local.                             |
| Chat         | `stay-local`        | `deck-go/frontend-new/src/components/panels/chat/ChatPanel.tsx`, `deck-go/frontend-new/src/components/panels/chat/CanvasPanel.tsx`, `deck-go/frontend-new/src/components/panels/chat/RightPanel.tsx`, `deck-go/test/e2e/chat-visual.spec.ts`                                              | Separate chat shell and canvas surfaces, not cockpit workbench chrome                                                                                                                | Transcript, message blocks, composer, canvas, right drawer, approvals and tool-pair rendering                                 | Special                            | Chat-specific visual and interaction suites                                                                                   | Audit only. Do not force automatic cockpit rollout.                                                                                                                                           |
| Config       | `stay-local`        | `deck-go/frontend-new/src/components/panels/config/ConfigPanel.tsx`, `deck-go/frontend-new/src/components/panels/config/config-panel.css`, `deck-go/test/e2e/config-visual.spec.ts`                                                                                                       | Header/status pieces exist, but raw config editor and diff workflow dominate                                                                                                         | Raw JSON editor, schema lookup, structured field cards, sensitive reveal, diff preview, base-hash conflict recovery           | Special/deferred                   | `cd deck-go && make frontend-build`; `cd deck-go && make e2e-mock-module MODULE=config`; add contract checks if writes change | Govern by config write-safety proposals, not cockpit rollout.                                                                                                                                 |
| Cron         | `partial-fit`       | `deck-go/frontend-new/src/components/panels/cron/CronPanel.tsx`, `deck-go/frontend-new/src/components/panels/cron/cron-panel.css`, `deck-go/test/e2e/cron-visual.spec.ts`                                                                                                                 | Migrated by `deck-go-cockpit-rollout-batch-c-automation-guarded-writes`: `PanelRoot`, `PanelSectionHeader`, `KpiStrip`, `PanelMetric`, `PanelSurface`, `PanelStatusRow`, `PanelPill` | Job rows, schedule forms, heartbeat details, run-history rows, manual-run evidence                                            | Batch C, migrated                  | `cd deck-go && make frontend-build` passed; `cd deck-go && make e2e-mock-module MODULE=cron` passed                           | No global token value, atom API, `PanelCockpit` API, backend, contract, generated artifact, or dependency change. Guarded scheduler writes stay local.                                        |
| Docs         | `stay-local`        | `deck-go/frontend-new/src/components/panels/docs/DocsPanel.tsx`, `deck-go/test/e2e/docs-visual.spec.ts`                                                                                                                                                                                   | Some document workbench chrome exists, but content reader dominates                                                                                                                  | Markdown reader, document inventory, source evidence, extraction/delete seams, raw payload disclosure                         | Special/deferred                   | `cd deck-go && make frontend-build`; `cd deck-go && make e2e-mock-module MODULE=docs`                                         | Keep with Knowledge/Content proposals unless visual drift becomes severe.                                                                                                                     |
| Gateway      | `needs-new-pattern` | `deck-go/frontend-new/src/components/panels/gateway/GatewayPanel.tsx`, `deck-go/frontend-new/src/components/panels/gateway/gateway-panel.css`, `deck-go/test/e2e/gateway-visual.spec.ts`                                                                                                  | Runtime topbar, hero, metrics, card headers, status pills                                                                                                                            | Runtime diagnostics, activity feed, monitor history, timeline events, evidence sidecars                                       | Pattern incubator, tracked         | `cd deck-go && make frontend-build`; `cd deck-go && make e2e-mock-module MODULE=gateway`                                      | Needs `RuntimeEvidenceCard` or `StatusTimeline` reuse analysis before deeper convergence. Tracked in `openspec/follow-ups/2026-05-11-deck-go-cockpit-rollout-follow-ups.md`.                  |
| Identity     | `partial-fit`       | `deck-go/frontend-new/src/components/panels/identity/IdentityPanel.tsx`, `deck-go/frontend-new/src/components/panels/identity/identity-panel.css`, `deck-go/test/e2e/identity-visual.spec.ts`                                                                                             | Migrated by `deck-go-cockpit-rollout-batch-b-relationship-runtime`: `PanelRoot`, `PanelSectionHeader`, `KpiStrip`, `PanelMetric`, `PanelSurface`, `PanelStatusRow`, `PanelPill`      | Channel pills, hash chips, peer mapping rows, link/unlink dialogs, base-hash guard, raw payload disclosure                    | Batch B, migrated                  | `cd deck-go && make frontend-build` passed; `cd deck-go && make e2e-mock-module MODULE=identity` passed                       | No global token value, atom API, `PanelCockpit` API, backend, contract, generated artifact, or dependency change. Relationship and mutation guard semantics remain local.                     |
| Logs         | `direct-fit`        | `deck-go/frontend-new/src/components/panels/logs/LogsPanel.tsx`, `deck-go/frontend-new/src/components/panels/logs/logs-panel.css`, `deck-go/test/e2e/logs-visual.spec.ts`                                                                                                                 | Already consumes `PanelRoot`, `PanelSectionHeader`, `PanelStatusRow`, `KpiStrip`, `PanelMetric`                                                                                      | Filter bar, log rows, live tape, selected-line details, stack/raw payload rendering, export preview                           | Migrated reference                 | Existing logs verification plus future regression when cockpit API changes                                                    | Third validation consumer. No child batch needed.                                                                                                                                             |
| Memory       | `needs-new-pattern` | `deck-go/frontend-new/src/components/panels/memory/MemoryPanel.tsx`, `deck-go/test/e2e/memory-visual.spec.ts`                                                                                                                                                                             | Topbar, KPI badges, health/status pills                                                                                                                                              | File browser, graph rows, recall search results, health diagnostics, dream actions, detail sidecar                            | Pattern incubator, tracked         | `cd deck-go && make frontend-build`; `cd deck-go && make e2e-mock-module MODULE=memory`                                       | Needs FileTree/SearchResult/DetailSidecar analysis before cockpit migration. Tracked in `openspec/follow-ups/2026-05-11-deck-go-cockpit-rollout-follow-ups.md`.                               |
| Models       | `needs-new-pattern` | `deck-go/frontend-new/src/components/panels/models/ModelsPanel.tsx`, `deck-go/frontend-new/src/components/panels/models/parts/CatalogHeader.tsx`, `deck-go/frontend-new/src/components/panels/models/models-panel.css`, `deck-go/test/e2e/models-visual.spec.ts`                          | Catalog header and status cards can partially align                                                                                                                                  | Provider rail/tree, model inventory table, auth evidence rows, fallback chains, allowlist rows, quota/cost bars               | Pattern incubator, tracked         | `cd deck-go && make frontend-build`; `cd deck-go && make e2e-mock-module MODULE=models`                                       | Needs DataTable/TreeView/Sparkline or quota pattern analysis before meaningful convergence. Tracked in `openspec/follow-ups/2026-05-11-deck-go-cockpit-rollout-follow-ups.md`.                |
| Nodes        | `partial-fit`       | `deck-go/frontend-new/src/components/panels/nodes/NodesPanel.tsx`, `deck-go/frontend-new/src/components/panels/nodes/nodes-panel.css`, `deck-go/test/e2e/nodes-visual.spec.ts`                                                                                                            | Migrated by `deck-go-cockpit-rollout-batch-d-integration-inventory`: `PanelRoot`, `PanelSectionHeader`, `KpiStrip`, `PanelMetric`, `PanelSurface`, `PanelStatusRow`, `PanelPill`     | Lifecycle strips, pairing rows, dynamic command forms, pending-work queue, permission/capability chips                        | Batch D, migrated                  | `cd deck-go && make frontend-build` passed; `cd deck-go && make e2e-mock-module MODULE=nodes` passed                          | No global token value, atom API, `PanelCockpit` API, backend, contract, generated artifact, or dependency change. Remote-control safety and pairing semantics stay local.                     |
| Plugins      | `partial-fit`       | `deck-go/frontend-new/src/components/panels/plugins/PluginsPanel.tsx`, `deck-go/frontend-new/src/components/panels/plugins/plugins-panel.css`, `deck-go/test/e2e/plugins-visual.spec.ts`                                                                                                  | Migrated by `deck-go-cockpit-rollout-batch-d-integration-inventory`: `PanelRoot`, `PanelSectionHeader`, `KpiStrip`, `PanelMetric`, `PanelSurface`, `PanelStatusRow`, `PanelPill`     | Plugin inventory rows, capability/action evidence, diagnostics, related-channel handoff, lifecycle notices                    | Batch D, migrated                  | `cd deck-go && make frontend-build` passed; `cd deck-go && make e2e-mock-module MODULE=plugins` passed                        | No global token value, atom API, `PanelCockpit` API, backend, contract, generated artifact, or dependency change. Real plugin lifecycle control remains out of scope.                         |
| Routing      | `needs-new-pattern` | `deck-go/frontend-new/src/components/panels/routing/RoutingPanel.tsx`, `deck-go/test/e2e/routing-visual.spec.ts`                                                                                                                                                                          | Header, metrics, card headers, detail region                                                                                                                                         | Binding queue rows, selected binding hero, match chips, simulator timeline, mutation result strip                             | Pattern incubator, tracked         | `cd deck-go && make frontend-build`; `cd deck-go && make e2e-mock-module MODULE=routing`                                      | Needs `SelectableQueueRow`, `DetailHero`, or `StatusTimeline` analysis before cockpit extraction. Tracked in `openspec/follow-ups/2026-05-11-deck-go-cockpit-rollout-follow-ups.md`.          |
| Sessions     | `direct-fit`        | `deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.tsx`, `deck-go/frontend-new/src/components/panels/sessions/sessions-panel.css`, `deck-go/test/e2e/sessions-visual.spec.ts`                                                                                             | Already consumes cockpit root/header/status/KPI/metric structures                                                                                                                    | Inventory rows, transcript rows, inspector tabs, compaction controls, lineage content, mutation confirmations                 | Migrated reference                 | Existing sessions verification plus future regression when cockpit API changes                                                | First reference consumer.                                                                                                                                                                     |
| Settings     | `stay-local`        | `deck-go/frontend-new/src/components/panels/settings/SettingsPanel.tsx`, `deck-go/test/e2e/settings-visual.spec.ts`                                                                                                                                                                       | Topbar/status/metric structures exist, but settings/security surface dominates                                                                                                       | Secure fields, endpoint status, token dialogs, pending/paired device rows, confirmation content                               | Special/deferred                   | `cd deck-go && make frontend-build`; `cd deck-go && make e2e-mock-module MODULE=settings`                                     | Govern by security/config proposals. Do not migrate token surfaces through cockpit alone.                                                                                                     |
| Skills       | `partial-fit`       | `deck-go/frontend-new/src/components/panels/skills/SkillsPanel.tsx`, `deck-go/test/e2e/skills-visual.spec.ts`                                                                                                                                                                             | Migrated by `deck-go-cockpit-rollout-batch-d-integration-inventory`: `PanelRoot`, `PanelSectionHeader`, `KpiStrip`, `PanelMetric`, `PanelSurface`, `PanelStatusRow`, `PanelPill`     | Skill inventory rows, requirement evidence, config editors, install option rows, ClawHub catalog, agent matrix                | Batch D, migrated                  | `cd deck-go && make frontend-build` passed; `cd deck-go && make e2e-mock-module MODULE=skills` passed                         | No global token value, atom API, `PanelCockpit` API, backend, contract, generated artifact, or dependency change. Marketplace/trust/install semantics stay local.                             |
| Subagents    | `partial-fit`       | `deck-go/frontend-new/src/components/panels/subagents/SubagentsPanel.tsx`, `deck-go/test/e2e/subagents-visual.spec.ts`                                                                                                                                                                    | Migrated by `deck-go-cockpit-rollout-batch-b-relationship-runtime`: `PanelRoot`, `PanelSectionHeader`, `KpiStrip`, `PanelMetric`, `PanelSurface`, `PanelStatusRow`, `PanelPill`      | Run queue rows, lineage tree/timeline, defaults grid, permissions, action results                                             | Batch B, migrated                  | `cd deck-go && make frontend-build` passed; `cd deck-go && make e2e-mock-module MODULE=subagents` passed                      | No global token value, atom API, `PanelCockpit` API, backend, contract, generated artifact, or dependency change. Lineage/timeline patterns need separate evidence before promotion.          |
| Threads      | `direct-fit`        | `deck-go/frontend-new/src/components/panels/threads/ThreadsPanel.tsx`, `deck-go/frontend-new/src/components/panels/threads/threads-panel.css`, `deck-go/test/e2e/threads-visual.spec.ts`                                                                                                  | Header actions, metrics, status pills, selected thread hero                                                                                                                          | Thread rows, relationship map, handoff action strip, raw payload disclosure                                                   | Batch A                            | `cd deck-go && make frontend-build`; `cd deck-go && make e2e-mock-module MODULE=threads`                                      | Include after Budget/Alerts if Batch A review budget allows relationship detail to stay local.                                                                                                |
| Usage        | `direct-fit`        | `deck-go/frontend-new/src/components/panels/usage/UsagePanel.tsx`, `deck-go/frontend-new/src/components/panels/usage/usage-panel.css`, `deck-go/test/e2e/usage-visual.spec.ts`                                                                                                            | Already consumes cockpit root/header/status/KPI/metric structures                                                                                                                    | Range controls, trend charts, provider quota rows, session detail tabs, aggregate/context pressure rows                       | Migrated reference                 | Existing usage verification plus future regression when cockpit API changes                                                   | Second reference consumer.                                                                                                                                                                    |
| Webhooks     | `partial-fit`       | `deck-go/frontend-new/src/components/panels/webhooks/WebhooksPanel.tsx`, `deck-go/test/e2e/webhooks-visual.spec.ts`                                                                                                                                                                       | Migrated by `deck-go-cockpit-rollout-batch-c-automation-guarded-writes`: `PanelRoot`, `PanelSectionHeader`, `KpiStrip`, `PanelMetric`, `PanelSurface`, `PanelStatusRow`, `PanelPill` | Receiver rows, event subscription controls, receiver form, delivery evidence rows, test result seam, raw payload disclosure   | Batch C, migrated                  | `cd deck-go && make frontend-build` passed; `cd deck-go && make e2e-mock-module MODULE=webhooks` passed                       | No global token value, atom API, `PanelCockpit` API, backend, contract, generated artifact, or dependency change. External delivery/signature assurance stays outside cockpit-only migration. |

## Batch Map

### Batch A: Control Policy Direct Fit

**Panels:** Budget, Alerts, Threads.

**Status:** Budget and Alerts migrated in
`deck-go-cockpit-rollout-batch-a-control-policy`. Threads remains deferred until
the Budget/Alerts direct-fit rollout is reviewed.

**Why this batch:** These panels have the closest match to the validated
cockpit set: header/actions, metric strips, status/pill rows, and selected
detail heroes.

**Migrate:** Shared root, section headers, status rows, pill styling, KPI strip,
metric cards, and simple panel surfaces.

**Keep local:** Budget threshold/evaluation surfaces, alert trigger/action
forms, fired-history fallback, thread relationship map, handoff actions, and
raw payload rendering.

**Verification:** `cd deck-go && make frontend-build`; then one
`cd deck-go && make e2e-mock-module MODULE=<module>` run per touched module.
Add focused component/unit tests only for behavior changed by the batch.

**Recommendation:** Threads should be the next direct-fit candidate only if its
relationship-map and handoff surfaces stay module-local.

### Batch B: Relationship And Runtime Inventory

**Panels:** Identity, Subagents, Channels.

**Why this batch:** These panels repeat topbar/KPI/detail hero structures, but
also contain domain-specific identity, lineage, and provider-access molecules.

**Migrate:** Root/header, KPI/metric strip, status/pill rows, selected-detail
surface shell, and simple action rows.

**Keep local:** Identity hash/channel chips and link dialogs, Subagents lineage
and permission grids, Channels diagnostics, probe results, WeCom controls, and
routing handoff strips.

**Verification:** `cd deck-go && make frontend-build`; then `make
e2e-mock-module` for `identity`, `subagents`, and `channels`. Add real Gateway
or contract checks only if the child change modifies contract/data behavior.

### Batch C: Automation And Guarded Writes

**Panels:** Webhooks, Cron, Approvals.

**Why this batch:** These panels repeat topbar/KPI/status/detail anatomy, but
the core risk is guarded write flows.

**Migrate:** Shared workbench chrome, KPI/metric strips, status rows, pill rows,
and selected entity shell.

**Keep local:** Receiver delivery/test seams, scheduler forms, run history,
approval decisions, policy controls, stream evidence, destructive or guarded
confirmation flows, and raw action payloads.

**Verification:** `cd deck-go && make frontend-build`; then `make
e2e-mock-module` for `webhooks`, `cron`, and `approvals`. Real E2E is out of
scope unless the child batch changes mutation payloads or security semantics.

### Batch D: Integration Inventory Partial Fit

**Panels:** Skills, Plugins, Nodes.

**Why this batch:** These panels can use cockpit chrome while keeping their
inventory rows, evidence seams, and action safety semantics local.

**Migrate:** Page header, KPI/metric strip, status/pill rows, panel surfaces,
and selected entity shell where it matches the current cockpit contract.

**Keep local:** Skills ClawHub/install/config surfaces, Plugins capability and
lifecycle evidence, Nodes pairing/remote command/pending work surfaces.

**Verification:** `cd deck-go && make frontend-build`; then `make
e2e-mock-module` for `skills`, `plugins`, and `nodes`.

### Pattern Incubator Before Migration

**Panels:** API Explorer, Gateway, Memory, Models, Routing.

**Why this group:** These panels expose repeated structures that are broader
than the current cockpit primitives. Migrating only the root/header/KPI chrome
would leave the larger visual divergence unsolved.

**Candidate proposals:** `ContractCatalog`, `ContractSchemaTree`,
`RuntimeEvidenceCard`, `StatusTimeline`, `ObserveTimeline`, `DataTable`,
`TreeView`, `SearchResultRow`, `DetailSidecar`, `SelectableQueueRow`, and
`QuotaTrend`.

**Rule:** Do not extend `PanelCockpit` inside an implementation batch to cover
these shapes. Keep them local or open a separate reuse-analysis proposal.

### Special Or Deferred

**Panels:** Chat, Config, Docs, Settings.

**Reason:** Chat is its own conversation/canvas surface. Config and Settings are
configuration/security surfaces. Docs is a content/knowledge surface. Each can
reuse specific design-system atoms and tokens, but none should be automatically
forced through cockpit rollout.

## Child Change Protocol

Every child cockpit rollout change must include:

1. A panel set of 2-5 panels, unless it is explicitly a one-panel pattern
   incubator or special-surface follow-up.
2. A copied subset of this matrix with updated implementation status.
3. A list of current cockpit APIs consumed: `PanelRoot`, `PanelSurface`,
   `PanelSectionHeader`, `PanelStatusRow`, `PanelPill`, `KpiStrip`, and
   `PanelMetric`.
4. A list of local-only molecules that the child change will not promote.
5. A statement that global token values, atom APIs, new shared patterns,
   backend/BFF/Gateway contracts, generated artifacts, and dependency manifests
   are out of scope unless the child OpenSpec explicitly proposes them.
6. Per-module verification evidence, normally `cd deck-go && make
frontend-build` plus `cd deck-go && make e2e-mock-module MODULE=<module>` for
   every touched module.
7. Real Gateway, contract, backend, or security verification only when the child
   change changes data loading, mutation payloads, security semantics, or
   contract authority.
8. An update to this matrix after implementation, including any migrated
   cockpit structures, retained local molecules, new pattern candidates, and
   verification gaps.

## Program Closure Checklist

The cockpit rollout program can be closed only after all of these are true:

- Every target panel has one of the four classifications in this matrix.
- Every child batch is implemented, archived, or explicitly deferred with a
  follow-up.
- Any `needs-new-pattern` panel either has a promoted pattern proposal, remains
  local by decision, or is tracked in `openspec/follow-ups/`.
- Sessions, Usage, and Logs remain green as reference consumers after any
  cockpit API changes.
- `openspec validate` passes for the head change and every child change.
- Touched frontend batches pass `cd deck-go && make frontend-build` and their
  module visual smoke commands.
- Program-level closure checks that no global token value, atom API, backend,
  BFF, Gateway, generated contract, or dependency change was smuggled into a
  visual cockpit batch.

## Governance Notes

- The repeated problem is panel chrome structure and stale local alias
  consumption, not canonical token value failure.
- Existing cockpit APIs should be consumed first. New shared patterns require a
  separate reuse-analysis proposal.
- Domain-specific rows, charts, forms, editors, timelines, payload renderers,
  and guarded-write flows remain module-local until at least two stable modules
  prove a shared API.
- Mock visual evidence proves visual and interaction convergence only. It does
  not replace real Gateway, real security, billing, delivery, marketplace, or
  production safety evidence.

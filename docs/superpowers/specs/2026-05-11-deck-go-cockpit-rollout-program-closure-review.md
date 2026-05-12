# Deck-Go Cockpit Rollout Program Closure Review

## Program Matrix

| Change                                                      | Expected                                                                        | Actual                                        | Verification                                                                                                                                                                                                                                          | Notes                                                                                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `deck-go-panel-cockpit-rollout-program`                     | Head matrix and governance                                                      | Active head change remains the program source | Previously validated by head tasks; Batch D updates landed in readiness docs                                                                                                                                                                          | No runtime code in the head change itself.                                                          |
| `deck-go-cockpit-rollout-batch-a-control-policy`            | Budget + Alerts cockpit migration                                               | Implemented                                   | `frontend-build`, Budget mock E2E, Alerts mock E2E, style scans, `git diff --check`                                                                                                                                                                   | Threads remained deferred as allowed by Batch A gate.                                               |
| `deck-go-cockpit-rollout-batch-b-relationship-runtime`      | Identity + Subagents + Channels cockpit migration                               | Implemented                                   | Focused Vitest, `frontend-build`, Identity/Subagents/Channels mock E2E, style scans, `git diff --check`                                                                                                                                               | Relationship and runtime molecules stayed local.                                                    |
| `deck-go-cockpit-rollout-batch-c-automation-guarded-writes` | Webhooks + Cron + Approvals cockpit migration                                   | Implemented                                   | Focused Vitest, `frontend-build`, Webhooks/Cron/Approvals mock E2E, style scans, `git diff --check`                                                                                                                                                   | Guarded writes and security semantics stayed local.                                                 |
| `deck-go-cockpit-rollout-batch-d-integration-inventory`     | Skills + Plugins + Nodes cockpit migration                                      | Implemented; tasks 16/16 complete             | `openspec validate deck-go-cockpit-rollout-batch-d-integration-inventory --type change --strict`; `cd deck-go && make frontend-build`; `make e2e-mock-module` for `skills`, `plugins`, `nodes`; focused Vitest 25/25; style scans; `git diff --check` | Integration, inventory, marketplace, lifecycle, pairing, and remote-control molecules stayed local. |
| Pattern incubator                                           | API Explorer, Gateway, Memory, Models, Routing tracked without forced migration | Deferred to follow-up inbox                   | Follow-up file created under `openspec/follow-ups/`                                                                                                                                                                                                   | New shared patterns require separate reuse-analysis proposals.                                      |

## Cross-Change Findings

### Corrected

- Batch D finished the remaining allowed partial-fit migration for Skills, Plugins, and Nodes using only existing cockpit APIs: `PanelRoot`, `PanelSectionHeader`, `KpiStrip`, `PanelMetric`, `PanelSurface`, `PanelStatusRow`, and `PanelPill`.
- Batch D removed stale module-local implementations for migrated header/KPI/status/surface/pill structures in touched modules. Focused style scans found no stale alias fallback, copied cockpit CSS, or old migrated structure class names in Batch D runtime files.
- The readiness matrix and cross-module readiness notes now reflect Batch D implementation status and retained local molecules.

### Deferred-Uncertain

- API Explorer, Gateway, Memory, Models, and Routing still show substantial visual divergence, but the divergence is dominated by domain-specific catalog, schema tree, evidence, file tree, table/tree, quota, queue, detail, and timeline structures rather than the existing cockpit shell alone.
- No global token value, design-system atom API, `PanelCockpit` API, backend/BFF/Gateway contract, generated artifact, dependency, or routing change was required during the cockpit rollout batches.

## Follow-Up Matrix

| Priority      | Item                                                   | Source       | Decision Needed                                                                               | Verification                                                                     |
| ------------- | ------------------------------------------------------ | ------------ | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| next-openspec | `ContractCatalog` / `ContractSchemaTree`               | API Explorer | Decide shared catalog/tree API after comparing API Explorer and Gateway describe surfaces     | API Explorer tests and mock E2E                                                  |
| next-openspec | `RuntimeEvidenceCard` / `StatusTimeline`               | Gateway      | Decide runtime evidence and timeline API after comparing Gateway, Logs, and Activity          | Gateway tests, mock E2E, optional real Gateway smoke if runtime contracts change |
| next-openspec | `TreeView` / `SearchResultRow` / `DetailSidecar`       | Memory       | Decide file/search/detail patterns after comparing Memory and Docs                            | Memory browse/search/health/dreams tests and mock E2E                            |
| next-openspec | `DataTable` / `TreeView` / `QuotaTrend`                | Models       | Decide inventory/provider/quota patterns after comparing Models, Budget, and Usage            | Models tests, mock E2E, auth safety tests if touched                             |
| next-openspec | `SelectableQueueRow` / `DetailHero` / `StatusTimeline` | Routing      | Decide queue/detail/simulator patterns after comparing Routing, Identity, Nodes, and Activity | Routing tests and mock E2E                                                       |

## Follow-Up Inbox

Tracked file: `openspec/follow-ups/2026-05-11-deck-go-cockpit-rollout-follow-ups.md`

## Commit Readiness

The cockpit rollout program has many active, unarchived OpenSpec changes and runtime frontend changes. Recommended commit grouping is by completed batch plus shared documentation/follow-up artifacts, not one mixed monolithic commit. The current worktree also contains unrelated pre-existing files outside this program scope; commit staging must remain explicit.

## Final Verdict

The current cockpit rollout program is complete with tracked follow-ups. All allowed direct-fit and partial-fit panels in Batches A-D are implemented and verified. The remaining panels are not safe to force through existing cockpit APIs; they are tracked as future reuse-analysis proposals before any design-system expansion.

## 1. Contract Truth And Baseline

- [x] 1.1 Re-read scoped contract sources and generated DTO/Gateway/client types, then record the exact BFF endpoints, Gateway RPC methods, list-query metadata, mutation safety metadata, and live projection metadata used by this change.
- [x] 1.2 Inventory current server-state lifecycles in scoped panels and stores, separating server state from local UI state.
- [x] 1.3 Confirm module boundaries and exclusions in `proposal.md`/`design.md` still match code truth before editing production code.

## 2. Data Module Foundation For Scoped Modules

- [x] 2.1 Add Data Fabric modules for `skills`, `models`, `channels`, `routing`, `nodes`, `settings`, `plugins`, `docs`, `memory`, and `config` with stable keys and index barrels.
- [x] 2.2 Add query hooks/options for scoped reads with explicit source metadata and freshness tiers.
- [x] 2.3 Add mutation wrappers for scoped writes with conservative defaults, declared invalidation targets, hash guards where required, and draft-preserving error behavior.
- [x] 2.4 Add projection policies for `device-pairing` and routing read-model invalidation without requiring generated patch fields.
- [x] 2.5 Add focused tests for keys, freshness mapping, shared-source reuse, cached return, background refresh error preservation, mutation invalidation, hash-required blocking, and projection invalidation.

## 3. Panel Migration

- [x] 3.1 Migrate `SkillsPanel` and skill child components to Data Fabric reads/mutations while preserving local filters, selected skill, install/update dialogs, and current UI.
- [x] 3.2 Migrate `ModelsPanel` and child editors to Data Fabric reads/mutations while preserving provider/model drafts, auth probe interactions, and usage sections currently displayed in the panel.
- [x] 3.3 Migrate `ChannelsPanel` and channel child editors to Data Fabric reads/mutations while preserving selected channel, throughput window, access-control drafts, and probe/logout behavior.
- [x] 3.4 Migrate `RoutingPanel` to Data Fabric reads/mutations while preserving filters, simulation/validation interactions, add/remove flows, and recent activity context currently displayed in the panel.
- [x] 3.5 Migrate `NodesPanel` to Data Fabric reads/mutations while preserving selected node, pending/pairing actions, command dialogs, and skipped-safe write gates.
- [x] 3.6 Migrate `SettingsPanel` to Data Fabric reads/mutations while preserving endpoint/settings/device sections and device-pairing refresh behavior.
- [x] 3.7 Migrate `PluginsPanel`, `DocsPanel`, `MemoryPanel`, and `ConfigPanel` to Data Fabric reads/mutations while preserving local search/filter/detail/draft behavior.
- [x] 3.8 Update focused panel tests to use `DataFabricTestProvider` and prove migrated first-load, ready, empty, error, cached return, and cached-data-preserved-on-refresh-error states where applicable.

## 4. Verification

- [x] 4.1 Run `openspec validate deck-go-data-fabric-config-inventory --type change --strict` and fix all proposal/spec/task validation issues.
- [x] 4.2 Run focused Data Fabric/module/panel tests for all scoped modules.
- [x] 4.3 Run `cd deck-go/frontend-new && npm run test:deck-ui`; if unrelated failures remain, record exact failing files/assertions separately from this change.
- [x] 4.4 Run `cd deck-go && make frontend-build`.
- [x] 4.5 Run `cd deck-go && make contract-gate`.
- [x] 4.6 Run L4 mock-functional browser evidence for the scoped modules: `skills`, `models`, `channels`, `routing`, `nodes`, `settings`, `plugins`, `docs`, `memory`, and `config`.
- [x] 4.7 Run L5 real Gateway evidence for the scoped modules against the isolated real stack; after two environment/startup failures without new narrowing evidence, record a circuit-breaker handoff while keeping deterministic checks green.
- [x] 4.8 Create or update `verification.yaml` with command evidence, known unrelated failures, circuit-breaker handoffs if any, and archive readiness.
- [x] 4.9 Sync accepted spec deltas into main specs, rerun change validation, confirm all tasks are checked only after fresh evidence, and archive the change when ready.

# deck-go Data Fabric Config And Inventory Modules

## Why

`frontend-new` still has many config and inventory panels that own server fetch
lifecycles directly in components or stores. The Data Fabric foundation and
Agents reference module established the desired contract chain, but the rest of
the config/inventory surface still over-fetches on panel switches, repeats
loading/error handling, and keeps write safety rules close to UI code instead of
module data boundaries.

This change migrates the config/inventory tier to Data Fabric using the same
contract-first approach as the Agents reference. The goal is to make these
panels read and mutate server state through explicit module data hooks while
preserving their current product UI and keeping local UI state outside TanStack
Query.

## Scope

This change covers the config/inventory modules named by
`docs/superpowers/specs/2026-05-08-frontend-data-fabric-design.md` Phase 2:

- `skills`
- `models`
- `channels`
- `routing`
- `nodes`
- `settings`
- `plugins`
- `docs`
- `memory`
- `config`

The change SHALL migrate only server-state reads and contract-declared
mutations for these modules. It SHALL NOT redesign the visual UI, change Gateway
protocol authority, add new backend features, or migrate live/historical/chat
surfaces that belong to later Data Fabric changes.

## Contract Truth Read Before Design

- `deck-go/contracts/source/deck-api.contract.ts`
- `deck-go/contracts/source/deck-endpoints.contract.json`
- `deck-go/contracts/source/deck-list-queries.contract.json`
- `deck-go/contracts/source/deck-mutations.contract.json`
- `deck-go/contracts/source/deck-config-write-safety.contract.json`
- `deck-go/contracts/source/deck-live-projections.contract.json`
- `deck-go/contracts/source/deck-route-governance.contract.json`
- `deck-go/contracts/source/deck-api-dynamic-surfaces.contract.json`
- `deck-go/contracts/source/deck-ui.contract.json`

Important contract facts:

- Models runtime inventory routes are Gateway protocol adapters:
  `models.configured`, `deck.auth.overview`, `models.catalog.providers`, and
  `deck.auth.probe` through the deck-go backend RPC adapter.
- Skills, channels, config, settings, plugins, docs, nodes, memory, routing, and
  models config editor routes remain Deck BFF/product-shaped routes.
- `docs-list` is the only Phase 2 list-query contract currently declared; its
  parameters are `category` and `q`.
- Config-write-safety declares hash/conflict behavior for
  `channels.config.patch`, `config.apply`, `config.patch`,
  `models.config.save`, `routing.add`, `routing.remove`,
  `routing.dm-scope.patch`, `settings.save`, and `skills.update`.
- Mutation evidence marks many real writes as `deferred` or `skipped-safe`; real
  E2E MUST use safe read paths, validation-only paths, or disposable fixtures
  where the existing spec already provides them.
- Live projections in this scope are limited: `device-pairing` is tied to
  settings, and `routing-bindings` is metadata-only with no stream events.

## What Changes

1. Add per-module Data Fabric directories under
   `frontend-new/src/data/modules/` for each scoped module, using the Agents
   reference shape: `keys.ts`, `queries.ts`, `mutations.ts` when needed,
   `projections.ts` when contract metadata exists, tests, and an index barrel.
2. Migrate scoped panels away from component-owned server fetch lifecycles and
   direct raw `deckFetch`/Gateway calls for server state. UI state such as
   filters, tabs, selections, dialogs, and drafts remains local.
3. Encode freshness explicitly:
   - `config-authority`: config snapshots, config editor data, models config,
     channel config/status, routing bindings, settings.
   - `inventory`: skills list, plugins list, models runtime/catalog inventory,
     nodes list, docs list, memory browse/search inputs where treated as
     inventory.
   - `lazy-detail`: docs detail, skill hub detail, node detail, memory health or
     detail-like one-off reads.
   - `live-workbench`: settings device-pairing and other explicitly live status
     reads within this scope.
4. Encode mutation behavior in data modules:
   - no automatic mutation retry;
   - no offline replay queue;
   - base-hash/client-hash guards where the contract requires or preserves hash
     behavior;
   - explicit invalidation maps per mutation;
   - safe real E2E writes only when contract evidence marks them fixture-safe or
     existing real specs already provide disposable fixtures.
5. Add focused unit/hook/component tests for query keys, freshness mapping,
   cached return, cached-data-preserved-on-refresh-error, mutation invalidation,
   hash guards, and no backend call on blocked writes.
6. Run mock-functional and real-gateway evidence for the scoped modules using
   existing module E2E specs, with circuit-breaker recording for repeated real
   environment/startup failures.

## Out Of Scope

- Chat transcript streaming and chat send/abort/compact command execution.
- Sessions, approvals, activity, gateway monitor, usage, logs, alerts, budget,
  cron, threads, webhooks, and other live/historical surfaces assigned to later
  changes.
- New Gateway RPC methods, new OpenClaw upstream schemas, or generated
  `patchStrategy`/`patchKeys`.
- Automatic mutation retry, offline mutation queue, IndexedDB persistence,
  custom lint rules, or devtools/prefetch hardening.
- Visual redesign of any scoped panel.

## Risks

- This change touches many panels, so accidental UI behavior drift is the main
  risk. Mitigation: migrate in module-sized vertical slices and keep existing
  panel tests/E2E as acceptance.
- Some existing E2E tests may assert old locator/text details rather than
  product intent. Mitigation: only fix locator drift when the UI behavior is
  confirmed correct; do not weaken assertions that protect behavior.
- Real-gateway specs may fail because of environment or real account state.
  Mitigation: use the established two-attempt circuit breaker and keep
  deterministic code/build/contract checks green.

## Acceptance Summary

- All scoped server-state reads are available through Data Fabric module hooks
  or query option factories.
- Scoped panels no longer add raw server fetch lifecycles for the migrated
  server state.
- Mutations use contract-derived safety, explicit invalidation, no retry, and no
  offline queue.
- Focused tests, `openspec validate`, frontend build, contract gate, L4 mock
  module evidence, and L5 real-gateway module evidence pass or record accepted
  circuit-breaker handoffs.

## Capabilities

### New Capabilities

- `deck-go-data-fabric-config-inventory`: Data Fabric migration for Phase 2
  config/inventory modules, including module query keys, freshness, mutation
  safety, panel consumption rules, and mock/real verification expectations.

### Modified Capabilities

- `deck-go-data-fabric-foundation`: Clarify that the foundation supports broad
  repeated config/inventory module migrations and explicit cross-module shared
  query sources.
- `frontend-new-workspace`: Require scoped config/inventory panels to follow
  the Data Fabric server-state protocol while preserving visual/product UI.
- `deck-go-live-projection-subscription-contract`: Map current settings
  device-pairing and routing-bindings metadata to Data Fabric invalidation
  without new patch fields.

## Impact

- Affected frontend data files:
  - `deck-go/frontend-new/src/data/modules/skills/**`
  - `deck-go/frontend-new/src/data/modules/models/**`
  - `deck-go/frontend-new/src/data/modules/channels/**`
  - `deck-go/frontend-new/src/data/modules/routing/**`
  - `deck-go/frontend-new/src/data/modules/nodes/**`
  - `deck-go/frontend-new/src/data/modules/settings/**`
  - `deck-go/frontend-new/src/data/modules/plugins/**`
  - `deck-go/frontend-new/src/data/modules/docs/**`
  - `deck-go/frontend-new/src/data/modules/memory/**`
  - `deck-go/frontend-new/src/data/modules/config/**`
- Affected panels:
  - `deck-go/frontend-new/src/components/panels/skills/**`
  - `deck-go/frontend-new/src/components/panels/models/**`
  - `deck-go/frontend-new/src/components/panels/channels/**`
  - `deck-go/frontend-new/src/components/panels/routing/**`
  - `deck-go/frontend-new/src/components/panels/nodes/**`
  - `deck-go/frontend-new/src/components/panels/settings/**`
  - `deck-go/frontend-new/src/components/panels/plugins/**`
  - `deck-go/frontend-new/src/components/panels/docs/**`
  - `deck-go/frontend-new/src/components/panels/memory/**`
  - `deck-go/frontend-new/src/components/panels/config/**`
- Verification impact:
  - focused Data Fabric/module/panel tests for scoped modules
  - `cd deck-go/frontend-new && npm run test:deck-ui`
  - `cd deck-go && make frontend-build`
  - `cd deck-go && make contract-gate`
  - L4/L5 module E2E for `skills`, `models`, `channels`, `routing`, `nodes`,
    `settings`, `plugins`, `docs`, `memory`, and `config`

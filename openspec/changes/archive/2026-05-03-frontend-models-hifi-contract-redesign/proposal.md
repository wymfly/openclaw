## Why

Models is the most complex remaining Core panel: it already touches Gateway typed RPC, Deck config editing, auth probing, catalog discovery, fallback chains, allowlists, usage cost, and provider pressure, but the UI still depends on the old `deck-ui-models` global shell and dense legacy editor layout.

This change applies the contract-led high-fidelity workflow to Models so the frontend can converge visually against mock data and the design system while preserving the existing contract chain. Deterministic mock/API drift should be fixed in this change; uncertain real Gateway model/auth/catalog semantics should be recorded as handoff follow-up.

## What Changes

- Create a complete high-fidelity Models handoff package under `deck-go/frontend-handoff/modules/models/`.
- Redesign `deck-go/frontend-new/src/components/panels/models/` into a compact model operations workbench:
  - runtime-visible model inventory and provider grouping
  - auth health, OAuth/cooldown evidence, and provider probe result
  - catalog provider discovery and catalog-to-config actions
  - global provider configuration editing
  - default text/image model fallback chains and allowlist controls
  - usage cost and provider pressure evidence
  - raw config and schema lookup affordances without making raw JSON the primary workspace
- Preserve current behavior for:
  - `fetchModelsConfig`
  - `saveModelsConfig`
  - `lookupConfigPath`
  - `fetchRuntimeConfiguredModels`
  - `fetchRuntimeModelAuthOverview`
  - `fetchRuntimeModelCatalogProviders`
  - `probeRuntimeModelAuth`
  - `fetchModelUsageCost`
  - `fetchModelUsageProviders`
- Fix deterministic mock Gateway gaps for `models.configured`, `models.catalog.providers`, `deck.auth.overview`, and `deck.auth.probe` if visual E2E cannot load Models through the normal frontend API path.
- Add focused mock visual E2E covering the ready workbench and at least two interaction states, such as provider config, fallback chain, catalog selection, usage, or probe result.
- Update cross-module readiness evidence with Models-specific findings, repeated workbench/table/tree/quota molecules, and any promotion candidates.

## Capabilities

### New Capabilities

- `frontend-models-hifi-redesign`: Covers the Models handoff package, production UI rewrite, contract-shaped mocks, focused mock visual evidence, and local design-system feedback.

### Modified Capabilities

- `design-system-cross-module-readiness`: Adds Models implementation evidence and classifies whether DataTable, TreeView, KpiCard, SparklineChart, provider config, fallback chain, and usage-pressure molecules remain local, need a dedicated atom proposal, or are accepted as follow-up.

## Impact

- `deck-go/frontend-handoff/modules/models/`
- `deck-go/frontend-new/src/components/panels/models/`
- `deck-go/frontend-new/src/theme.css` Models global styling removal or narrowing
- `deck-go/frontend-new/src/i18n/en.json` and `deck-go/frontend-new/src/i18n/zh.json`
- `deck-go/test/fixtures/mock-gateway.mjs` if model/auth/catalog mock drift is confirmed
- `deck-go/test/e2e/` focused Models mock visual coverage
- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`
- `openspec/specs/frontend-models-hifi-redesign/spec.md`
- `openspec/specs/design-system-cross-module-readiness/spec.md`

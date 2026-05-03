## Context

`frontend-new` already has a functional `ModelsPanel` under the `models` panel id. It loads raw model config through `/models/config`, saves through `/models/config`, looks up schema paths through `/config/schema-lookup`, loads runtime inventory through `models.configured`, loads auth and catalog data through `deck.auth.overview` and `models.catalog.providers`, probes auth through `deck.auth.probe`, and shows usage evidence through `usage.cost` and `usage.status`.

The current panel is behavior-rich, but the user experience is still built around the old `deck-ui-models` global shell, a raw JSON-first left column, and several dense legacy surfaces. The mock Gateway also does not currently provide default model/auth/catalog RPC handlers, which blocks a realistic mock visual E2E path for this panel.

## Goals / Non-Goals

**Goals:**

- Produce a complete Models handoff package.
- Rewrite Models into a high-fidelity model operations workbench aligned with the settled design-system posture.
- Preserve runtime inventory, auth overview, catalog discovery, config editing, fallback chains, allowlist controls, usage cost, provider pressure, schema lookup, save, and probe behavior.
- Fix deterministic mock Gateway model/auth/catalog gaps needed for visual E2E.
- Add focused mock visual coverage for the ready workbench and meaningful interaction states.
- Record Models-specific design-system feedback without silently promoting atoms.

**Non-Goals:**

- No real Gateway/LLM E2E.
- No new Gateway, usage, or config endpoints.
- No direct Gateway RPC from browser code.
- No new dependencies.
- No canonical design-system atom promotion inside this module change.
- No broad config schema redesign beyond preserving current supported edits.

## Decisions

1. **Treat Models as a model operations workbench, not a raw JSON editor.**
   Raw config remains available because the existing save contract is raw+hash, but the first viewport should prioritize runtime inventory, provider health, catalog state, fallback chains, and usage pressure. Raw JSON becomes an evidence/editing sidecar, not the main mental model.

2. **Keep all data through existing wrappers.**
   `fetchModelsConfig`, `saveModelsConfig`, `lookupConfigPath`, `fetchRuntimeConfiguredModels`, `fetchRuntimeModelAuthOverview`, `fetchRuntimeModelCatalogProviders`, `probeRuntimeModelAuth`, `fetchModelUsageCost`, and `fetchModelUsageProviders` remain the production boundary. Browser code must keep using Deck BFF and generated Gateway client wrappers instead of direct Gateway calls.

3. **Use module-local molecules for table, tree, quota, catalog, and fallback layouts.**
   Models is the first panel that needs all of DataTable, TreeView, KpiCard, and Sparkline-like usage surfaces at once. This change will not re-architect canonical atoms or introduce shared APIs prematurely. Candidate patterns are documented in readiness and can move to a dedicated design-system proposal after the module proves the shape.

4. **Fix only deterministic mock/API drift.**
   The bundled mock stack should return contract-shaped `models.configured`, `deck.auth.overview`, `models.catalog.providers`, and `deck.auth.probe` payloads so visual E2E exercises the real frontend API path. Unknown real Gateway catalog/auth semantics become handoff follow-up, not fabricated UI guarantees.

5. **Preserve config mutation semantics.**
   Provider edits, catalog apply, fallback reordering, allowlist toggles, Bedrock discovery edits, schema lookup, and save must continue to mutate the raw config draft and submit it with the current base hash. A visual rewrite must not silently change the patch authority.

## Risks / Trade-offs

- **Risk: Behavior regression through a large visual rewrite.** -> Keep focused unit tests for load calls, localization, save/hash behavior, fallback edits, catalog quick actions, provider config edits, allowlist edits, Bedrock discovery edits, probe, and inline-style absence.
- **Risk: Models local molecules become de facto design-system behavior.** -> Keep them under `panels/models/` and record promotion candidates in readiness instead of exporting shared APIs.
- **Risk: Raw config and structured controls diverge.** -> Continue deriving structured state from `rawConfig` and keep save authority on the raw draft.
- **Risk: Mock data hides real Gateway gaps.** -> Label visual E2E as mock-only and document uncertain real Gateway model/auth/catalog differences in handoff notes.
- **Risk: Large CSS diff.** -> Move or narrow the old `deck-ui-models` global block into module-local CSS and keep the rewrite inside the Models panel, mocks, E2E, handoff, readiness, and OpenSpec artifacts.

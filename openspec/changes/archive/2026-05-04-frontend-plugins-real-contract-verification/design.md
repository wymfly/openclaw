## Context

Plugins already have production code, a hifi spec, focused tests, and a mock visual E2E. The new v2 handoff refreshes the product target into a read-only operator workbench for plugin inventory and diagnostics: KPI strip, filterable inventory, selected plugin detail, capabilities, diagnostics, manifest/raw evidence, activation/audit placeholders, and clear lifecycle limitations.

The current contract chain is:

1. `frontend-new/src/api.ts` wrapper `fetchPluginsWithCapability(capability)`
2. Deck-facing DTOs `DeckGoPluginInventoryEntry`, `DeckGoPluginsListResponse`, `DeckGoPluginActionCapabilities`, and `DeckGoPluginDiagnostic`
3. Endpoint classification in `contracts/source/deck-endpoints.contract.json`
4. Go BFF route `GET /api/deck/plugins`
5. Runtime facade query `DeckPluginsList`
6. Gateway typed RPC `deck.plugins.list`

## Goals / Non-Goals

**Goals:**

- Align production Plugins with the fresh v2 handoff where the prototype is backed by the true BFF/Gateway contract.
- Preserve browser-to-BFF-only access and avoid direct Gateway calls from frontend code.
- Verify inventory, capability scope switching, search/filtering when implemented, selected plugin detail, capability chips, diagnostics, raw evidence, related channel handoff copy, unsupported lifecycle states, empty/error states, and no direct Gateway calls.
- Fix clear Plugins drift directly, including stale handoff claims for non-existent manifest/audit routes and unsupported mutation semantics.
- Record capability gaps in `frontend-handoff/modules/plugins/implementation-notes.md`.

**Non-Goals:**

- Add install, uninstall, enable, disable, reload, marketplace, trust-source, package-signature, or plugin activation mutation behavior.
- Add `/api/deck/plugins/{id}/manifest`, `/api/deck/plugins/{id}/audit`, or similar projection endpoints unless current code already supports them.
- Add new UI dependencies or persistence layers without explicit approval.
- Claim the UI verifies production plugin activation beyond the read-only Gateway-reported inventory payload.

## Decisions

1. **Gateway/BFF inventory truth wins over prototype claims.** The v2 prototype is the visual/product target, but route truth is `GET /api/deck/plugins` backed by `deck.plugins.list`.

2. **Manifest and audit tabs are degraded unless route truth exists.** The handoff describes BFF projections for manifest and audit. Current endpoint classification does not list those routes.

3. **Plugins remains read-only.** Lifecycle controls are copy/evidence only; no install/enable/reload mutation is added in this change.

4. **Real E2E uses safe read-only Gateway inventory.** The real-stack test may call `/api/deck/plugins?capability=all` and render the UI, but it must not mutate plugin runtime state.

5. **Circuit breaker applies to real Gateway inventory variation.** If the real Gateway returns an empty plugin list or environment-specific plugin shape, classify as empty-valid/degraded with evidence after bounded attempts and continue after static review plus L1 evidence.

## Risks / Trade-offs

- **Prototype includes projections that may not exist** -> Render as unsupported/degraded and document instead of inventing routes.
- **Gateway plugin inventory can vary by environment** -> L2 tests assert route shape and UI resilience, not exact plugin names unless seeded by mock.
- **Open string enums** -> Status, origin, capability kind, and diagnostic level must render unknown values without breaking filters.
- **Channel handoff depends on channel visibility** -> Hidden channel IDs get warning copy rather than unsupported navigation buttons.

# models - high-fidelity handoff

**Status:** `implemented`
**Protocol version:** `protocol-v1`
**Active visual target:** [`./prototype.html`](./prototype.html)
**OpenSpec change:** `frontend-models-hifi-contract-redesign`

This package defines the visual and interaction target for the `models/`
module rewrite in `frontend-new`. The existing panel already has broad contract
coverage, but its layout still comes from the old global `deck-ui-models`
surface and treats raw JSON as the primary workspace. Code and contracts remain
the final authority when a handoff note drifts.

## What this module does

`models/` is the model operations workbench. Operators use it to answer: which
models are visible to the runtime, which providers are authenticated, which
catalog providers can be added, how default/fallback chains will fail over, what
usage pressure exists, and what raw config will be saved.

The design keeps runtime inventory, provider health, usage pressure, and
navigation in the first viewport. Raw config remains available because the save
contract is raw JSON plus base hash, but it is not the main mental model.

## Contract truth

Production and mocks must use the current Deck-facing and Gateway DTOs:

- `DeckGoModelsConfigResponse`
- `DeckGoConfigApplyResponse`
- `DeckGoConfigLookupResponse`
- `DeckGoRuntimeConfiguredModel`
- `DeckGoRuntimeConfiguredModelsResponse`
- `DeckGoModelAuthProvider`
- `DeckGoModelAuthOverviewResponse`
- `DeckGoCatalogProvider`
- `DeckGoModelCatalogProvidersResponse`
- `DeckGoModelProbeResponse`
- `DeckGoUsageCostResponse`
- `DeckGoUsageProviderStatus`
- `DeckGoUsageProvidersResponse`

Endpoint/RPC truth:

- `GET /models/config`
- `PATCH /models/config`
- `POST /config/schema-lookup`
- `GET /models/usage/cost`
- `GET /models/usage/providers`
- `models.configured`
- `deck.auth.overview`
- `models.catalog.providers`
- `deck.auth.probe`

Browser code must continue through `frontend-new/src/api.ts` wrappers and the
Deck backend. It must not call Gateway RPC directly.

## Workflow constraints

- Visual convergence is the goal of this module pass: mock + frontend should
  become stable against the contract and design system.
- Code truth wins over this handoff when the two disagree.
- Deterministic fixture/API drift may be fixed in this change. Uncertain real
  Gateway model/auth/catalog/usage semantics must be recorded as follow-up
  instead of invented in the UI.
- Raw config remains the save authority; structured controls edit that draft.
- No new Gateway endpoints, new dependencies, or canonical atom promotion are
  part of this handoff.

## Depends on canonical atoms

`Badge`, `Button`, `Card`, `Chip`, `Code`, `Input`, `Select`, `SegmentedControl`,
`Spinner`, `Tag`, `Textarea`, and status atoms can be used where production fit
is straightforward.

No canonical atom or token is required by this handoff. Local molecules:

- model metric tile
- runtime provider rail
- model inventory table row
- provider auth evidence row
- catalog provider card
- provider config field cluster
- fallback chain card
- allowlist row
- usage cost bar
- provider quota card
- raw config sidecar

## How to implement

1. Open `prototype.html` and inspect ready, provider config, catalog, fallback,
   usage, loading, empty, and error states.
2. Read `api-usage.md` before touching mocks, API wrappers, or backend
   behavior.
3. Translate the prototype into `frontend-new/src/components/panels/models/`,
   preserving API wrappers, raw-config save/hash behavior, schema lookup,
   catalog apply, fallback edits, allowlist edits, and probe behavior.
4. Move Models styling out of global `theme.css` into module-local CSS.
5. Add mock visual E2E with contract-shaped data and label evidence as mock
   visual coverage.

## Open questions for follow-up

- Whether real Gateway always returns `payload.models` or may rely on
  `payload.items` for `models.configured` in every runtime mode.
- Whether real `deck.auth.overview` provider `usage` windows should be merged
  with `usage.status` or kept as separate evidence.
- Whether catalog provider model entries should become a canonical DataTable
  atom after Usage/Activity/Plugins repeat the same table shape.
- Whether provider tree and fallback chain patterns should become shared
  design-system patterns after Models and future configuration modules converge.
- Whether raw model config should eventually move behind a dedicated advanced
  mode once config patch contracts become more structured.

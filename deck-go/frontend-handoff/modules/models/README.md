# models — high-fidelity handoff

**Status:** `implemented — real-contract verified`
**Protocol version:** `protocol-v1`
**Active visual target:** [`./prototype.html`](./prototype.html)
**Reference prior art:** [`./prototype-v1-codex.html`](./prototype-v1-codex.html) (V1 Codex single-file; do not implement against it)

This package replaces the V1 single-file Codex prototype with a multi-file
interactive React rebuild matching the agents v2 quality bar. Same
list↔detail page-transition pattern as channels, with model-domain
sections (Limits / Pricing / Usage / Auth / Audit).

## What this module does

`models/` is the model registry workbench. Operators use it to:

- Inventory runtime-configured models grouped by provider
- See per-provider auth state, OAuth/cooldown evidence, and usage
  windows
- Inspect default + fallback chain for each provider
- Drill into a model: limits, pricing, 24h spend, audit history
- Add models from the provider catalog
- Configure provider auth (apiKey / oauth / profile / none)
- Run a probe end-to-end through the runtime

The design keeps runtime inventory + provider health + spend pressure on
the first viewport. Raw `openclaw.json` config remains the save authority
but is not the main mental model — structured controls edit a draft that
serializes to the raw config behind the scenes.

## Visual target

```sh
cd deck-go/frontend-handoff/modules/models
python3 -m http.server 8898
# → http://localhost:8898/
```

## Files

| File                                                                             | Role                                                                                                                                                                                 |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prototype.html`                                                                 | ~30-line shell loading the .jsx files via Babel standalone                                                                                                                           |
| `app.jsx`                                                                        | Application shell: list↔detail routing, ⌘N + ⌘K + Esc, Tweaks panel                                                                                                                  |
| `list-view.jsx`                                                                  | Provider-grouped model list, KPI strip, status pills, search/filter                                                                                                                  |
| `detail-view.jsx`                                                                | Model hero + 6 tabs (Overview/Limits/Pricing/Usage/Auth/Audit)                                                                                                                       |
| `dialogs.jsx`                                                                    | ProbeResult + AuthConfig + Catalog (add-model)                                                                                                                                       |
| `data.js`                                                                        | Contract-shaped mock (DeckGoModelsConfigResponse, RuntimeConfiguredModel, ModelAuthOverview, CatalogProviders, ModelProbe, UsageCost, UsageProviders, pricing/audit BFF projections) |
| `icons.jsx`                                                                      | 19 SVG icons + ProviderGlyph                                                                                                                                                         |
| `styles.css`                                                                     | Linear-inspired full visual language; --ds-\* tokens only                                                                                                                            |
| `tokens.css`                                                                     | Mirror of canonical tokens                                                                                                                                                           |
| `tweaks-panel.jsx`                                                               | Reusable tweaks shell (cp from agents/channels)                                                                                                                                      |
| `prototype-v1-codex.html`                                                        | V1 reference, retained for diff                                                                                                                                                      |
| `README.md` / `components.md` / `states.md` / `interactions.md` / `api-usage.md` | Handoff docs                                                                                                                                                                         |

## Contract truth

Production and mocks must use the current Deck-facing and Gateway DTOs:

- `DeckGoModelsConfigResponse`
- `DeckGoConfigApplyResponse`
- `DeckGoRuntimeConfiguredModel` / `DeckGoRuntimeConfiguredModelsResponse`
- `DeckGoModelAuthProvider` / `DeckGoModelAuthOverviewResponse`
- `DeckGoCatalogProvider` / `DeckGoModelCatalogProvidersResponse`
- `DeckGoModelProbeResponse`
- `DeckGoUsageCostResponse` / `DeckGoUsageProviderStatus` / `DeckGoUsageProvidersResponse`

BFF projections (not raw Gateway wire):

- per-model pricing snapshot (vendor list)
- audit log over `PATCH /models/config` history

## Depends on canonical atoms

`Badge`, `Button`, `Card`, `Chip`, `Code`, `Input`, `Select`,
`SegmentedControl`, `Spinner`, `Tag`, `Textarea`. Local molecules:

- model row + provider section header
- KPI tile + KPI strip
- provider auth row
- quota bar
- pricing cell
- fallback chain badge row
- catalog provider card
- audit log row

## Depends on canonical icons

Maps to `@/design-system/icons` re-exports of lucide-react:

- IconSearch / IconPlus / IconArrowL / IconRefresh / IconCheck / IconX
- IconBolt / IconCpu / IconBrain / IconLock / IconKey / IconDollar
- IconHistory / IconShield / IconActivity / IconDownload / IconStar
- IconChain / IconEmpty
- ProviderGlyph (local — provider-initial avatar; do not promote)

## Depends on canonical patterns

Prototype uses local layout primitives that map 1:1 to canonical
patterns at translation:

- `.view` → `PageShell`
- detail tabs → `TabsBar` (after a second module reuses, propose for
  promotion to `@/design-system/patterns`)
- empty/error surfaces → `EmptyState`

## Workflow constraints

- Visual convergence is the goal of this module pass: mock + frontend
  should become stable against the contract and design system.
- Code truth wins over this handoff when the two disagree.
- Raw config remains the save authority; structured controls edit the
  draft.
- No new Gateway endpoints in this handoff.
- `deck.auth.probe` may be cached briefly server-side — UI should
  expose a "force re-run" path in the dialog.

## How to implement

1. Open `prototype.html` (served via http.server) and walk through each
   tab + dialog state via the Tweaks panel.
2. Read `components.md` (component tree + props shapes).
3. Read `states.md` (state machine + edge cases).
4. Read `interactions.md` (keyboard / a11y / pointer / loading / errors).
5. Read `api-usage.md` (endpoints, payload shapes, BFF projections).
6. Translate into `frontend-new/src/components/panels/models/` preserving
   API wrappers, raw-config save/hash, schema lookup, catalog apply,
   fallback edits, allowlist edits, probe behavior.
7. Extract literal text into `i18n/{en,zh}.json` per protocol.
8. Add mock visual E2E with contract-shaped fixture data.

## Open questions

- Should `models.configured` always return `payload.models` or may it
  rely on `payload.items` in some runtimes?
- Should provider `usage.windows` from `deck.auth.overview` be merged
  with the `/models/usage/providers` view or shown separately?
- Should the catalog provider's model entries become a canonical
  `DataTable` atom after Usage / Activity / Plugins repeat the same
  shape?
- Should provider-tree + fallback-chain become shared design-system
  patterns after Models converges with Settings?
- Should raw config move behind a dedicated advanced mode after the
  PATCH contract becomes more structured?
- Should the model-row ListRow be promoted to a canonical molecule
  after channels and models both ship the same shape? (Reflowback
  signal #2 — channels was #1.)

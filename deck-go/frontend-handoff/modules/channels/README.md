# channels — high-fidelity handoff

**Status:** `revised v2 — pending implementation`
**Protocol version:** `protocol-v1`
**Active visual target:** [`./prototype.html`](./prototype.html)
**Reference prior art:** [`./prototype-v1-codex.html`](./prototype-v1-codex.html) (Codex V1, kept as reference; do not implement against it)

This package replaces the V1 single-file Codex prototype with a multi-file
interactive React rebuild matching the agents v2 quality bar. The V1 file is
kept under `prototype-v1-codex.html` as reference for what was deliberately
revised.

## What this module does

`channels/` is the operations workbench for OpenClaw provider connections.
Operators use it to:

- Inventory provider channels (Telegram, Discord, WeCom, Slack, QQ, …)
- See per-channel throughput, account-level diagnostics, and probe results
- Patch generic channel settings (retry, jitter, webhook) via the BFF
- Inspect routing bindings filtered to the channel
- Manage WeCom-specific access controls when the selected channel is WeCom
- Run probe + logout actions with confirmation gates

The design is operations-dense and keeps every panel section readable on a
single page. Layout is page-transition (list ↔ detail) at full canvas width;
no split panel.

## Visual target

Open `prototype.html` in a browser served from this directory:

```sh
cd deck-go/frontend-handoff/modules/channels
python3 -m http.server 8899
# then open http://localhost:8899/
```

Use the Tweaks panel (bottom-right) to switch theme/density/state and to
exercise list-error, list-empty, detail-loading, settings-dirty,
test-result, logout, and create-wizard surfaces.

## Files

| File                                                                             | Role                                                                                                          |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `prototype.html`                                                                 | ~30-line shell loading the .jsx files via Babel standalone                                                    |
| `app.jsx`                                                                        | Application shell: list↔detail routing, dialog state, Tweaks panel mount                                      |
| `list-view.jsx`                                                                  | Inventory list, KPI strip, search/filter/sort toolbar, status pills                                           |
| `detail-view.jsx`                                                                | Selected-channel hero + 6 tabs (Overview/Throughput/Probe/Settings/Routing/WeCom)                             |
| `dialogs.jsx`                                                                    | TestResult, LogoutConfirm, CreateChannel 3-step wizard                                                        |
| `data.js`                                                                        | Contract-shaped mock data (DeckGo\* DTOs, BFF projections, accounts, probe, throughput, routing, wecomAccess) |
| `icons.jsx`                                                                      | Channel-specific SVG icons + provider glyph                                                                   |
| `styles.css`                                                                     | Linear-inspired full visual language; `--ds-*` tokens only                                                    |
| `tokens.css`                                                                     | Mirror of canonical `frontend-new/src/design-system/tokens/index.css`                                         |
| `tweaks-panel.jsx`                                                               | Reusable tweaks shell + form controls (copied from agents)                                                    |
| `prototype-v1-codex.html`                                                        | V1 reference, retained for diff                                                                               |
| `README.md` / `components.md` / `states.md` / `interactions.md` / `api-usage.md` | Handoff docs                                                                                                  |

## Contract truth

Production and mocks must use the current Deck-facing DTOs:

- `DeckGoChannelsStatusResponse`
- `DeckGoChannelUiMeta`
- `DeckGoChannelTestResponse`
- `DeckGoChannelThroughputBucket`
- `DeckGoChannelThroughputResponse`
- `DeckGoConfigSnapshotResponse`
- `DeckGoConfigApplyResponse`
- `DeckGoRoutingListResponse`
- `DeckGoRoutingBinding`

BFF projections (not raw Gateway wire frames; flagged in `api-usage.md`):

- per-account diagnostic title/description/nextStep/health
- per-account DM policy + scope
- WeCom access-controls state per account

## Depends on canonical atoms

`Badge`, `Button`, `Card`, `Chip`, `Input`, `Select`, `Textarea`, `Toggle`,
`Spinner`, `Modal`. Local molecules kept inside the module:

- channel inventory row (list-view)
- selected-channel hero (detail-view)
- KPI tile + KPI strip
- account diagnostic row
- throughput chart strip
- channel settings form section
- routing binding row
- WeCom access card

These molecules will be re-evaluated for promotion once a second module
shows the same shape (see `frontend-handoff/design-system/proposals/`).

## Depends on canonical patterns

(none directly imported in prototype — patterns will be substituted at
engineering implementation time.) The prototype uses local layout
primitives that map to canonical patterns 1:1 at translation:

- `.view` → `PageShell` (max-width container + entrance animation)
- detail tabs follow the same shape as agents detail tabs; will share a
  `TabsBar` pattern after a second module reuses it
- empty/error surfaces map to `EmptyState`

## Depends on canonical icons

Prototype-local SVG icons; engineering side maps to lucide-react via
`@/design-system/icons` re-exports:

- IconSearch → `IconSearch`
- IconPlus → `IconPlus`
- IconArrowL → `IconArrowL`
- IconRefresh → `IconRefresh`
- IconCheck → `IconCheck`
- IconX → `IconClose`
- IconWarn → `IconWarn`
- IconActivity → `IconActivity`
- IconRoute → `IconRoute`
- IconShield → `IconShield`
- IconPlug → `IconPlug` (new — propose lucide `Plug` alias)
- IconLogout → `IconLogout`
- IconCog → `IconSettings`
- IconChevronD → `IconChevronDown`
- ChannelGlyph → local-only, do not promote

## Workflow constraints

- Browser code must continue through the Deck BFF / API facade.
- Channel status / account shapes are BFF projections, not raw Gateway wire
  frames.
- Probe result is a BFF interpretation over `channels.status` with
  `probe=true`.
- Channel patching must continue through the server's config get/patch
  chain.
- Logout / enable / disable actions must keep a confirmation gate (see
  dialogs.jsx).
- WeCom config and routing behaviors stay scoped to the WeCom channel
  detail tab.

## How to implement

1. Open `prototype.html` (served via `python3 -m http.server`) and walk
   through each tab, using the Tweaks panel to exercise loading/error
   states and dialog surfaces.
2. Read `components.md` (component tree + props shapes).
3. Read `states.md` (state machine + edge cases).
4. Read `interactions.md` (keyboard / a11y / pointer / loading / errors).
5. Read `api-usage.md` (endpoints, payload shapes, BFF projections,
   pagination notes).
6. Translate into `frontend-new/src/components/panels/channels/` preserving
   wrappers, confirmation gates, and selection-refresh behavior.
7. Extract literal text into `frontend-new/src/i18n/{en,zh}.json` (one-time
   pass at engineering time — see frontend-handoff/CLAUDE.md "Prototype
   string rule").
8. Add mock visual E2E with contract-shaped fixture data; label as mock
   visual coverage only.

## Open questions for follow-up

- Should throughput become a real Gateway-backed metric instead of the
  current BFF placeholder in some runtimes? (currently buckets only)
- Should every provider expose a schema-guided config form, or does
  generic JSON patch stay as the fallback?
- Should channel account diagnostics be normalized server-side rather
  than inferred in the UI? (current health/title/description live as BFF
  projections)
- Should WeCom access controls become a dedicated provider detail route
  when more WeCom sections are added?
- Should native `window.confirm` be replaced by the prototype's modal
  dialog after enough configuration modules repeat the pattern?
- Should the channel inventory ListRow molecule be promoted to atoms
  after agents and channels both ship? (agents pilot also uses a list-row
  shape — second-module proof-of-reuse signal.)

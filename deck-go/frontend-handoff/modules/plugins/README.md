# Plugins (Workbench)

**Status**: implemented-real-contract
**Design completed**: 2026-05-04
**Designer**: design agent (Claude)
**Depends on atoms**: Pill, Badge, Tag, Button, IconButton, Modal, Tabs, KbdHint, Avatar, EmptyState
**Depends on canonical patterns**: PageShell, SectionHeader, EmptyState
**New atoms needed**: none
**New tokens needed**: none
**Backend endpoints used**: see `api-usage.md`

## What this module does

Read-only inventory and diagnostics workbench for plugins discovered by the Deck BFF through the OpenClaw Gateway `deck.plugins.list` RPC. The panel answers: what is installed, where did it come from, what capabilities does it expose, what diagnostics are reported, and which related channel surfaces can be opened safely.

The current contract is inventory-only:

1. Inventory: `DeckGoPluginInventoryEntry[]` from `GET /api/deck/plugins`.
2. Channel handoff context: `GET /api/channels`.
3. Manifest: synthetic read-only projection from the inventory payload only.
4. Audit: activation evidence from inventory fields only.

Anything that would change runtime state, including install, uninstall, enable, disable, reload, marketplace trust, or package signature verification, is explicitly out of scope until a real contract supports it.

## Contract truth

- BFF endpoint: `GET /api/deck/plugins` and `GET /api/deck/plugins?capability=all`
- Gateway method: `deck.plugins.list`
- Cross-link endpoint: `GET /api/channels`
- DTO authority: `DeckGoPluginInventoryEntry`, `DeckGoPluginActionCapabilities`, `DeckGoPluginDiagnostic`, `DeckGoPluginsListResponse`
- Browser code must call Go BFF wrappers only. It must never call Gateway directly.
- No current BFF route exists for per-plugin manifest projection, activation audit projection, install/enable/reload mutation, marketplace metadata, trust-source metadata, or package-signature verification.
- Code truth wins over this handoff package if drift is found later.

## How to implement

1. Open `prototype.html` to review list, filters, detail tabs, dialogs, and state demos.
2. Read `components.md`, `states.md`, and `interactions.md` for intended UI behaviors.
3. Read `api-usage.md` for route truth and unsupported assumptions.
4. In production, translate only contract-backed behavior. Render unsupported manifest/audit/lifecycle behavior as degraded or follow-up evidence.
5. Keep all literal strings in `frontend-new/src/i18n/{en,zh}.json`.

## Open questions / follow-ups

- Manifest projection scope: no route exists today. A future proposal can add a BFF projection endpoint.
- Activation audit retention: no route exists today. A future proposal should define retention and pagination.
- Diagnostic level set: current contract uses open `string`; unknown levels should render without breaking filters.
- Origin/capability enums: current contract is open; unknown values should render as text and remain searchable.

## File inventory (v2)

```
plugins/
├── README.md
├── prototype.html
├── prototype-v1-codex.html
├── app.jsx
├── list-view.jsx
├── detail-view.jsx
├── dialogs.jsx
├── data.js
├── icons.jsx
├── styles.css
├── tokens.css
├── tweaks-panel.jsx
├── components.md
├── states.md
├── interactions.md
├── api-usage.md
└── implementation-notes.md
```

## Reverse sign-off

Implemented in `frontend-new/src/components/panels/plugins/` with L1 mock visual coverage and bounded L2 real-stack inventory evidence.

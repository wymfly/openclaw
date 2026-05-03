# Plugins (Workbench)

**Status**: revised v2 — pending implementation
**Design completed**: 2026-05-04
**Designer**: design agent (Claude)
**Depends on atoms**: Pill, Badge, Tag, Button, IconButton, Modal, Tabs, KbdHint, Avatar, EmptyState
**Depends on canonical patterns**: PageShell, SectionHeader, EmptyState
**Depends on canonical icons**: IconSearch, IconFilter, IconChevronRight/Left, IconChannel, IconTool,
IconAgent, IconProvider, IconBundled, IconExtension, IconCheck, IconX, IconAlert, IconInfo,
IconErrorCircle, IconRefresh, IconSettings, IconCopy, IconCode, IconClock, IconBookOpen,
IconLink, IconShield, IconKbd
**New atoms needed**: none — all plugin-specific molecules (`origin-pill`, `cap-chip`, `chain__node`,
`event-pill`) are local prototype CSS only; they map to existing atoms in production
**New tokens needed**: none — uses canonical `--ds-*` from
`frontend-handoff/design-system/tokens.css`
**Backend endpoints used**: see `api-usage.md` (Deck plugin inventory + BFF projections)

## What this module does

Read-only inventory + diagnostics workbench for the plugins discovered by Deck Gateway. The
panel is the operator's view of "what's installed, where it came from, what it exposes, is it
healthy?" — not a marketplace and not a config editor.

The Deck plugin contract is read-only (no install / uninstall / enable mutation). The workbench
therefore leans on three projections:

1. **Inventory** — `DeckGoPluginInventoryEntry[]` from the Gateway-backed BFF.
2. **Manifest** — BFF-projected manifest preview (curated; bundled core + selected extensions).
3. **Audit** — BFF-projected activation timeline (config history + diagnostics replay).

Anything that would change runtime state (install, enable, disable, reload, sign verification) is
explicitly out of scope until the Gateway contract supports it; today the panel is observation only.

## How to implement

1. Open `prototype.html` in a browser and walk through:
   - List view → use the search box, capability segmented control, origin filter, scope toggle
   - Click any row → inspect the 6-tab detail (Overview / Capabilities / Diagnostics / Activation
     / Manifest / Audit)
   - Open the Tweaks panel (top-right pill) and exercise list-state / detail-state / dialog state
2. Read `components.md` — production component skeleton + props shapes.
3. Read `states.md` — view routing, list states, per-tab states, focus management, a11y.
4. Read `interactions.md` — pointer / keyboard / hover / empty / error / dialog flows.
5. Read `api-usage.md` — endpoint truth, DTO shapes, BFF projections, open assumptions.
6. Translate each `.jsx` file to TypeScript at the production target listed in `components.md`,
   replacing the prototype's `__fixtures__` mock with real data hooks. Keep kebab-case classes
   verbatim — the visual contract lives in the class names.

## Open questions for Claude Code

- **Manifest projection scope.** The prototype assumes BFF projects manifests for bundled core +
  curated extensions only. If projection is per-plugin (every entry gets a manifest) the empty
  fallback in the Manifest tab can go.
- **Activation audit retention.** BFF-side audit retention window is unspecified. Prototype shows
  an unbounded list; production should add pagination or a "show older" gate once we know the cap.
- **Diagnostic level set.** Contract uses `level: string` (open). Prototype groups into
  `error / warn / info`. Any other levels surfaced by Gateway should be co-grouped under `info`
  with a flag, and we should propose a Gateway-side enum back upstream.

## File inventory (v2)

```
plugins/
├── README.md                    ← this file
├── prototype.html               ← ~30-line shell loading external .jsx via Babel standalone
├── prototype-v1-codex.html      ← preserved V1 single-file prototype (reference, not implemented)
├── app.jsx                      ← App shell + list↔detail routing + Tweaks panel + ⌘K/⌘R/Esc
├── list-view.jsx                ← KPI strip + toolbar + 7-col rows + ready/loading/error/empty
├── detail-view.jsx              ← Hero + 6 tabs (Overview/Capabilities/Diagnostics/Activation/Manifest/Audit)
├── dialogs.jsx                  ← DiagnosticDetailDialog + ManifestPreviewDialog + RawJsonDialog
├── data.js                      ← contract-shaped MOCK with 12 plugins + manifests + timelines
├── icons.jsx                    ← 24 SVG icons + PluginGlyph (origin-aware avatar)
├── styles.css                   ← Linear-inspired, --ds-* tokens only, dark/light + density-aware
├── tokens.css                   ← mirror copy of canonical tokens (drift-checked)
├── tweaks-panel.jsx             ← shared design-time tooling
├── components.md                ← production component skeleton + props shapes
├── states.md                    ← state machine + focus + a11y semantics
├── interactions.md              ← keyboard / pointer / hover / dialog flows
└── api-usage.md                 ← endpoint truth + DTO shapes + BFF projections + assumptions
```

## Reverse sign-off

(pending Claude Code implementation in `frontend-new/src/components/panels/plugins/`)

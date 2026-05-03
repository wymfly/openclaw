# plugins — components

> v2 multi-file handoff. Engineering target is
> `frontend-new/src/components/panels/plugins/`.

## Production component skeleton

```
PluginsPanel
  └── (route) → PluginsListView
                 ├── PluginsToolbar (search + capability seg + origin seg + scope seg)
                 ├── PluginsKpiStrip
                 └── PluginListRow[]
                      ├── PluginGlyph (origin-aware avatar)
                      ├── PluginCapabilityChips
                      ├── OriginPill
                      └── StatusPill
  └── (route) → PluginsDetailView
                 ├── DetailHero (glyph + name + version + status pills + actions)
                 ├── PluginTabsBar
                 └── (tab body)
                      ├── TabOverview
                      ├── TabCapabilities
                      ├── TabDiagnostics
                      ├── TabActivation
                      ├── TabManifest
                      └── TabAudit
  └── PluginDialogs
       ├── DiagnosticDetailDialog
       ├── ManifestPreviewDialog
       └── RawJsonDialog
```

## Prototype file → production target

| Prototype file     | Production target                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `app.jsx`          | `PluginsPanel.tsx`                                                                         |
| `list-view.jsx`    | `PluginsListView.tsx` + `PluginListRow.tsx` + `PluginsKpiStrip.tsx` + `PluginsToolbar.tsx` |
| `detail-view.jsx`  | `PluginsDetailView.tsx` + 6 tab modules (`TabOverview.tsx`, …, `TabAudit.tsx`)             |
| `dialogs.jsx`      | `dialogs/DiagnosticDetailDialog.tsx` + `ManifestPreviewDialog.tsx` + `RawJsonDialog.tsx`   |
| `data.js`          | `__fixtures__/plugins.fixture.ts`                                                          |
| `icons.jsx`        | `@/design-system/icons` re-exports + `PluginGlyph.tsx` local                               |
| `styles.css`       | per-component `.css` files (kebab-case)                                                    |
| `tokens.css`       | dropped (canonical lives in `frontend-new/src/design-system/tokens/`)                      |
| `tweaks-panel.jsx` | dropped (design-time tooling only)                                                         |

## Props (shape contracts)

### PluginsListView

```ts
interface PluginsListViewProps {
  plugins: PluginInventoryEntry[]; // from DeckGoPluginsListResponse.plugins
  selectedId: string | null;
  listState: "ready" | "loading" | "error" | "empty";
  searchQuery: string;
  filter: "all" | "channel" | "tool" | "agent" | "provider";
  scope: "all" | "channel";
  origin: "all" | "bundled" | "extension";
  asOfMs: number;
  runtimeId: string;
  onSearch: (q: string) => void;
  onFilter: (f: PluginsCapabilityFilter) => void;
  onScope: (s: "all" | "channel") => void;
  onOrigin: (o: "all" | "bundled" | "extension") => void;
  onSelect: (pluginId: string) => void;
  onRefresh: () => void;
}

interface PluginInventoryEntry extends DeckGoPluginInventoryEntry {
  // pure pass-through; no client-side projection at the row level
}
```

### PluginListRow

```ts
interface PluginListRowProps {
  plugin: PluginInventoryEntry;
  selected: boolean;
  onSelect: (id: string) => void;
}
```

7 columns: glyph, id+meta + `implicit` badge if implicit, capability chips, exposed counts
(channels / tools / providers), origin pill, diagnostic counts (err / warn), status pill, chev.

### PluginsDetailView

```ts
interface PluginsDetailViewProps {
  plugin: PluginInventoryEntry;
  manifest?: ProjectedManifest | null;
  timeline?: ActivationEvent[];
  detailState: "ready" | "loading" | "error";
  activeTab: PluginTabId;
  onTabChange: (tab: PluginTabId) => void;
  onBack: () => void;
  onViewRaw: () => void;
  onViewManifest: () => void;
  onOpenDiagnostic: (d: DeckGoPluginDiagnostic) => void;
}

type PluginTabId =
  | "overview"
  | "capabilities"
  | "diagnostics"
  | "activation"
  | "manifest"
  | "audit";
```

### Tab modules

Each tab consumes a slice of the `PluginInventoryEntry` (and, for Manifest / Audit, the BFF
projection) and renders its section. State and focus rules in `states.md`; key flows in
`interactions.md`.

### Dialogs

| Dialog                   | Props                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `DiagnosticDetailDialog` | `{ open, plugin, diagnostic, onClose }` — full message + level + remediation hint                                  |
| `ManifestPreviewDialog`  | `{ open, plugin, manifest, onClose }` — projected manifest JSON, copyable; fallback banner when `manifest` is null |
| `RawJsonDialog`          | `{ open, plugin, onClose }` — raw `DeckGoPluginInventoryEntry` JSON, debug-shaped                                  |

## Class naming

Production should keep prototype kebab-case classes:

- `.list-view` / `.kpi-strip` / `.kpi`
- `.toolbar` / `.toolbar__search` / `.seg` / `.seg__btn`
- `.row` / `.row--selected` / `.row--muted` / `.row__id` / `.row__counts` / `.row__diag`
- `.cap-chips` / `.cap-chip` / `.cap-chip--{channel|tool|agent|provider}`
- `.origin-pill` / `.origin-pill--{bundled|extension|unknown}`
- `.meta-pill` / `.meta-pill--implicit`
- `.diag-count` / `.diag-count--err` / `.diag-count--warn`
- `.detail` / `.hero` / `.tabs` / `.tab` / `.tab--active`
- `.section` / `.section--{cap|diag|act|manifest|audit}`
- `.field-grid` / `.field-row` / `.field-row__label` / `.field-row__value`
- `.cap-strip` / `.cap-tile` / `.cap-tile__num`
- `.deck-action-grid` / `.deck-action` / `.deck-action.is-on`
- `.diag-group` / `.diag-list` / `.diag-row` / `.diag-row__msg`
- `.chain` / `.chain__node` / `.chain__node--ok` / `.chain__node--off` / `.chain__edge`
- `.timeline` / `.timeline__row` / `.timeline__row--{activated|imported|error|diagnostic|config-edit}`
- `.event-pill` / `.event-pill--{activated|imported|error|diagnostic|config-edit}`
- `.banner` / `.banner--info` / `.banner--muted`
- `.modal-backdrop` / `.modal` / `.modal--{diag|manifest|raw}` / `.modal__head/body/foot`
- `.code-block` / `.diag-block` / `.chip-list` / `.chip-item`
- `.pill` / `.pill--{ok|warn|err|info|muted}`

## Accessibility

- Inventory rows: `role="button"`, `tabIndex={0}`, `onKeyDown` for Enter/Space → select.
- Capability filter / origin filter / scope filter: `role="tablist"` + `role="tab"` +
  `aria-selected` (segmented controls behave as tab strips).
- Tabs in detail: `role="tablist"` + `role="tab"` + `aria-selected`.
- Modals: `role="dialog"` + `aria-modal="true"` + `aria-label`. Focus trap and Esc close.
- Status pills, diagnostic counts, capability chips: always carry text label; color is decoration.
- The activation chain conveys state with both icon and text — color alone is not load-bearing.

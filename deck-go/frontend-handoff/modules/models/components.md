# models — components

> v2 multi-file handoff. Engineering target is
> `frontend-new/src/components/panels/models/`.

## Production component skeleton

```
ModelsPanel
  └── (route) → ModelsListView
                 ├── ModelsToolbar (search + filter + add-button)
                 ├── ModelsKpiStrip
                 └── ProviderSection[]
                      ├── ProviderSectionHeader (glyph + status)
                      └── ModelRow[]
  └── (route) → ModelsDetailView
                 ├── DetailHero (provider glyph + model id + status pills)
                 ├── ModelTabsBar
                 └── (tab body)
                      ├── TabOverview
                      ├── TabLimits
                      ├── TabPricing
                      ├── TabUsage
                      ├── TabAuth
                      └── TabAudit
  └── ModelDialogs
       ├── ProbeResultDialog
       ├── AuthConfigDialog
       └── CatalogDialog (add model from provider catalog)
```

## Prototype file → production target

| Prototype file     | Production target                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `app.jsx`          | `ModelsPanel.tsx`                                                                        |
| `list-view.jsx`    | `ModelsListView.tsx` + `ProviderSection.tsx` + `ModelRow.tsx` + `ProviderStatusPill.tsx` |
| `detail-view.jsx`  | `ModelsDetailView.tsx` + 6 tab modules                                                   |
| `dialogs.jsx`      | `dialogs/ProbeResultDialog.tsx` + `AuthConfigDialog.tsx` + `CatalogDialog.tsx`           |
| `data.js`          | `__fixtures__/models.fixture.ts`                                                         |
| `icons.jsx`        | `@/design-system/icons` re-exports + provider glyph local                                |
| `styles.css`       | per-component `.css` files (kebab-case)                                                  |
| `tokens.css`       | dropped (canonical lives in `frontend-new/src/design-system/tokens/`)                    |
| `tweaks-panel.jsx` | dropped (design-time tooling only)                                                       |

## Props (shape contracts)

### ModelsListView

```ts
interface ModelsListViewProps {
  models: RuntimeConfiguredModel[]; // shaped from DeckGoRuntimeConfiguredModelsResponse
  listState: "ready" | "loading" | "error" | "empty";
  searchQuery: string;
  filter: "all" | "default" | "fallback" | "reasoning" | "local";
  onSearch: (q: string) => void;
  onFilter: (f: ModelsListFilter) => void;
  onSelect: (modelId: string) => void;
  onCatalogClick: () => void;
}

interface RuntimeConfiguredModel {
  id: string;
  provider: string;
  family: string;
  displayName: string;
  contextWindow: number;
  maxTokens: number;
  reasoning?: boolean;
  isDefault?: boolean;
  fallback?: boolean;
  local?: boolean;
  lastUsedMs?: number | null;
}
```

### ModelRow

```ts
interface ModelRowProps {
  model: RuntimeConfiguredModel;
  probe?: DeckGoModelProbeResponse["payload"];
  perModelCost?: { in: number; out: number; requests: number };
  selected: boolean;
  onSelect: (id: string) => void;
}
```

7 columns: provider glyph, id+meta + role pills, context window, max
tokens, probe pill, 24h spend, status pill.

### ModelsDetailView

```ts
interface ModelsDetailViewProps {
  model: RuntimeConfiguredModel;
  detailState: "ready" | "loading" | "error";
  activeTab: ModelTabId;
  onTabChange: (tab: ModelTabId) => void;
  onBack: () => void;
  onProbe: () => void;
  onAuthConfig: () => void;
}

type ModelTabId = "overview" | "limits" | "pricing" | "usage" | "auth" | "audit";
```

### TabOverview / TabLimits / TabPricing / TabUsage / TabAuth / TabAudit

Each consumes data from `MOCK` (or production: `useModelsConfig()` +
`useAuthOverview()` + `useUsageCost()` selectors) and renders the
relevant section. See `data.js` for shape; see `interactions.md` for
state behavior.

### Dialogs

| Dialog              | Props                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| `ProbeResultDialog` | `{ open, model, onClose }` — KPI tiles for ok probe; warn banner for cooldown/error.                      |
| `AuthConfigDialog`  | `{ open, provider, onClose, onSave }` — segmented authType (apiKey/oauth/profile/none) + per-type fields. |
| `CatalogDialog`     | `{ open, onClose, onAdd(modelId) }` — two-pane: provider list (left) + model cards (right).               |

## Class naming

Production should keep prototype kebab-case classes:

- `.list-view` / `.kpi-strip` / `.kpi`
- `.provider-section` / `.provider-section__head` / `.provider-section__title`
- `.row` / `.row.is-default` / `.row__id` / `.row__num`
- `.detail__head` / `.hero` / `.hero__title` / `.hero__meta`
- `.tabs` / `.tab`
- `.section` / `.section__head` / `.section__title`
- `.tile-row` / `.tile`
- `.quota` / `.quota__head` / `.quota__bar` / `.quota__fill`
- `.auth-list` / `.auth-row` / `.auth-row__main`
- `.pricing` / `.pricing__cell`
- `.chain` / `.chain__node` / `.chain__node--default`
- `.audit-list` / `.audit-row`
- `.catalog-grid` / `.catalog-card`
- `.modal-backdrop` / `.modal` / `.modal__head` / `.modal__body` / `.modal__foot`
- `.pill` / `.pill--ok|warn|err|info|muted`

## Accessibility

- Inventory rows: `role="button"`, `tabIndex={0}`, `onKeyDown` for
  Enter/Space.
- Tabs: `role="tablist"` + `role="tab"` + `aria-selected`.
- Modals: `role="dialog"` + `aria-modal="true"` + `aria-label`.
- Quota bars: engineering adds `role="meter"` with `aria-valuenow`,
  `aria-valuemax`.
- Status pills always carry text label; color is decoration.

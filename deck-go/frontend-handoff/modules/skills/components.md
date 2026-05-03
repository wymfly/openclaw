# skills — components

> v2 multi-file handoff. Engineering target is
> `frontend-new/src/components/panels/skills/`.

## Production component skeleton

```
SkillsPanel
  └── (route) → SkillsListView
                 ├── SkillsToolbar (mode seg + search + status seg + source seg)
                 ├── SkillsKpiStrip
                 └── (mode = installed) InstalledRow[]
                      ├── SkillGlyph (emoji + source tint)
                      ├── SourcePill
                      └── StatusPill
                 └── (mode = hub) HubResultRow[]
                      ├── HubRowMeta (slug + version + score)
                      └── { PreviewButton, InstallButton }
  └── (route) → SkillsDetailView
                 ├── DetailHero (glyph + name + status + source + actions)
                 ├── SkillTabsBar
                 └── (tab body)
                      ├── TabOverview
                      ├── TabSetup
                      ├── TabTriggers
                      ├── TabBins
                      ├── TabFiles
                      └── TabAudit
  └── SkillDialogs
       ├── InstallFromHubDialog
       ├── ConfigureSkillDialog
       ├── DisableConfirmDialog
       └── SkillReadmeDialog
```

## Prototype file → production target

| Prototype file     | Production target                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `app.jsx`          | `SkillsPanel.tsx`                                                                                                      |
| `list-view.jsx`    | `SkillsListView.tsx` + `InstalledRow.tsx` + `HubResultRow.tsx` + `SkillsKpiStrip.tsx` + `SkillsToolbar.tsx`            |
| `detail-view.jsx`  | `SkillsDetailView.tsx` + 6 tab modules (`TabOverview.tsx`, …, `TabAudit.tsx`)                                          |
| `dialogs.jsx`      | `dialogs/InstallFromHubDialog.tsx` + `ConfigureSkillDialog.tsx` + `DisableConfirmDialog.tsx` + `SkillReadmeDialog.tsx` |
| `data.js`          | `__fixtures__/skills.fixture.ts`                                                                                       |
| `icons.jsx`        | `@/design-system/icons` re-exports + `SkillGlyph.tsx` local                                                            |
| `styles.css`       | per-component `.css` files (kebab-case)                                                                                |
| `tokens.css`       | dropped (canonical lives in `frontend-new/src/design-system/tokens/`)                                                  |
| `tweaks-panel.jsx` | dropped (design-time tooling only)                                                                                     |

## Props (shape contracts)

### SkillsListView

```ts
interface SkillsListViewProps {
  mode: "installed" | "hub";
  installed: SkillEntry[]; // from DeckGoSkillsResponse.skills
  hub: SkillHubSearchResult[]; // from DeckGoSkillHubSearchResponse.results
  selectedKey: string | null;
  listState: "ready" | "loading" | "error" | "empty";
  searchQuery: string;
  filter: "all" | "ready" | "needs-setup" | "disabled";
  source: "all" | "bundled" | "managed" | "plugin";
  asOfMs: number;
  runtimeId: string;
  onMode: (m: "installed" | "hub") => void;
  onSearch: (q: string) => void;
  onFilter: (f: SkillsStatusFilter) => void;
  onSource: (s: SkillsSourceFilter) => void;
  onSelect: (key: string) => void;
  onRefresh: () => void;
  onHubInstall: (slug: string) => void;
  onHubPreview: (slug: string) => void;
}

interface SkillEntry extends DeckGoSkillEntry {
  // pure pass-through
}

interface SkillHubSearchResult extends DeckGoSkillHubSearchResult {
  // pure pass-through
}
```

### InstalledRow

```ts
interface InstalledRowProps {
  skill: SkillEntry;
  selected: boolean;
  onSelect: (key: string) => void;
}
```

7 columns (rendered via grid): glyph, name+key+env, description, source pill, config-count,
unmet-requirement count, status pill, chev.

### HubResultRow

```ts
interface HubResultRowProps {
  result: SkillHubSearchResult;
  onInstall: (slug: string) => void;
  onPreview: (slug: string) => void;
}
```

### SkillsDetailView

```ts
interface SkillsDetailViewProps {
  skill: SkillEntry;
  triggers: string[]; // BFF projection
  files: SkillFile[]; // BFF projection
  audit: SkillAuditEvent[]; // BFF projection
  detailState: "ready" | "loading" | "error";
  activeTab: SkillTabId;
  onTabChange: (tab: SkillTabId) => void;
  onBack: () => void;
  onConfigure: () => void;
  onDisable: () => void;
  onEnable: () => void;
  onOpenFiles: () => void;
}

type SkillTabId = "overview" | "setup" | "triggers" | "bins" | "files" | "audit";
```

### Dialogs

| Dialog                 | Props                                                                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `InstallFromHubDialog` | `{ open, hubResult, hubDetail, hubBins, onClose, onInstalled }` — radio install option (managed/local), bins preview, 3-phase progress (idle/running/done/error) |
| `ConfigureSkillDialog` | `{ open, skill, onClose, onSave }` — free-form key/value editor over `skill.config`; submits via `PATCH /api/deck/skills/<key>`                                  |
| `DisableConfirmDialog` | `{ open, skill, onCancel, onConfirm }` — copy adapts based on `skill.source` (managed copy mentions PATH cleanup)                                                |
| `SkillReadmeDialog`    | `{ open, skill, files, onClose }` — file inventory with SKILL.md highlighted as primary                                                                          |

## Class naming

Production should keep prototype kebab-case classes:

- `.list-view` / `.kpi-strip` / `.kpi`
- `.toolbar` / `.toolbar__search` / `.seg` / `.seg__btn`
- `.row` / `.row--selected` / `.row--muted` / `.row__id` / `.row__desc` / `.row__status` / `.row__chev`
- `.hub-list` / `.hub-row` / `.hub-row__title` / `.hub-row__summary` / `.hub-row__score` / `.hub-row__actions`
- `.source-pill` / `.source-pill--{bundled|managed|plugin}`
- `.meta-pill` / `.meta-pill--off`
- `.detail` / `.hero` / `.tabs` / `.tab` / `.tab--active`
- `.section` / `.field-grid` / `.field-row` / `.field-row__label`
- `.empty-block` / `.empty-block--ok`
- `.banner` / `.banner--{info|muted|success|global}`
- `.checklist` / `.checklist__row` / `.checklist__row--unmet`
- `.trigger-grid` / `.trigger-chip`
- `.install-option-card` / `.install-option-card__head` / `.install-option-card__title`
- `.chip-list` / `.chip-item` / `.chip-item--{bin|cfg|req}`
- `.files-table` / `.files-row` / `.files-row--primary`
- `.timeline` / `.timeline__row` / `.timeline__row--{installed|updated|needs-setup|disabled}`
- `.event-pill` / `.event-pill--{installed|updated|needs-setup|disabled}`
- `.modal-backdrop` / `.modal` / `.modal--{install|configure|readme|confirm}`
- `.install-options` / `.install-option` / `.install-option.is-active`
- `.install-progress` / `.install-error` / `.install-done`
- `.config-list` / `.config-row` / `.input` / `.input--mono`
- `.pill` / `.pill--{ok|warn|err|info|muted}`
- `.btn` / `.btn--{ghost|primary|danger|danger-ghost}`

## Accessibility

- Inventory rows: `role="button"`, `tabIndex={0}`, `onKeyDown` for Enter/Space → select.
- Mode / status / source segmented controls: `role="tablist"` + `role="tab"` + `aria-selected`.
- Detail tabs: same.
- Dialogs: `role="dialog"` + `aria-modal="true"` + `aria-label`. Focus trap; Esc closes.
- Status, source, event pills always carry text — color is decoration.
- Install wizard: live region (`aria-live="polite"`) on the progress / error / done block.
- Configure dialog inputs labeled with explicit `aria-label`; key + value treated as paired
  input groups.
- Setup checklist rows announce `unmet requirement: <text>` for screen readers (production: wrap
  bullet + msg in a `<li>` with explicit `<ul role="list">`).

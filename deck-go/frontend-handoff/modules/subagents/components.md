# subagents — components

> v2 multi-file handoff. Engineering target is
> `frontend-new/src/components/panels/subagents/`.

## Production component skeleton

```
SubagentsPanel
  └── (route) → SubagentsListView
                 ├── SubagentsToolbar (mode seg + search + status seg + spawn-mode seg)
                 ├── SubagentsKpiStrip
                 └── (mode = runs) RunRow[]
                      ├── AgentGlyph (child)
                      ├── ParentRow (mini AgentGlyph + name)
                      ├── ModePill
                      └── StatusPill
                 └── (mode = permissions) PermissionRow[]
                      ├── AgentGlyph (agent)
                      ├── PolicyPill (allowAny | allow-list)
                      └── CapsBlock (depth + children + thinking)
  └── (route) → SubagentsDetailView
                 ├── DetailHero (child glyph + name + status + parent + actions)
                 ├── SubagentTabsBar
                 └── (tab body)
                      ├── TabOverview
                      ├── TabLineage (recursive tree of LineageNode)
                      ├── TabOutcome
                      ├── TabPermissions
                      ├── TabAudit
                      └── TabRaw
  └── SubagentDialogs
       ├── KillRunDialog
       ├── SteerRunDialog
       ├── PermissionsDialog
       └── RunOutcomeDialog
```

## Prototype file → production target

| Prototype file     | Production target                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `app.jsx`          | `SubagentsPanel.tsx`                                                                                            |
| `list-view.jsx`    | `SubagentsListView.tsx` + `RunRow.tsx` + `PermissionRow.tsx` + `SubagentsKpiStrip.tsx` + `SubagentsToolbar.tsx` |
| `detail-view.jsx`  | `SubagentsDetailView.tsx` + 6 tab modules + `LineageNode.tsx`                                                   |
| `dialogs.jsx`      | `dialogs/KillRunDialog.tsx` + `SteerRunDialog.tsx` + `PermissionsDialog.tsx` + `RunOutcomeDialog.tsx`           |
| `data.js`          | `__fixtures__/subagents.fixture.ts`                                                                             |
| `icons.jsx`        | `@/design-system/icons` re-exports + `AgentGlyph.tsx` local                                                     |
| `styles.css`       | per-component `.css` files (kebab-case)                                                                         |
| `tokens.css`       | dropped (canonical lives in `frontend-new/src/design-system/tokens/`)                                           |
| `tweaks-panel.jsx` | dropped (design-time tooling only)                                                                              |

## Props (shape contracts)

### SubagentsListView

```ts
interface SubagentsListViewProps {
  mode: "runs" | "permissions";
  runs: SubagentRun[]; // from DeckGoSubagentsListResponse.runs
  agentConfigs: Record<string, AgentSubagentConfig>;
  allAgents: Array<{ id: string; name?: string }>;
  selectedRunId: string | null;
  listState: "ready" | "loading" | "error" | "empty";
  searchQuery: string;
  filter: "all" | "running" | "succeeded" | "failed" | "killed" | "stalled";
  spawnMode: "all" | "blocking" | "background";
  asOfMs: number;
  runtimeId: string;
  onMode: (m: "runs" | "permissions") => void;
  onSearch: (q: string) => void;
  onFilter: (f: SubagentsStatusFilter) => void;
  onSpawnMode: (s: SubagentsSpawnFilter) => void;
  onSelect: (runId: string) => void;
  onEditPermissions: (agentId: string) => void;
  onRefresh: () => void;
}

interface SubagentRun extends DeckGoSubagentRun {}
interface AgentSubagentConfig extends DeckGoAgentSubagentConfigResponse {}
```

### RunRow

```ts
interface RunRowProps {
  run: SubagentRun;
  selected: boolean;
  onSelect: (runId: string) => void;
}
```

8 columns: glyph, name+task (truncated), parent, model, spawn-mode pill, duration/live, status
pill, chev.

### PermissionRow

```ts
interface PermissionRowProps {
  agentId: string;
  config: AgentSubagentConfig;
  allAgentsCount: number;
  onEdit: (agentId: string) => void;
}
```

### SubagentsDetailView

```ts
interface SubagentsDetailViewProps {
  run: SubagentRun;
  lineage: SubagentLineage | null;
  parentConfig: AgentSubagentConfig | null;
  audit: SubagentAuditEvent[];
  allAgents: Array<{ id: string; name?: string }>;
  detailState: "ready" | "loading" | "error";
  activeTab: SubagentTabId;
  onTabChange: (tab: SubagentTabId) => void;
  onBack: () => void;
  onSteer: () => void;
  onKill: () => void;
  onViewOutcome: () => void;
  onSelectInLineage: (runId: string) => void;
  onEditPermissions: (agentId: string) => void;
}

type SubagentTabId = "overview" | "lineage" | "outcome" | "permissions" | "audit" | "raw";
```

### Dialogs

| Dialog              | Props                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| `KillRunDialog`     | `{ open, run, onCancel, onConfirm }` — copy explains the child session is terminated and partial work is lost |
| `SteerRunDialog`    | `{ open, run, onClose, onSteered }` — multiline message + dedup outcome (deduped or newRunId returned)        |
| `PermissionsDialog` | `{ open, agentId, config, allAgents, onClose, onSave }` — checkbox grid + allowAny + default model            |
| `RunOutcomeDialog`  | `{ open, run, onClose }` — pretty-prints the entire `DeckGoSubagentRun`; copy-to-clipboard                    |

## Class naming

Production should keep prototype kebab-case classes:

- `.list-view` / `.kpi-strip` / `.kpi`
- `.toolbar` / `.toolbar__search` / `.seg` / `.seg__btn`
- `.row` / `.row--selected` / `.row--permission`
- `.parent-row` / `.row__id-task` / `.row__perm-policy` / `.row__perm-caps` / `.row__perm-thinking`
- `.mode-pill` / `.mode-pill--{blocking|background}`
- `.meta-pill` / `.meta-pill--depth`
- `.cap-num` / `.time-mono`
- `.detail` / `.hero` / `.tabs` / `.tab` / `.tab--active`
- `.section` / `.field-grid` / `.field-row` / `.field-row__label`
- `.empty-block`
- `.banner` / `.banner--info`
- `.tree` / `.tree-children` / `.tree-node` / `.tree-node--{root|selected}` / `.tree-node__main`
- `.permission-grid` / `.permission-grid--readonly` / `.perm-row` / `.perm-row.is-{active|blocked|readonly|dimmed}`
- `.timeline` / `.timeline__row--{spawned|started|ended|kill|steer}`
- `.event-pill` / `.event-pill--{spawned|started|ended|kill|steer}`
- `.modal-backdrop` / `.modal` / `.modal--{confirm|steer|permissions|raw}`
- `.install-progress` / `.install-info` / `.install-done`
- `.input` / `.input--mono` / `.input--multi`
- `.pill` / `.pill--{ok|warn|err|info|muted}`
- `.btn` / `.btn--{ghost|primary|danger|danger-ghost}`

## Accessibility

- Run rows: `role="button"`, `tabIndex={0}`, Enter/Space activates.
- Mode / status / spawn-mode segments: `role="tablist"` + `role="tab"` + `aria-selected`.
- Detail tabs: same.
- Tree nodes: `role="treeitem"` + `aria-expanded` (production: prototype renders flat).
- Modals: `role="dialog"` + `aria-modal="true"` + `aria-label`. Focus trap + Esc close.
- Status / mode / event pills: always carry text; color is decoration only.
- Steer textarea labeled with `aria-label="Steering message"`.
- Permission checkboxes labeled with the peer's name + id; disabled checkboxes (when `allowAny`)
  carry `aria-disabled="true"` and visual dimming (no announcement contradiction).
- Live runs in lists / hero use `aria-live="polite"` so status flips are announced.

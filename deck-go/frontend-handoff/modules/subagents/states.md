# subagents — states

> View routing, list states, detail state, dialog state machines, focus, a11y.

## View routing

- `view = "list"` → `SubagentsListView`
- `view = "detail"` → `SubagentsDetailView`

The list has a **mode** dimension:

- `mode = "runs"` → operational live view (default)
- `mode = "permissions"` → per-agent allow-list config

Both `selectedRunId` and `selectedPermissionAgent` are preserved across `list↔detail` transitions.
Switching mode does not lose either.

## List states

| State     | Trigger                             | Renders                                |
| --------- | ----------------------------------- | -------------------------------------- |
| `ready`   | inventory fetch resolved with rows  | Toolbar + KPI strip + filtered rows    |
| `loading` | first fetch or manual refresh       | Spinner + "Loading subagent runs…"     |
| `error`   | BFF returned 5xx / network fail     | Error icon + retry button              |
| `empty`   | filter or search produces zero rows | Empty illustration + clear-filter hint |

### Filters that compose (runs mode)

- `searchQuery` — free text on runId + childAgentId/Name + requesterAgentId/Name + task + label + model.
- `filter` — status segmented: `all | running | succeeded | failed | killed | stalled`.
- `spawnMode` — segmented: `all | blocking | background`.

All AND-combined. Live runs (`running` / `stalled`) sort to the top.

### Permissions mode

- Search applies to `agentId` only (since each row is one parent agent).
- No status / spawn-mode filters (irrelevant pre-spawn).

## Detail states

| State     | Trigger                | Renders                                                                 |
| --------- | ---------------------- | ----------------------------------------------------------------------- |
| `ready`   | run found in inventory | Hero + tabs + active tab body                                           |
| `loading` | refetch initiated      | Hero (cached) + spinner panel below tabs                                |
| `error`   | BFF projection failed  | Hero (cached) + inline error panel; tab content from inventory still ok |

A missing runId (e.g., user navigated after a refresh removed the run) renders the list view as
a fallback.

## Per-tab state

| Tab           | Source                                    | Empty fallback                                                                       |
| ------------- | ----------------------------------------- | ------------------------------------------------------------------------------------ |
| `overview`    | inventory only                            | n/a — overview always renders                                                        |
| `lineage`     | BFF projection over `requesterSessionKey` | "No lineage projection available yet."                                               |
| `outcome`     | inventory.outcome                         | running → "Run is still in progress." banner; ended → "No outcome payload recorded." |
| `permissions` | agentConfigs[run.requesterAgentId]        | "No permission projection for <agentId> yet."                                        |
| `audit`       | BFF projection                            | "No audit projected for this run yet."                                               |
| `raw`         | inventory full DTO                        | n/a — always renders JSON                                                            |

## Dialog state machines

### KillRunDialog

Two-button confirm. No internal state.

### SteerRunDialog

```
idle ─[Send hint]─▶ running ─▶ done (outcome: { deduped | newRunId })
                              └─▶ user closes
       ─[Cancel]─▶ closed
```

State variables: `phase ∈ {idle | running | done}`, `draft` string, `outcome` ({ success,
dedupKey, deduped?, newRunId? } | null).

### PermissionsDialog

```
opened ─[Toggle peer]─▶ opened (draft.allowAgents mutated)
       ─[Toggle allowAny]─▶ opened (draft.allowAny mutated, peer rows dim)
       ─[Edit model]─▶ opened (draft.model mutated)
       ─[Save]─▶ saving ─▶ closed (parent applies onSave(draft))
       ─[Cancel]─▶ closed (draft discarded)
```

Draft initializes from `config` on every `open` true transition.

### RunOutcomeDialog

Pretty-print + copy-to-clipboard. No internal state besides the copy toast.

## Tweaks panel

Design-time only. Exposes:

- `theme` ∈ `dark | light`
- `density` ∈ `comfortable | compact`
- `view` ∈ `list | detail`
- `mode` ∈ `runs | permissions`
- `listState` ∈ `ready | loading | error | empty`
- `selectedRun` (any runId in MOCK)
- `selectedPermissionAgent` (any agentId in MOCK.agentConfig)
- `activeTab` ∈ all 6 detail tabs
- `detailState` ∈ `ready | loading | error`
- `killOpen` / `steerOpen` / `permissionsOpen` / `outcomeOpen` ∈ booleans

Dropped at production translation.

## Focus

- List view first focusable: search input.
- After selecting a row → focus moves to back button in detail hero.
- After dismissing a dialog → focus returns to trigger.
- Esc:
  - In dialog → close dialog.
  - In detail (no dialog) → return to list.
  - In list → no-op.
- ⌘K → focus search input.
- ⌘P → switch to permissions mode.
- ⌘R → refresh.

## A11y semantics

- Mode / status / spawn-mode segments: `role="tablist"` + `role="tab"` + `aria-selected`.
- Detail tabs: same.
- Run rows: `role="button"`, `tabIndex={0}`, Enter/Space activates.
- Permission rows: not buttons (hover doesn't navigate); the Edit button is independently
  labeled.
- Modals: `role="dialog"` + `aria-modal="true"` + `aria-label`. Focus trap + Esc close.
- Status / mode pills: always carry text; color is decoration only.
- Live runs in row + hero use `aria-live="polite"` so a status flip from running → succeeded /
  killed is announced once.
- Permission checkbox grid: each label wraps the input + name + id; visible focus ring on the
  label, not the input.
- Steer textarea labeled with `aria-label="Steering message"`.
- Tree nodes (lineage tab): production should add `role="treeitem"` + `aria-level` + sequencing
  via `aria-setsize` / `aria-posinset`. Prototype uses semantic `<div>` with click + keyboard
  via parent's tab focus.

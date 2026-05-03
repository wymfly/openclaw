# skills — states

> View routing, list states, detail state, dialog state machines, focus, a11y.

## View routing

Two top-level views, page-transition (no split panel):

- `view = "list"` → `SkillsListView`
- `view = "detail"` → `SkillsDetailView`

The list view has an additional **mode** dimension:

- `mode = "installed"` → inventory list (default)
- `mode = "hub"` → marketplace search list

Mode is preserved across `list↔detail` transitions. Selected skill key + active tab are also
preserved so going back keeps your context.

## List states

| State     | Trigger                             | Renders                                |
| --------- | ----------------------------------- | -------------------------------------- |
| `ready`   | inventory or hub fetch resolved     | Toolbar + KPI strip + filtered rows    |
| `loading` | first fetch or manual refresh       | Spinner + "Loading skill inventory…"   |
| `error`   | BFF returned 5xx / network fail     | Error icon + retry button              |
| `empty`   | filter or search produces zero rows | Empty illustration + clear-filter hint |

`empty` reaches via two paths in installed mode (zero entries from BFF, or filters hide all rows)
and one path in hub mode (search returns zero).

### Filters that compose (installed mode only)

- `searchQuery` — free text on key + name + description + primaryEnv + source.
- `filter` — status segmented: `all | ready | needs-setup | disabled`.
- `source` — segmented: `all | bundled | managed | plugin`.

All AND-combined.

### Hub mode

- Search applies on `slug + displayName + summary`.
- No status/source filters (hub is pre-install, those dimensions don't exist yet).
- Hub rows show score from `DeckGoSkillHubSearchResult.score`.

## Detail states

| State     | Trigger                                      | Renders                                                                 |
| --------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| `ready`   | skill found in inventory                     | Hero + tabs + active tab body                                           |
| `loading` | refetch initiated                            | Hero (cached) + spinner panel below tabs                                |
| `error`   | BFF projection (triggers/files/audit) failed | Hero (cached) + inline error panel; tab content from inventory still ok |

A missing skill key (e.g., user navigates after a refresh that removed the skill) renders the
list view as a fallback.

## Per-tab state

| Tab        | Source                          | Empty fallback                                |
| ---------- | ------------------------------- | --------------------------------------------- |
| `overview` | inventory only                  | n/a (overview always renders)                 |
| `setup`    | inventory + missingRequirements | "Setup complete." success block when no unmet |
| `triggers` | BFF projection                  | "No trigger projection available" empty block |
| `bins`     | inventory.installOptions[]      | "No bins; SKILL.md trigger only" empty block  |
| `files`    | BFF projection                  | "File inventory unavailable" empty block      |
| `audit`    | BFF projection                  | "No audit projected" empty block              |

## Dialog state machines

### InstallFromHubDialog

```
idle ─[Install]─▶ running ─[ok]─▶ done ─[Open in inventory]─▶ closed (route to detail)
                            └─[fail]─▶ error ─[Retry install]─▶ running
                                              └─[Cancel/Close]─▶ closed
                  └─[Close while running]─▶ "Run in background" (closes dialog, leaves work pending)
```

State variables: `phase ∈ {idle | running | done | error}`, `optionId ∈ {managed | local}`,
`errorMsg`. State resets on every `open` transition false → true.

### ConfigureSkillDialog

```
opened ─[Add field]─▶ opened (draft++)
       ─[Edit value]─▶ opened (draft mutated)
       ─[Save]─▶ saving ─[ok]─▶ closed (parent applies onSave(draft))
       ─[Cancel]─▶ closed (draft discarded)
```

Draft is initialized from `skill.config` on every `open` true transition.

### DisableConfirmDialog

Two-button confirm. No internal state.

### SkillReadmeDialog

Renders `files` from BFF projection. No internal state.

## Tweaks panel

Design-time only. Exposes:

- `theme` ∈ `dark | light`
- `density` ∈ `comfortable | compact`
- `view` ∈ `list | detail`
- `mode` ∈ `installed | hub`
- `listState` ∈ `ready | loading | error | empty`
- `selectedSkill` (any installed skill key)
- `hubSelectedSlug` (any hub slug)
- `activeTab` ∈ all 6 skill tabs
- `detailState` ∈ `ready | loading | error`
- `installOpen` / `configureOpen` / `disableOpen` / `filesOpen` ∈ booleans

Dropped at production translation.

## Focus

- List view first focusable: search input.
- After selecting a row → focus moves to back button in detail hero.
- After dismissing a dialog → focus returns to trigger.
- Esc:
  - In dialog → close dialog.
  - In detail (no dialog) → return to list.
  - In list → no-op.
- ⌘K → focus search input regardless of mode.
- ⌘N → switch to hub mode.

## A11y semantics

- Mode / status / source segments: `role="tablist"` + `role="tab"` + `aria-selected`.
- Detail tabs: same.
- Inventory rows: `role="button"`, `tabIndex={0}`, Enter/Space activates.
- Hub rows: not buttons (the row itself isn't clickable); buttons are independently labeled.
- Modals: `role="dialog"` + `aria-modal="true"` + `aria-label`. Focus trap and Esc close.
- Status / source / event pills: always carry text; color is decoration only.
- Install wizard progress block: `aria-live="polite"`.
- Setup checklist: each row uses an `aria-live="polite"` region so flipping a requirement to
  satisfied announces "Setup complete." (production: not in prototype).
- Configure inputs: labeled with explicit `aria-label="Key"` / `"Value"` per row.

# skills — interactions

> Pointer, keyboard, hover, empty, error, and dialog flows.

## Keyboard

| Key                 | Context                  | Behavior                                                  |
| ------------------- | ------------------------ | --------------------------------------------------------- |
| `⌘K` / `Ctrl K`     | anywhere in the panel    | Focus search input in toolbar                             |
| `⌘N` / `Ctrl N`     | anywhere in the panel    | Switch to **Hub** list mode                               |
| `⌘R` / `Ctrl R`     | anywhere in the panel    | Refresh inventory (debounced 320ms; stays on `loading`)   |
| `Esc`               | detail view, no dialog   | Return to list view (preserves selected key + active tab) |
| `Esc`               | any open dialog          | Close dialog, focus the trigger                           |
| `Enter` / `Space`   | focused inventory row    | Activate row → navigate to detail                         |
| `Tab` / `Shift Tab` | within a dialog          | Cycle focus inside dialog (focus trap)                    |
| `Arrow keys`        | inside segmented control | Move active option (production: ARIA tablist)             |

Production must keep these. Prototype implements `⌘K`, `⌘N`, `⌘R`, `Esc`, and `Enter`/`Space`
row activation.

## Pointer

- **Installed rows** — full-row click → detail. Cursor `pointer`.
- **Hub rows** — row body is informational; **Preview** and **Install** buttons drive action.
  Hovering the row does not change cursor.
- **Toolbar search** — typing filters in real time; production should add ~120ms debounce on
  large inventories.
- **Mode segmented control** — single click swaps `installed` ↔ `hub`. Toolbar copy + filter
  set adapt accordingly.
- **Hero buttons** — Configure / Disable / Files / Enable directly open their respective dialog
  / mutate state.
- **Modal backdrop** — click outside the modal frame closes it.

## Hover

- **Installed rows** — background tint on hover; left border becomes accent on `:focus-visible`.
- **Hub rows** — visually static on hover (the action lives in the buttons).
- **Tabs** — text color brightens on hover; active tab carries the accent underline.
- **Install option radio cards** — entire card is clickable; hover lifts background.

## Empty / loading / error

| Scenario                              | UI                                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| `listState = "loading"` (installed)   | Centered spinner row with copy "Loading skill inventory…"                          |
| `listState = "loading"` (hub)         | Centered spinner row with copy "Searching hub…"                                    |
| `listState = "error"`                 | Error icon + headline + retry button (`onRefresh`)                                 |
| `listState = "empty"` (installed)     | Box icon + "No installed skills match." + clear-filter / switch-to-Hub hint        |
| `listState = "empty"` (hub)           | Cloud icon + "No hub results match." + broader-search hint                         |
| `detailState = "loading"`             | Hero remains visible; below it spinner row                                         |
| `detailState = "error"`               | Hero remains visible; inline error panel; tab content from inventory still renders |
| Setup tab — clean                     | Success block "Setup complete."                                                    |
| Setup tab — disabled, no requirements | Muted banner "No specific requirements reported."                                  |
| Triggers tab — no projection          | Empty block "No trigger projection available for this skill yet."                  |
| Bins tab — no install options         | Empty block "Skill exposes no bins. Invoked via SKILL.md trigger only."            |
| Files tab — no projection             | Empty block "File inventory projection is unavailable."                            |
| Audit tab — no events                 | Empty block "No audit projected for this skill yet."                               |

## Dialog flows

### InstallFromHubDialog

1. Open via Hub row's **Install** button or **Preview** button (Preview opens the same dialog,
   pre-staged).
2. Pick install option (`managed` default; `local` snapshots into the workspace).
3. Click **Install** → enter `running` phase. Spinner banner shows progress copy.
4. On success → `done` phase (success banner). Footer flips to single **Open in inventory**
   button → closes dialog, switches list mode to installed, opens detail.
5. On failure → `error` phase (red banner with reason). Footer's primary button becomes
   **Retry install**.
6. **Close while running** → keeps the install pending; UI shows a global success banner once
   the simulated install resolves.

### ConfigureSkillDialog

1. Opened from hero **Configure** or Setup tab CTA.
2. Draft initializes from `skill.config`.
3. **Add field** appends `newFieldN: ""`.
4. Editing key renames in-place; editing value updates value.
5. **Trash** icon removes a row.
6. **Save** → `saving` → resolves; parent applies the new config; dialog closes.

### DisableConfirmDialog

1. Open from hero **Disable** button.
2. Body copy adapts: managed skills mention "Hub-managed bins will be removed from PATH on next
   session start"; bundled / plugin skills get "soft toggle" copy.
3. **Cancel** / backdrop / Esc → close.
4. **Disable** (danger button) → simulated mutation; dialog closes.

### SkillReadmeDialog

1. Open from hero **Files** button (or Files tab "Open all" button).
2. Lists SKILL.md highlighted as primary, references below.
3. Each row has an "Open" external-link icon (production: opens the file in the IDE / editor).
4. **Close** (primary) → close.

## Tweaks-driven exploration

The Tweaks panel exposes:

- `mode` lets reviewers compare installed vs hub layouts without typing.
- `listState` exercises loading / error / empty.
- `detailState` exercises the cached hero with stale tab content.
- `selectedSkill` rotates through 12 mock skills covering every status + source combination.
- `hubSelectedSlug` chooses which hub result the install dialog seeds with.
- `activeTab` jumps to any of the 6 detail tabs.
- 4 dialog toggles open each dialog with the currently-selected skill.

In production these knobs disappear; corresponding state arrives from real fetch + selectors.

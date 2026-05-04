# Interactions

## Keyboard

| Key             | Where                                   | Action                                                |
| --------------- | --------------------------------------- | ----------------------------------------------------- |
| Tab / Shift+Tab | Topbar tabs → workspace                 | Standard focus rotation                               |
| Enter / Space   | Tab button (focused)                    | Switches active tab                                   |
| Enter / Space   | Tree node (focused)                     | Toggles directory or selects file                     |
| Enter           | Search input (focused, query non-empty) | Submits search (production: native form behavior)     |
| Esc             | Search input                            | Reserved (clear query — consistent with other panels) |
| Esc             | Dreams confirm row                      | Clears `pendingAction` (Cancel button focused)        |

## Hover & focus

| Element                           | Idle                            | Hover                                               | Active / on                                                     |
| --------------------------------- | ------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| Topbar tab                        | muted text + icon               | bg = `--ds-bg-elev2`; text = `--ds-text-primary`    | active tab gets accent bg + accent text + accent border         |
| Topbar health badge               | accent rose pill                | (no hover)                                          | always rendered when errCount > 0                               |
| Topbar errors KPI                 | muted                           | (no hover)                                          | rose color when errCount > 0                                    |
| File tree node (idle)             | text + folder/file icon (muted) | bg = `--ds-bg-elev2`                                | selected file gets accent left-border + accent bg + accent icon |
| Path-copy chip                    | mono background, muted icon     | bg = `--ds-bg-1`; border = `--ds-border-strong`     | "copied" label appears for 1400ms after click                   |
| Search input                      | placeholder visible             | (focus → border = accent)                           | focus = accent border                                           |
| Scope toggle button               | flat                            | text = `--ds-text-primary`                          | active gets accent bg + accent border                           |
| Search row                        | flat                            | border = `--ds-border-strong`                       | (no active state — pure read)                                   |
| Search row warn pill              | rose tinted                     | (no hover)                                          | always shown when LanceDB unavailable                           |
| Health KPI card                   | flat                            | (no hover)                                          | tone-tinted border (ok/warn/err) when applicable                |
| Health row                        | flat                            | (no hover)                                          | (no active state — table read)                                  |
| Dreams agent row                  | flat                            | bg = `--ds-bg-elev2`                                | active gets accent bg + accent border                           |
| Dreams action button (non-danger) | flat                            | bg = `--ds-bg-elev2`; border = `--ds-border-strong` | (disabled while running)                                        |
| Dreams action button (danger)     | rose-tinted text + icon         | bg + border slightly darker rose                    | (disabled while running)                                        |
| Confirm row                       | rose-tinted bg                  | (no hover — rendered as a single banner)            | only shown when `pendingAction !== null`                        |

## Animations

| Animation                        | Duration      | Where                  | Purpose                                                      |
| -------------------------------- | ------------- | ---------------------- | ------------------------------------------------------------ |
| Tab switch                       | 0ms (no fade) | Workspace content swap | Keep tab navigation snappy; tabs feel like first-class views |
| File tree expand/collapse        | 0ms           | Tree node toggle       | Snappy — large trees would suffer from animation             |
| Path-copy "copied" pulse         | 1400ms        | Path chip after click  | Confirms clipboard success                                   |
| Search "running" → results       | 260ms (mock)  | Search submit          | Visual feedback that the query is in flight                  |
| Dreams action "running" → result | 600ms (mock)  | Action button click    | Visual feedback for the action                               |
| Confirm row appearance           | 0ms           | When pendingAction set | Immediate; no delay before user can interact                 |

## Tab interactions

```
click tab "Browse"   → activeTab = "browse"; URL hash = "#/browse"
click tab "Search"   → activeTab = "search"; URL hash = "#/search"
click tab "Health"   → activeTab = "health"; URL hash = "#/health"
click tab "Dreams"   → activeTab = "dreams"; URL hash = "#/dreams"
```

Tab content state is preserved across switches. Switching tabs does NOT reset child component state (Browse keeps `expanded` + `selectedPath`; Search keeps `query` + `scope` + `response`; Dreams keeps `activeAgent`).

## Browse tab — file tree interactions

```
click chevron / directory row:
  if directory in expanded → collapse (remove from Set)
  else → expand (add to Set)
  → recursively render children from BROWSE_TREE[path]

click file row:
  selectedPath = file.path
  viewer renders markdown; breadcrumbs update
  (selectedPath persists across re-renders)

production: arrow keys for tree navigation (reserved for v2)
```

Visual depth indicator: each tree-row's `padding-left` = `8 + depth * 14` px. Chevron rotates from R to D when expanded.

## Browse tab — viewer interactions

```
breadcrumb segments are rendered from selectedPath split by "/"
  → each segment is a non-clickable span (production: clickable to scope-back)

path-copy chip:
  click → navigator.clipboard.writeText(selectedPath)
  → show "copied" badge for 1400ms
```

## Search tab — form interactions

```
type in input → query updated; phase resets to "idle"
clear (×) → query = ""; response = null; phase = "idle"; input refocused

scope toggle (3 buttons: All / Global only / Per-agent):
  click → scope = id; does NOT auto-rerun

submit button (or Enter on focused input → form onSubmit):
  if query.trim() === "" → no-op
  if phase === "running" → no-op (button disabled)
  → phase = "running" (button label changes to "Searching…")
  → 260ms (mock) → response set; phase = "done"
```

Production replaces the SEARCH_FIXTURES lookup with `POST /api/memory/search` and serializes scope per the contract:

- scope = "all" → omit scope param
- scope = "global" → send `scope: "global"`
- scope = "agent" → send `scope: "agent"` (production: also send `agentId` from a picker; prototype omits)

## Search tab — result row interactions

```
hover on row → border = --ds-border-strong (visual affordance, no click target)

production: click row → navigate to Browse tab with selectedPath = r.path
  (deferred to v3; v2 keeps tabs isolated)
```

## Health tab — interactions

The Health tab is read-only. No interactions in v2.

Production extras:

- Refresh button in the topbar actions (force re-poll)
- Click row → expand to show raw response payload (debug)

## Dreams tab — agent picker interactions

```
click agent row:
  activeAgent = agent.id
  pendingAction = null  (cancel any in-flight confirm)
  actionResult = null   (clear last action result)
```

The "last updated" muted text in each row reflects `DREAMS.diaries[agentId].updatedAtMs` formatted via `formatRelative`. If `found === false`, shows "no diary" instead.

## Dreams tab — action interactions

```
click non-danger action (read / backfill / dedupe / repair):
  actionResult = null
  running = true
  → 600ms (mock) → set fakeResults[id]; running = false

click danger action (resetShortTerm / reset):
  pendingAction = action  (CONFIRM ROW APPEARS)

confirm row:
  Confirm → runAction(pendingAction.id) → same as non-danger flow
  Cancel → pendingAction = null

while running:
  all action buttons disabled
  topbar KPI count and tab indicator unchanged (action is local to this tab)
```

The 6 action types map directly to `DeckGoMemoryDreamAction`:

| Button label     | Action id (DTO)  | Danger                 |
| ---------------- | ---------------- | ---------------------- |
| Read             | `read`           | no                     |
| Backfill         | `backfill`       | no                     |
| Dedupe           | `dedupe`         | no                     |
| Repair           | `repair`         | no                     |
| Reset short-term | `resetShortTerm` | YES — confirm required |
| Reset all        | `reset`          | YES — confirm required |

## Cross-section coupling

| Source                    | Affects                                                  | How                                                     |
| ------------------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| Tab switch                | activeTab + URL hash + workspace render                  | Single state mutation                                   |
| Browse: select file       | viewer content                                           | Single state mutation; tree paint preserved             |
| Browse: copy path         | clipboard + transient "copied" badge                     | Async clipboard call (silently catches errors)          |
| Search: submit            | results overlay + KPI invariant (file count unchanged)   | Pure function over fixture                              |
| Search: change scope      | (no auto-re-run)                                         | Manual re-run gate                                      |
| Health: (read-only in v2) | no upstream effect                                       | —                                                       |
| Dreams: pick agent        | diary content + clear pendingAction + clear actionResult | Cascaded state reset                                    |
| Dreams: confirm danger    | pendingAction → null + run                               | Two-step gate prevents accidents                        |
| Dreams: action complete   | actionResult set                                         | Production: also refetches diary; prototype keeps stale |
| Topbar: error count badge | tab decoration + KPI tone                                | Computed from HEALTH.entries                            |

## Cross-module coupling

| With         | What                                | Why                                                                                                                     |
| ------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **agents**   | AGENTS registry (id → name + color) | Both modules use the same agent data — promote registry to a shared selector once a real store is added                 |
| **docs**     | AgentDot molecule + MarkdownView    | Same molecules; promote both to design-system after a third use case                                                    |
| **sessions** | session id → memory provenance      | Memory entries originate from sessions; cross-link path is `/agents/<id>/working.md` ← `session.id` (out of scope here) |
| **activity** | dream actions emit activity events  | Production: destructive actions show in Activity feed                                                                   |

## Edge cases

| Case                                          | Behavior                                                                    |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| URL hash unknown (`#/foo`)                    | Falls back to `browse`                                                      |
| Browse: BROWSE_TREE missing for a directory   | Shown as collapsed; click does nothing useful (production: fetch on expand) |
| Browse: file path not in FILE_CONTENTS        | Empty viewer state                                                          |
| Search: query is whitespace only              | Submit button disabled                                                      |
| Search: SEARCH_FIXTURES missing the query     | Renders empty results state with `lanceDbEnabled: true`                     |
| Health: 0 agents                              | KPIs show 0; table empty                                                    |
| Health: all agents error                      | KPI cards err-tinted; topbar errors KPI red; tab gets badge                 |
| Dreams: no agents at all                      | (degenerate; AGENTS would be empty — prototype assumes ≥ 1)                 |
| Dreams: confirm danger then switch agent      | pendingAction cleared (per-agent context)                                   |
| Dreams: action twice in quick succession      | Second click during running is blocked (button disabled)                    |
| Dreams: action result list with all keys null | Renders only the head + agent label; list shrinks to nothing                |
| Path-copy chip clicked rapidly                | Subsequent clicks reset the 1400ms timer                                    |

## Pointer fluency

- Cursor `pointer` on: topbar tabs, tree rows, file rows, scope toggles, dream agent rows, dream action buttons, path-copy chip, search clear, search submit
- Cursor `default` on: KPI cards, health rows, action result rows, confirm row body
- Cursor `text` on: search input, content viewer (markdown body)

## Click-anywhere-to-close

The Dreams confirm row does NOT auto-close on click outside. Decision: confirm-by-explicit-action only — Cancel or Confirm. Reduces accidental "I clicked outside, did it commit or cancel?" ambiguity.

# subagents — interactions

> Pointer, keyboard, hover, empty, error, and dialog flows.

> Production note: Steer/Kill are implemented through `POST /api/deck/subagents` action envelopes.
> Real E2E treats live mutations as skipped-safe unless a disposable run fixture exists.

## Keyboard

| Key                 | Context                | Behavior                                                |
| ------------------- | ---------------------- | ------------------------------------------------------- |
| `⌘K` / `Ctrl K`     | anywhere in the panel  | Focus search input in toolbar                           |
| `⌘P` / `Ctrl P`     | anywhere in the panel  | Switch to **Permissions** list mode                     |
| `⌘R` / `Ctrl R`     | anywhere in the panel  | Refresh inventory (debounced 320ms; stays on `loading`) |
| `Esc`               | detail view, no dialog | Return to list view (preserves selected runId + tab)    |
| `Esc`               | any open dialog        | Close dialog, focus the trigger                         |
| `Enter` / `Space`   | focused run row        | Activate row → navigate to detail                       |
| `Tab` / `Shift Tab` | within a dialog        | Cycle focus inside dialog (focus trap)                  |

Production must keep these. Prototype implements `⌘K`, `⌘P`, `⌘R`, `Esc`, and `Enter` / `Space`
row activation.

## Pointer

- **Run rows** — full-row click → detail. Cursor `pointer`.
- **Permission rows** — informational; **Edit** button drives action.
- **Hero buttons** — Steer / Kill (live runs only) / Raw — direct dialog open.
- **Lineage nodes** — clicking a non-root node navigates to its detail. Root node is informational
  (cursor `default`).
- **Modal backdrop** — click outside the modal frame closes it.

## Hover

- **Run rows** — background tint on hover; left border becomes accent on `:focus-visible` /
  `--selected`.
- **Permission rows** — background tint subtle; the Edit button is the affordance.
- **Tabs** — text color brightens on hover; active tab carries the accent underline.
- **Tree nodes** — background tint; root node inert.
- **Permission checkboxes (allowAny on)** — visually dimmed (`is-dimmed`) and disabled.

## Empty / loading / error

| Scenario                            | UI                                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| `listState = "loading"`             | Centered spinner row with copy "Loading subagent runs…"                                |
| `listState = "error"`               | Error icon + headline + retry button (`onRefresh`)                                     |
| `listState = "empty"` (runs)        | Activity icon + "No runs match this filter." + clear-filter hint                       |
| `listState = "empty"` (permissions) | Shield icon + "No permission rows match." + clear-filter / direct-to-agents-panel hint |
| `detailState = "loading"`           | Hero remains visible; spinner row below                                                |
| `detailState = "error"`             | Hero remains visible; inline error panel; tab content from inventory still renders     |
| Lineage tab — no projection         | "No lineage projection available yet." empty block                                     |
| Outcome tab — running               | Banner: "Run is still in progress."                                                    |
| Outcome tab — no payload (ended)    | "No outcome payload recorded for this run." empty block                                |
| Permissions tab — no parent config  | "No permission projection for <agentId> yet." empty block                              |
| Audit tab — no events               | "No audit projected for this run yet." empty block                                     |

## Dialog flows

### KillRunDialog

1. Open from hero **Kill** (only visible if status is running / stalled).
2. Body explains: child session terminated, partial work lost, parent receives kill outcome,
   no undo.
3. **Cancel** / backdrop / Esc → close.
4. **Kill run** (danger button) → simulated mutation; dialog closes.

### SteerRunDialog

1. Open from hero **Steer**.
2. User types a steering message in the multiline textarea.
3. **Send hint** → enters `running` phase. Spinner copy.
4. Backend (mock) returns:
   - `deduped: true` if message starts with `dup:` (a dedupKey collision).
   - `newRunId: <fresh>` otherwise.
5. `done` phase shows outcome banner (info for deduped, success for new). dedupKey always shown.
6. **Close** ends the wizard.

### PermissionsDialog

1. Open from Permissions list mode **Edit** button OR Detail Permissions tab Edit button.
2. Draft initializes from existing `agentConfigs[agentId]`.
3. **Allow any subagent** toggle → all peer checkboxes dim and disable.
4. **Toggle a peer** → mutates draft.allowAgents.
5. **Edit default model** → free-text input.
6. **Save** → `saving` phase → simulated mutation; dialog closes.
7. **Cancel** discards draft.

### RunOutcomeDialog

1. Open from hero **Raw** button.
2. Pretty-prints the entire `DeckGoSubagentRun`.
3. **Copy JSON** → clipboard write; button label flips to "Copied" for ~1.4s.
4. **Close** ends.

## Tweaks-driven exploration

The Tweaks panel exposes:

- `mode` lets reviewers compare runs vs permissions modes without typing.
- `listState` exercises loading / error / empty.
- `detailState` exercises the cached hero with stale tab content.
- `selectedRun` rotates through 14 runs covering every status / spawnMode / depth.
- `selectedPermissionAgent` chooses which parent agent the Permissions dialog seeds with.
- `activeTab` jumps to any of 6 detail tabs.
- 4 dialog toggles open each dialog with the currently-selected run / agent.

In production these knobs disappear; corresponding state arrives from real fetch + selectors.

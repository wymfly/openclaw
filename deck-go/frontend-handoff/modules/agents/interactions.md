# agents — interactions

> Keyboard, hover, focus, a11y, empty/error/loading. Engineers should treat this as the contract for QA + accessibility tests.

## Keyboard

### Global (any agents view)

| Key             | Action                                                    |
| --------------- | --------------------------------------------------------- |
| `⌘K` / `Ctrl+K` | Focus search input (list view); no-op in detail           |
| `⌘N` / `Ctrl+N` | Open Create wizard                                        |
| `Esc`           | Close wizard / modal / drawer; from detail → back to list |
| `g` then `l`    | Vim-style: go to list                                     |

### List view

| Key             | Action                                   |
| --------------- | ---------------------------------------- |
| `↑` / `↓`       | Move row focus (visible focus ring)      |
| `Enter`         | Open focused row's detail                |
| `Space`         | Open focused row's detail (alt to Enter) |
| `/`             | Focus search                             |
| `1` / `2` / `3` | Filter: all / busy / default             |

### Detail view

| Key       | Action                                      |
| --------- | ------------------------------------------- |
| `1` … `7` | Jump to nav section by index                |
| `⌘S`      | Save current section (if dirty)             |
| `j` / `k` | Next / prev nav section                     |
| `Esc`     | Back to list (unless dirty → confirm modal) |

### Wizard

| Key                 | Action                              |
| ------------------- | ----------------------------------- |
| `Tab` / `Shift+Tab` | Cycle through focusable elements    |
| `Enter`             | Advance to next step (when valid)   |
| `Esc`               | Cancel (with discard-draft confirm) |
| `⌘Enter`            | Submit (only on Review step)        |

## Hover

- **Row hover**: background lifts to `--ds-bg-2`, action buttons (`Open`, overflow) fade in (`opacity 0 → 1`, 100ms)
- **Status dot hover**: tooltip with `lastActiveAtMs` formatted as ISO + relative
- **Skill row hover**: row background → `--ds-bg-2`; if `args` chip is present, hovering it shows full JSON in a tooltip
- **Policy rule hover**: shows the full source path tooltip (e.g. `global:safe-mode → /etc/deck/policy.toml#L24`)

## Focus

- All interactive elements have a 2px outline ring at `--ds-accent`
- Focus is trapped inside Wizard and ConfirmDelete modal (using `use-focus-trap`)
- On modal close, focus returns to the trigger element (Create button / Delete button)
- After saving identity, focus returns to the field that was edited (not the Save button) — feels less jarring during multi-field edits

## ARIA / a11y

| Element         | Role / aria                                                                         |
| --------------- | ----------------------------------------------------------------------------------- |
| `<AgentsTable>` | `role="table"`, head row `role="row"`, cells `role="columnheader"`                  |
| `<AgentRow>`    | `role="row"` with `aria-selected` when active; `tabIndex={0}`                       |
| Status dot      | `aria-label="Status: busy"` etc.; pulse is purely visual                            |
| `<DetailNav>`   | `role="navigation" aria-label="Agent configuration sections"`                       |
| `<NavItem>`     | `role="link"` (because nav driven by hash route); `aria-current="page"` when active |
| Switch          | `role="switch" aria-checked`                                                        |
| Wizard          | `role="dialog" aria-modal="true" aria-labelledby="wizard-title"`                    |
| Confirm delete  | `role="alertdialog" aria-describedby` pointing to body                              |
| Toast           | `role="status" aria-live="polite"`                                                  |
| Save errors     | `role="alert" aria-live="assertive"`                                                |

A11y test must include `vitest-axe` assertions on:

- list view (with 0, 1, 6 agents)
- detail view (each section)
- wizard (each step)
- confirm modal

## Empty states

| Where                  | Copy                                                                                | CTA            |
| ---------------------- | ----------------------------------------------------------------------------------- | -------------- |
| List, no agents at all | _"No agents yet. Create your first agent to start chatting."_                       | "Create agent" |
| List, search no match  | _"No agents match `<query>`."_                                                      | "Clear search" |
| List, filter no match  | _"No `<filter>` agents."_                                                           | "Show all"     |
| Skills tab (mode=none) | _"This agent has no skills. Switch to Inherit or Explicit to enable tools."_        | none           |
| Subagents tab          | _"This agent cannot delegate. Permit at least one agent to allow `task_dispatch`."_ | none           |
| Files                  | _"No files in this workspace yet."_                                                 | "Upload"       |

## Error states

All errors use `<Banner kind="danger">` with these elements:

- Title (one short sentence)
- Body (one paragraph max — say what failed and what to do)
- Action button (Retry / Reload / Dismiss)
- Optional `Show details` toggle that reveals the raw error text in a `<details>` block (for engineering escalation)

Specific copy:

| Failure                             | Title                       | Body                                                                                     |
| ----------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------- |
| List GET fails                      | "Couldn't load agents"      | "Network error or the runtime is unavailable. Retry, or check the runtime status panel." |
| Detail GET fails                    | "Couldn't load this agent"  | "Try again, or return to the list."                                                      |
| Section save fails (4xx validation) | "Couldn't save"             | Server's human message (`error.message`)                                                 |
| Section save fails (5xx)            | "Save failed"               | "The runtime returned an error. Your changes are still here — try again in a moment."    |
| Optimistic-lock conflict            | "Someone else updated this" | "Reload to merge their changes (your edits will be discarded)."                          |
| SSE disconnected                    | "Live status unavailable"   | "Showing last-known state from {timestamp}." (kind=info)                                 |
| File upload too large               | "File too large"            | "Max upload is {sizeMB}MB."                                                              |

## Loading

- **Skeleton patterns** (not spinners) for predictable structures: list rows, skill rows, file rows
- **Spinner** only inside buttons during in-flight save
- All loading states have a 200ms minimum visible duration to avoid flash on fast networks (use `useDeferredValue` or a setTimeout-gate)

## Streaming-driven UI updates

Status dots and `lastActiveAtMs` are updated live from `activity.event` SSE. To avoid layout thrash:

- `lastActiveAtMs` text rerender is throttled to once per 30s while idle, immediate on busy→idle transition
- Status dot transitions are CSS class swaps; no layout recompute required

## Density rules

When `data-density="compact"`:

- Row height shrinks from 56px → 44px
- Section header `margin-bottom` halves
- Field-card padding `--ds-space-5` → `--ds-space-4`

Compact mode must remain a11y-compliant: hit targets ≥ 32px for buttons, ≥ 24px for switches.

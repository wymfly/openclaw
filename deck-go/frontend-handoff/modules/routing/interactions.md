# Interactions

## Keyboard

| Key                           | Where                                | Action                                        |
| ----------------------------- | ------------------------------------ | --------------------------------------------- |
| Tab / Shift+Tab               | head → metric strip → queue → detail | Standard focus rotation                       |
| Enter / Space                 | binding row (focused)                | Selects binding                               |
| Enter                         | filter input (focused)               | Reserved (production: triggers Apply)         |
| Esc                           | Confirm row                          | Cancels pendingAction (Cancel button focused) |
| Esc                           | Add-draft drawer                     | Reserved (production: closes drawer)          |
| Tab inside textarea (comment) | Inserts indent                       | (production: tab-trap off)                    |

## Hover & focus

| Element                     | Idle             | Hover                                               | Active / on                                                    |
| --------------------------- | ---------------- | --------------------------------------------------- | -------------------------------------------------------------- |
| Refresh / Add binding       | flat             | bg = `--ds-bg-elev2`; border = `--ds-border-strong` | (disabled while running)                                       |
| Metric card                 | flat             | (no hover)                                          | warn-tinted when conflicts > 0                                 |
| Binding row                 | flat             | bg = `--ds-bg-elev1`; border = `--ds-border-strong` | active gets accent bg + accent left-border + accent box-shadow |
| Tier badge                  | tier-tinted      | (no hover — decorative)                             | (no active state)                                              |
| Match chip                  | flat mono        | (no hover — read-only)                              | (no active state)                                              |
| Conflict marker             | warn-tinted pill | (no hover; tooltip on title attr)                   | always shown when conflicts present                            |
| Hash chip                   | flat             | bg = `--ds-bg-elev2`; border = `--ds-border-strong` | "copied" appears for 1400ms after click                        |
| Filter input / select       | flat             | (focus → border = accent)                           | focus = accent border                                          |
| DM scope select             | flat             | (focus → border = accent)                           | focus = accent border; Patch button enables on dirty           |
| Add-draft fields            | warn-tinted bg   | (focus → border = accent)                           | (none)                                                         |
| Validation strip (ok)       | success-tinted   | (no hover)                                          | only when validation.ok                                        |
| Validation strip (warn)     | warning-tinted   | (no hover)                                          | only when validation.ok === false                              |
| Confirm row (warn)          | warn-tinted      | (no hover — banner)                                 | only when pendingAction set                                    |
| Confirm row (danger)        | danger-tinted    | (no hover — banner)                                 | only when pendingAction.danger                                 |
| Mutation strip (ok)         | success-tinted   | (no hover — banner)                                 | only when mutationResult.tone === ok                           |
| Mutation strip (warn)       | warn-tinted      | (no hover — banner)                                 | only when mutationResult.tone === warn                         |
| Tier timeline row (matched) | success-tinted   | (no hover)                                          | always shown after Simulate                                    |
| Tier timeline row (checked) | flat             | (no hover)                                          | always shown after Simulate                                    |
| Tier timeline row (skipped) | dimmed           | (no hover)                                          | always shown after Simulate                                    |
| Activity row                | flat             | (no hover — read-only)                              | (no active state)                                              |

## Animations

| Animation                 | Duration      | Where                    | Purpose                                           |
| ------------------------- | ------------- | ------------------------ | ------------------------------------------------- |
| Selection swap            | 0ms (instant) | queue → detail re-render | Snappy — large fleets would suffer from animation |
| Refresh "running"         | 300ms (mock)  | Refresh button           | Visual feedback that fetch is in flight           |
| Mutation "running"        | 360ms (mock)  | Action confirm → done    | Visual feedback for the dispatched action         |
| Simulator "running"       | 280ms (mock)  | Simulate button          | Visual feedback for the match-chain walk          |
| Activity refresh          | 250ms (mock)  | Activity Refresh         | Visual feedback that activity fetch is in flight  |
| Confirm row appearance    | 0ms           | When pendingAction set   | Immediate; no delay before user can interact      |
| Mutation strip appearance | 0ms           | When mutationResult set  | Immediate; sticky until cleared                   |
| Hash chip "copied" pulse  | 1400ms        | After click              | Confirms clipboard success                        |
| JSON view "copied" pulse  | 1400ms        | After click              | Confirms clipboard success                        |

## Queue interactions

```
type filter input → filters (draft) updated; appliedFilters unchanged (no auto-rerun)
click Apply → appliedFilters = filters; if selected not in new view, reselect first
click Clear → both reset to empty

click Refresh:
  refreshing = true → 300ms → refreshing = false
  (production: real fetch; preserve selection)

click Add binding…:
  showAddDraft = true; validation = null

click binding row:
  selectedId = id
  pendingAction = null
  mutationResult = null
```

## DM scope interactions

```
type/select dropdown → draft changed (dirty if !== scope)
click Patch scope (only when dirty):
  raise pendingAction { kind: "scope" }
  ConfirmRow appears: "Patch DM scope? scope: A → B (requires hash …)"
  Confirm → 360ms → setScope(next); advance configHash; mutationResult.ok
  Cancel → pendingAction cleared; dropdown stays at draft (user can retry)
```

## Add-binding draft interactions

```
click Add binding… → drawer opens

edit fields:
  agent (select), tier (select), channel (select), accountId (text),
  peer.kind (select including "(none)"), peer.id (text, disabled if no kind),
  guildId (text), teamId (text), roles (csv → string[]),
  comment (textarea)

click Validate:
  synchronous → validation = window.validateBinding(draft, bindings)
  ok → "Validated as <tier>"
  not ok → list of conflicts inline

click Add binding:
  ConfirmRow appears: "Add binding? Add <agent> via <channel> (<tier>) — config hash …"
  Confirm → 360ms → bindings.push(new); advance configHash; selectedId = new.id; close drawer
  Cancel → pendingAction cleared; drawer stays open (user can re-edit)

click Close (X):
  showAddDraft = false; validation = null; draft preserved (so reopen restores)
```

## Selected hero — action interactions

```
click "Use as simulation":
  populates simulatorInput from binding.match (no run; user must click Simulate)

click "Move up" (disabled at index 0):
  ConfirmRow ("Move up? Reorder <agent> — remove + add at position N-1")
  Confirm → 360ms → splice bindings; both POSTs simulated; configHash advances

click "Move down" (disabled at last index):
  same as Move up but to N+1

click "Remove" (always danger-tinted):
  ConfirmRow.danger ("Remove binding? Delete <agent> match. Downstream order will shift.")
  Confirm → 360ms → bindings.splice; configHash advances; reselect first remaining
  Cancel → pendingAction cleared
```

## Simulator interactions

```
edit any field → simulatorInput updated; no auto-run

click Simulate:
  busy = true → 280ms → simulateRoute(input, bindings) → lastSimulationResponse
  mutationResult.tone = "ok" if matched else "warn"
  tier timeline + session key + Open agent / Open session render

click Reset:
  simulatorInput = SIMULATOR_DEFAULT
  lastSimulationResponse unchanged (so user can compare)

click "Open agent" / "Open session" (only when matchedBy !== default):
  alert (mock); production: navigate via existing helpers
```

## Activity interactions

The activity card is **read-only** in v2. No interactions besides Refresh.

Production extras:

- Click row → expand to show raw event payload
- Click agent chip → navigate to agents panel
- Click binding-id mono → select that binding in the queue (deep-link)

## Cross-section coupling

| Source                  | Affects                                                    | How                                    |
| ----------------------- | ---------------------------------------------------------- | -------------------------------------- |
| select binding in queue | detail render + clear pendingAction + clear mutationResult | single state mutation                  |
| add binding             | bindings.push + advance hash + close drawer + reselect new | Cascaded mutations                     |
| remove binding          | bindings filter + advance hash + reselect first remaining  | Cascaded mutations                     |
| move up/down            | splice + 2-step (remove + add) + advance hash              | Two-step gate prevents partial regrets |
| patch DM scope          | scope state + advance hash                                 | Single state mutation                  |
| Use as simulation       | simulatorInput populated from binding.match                | One-way population                     |
| Simulate                | lastSimulationResponse + mutationResult                    | Pure function over fixture             |
| Refresh                 | bindings re-fetch (production)                             | Cache-invalidating                     |
| Filter Apply            | appliedFilters; reselect first if needed                   | Selection cascaded                     |

## Cross-module coupling

| With         | What                                                    | Why                                                                                  |
| ------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **agents**   | every binding has `agentId` — Open agent navigates here | When operator confirms a route, they often want to inspect the target agent's config |
| **sessions** | simulator returns `sessionKey` — Open session navigates | Operator can verify the session key derivation matches what they expect              |
| **channels** | filter `channel` matches the channel module identifier  | Future: deep-link from channels panel to "view all bindings for channel X"           |
| **activity** | filtered slice of activity events                       | The full activity feed is in activity panel; this is just a routing-relevant tail    |
| **gateway**  | DM scope changes affect Gateway routing decisions       | Gateway has the runtime state; routing config is the static plan                     |
| **settings** | `defaultAgentId` lives in settings as a config value    | Updating defaultAgentId from settings page must invalidate this panel's `head`       |

## Edge cases

| Case                                       | Behavior                                                                |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| 0 bindings total                           | both rail empty + detail empty                                          |
| filter excludes selected binding           | re-select first available; if none, empty hero                          |
| Move up at index 0                         | Move up button disabled                                                 |
| Move down at last index                    | Move down button disabled                                               |
| Add binding with duplicate match           | validation flags duplicate; Add still allowed (operator override)       |
| Validate with empty match                  | tier auto-detected as "channel"                                         |
| Simulate with no peer.kind                 | matches first binding without peer constraint; falls to default if none |
| Simulate with custom guildId               | only matches guild+roles or guild bindings                              |
| Simulate that doesn't match anything       | falls to default agent; tier timeline all skipped; warn pill            |
| Open agent / Open session when no match    | buttons hidden                                                          |
| Confirm during running                     | Confirm + Cancel buttons disabled while busy                            |
| Switch selection during pending confirm    | pendingAction cleared by select side-effect                             |
| Hash chip click when clipboard unavailable | silent fail (production: try/catch)                                     |
| Long binding id / agent name / peer id     | text truncates with title attribute                                     |
| Activity events with `agentId === null`    | row renders without AgentChip                                           |
| Reorder where addResp.configHash differs   | UI uses addResp.configHash (last write wins)                            |

## Pointer fluency

- Cursor `pointer` on: queue rows, action buttons (4 in hero + Simulate/Reset/Open in simulator), filter Apply/Clear, hash chip, JSON copy, scope Patch, validate/add/close in draft, activity Refresh
- Cursor `default` on: metric cards, tier badges, match chips, conflict markers, tier timeline rows, activity rows
- Cursor `text` on: filter inputs, draft inputs, simulator inputs, comment textarea
- Cursor `not-allowed` on: any button while `busy`, Move up at index 0, Move down at last index, peer.id when peer.kind empty, Patch when not dirty

## Click-anywhere-to-close

The ConfirmRow does NOT auto-close on click outside. Decision: confirm-by-explicit-action only — Cancel or Confirm. Reduces accidental "I clicked outside, did it commit or cancel?" ambiguity. Same UX language as docs delete + memory dreams + nodes.

The Add-binding draft drawer also does NOT auto-close on click outside. Decision: drafts are work-in-progress and shouldn't be lost from a misclick. Use the explicit Close (X) or Add to dispose.

## A11y notes

- Each binding row is a `<button>` with full keyboard activation (Enter/Space)
- Hash chip is a `<button>` with title attribute showing the full hash
- Conflict markers expose detail via `title` attribute (production: aria-describedby for screen readers)
- Form fields all have associated labels with `muted-label` headers
- Tier timeline rows expose tier + status via the inner pill text (not color alone)
- ConfirmRow uses `role="alertdialog"` in production with focus-trap
- Mutation strip uses `role="status"` in production for live announcement
- Color is never the only signal: every status pill has accompanying text

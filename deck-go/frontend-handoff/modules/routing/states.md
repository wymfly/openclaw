# States

State machines for the routing panel.

## Top-level state

```
┌──────────────────────────────────┐
│  initial-load                    │
│  fetch bindings + activity       │
│  (prototype: static fixtures)    │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  ready                           │
│  metric strip + queue + detail   │
│  selectedId defaults to first    │
└──────────────────────────────────┘
```

In production, `Promise.all([fetchRoutingBindings(), fetchActivityEvents(20)])` warms the page. Selected binding defaults to the first row of the **filtered** list.

## Selection state

```
selectedId = "<bindingId>"        → SelectedBindingHero renders binding
selectedId not in filtered view   → falls through to first available
no bindings at all                → SelectedBindingHero renders empty state

switch selection:
  pendingAction = null  (cancel any in-flight confirm)
  mutationResult = null (clear last result)
```

## Filter state

```
filters (draft) = { agentId, channel, accountId }   ← live form values
appliedFilters  = { agentId, channel, accountId }   ← only changes on Apply

user types → filters updates; appliedFilters unchanged (no auto-rerun)
user clicks Apply → appliedFilters = filters
  if selectedId not in new filtered view → re-select first available
user clicks Clear → both reset to empty
```

Decision: explicit Apply prevents accidental over-filtering during keyboard typing. Same gate as memory search panel.

## Refresh state

```
idle ──click Refresh──▶ refreshing
refreshing (300ms mock) ──▶ idle
```

Production: real fetch + cache invalidation. Selection preserved if target still exists.

## DM scope state

```
local: scope = head.dmScope (mirrors page-level)

user changes dropdown → draft changed (dirty-detect via dropdown != scope)
user clicks Patch scope (only when dirty):
  raise pendingAction { kind: "scope", payload: { next } }

confirm:
  → 360ms (mock) → mockPatchDmScope returns { ok, dmScope, configHash }
  → setScope(next), advance head.configHash, mutationResult.tone = "ok"
  cancel: pendingAction cleared, scope unchanged
```

## Add-binding draft state

```
showAddDraft = false (initial)

click "Add binding…" → showAddDraft = true; validation = null

draft form lives in component state:
  agentId / tier / match.{channel,accountId,peer{kind,id},guildId,teamId,roles[]} / comment

click Validate (synchronous):
  validation = window.validateBinding(draft, bindings)
  validation.ok → green strip "Validated as <tier>"
  validation.ok === false → yellow strip listing conflicts

click Add binding:
  raise pendingAction { kind: "add", payload: { draft } }

confirm:
  → 360ms → mockAddBinding returns { ok, binding, configHash, warnings }
  → bindings.push(resp.binding), advance head.configHash, showAddDraft = false, validation = null
  → selectedId = resp.binding.id (jump to the new binding)
  cancel: pendingAction cleared, draft unchanged

close drawer:
  showAddDraft = false; validation = null; draft preserved (so reopen restores)
```

## Mutation lifecycle (every guarded action)

```
idle ──user clicks action button──▶ pending-confirm
pending-confirm ──Cancel──▶ idle
pending-confirm ──Confirm──▶ running (busy = true)
running (360ms mock) ──▶ done (mutationResult set; busy = false; head.configHash advanced)
done ──user clicks another action──▶ pending-confirm (mutationResult cleared)
done ──user switches selection──▶ idle (mutationResult cleared)
```

The two-step gate applies to **every** mutating action: scope, add, remove, move (up/down).
Variant: `kind === "remove"` is `danger: true` (red confirm). All others are `danger: false` (yellow confirm).

## Move (reorder) lifecycle

```
move = remove + add (two POSTs in sequence per the contract intent)

confirm move:
  → splice the local bindings array (optimistic UI)
  → mockRemoveBinding(binding) — returns new hash
  → mockAddBinding(binding)    — returns new hash
  → use addResp.configHash as the final hash
  → mutationResult.tone = "ok"
  → mutationResult.detail = "Two-step (remove + add) completed; both Gateway calls succeeded."
```

Production must handle the partial-failure case: if remove succeeds but add fails, the binding is now gone. The BFF's `node.routing.add` may return a graceful re-insert or the UI must offer a retry. See `api-discrepancy.md` for the open Gateway question about a typed reorder action.

## Simulator state

```
on mount:
  simulatorInput = { ...SIMULATOR_DEFAULT }

user changes any field:
  simulatorInput updated (no auto-run)

click Simulate:
  busy = true → 280ms → simulateRoute(input, bindings) → lastSimulationResponse set
  mutationResult tone = "ok" or "warn" depending on matchedBy === "default"
  busy = false

click Reset:
  simulatorInput = { ...SIMULATOR_DEFAULT }
  lastSimulationResponse unchanged (so user can compare reset vs prior)

click "Use as simulation" (from selected binding hero):
  simulatorInput populated from binding.match (channel/accountId/peer/guildId/roles)
  no auto-run; user must click Simulate

click "Open agent" / "Open session" (only when matchedBy !== "default"):
  alert (mock) — production: route to agents panel / sessions panel
```

## Tier timeline derivation

```
For each tier in TIERS = ["peer", "guild+roles", "guild", "team", "channel"]:
  matched: tier === resp.bindingMatched.tier
  checked: TIERS.indexOf(tier) <= TIERS.indexOf(resp.bindingMatched.tier)
  skipped: !checked

When matchedBy === "default":
  every tier: matched = false, checked = true (we walked all of them)
```

This is a UI convention; the contract's `DeckGoRoutingSimulationTier` returns `{ tier, matched, checked }` directly from the BFF in production.

## Conflict derivation

Local advisory conflicts are pre-computed in `data.js#LOCAL_CONFLICTS` keyed by binding id. In production:

```
conflictsByBinding = aggregateLocalConflicts(bindings)  // optional client-side heuristic
                  ⊕ window.validateBinding(...).conflicts on the draft surface

When user clicks Validate, the backend response is authoritative for the draft.
The advisory list in the queue is informational and NOT a gate (operator can still proceed).
```

## Activity state

```
events = ACTIVITY_EVENTS (5 mock events spanning 48 minutes)

filter (production): events whose type ∈ { routing.matched, route.fallback, routing.config.updated }

click Refresh:
  refreshingActivity = true → 250ms → refreshingActivity = false
  (production: real fetch; preserve order)
```

## Hash advancement chain

```
initial: head.configHash = "9af31c2d80ab"

after scope patch:    head.configHash = newHash()  (mocked)
after add binding:    head.configHash = newHash()
after remove binding: head.configHash = newHash()
after move binding:   head.configHash = newHash() (uses addResp.configHash)

The hash is the source of truth for "current config snapshot". Every mutation advances it.
The HashChip in the detail card head re-renders the new value.
```

## Empty / sparse states

| Condition                   | Surface                                                        |
| --------------------------- | -------------------------------------------------------------- |
| 0 bindings total            | empty-state in queue + selected hero empty state               |
| 0 bindings match filters    | empty-state in queue ("No bindings match the current filters") |
| no draft open               | AddBindingDraft component not rendered                         |
| no validation run           | validation-strip not rendered                                  |
| 0 conflicts                 | conflict warn pill in metric card hidden; metric card neutral  |
| no simulation run           | tier-timeline + session-key footer not rendered                |
| simulation fell to default  | result pill warn-tinted; tier timeline shows all skipped       |
| 0 activity events in window | activity-row--empty placeholder                                |
| no mutationResult           | MutationStrip not rendered                                     |
| no pendingAction            | ConfirmRow not rendered                                        |

## Error states (production)

| Error                                   | Surface                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `fetchRoutingBindings` 5xx              | inline error banner above queue card; preserve last-known bindings (stale flag) |
| `fetchActivityEvents` 5xx               | activity card error chip + retry; main panel unaffected                         |
| `validateRoutingBinding` 5xx            | validation-strip danger-tone with error message                                 |
| `addRoutingBinding` 4xx (hash mismatch) | mutationStrip warn ("Config hash advanced; please refresh"); refetch on click   |
| `addRoutingBinding` 5xx                 | mutationStrip danger; bindings unchanged                                        |
| `removeRoutingBinding` 5xx              | mutationStrip danger; binding restored to local state                           |
| `simulateRouting` 5xx                   | mutationStrip danger; lastSimulationResponse cleared                            |
| Move (remove ok, add fails)             | mutationStrip danger with retry CTA; the missing binding flagged                |
| `patchDeckConfig` 4xx (hash mismatch)   | mutationStrip warn; refetch hash                                                |
| BFF unreachable entirely                | full-pane error overlay with retry CTA                                          |

## Loading vs ready

The prototype starts in `ready` (all fixtures in-memory). In production:

- Initial fetch parallel: `GET /deck/routing` + `GET /deck/activity?limit=20`
- Skeletons during loading: metric strip ghost cards, binding rows ghost, detail empty
- Cache `bindings` per fetch; invalidate on every mutation that returns a new `configHash`
- Cache `activity` with a short TTL (10s) and refresh on tab focus

## URL hash sync (production)

```
mount: parse window.location.hash
  if matches "#/binding/<id>" and exists in filtered view → selectedId = id
  else → selectedId = first filtered binding

on selection change: window.history.replaceState(null, "", `#/binding/${id}`)
```

Out of scope for this prototype; v3.

## Confirm cancel side-effects

```
click Cancel on pendingAction:
  pendingAction = null
  selectedId unchanged
  bindings / scope / draft / simulator unchanged
  mutationResult preserved (from prior action)

switch selection (queue row click):
  pendingAction = null   ← cancel any in-flight confirm
  mutationResult = null  ← clear last result on context switch
```

This prevents accidentally confirming an old action against a newly-selected target.

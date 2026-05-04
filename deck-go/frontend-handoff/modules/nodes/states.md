# States

State machines for the nodes panel.

## Top-level state

```
┌──────────────────────────────────┐
│  initial-load                    │
│  fetch nodes + pairing parallel  │
│  (prototype: static fixtures)    │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  ready                           │
│  rail + detail rendered          │
│  selectedKey defaults to first   │
│    pairing request if any,       │
│    else first node               │
└──────────────────────────────────┘
```

In production, `Promise.all([fetchNodes(), fetchNodePairing()])` warms the rail. Detail-side `describeNode(nodeId)` is called lazily on selection.

## Selection state machine

```
selectedKey = "node:<id>"     → render full NodeDetail
selectedKey = "pair:<reqId>"
  → req has matching node     → render full NodeDetail (with pending banner)
  → req is orphan (no node)   → render orphan NodeDetail (approve/reject only)
selectedKey = (unset)          → render empty NodeDetail
```

Switching selection clears `pendingAction` and `actionResult`. Inventory mutations do NOT auto-reselect (a deleted/de-paired node remains selected unless action-handler explicitly redirects).

## Refresh state

```
idle ──click Refresh──▶ refreshing
refreshing (320ms mock) ──▶ idle (button label restored)
```

Production: real fetch + cache invalidation.

```
refresh:
  Promise.all([fetchNodes(), fetchNodePairing()])
  preserve selectedKey when target still exists
  if target gone → fall back to first available
  call describeNode(selected) opportunistically (not blocking refresh UI)
```

## Action lifecycle (every guarded action)

```
idle ──user fills form + clicks "Action…"──▶ pending-confirm
pending-confirm ──Cancel──▶ idle (no action)
pending-confirm ──Confirm──▶ running (busy = true)
running (360ms mock) ──▶ done (actionResult set; busy = false)
done ──user clicks another action──▶ pending-confirm (actionResult cleared)
done ──user switches selection──▶ idle (actionResult cleared)
```

The two-step gate applies to **every** mutating action: rename, invoke, pending.enqueue, pair.approve, pair.reject, pair.request, pair.verify. The variant in `pair.reject` is `danger: true` (red confirm). All others are `danger: false` (yellow confirm).

## Pairing flow state

```
inventory has node + pairing has request matching node:
  detail renders Pairing card (Approve / Reject)
  node row in rail shows "repair pending" or "pairing pending" mini-pill

inventory has unpaired node + no matching pairing request:
  detail renders Unpaired card (Request pairing / Verify token)

pairing has request without matching inventory node (orphan):
  rail shows pending row with orphan hint
  selecting it renders orphan NodeDetail with Approve/Reject only

post-approve:
  node.paired = true, node.connected = true, connectedAtMs = now
  pairing request removed from list
  selectedKey jumps to "node:<id>" (so user lands on the now-paired device)

post-reject:
  pairing request removed
  selectedKey falls back to first node (or empty if none)

post-request (manual):
  new pairing request prepended to list (so user sees it immediately)

post-verify:
  if status === "verified" → mark node paired+connected
  else → keep state, surface "Token rejected" in actionResult
```

## Lifecycle tone derivation

```
function lifecycleTone(node, pendingForNode):
  if pendingForNode → { tone: "warn", label: "repair pending" or "pairing pending" }
  else if !node.paired → { tone: "neutral", label: "unpaired" }
  else if !node.connected → { tone: "warn", label: "paired · offline" }
  else → { tone: "ok", label: "connected · paired" }
```

This drives:

- the StatusDot color in node rows
- the lifecycle pill in the detail hero
- the KPI tone for Connected/Paired (warn when not all green)

## Form state (per form)

### InvokeForm

```
on mount / on nodeId change:
  command = node.commands[0] || ""
  timeout = "15000"
  params = COMMAND_TEMPLATES[command] || "{}"
  paramsError = ""

on command change:
  command = next
  params = COMMAND_TEMPLATES[next] || "{}"
  paramsError = ""

on params change:
  params = next text
  try { JSON.parse(next) } → paramsError = ""
  catch → paramsError = "Invalid JSON"

submit:
  guard: command set, paramsError empty
  raise pendingAction { kind: "invoke", payload: { command, params: parsed, timeoutMs } }
```

### PendingWorkForm

```
on mount:
  type = "status.request"
  priority = "normal"
  wake = true

submit:
  raise pendingAction { kind: "pending", payload: { type, priority, wake } }
```

### RenameForm

```
on mount / on nodeId change:
  name = node.displayName || node.nodeId

dirty-check:
  name.trim() !== (node.displayName || node.nodeId).trim()

submit (only if dirty):
  raise pendingAction { kind: "rename", payload: { name } }
```

## Empty / sparse states

| Condition                               | Surface                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------- |
| inventory empty + pairing empty         | rail shows "No nodes in inventory.", detail shows "Pick a node" empty card |
| inventory empty + pairing has orphan(s) | rail shows pending list only; selecting opens orphan detail                |
| inventory has node, no pairing requests | rail hides Pending pairing surface; detail shows idle Trust state          |
| node has 0 commands                     | InvokeForm renders idle ("Node advertises no commands.")                   |
| node permissions empty                  | PermissionGrid renders muted "no permission map"                           |
| no actionResult yet                     | ActionResult block not rendered                                            |
| no pendingAction                        | ConfirmRow not rendered                                                    |

## Error states (production)

| Error                                           | Surface                                                                     |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| `fetchNodes` 5xx                                | inline error banner above rail; preserve last-known nodes (stale flag)      |
| `fetchNodePairing` 5xx                          | rail Pending section shows error chip + retry                               |
| `describeNode` 5xx                              | detail hero shows error block + Retry; metadata grid kept from list payload |
| `renameNode` 4xx                                | rename row inline error; rollback name to prior value                       |
| `invokeNodeCommand` 4xx (param schema)          | inline error in InvokeForm under params textarea                            |
| `invokeNodeCommand` 5xx                         | actionResult shows error tone; raw error payload in JsonView                |
| `enqueueNodePendingWork` 5xx                    | actionResult shows error tone                                               |
| `requestNodePairing` / `approve` / `reject` 4xx | actionResult shows error; rail state unchanged                              |
| `verifyNodePairing` returns rejected            | actionResult heading "Token rejected"; node state unchanged                 |
| BFF unreachable entirely                        | full-pane error overlay with retry CTA                                      |

## Loading vs ready

The prototype starts in `ready` (all fixtures in-memory). In production:

- Initial fetch parallel: `GET /api/nodes` + `GET /api/nodes/pair`
- Skeletons during loading: rail KPIs ghost, list rows ghost, detail hero ghost
- Cache `nodes` and `pairing` arrays per refresh interval (default 5–10s); cache `describe` per node with 60s TTL

## URL hash sync (production)

```
mount: parse window.location.hash
  if matches "#/node/<id>" and exists → selectedKey = "node:<id>"
  else if matches "#/pair/<reqId>" and exists → selectedKey = "pair:<reqId>"
  else → selectedKey = first pairing request or first node

on selection change: window.history.replaceState(null, "", `#/${type}/${id}`)
```

Out of scope for this prototype; v3.

## Confirm cancel side-effects

```
click Cancel on pendingAction:
  pendingAction = null
  selectedKey unchanged
  actionResult unchanged (preserved from prior action)

switch selection (rail click):
  pendingAction = null   ← cancel any in-flight confirm
  actionResult = null    ← clear last result on context switch
```

This prevents accidentally confirming an old action against a newly-selected target.

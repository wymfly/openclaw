# Interactions

## Keyboard

| Key                          | Where                                                                 | Action                                              |
| ---------------------------- | --------------------------------------------------------------------- | --------------------------------------------------- |
| Tab / Shift+Tab              | rail → detail                                                         | Standard focus rotation                             |
| Enter / Space                | rail row (focused)                                                    | Selects node or pending request                     |
| Enter / Space                | Approve / Reject / Confirm / Cancel                                   | Triggers the action                                 |
| Enter                        | Verify token input (focused)                                          | Reserved (production: submit when token >= 6 chars) |
| Esc                          | Confirm row                                                           | Cancels pendingAction (Cancel button focused)       |
| Esc                          | Verify token input                                                    | Reserved (clear input)                              |
| Tab inside textarea (params) | Inserts indent (production: tab-trap off so user can leave the field) |

## Hover & focus

| Element                    | Idle                    | Hover                                               | Active / on                                                    |
| -------------------------- | ----------------------- | --------------------------------------------------- | -------------------------------------------------------------- |
| Refresh button             | flat                    | bg = `--ds-bg-elev2`; border = `--ds-border-strong` | (disabled while running)                                       |
| KPI card                   | flat                    | (no hover)                                          | tone-tinted border + value when applicable                     |
| Pending pairing row        | warn-tinted bg          | warn-tinted bg darker                               | active gets warn left-border + warn box-shadow                 |
| Node row                   | flat                    | bg = `--ds-bg-elev1`; border = `--ds-border-strong` | active gets accent bg + accent left-border + accent box-shadow |
| Status dot                 | tone-tinted halo + core | (no hover — decorative)                             | (no active state)                                              |
| Platform pill              | OS-tinted bg            | (no hover — decorative)                             | (no active state)                                              |
| Cap chip                   | flat mono               | (no hover — read-only)                              | (no active state)                                              |
| Cap chip (cmd)             | accent-tinted           | (no hover — read-only)                              | (no active state)                                              |
| Permission chip (allowed)  | success-tinted border   | (no hover — read-only)                              | (no active state)                                              |
| Permission chip (denied)   | danger-tinted border    | (no hover — read-only)                              | (no active state)                                              |
| primary button             | accent-tinted bg        | bg = accent 26%                                     | (disabled when busy or invalid)                                |
| danger button              | danger-tinted bg        | bg = danger 22%                                     | (disabled when busy)                                           |
| ghost button               | transparent             | bg = `--ds-bg-elev2`; border = `--ds-border-strong` | (disabled when busy or empty)                                  |
| text input / select / code | flat                    | (focus → border = accent)                           | focus = accent border                                          |
| Confirm row (warn)         | warn bg                 | (no hover — banner)                                 | only when pendingAction set                                    |
| Confirm row (danger)       | danger bg               | (no hover — banner)                                 | only when pendingAction.danger                                 |
| Action result              | success-tinted bg       | (no hover — banner)                                 | only when actionResult set                                     |
| JSON view copy chip        | flat                    | bg = `--ds-bg-elev2`; border = `--ds-border-strong` | "copied" label appears for 1400ms after click                  |

## Animations

| Animation                     | Duration      | Where                   | Purpose                                           |
| ----------------------------- | ------------- | ----------------------- | ------------------------------------------------- |
| Selection swap                | 0ms (instant) | rail → detail re-render | Snappy — large fleets would suffer from animation |
| Refresh "running"             | 320ms (mock)  | Refresh button          | Visual feedback that fetch is in flight           |
| Action "running"              | 360ms (mock)  | Action button click     | Visual feedback for the dispatched action         |
| Confirm row appearance        | 0ms           | When pendingAction set  | Immediate; no delay before user can interact      |
| ActionResult appearance       | 0ms           | When actionResult set   | Immediate; sticky until cleared                   |
| Path-copy chip "copied" pulse | 1400ms        | json-view copy chip     | Confirms clipboard success                        |

## Rail interactions

```
click Refresh:
  refreshing = true → 320ms → refreshing = false
  (production: real fetch + cache invalidation)

click pending row:
  selectedKey = "pair:<requestId>"
  pendingAction = null
  actionResult = null

click node row:
  selectedKey = "node:<nodeId>"
  pendingAction = null
  actionResult = null

click "Request pairing…" CTA in footer:
  if selectedNode && !selectedNode.paired
    → launch pair.request flow for that node
  else
    → launch pair.request flow for a stub node
```

## Detail — pairing actions

```
state: pending request awaiting decision
  click Approve → ConfirmRow ("Approve pairing? Approve <name> (<reqId>)")
    Confirm → 360ms → node marked paired+connected, request removed,
              selectedKey jumps to node:<id>, ActionResult shown
    Cancel → pendingAction cleared

  click Reject → ConfirmRow.danger ("Reject pairing? Device must restart pairing flow.")
    Confirm → 360ms → request removed, selectedKey falls back, ActionResult shown
    Cancel → pendingAction cleared

state: unpaired
  click "Request pairing" → ConfirmRow ("Request pairing? Send pairing request for <name>.")
    Confirm → 360ms → new request prepended, ActionResult shown

  type token (>= 6 chars) → Verify button enabled
  click Verify → ConfirmRow ("Verify token? Verify token for <name>.")
    Confirm → 360ms → if token valid, mark paired+connected; ActionResult shows verdict

state: paired+connected (no pending)
  card renders idle Trust state (no actions)
```

## Detail — invoke command

```
on form load:
  command = node.commands[0]
  timeout = "15000"
  params = COMMAND_TEMPLATES[command] || "{}"

user changes command:
  params auto-replaced with the new template
  paramsError cleared

user edits params:
  on every keystroke → JSON.parse(params) → set/clear paramsError
  invalid JSON disables Invoke button

click Invoke…:
  guard: command set, paramsError empty, busy false
  ConfirmRow ("Invoke command? <command> on <name> (timeout 15000 ms)")
    Confirm → 360ms → ActionResult shows the dispatched payload (verbatim, with dispatchedAtMs added)
    Cancel → pendingAction cleared
```

The mock dispatchedAtMs stamping mirrors what a real BFF would do — the Gateway-side handler enriches with timestamp before forwarding to the device.

## Detail — pending work

```
on form load:
  type = "status.request"
  priority = "normal"
  wake = true

click Queue work…:
  ConfirmRow ("Queue work? <type> (<priority>) on <name>")
    Confirm → 360ms → ActionResult shows revision + queued + wakeTriggered
    Cancel → pendingAction cleared
```

## Detail — rename

```
type new display name → dirty becomes true → Rename button enables
click Rename → ConfirmRow ("Rename? Display name → <new>")
  Confirm → 360ms → node.displayName updated in inventory; ActionResult shows the rename payload
  Cancel → pendingAction cleared
```

If the user types the same value back, `dirty` resets to false and the Rename button disables — no accidental no-op submits.

## Orphan pairing detail interactions

Orphan request = pending pairing for a `nodeId` that's not in the inventory. The detail surface drops the hero metadata, capabilities, invoke, pending-work, and raw-summary cards. Only:

- orphan-hero (request meta + warn pill)
- ConfirmRow + ActionResult
- Pairing request action card (Approve / Reject)
- Raw request JsonView

Approving an orphan in the prototype does not magically materialize a node — production may want a follow-up "describe" call to populate the inventory after approve. Out of scope here.

## Cross-section coupling

| Source                      | Affects                                                                      | How                   |
| --------------------------- | ---------------------------------------------------------------------------- | --------------------- |
| select node/pending in rail | detail render + clear pendingAction + clear actionResult                     | single state mutation |
| approve pending pairing     | inventory (paired/connected/connectedAtMs) + drop request + selectedKey jump | Cascaded mutations    |
| reject pending pairing      | drop request + selectedKey fallback                                          | Cascaded mutations    |
| verify token (success)      | inventory (paired/connected/connectedAtMs)                                   | Single state mutation |
| invoke command              | actionResult only                                                            | Verbatim payload echo |
| queue pending work          | actionResult only                                                            | Verbatim payload echo |
| rename node                 | inventory (displayName) + actionResult                                       | Both updated          |
| Refresh button              | rail re-fetch (production)                                                   | Cache-invalidating    |
| KPI tone                    | derived from `nodes` + `pairing`                                             | Pure compute          |

## Cross-module coupling

| With         | What                                                       | Why                                                                                    |
| ------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **agents**   | a node may host an agent — link?                           | Future: clicking an agent in nodes detail jumps to agents panel for that agent         |
| **activity** | every approve/reject/invoke/queue is an audit-worthy event | Production: emit activity entries; visible in activity feed                            |
| **alerts**   | a node going offline is alert-worthy                       | Out of scope — alerts panel owns that integration                                      |
| **memory**   | each node may have a memory provider                       | Out of scope — memory panel owns the per-agent memory view; node panel doesn't dive in |

## Edge cases

| Case                                            | Behavior                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| inventory empty + pairing empty                 | rail shows empty state; detail empty                                     |
| inventory empty + pairing has orphan only       | rail shows orphan only; detail renders orphan detail                     |
| node row clicked, then orphan row clicked       | detail swaps from full-node view to orphan view                          |
| pending request approved, switch back via undo? | not modeled; pairing requests are mutations                              |
| invoke params is `{}`                           | parses fine; payload is empty object                                     |
| invoke params has trailing comma (invalid JSON) | paramsError = "Invalid JSON"; Invoke button disabled                     |
| node has 0 commands                             | InvokeForm renders idle ("Node advertises no commands.")                 |
| node has 0 caps                                 | CapsCluster shows nothing                                                |
| node has 0 permissions                          | PermissionGrid renders muted "no permission map"                         |
| node has no remoteIp / no model / no path       | hero meta grid shrinks gracefully (auto-fit)                             |
| confirm during running                          | Confirm + Cancel buttons disabled while busy                             |
| switch agent during pending confirm             | pendingAction cleared by select side-effect                              |
| copy from JSON view when clipboard unavailable  | silent fail; no error toast (production: try/catch + fallback)           |
| extremely long command id                       | text wraps inside cap chip; production may truncate with title attribute |
| token verify with 5 chars                       | Verify button stays disabled (length guard)                              |

## Pointer fluency

- Cursor `pointer` on: rail rows, all action buttons, JSON copy chip, footer Request pairing CTA
- Cursor `default` on: KPI cards, status dots, platform pills, cap chips, permission chips
- Cursor `text` on: text inputs, select dropdowns, code textarea (params)
- Cursor `not-allowed` on: any button while `busy`, Invoke when params invalid, Verify when token < 6 chars

## Click-anywhere-to-close

The ConfirmRow does NOT auto-close on click outside. Decision: confirm-by-explicit-action only — Cancel or Confirm. Reduces accidental "I clicked outside, did it commit or cancel?" ambiguity. Same UX language as docs delete confirm and memory dreams reset confirm.

## A11y notes

- Each rail row is a `<button>` with `aria-pressed` reflecting selection (production should add this; prototype omits)
- StatusDot has `aria-label` and `title` reflecting tone label
- Form inputs have associated `<label>` elements with `muted-label` headers
- Confirm row should `role="alertdialog"` in production with focus-trap; prototype renders inline without trap
- JSON copy chip exposes the literal "copied" label for assistive tech
- Color is never the only signal: every status pill has accompanying text

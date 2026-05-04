# Nodes

> 2-pane operations workbench for device trust + remote-control. Inventory rail on the left, lifecycle + guarded actions on the right. v2 multi-file React rebuild via Babel-standalone.

**Status**: ready-for-implementation
**Design completed**: 2026-05-04 (v2 rebuild from V1 codex single-file)
**Designer**: design agent (Claude)
**Depends on atoms**: Pill, Button, Input, Select, Textarea, Checkbox, IconButton, JsonView, Code
**Depends on patterns**: 2-pane workspace shell (rail + main); ConfirmRow inline gate (shared with docs/memory)
**New atoms needed**: PlatformPill (lucide-backed icon + os tone) — promote candidate after 2nd module
**New tokens needed**: none — uses canonical `--ds-*`
**Backend endpoints used**: `GET /api/nodes`, `POST /api/nodes` (action-discriminated: `describe`/`rename`/`invoke`/`pending.enqueue`), `GET /api/nodes/pair`, `POST /api/nodes/pair` (action-discriminated: `request`/`approve`/`reject`/`verify`)

## What this module does

Operators use Nodes to manage the **device fleet** that connects into the OpenClaw runtime: which devices are paired, which are connected, which are pending pairing approval, and what remote actions can be safely dispatched against them. The contract treats this as a **trust + remote-control workbench** — not a "compute resource inventory". Three primary jobs:

1. **Trust state surveillance**: see the connection × pairing matrix at a glance (5 KPIs). Repair pending and orphan pairing requests are flagged in the rail.
2. **Pairing flow management**: approve / reject incoming pairing requests, send outbound pairing requests, verify tokens minted on the device. Two-step confirm guards rejection (pairing reject is destructive — device must restart its flow).
3. **Guarded remote actions**: invoke advertised commands (with JSON params + timeout) and queue pending work (`status.request` / `location.request`) — both flagged as **dynamic envelopes** because upstream Gateway schemas aren't typed yet, so the UI never invents a per-command schema.

The panel renders verbatim what the BFF returns (`DeckGoNodeInvokeResponse.payloadJSON`, `DeckGoNodePendingEnqueueResponse.queued`) — no client-side interpretation that would mislead operators about whether the action actually committed on the remote device.

## How to implement

1. **Browser-open `prototype.html`** to feel the multi-action lifecycle (select node → confirm action → result), the platform color palette, and the orphan pairing detail mode.
2. Read [`components.md`](./components.md) — component tree + prop contracts + 11 local molecules.
3. Read [`states.md`](./states.md) — state machines for selection / confirm / refresh / orphan-vs-node modes.
4. Read [`interactions.md`](./interactions.md) — keyboard, hover/focus, two-step confirm flow, edge cases.
5. Read [`api-usage.md`](./api-usage.md) — the 8 BFF endpoint shapes + scope-and-audit table + dynamic-envelope rule.
6. Read [`implementation-notes.md`](./implementation-notes.md) — design decisions, contract reconciliations, stack locks.

## File layout

```
nodes/
├── prototype.html         # 22-line multi-script-tag shell
├── data.js                # 5 nodes + 2 pairing requests + COMMAND_TEMPLATES + ACTION_FIXTURES
├── icons.jsx              # 24 svg icons + 5 molecules + 3 helpers
├── tweaks-panel.jsx       # shared design-mode panel
├── nodes-rail.jsx         # left rail: KPI strip + pending pairing list + node inventory list + footer pair-request action
├── node-detail.jsx        # right pane: hero + lifecycle + pairing actions + capabilities + invoke + pending work + raw json
├── app.jsx                # NodesApp orchestrator + selection + action lifecycle
├── styles.css             # ~700 lines — shell, rail, detail, action cards, json view, status dots, platform pills
├── tokens.css             # canonical tokens mirror
└── prototype-v1-codex.html  # preserved V1 codex single-file prototype
```

## Open questions for implementation

- **Polling**: production should poll `GET /api/nodes` + `GET /api/nodes/pair` on a 5–10s interval (or wire to a future WS broadcast). Prototype is static.
- **Command schema**: typed advertised-command schemas are not in the contract. The BFF could grow a `node.commands.describe` RPC that returns JSON Schema for each command id; the UI would then replace the freeform JSON textarea with a generated form (per the api-explorer pattern).
- **Pairing audit log**: `pair.approve` / `pair.reject` should produce activity-feed events. Out of scope for this prototype but flagged in implementation-notes.
- **Bulk actions**: refresh all + reject all pending. Deferred — needs UX vetting (don't accidentally reject every device after a network blip).
- **Token verify UX**: prototype uses a single text field. Production may want a **camera scan** (QR), a **clipboard auto-detect**, or a **paste guard** that rejects clearly-wrong shapes (e.g., spaces, very short strings).
- **Repair vs new**: the `isRepair` flag drives a different visual tone; verify with operators that the distinction is operationally meaningful (some teams treat them identically for approval).
- **JSON params validation**: the prototype validates as `JSON.parse` only. Production may want `zod`-based per-command schema validation once `node.commands.describe` exists.
- **Pending work payload**: contract returns `queued: Record<string, unknown>` — opaque. Verify whether the UI should render structured fields (priority, scheduledAt, etc.) when the BFF eventually narrows the shape.

## Why a 2-pane workspace and not something else

Considered three layouts:

1. **List → page transition** (like agents): clicking a node would navigate away. Rejected — operators frequently scan the rail for status changes and need both surfaces visible during action confirmation. Page transition would force constant context switching for routine triage.
2. **Three-column** (rail + lifecycle + actions stacked): considered but the action surfaces are tall (invoke form, pending work form, raw JSON) and would force a 3rd column to scroll vertically while the 2nd remains static. Felt fragmented.
3. **2-pane workspace** (chosen): rail stays sticky, detail is a single scrollable column. Pairing + capabilities + actions cascade naturally. Confirm row injects above all action cards so it's always visible during the two-step flow.

Same shape used by docs (tree + viewer) and memory (file tree + content). Pattern is now used by 3+ panels — strong promotion candidate for `<TwoPaneWorkspace>` (covered in implementation-notes).

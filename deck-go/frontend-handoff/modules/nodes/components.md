# Components

## Tree

```
NodesApp                                  app.jsx
├── NodesRail                             nodes-rail.jsx
│   ├── nodes-rail__head                  brand + Refresh button
│   ├── nodes-rail__kpis (4 cards)        Nodes / Connected / Paired / Pending
│   ├── rail-section--pending             (when pairing.length > 0)
│   │   └── pending-row × N               request id + display name + repair/new tag + orphan hint
│   ├── rail-section (Inventory)
│   │   └── node-row × N                  status dot + title + platform pill + meta + cap chips
│   └── nodes-rail__foot                  Request pairing… CTA
│
└── NodeDetail                            node-detail.jsx
    ├── (orphan branch)                    if selectedKey is pair:* with no matching node
    │   ├── orphan-hero                    request meta + warn pill
    │   ├── ConfirmRow                     (when pendingAction set)
    │   ├── ActionResult                   (when actionResult set)
    │   └── action-card × 2                Pairing request (Approve/Reject) + Raw request JSON
    │
    └── (node branch)                      otherwise
        ├── detail-hero
        │   ├── detail-hero__head          h1 + RenameForm + platform/lifecycle/seen pills
        │   └── detail-hero__meta          node id + model + remote ip + versions
        ├── ConfirmRow                     (when pendingAction set)
        ├── ActionResult                   (when actionResult set)
        ├── PairingActions
        │   ├── (pending branch)           Approve + Reject
        │   ├── (unpaired branch)          Request pairing + Verify token row
        │   └── (idle branch)              Trust state OK
        ├── action-card--cap                CapsCluster + commands + PermissionGrid + PATH
        ├── InvokeForm                      command select + timeout + JSON textarea + Invoke confirm gate
        ├── PendingWorkForm                 type select + priority select + wake checkbox + Queue confirm gate
        └── action-card--raw                JsonView of DeckGoNodeSummary
```

## Component contracts

### `<NodesApp />`

Root orchestrator. Owns:

- `nodes: DeckGoNodeSummary[]` — inventory (mock-mutates on rename/approve/verify)
- `pairing: DeckGoPairingRequest[]` — pending requests (mock-mutates on approve/reject/request)
- `selectedKey: string` — `"node:<nodeId>"` or `"pair:<requestId>"`. Persisted to URL hash in production (out of scope here).
- `pendingAction: { kind, label, hint, danger, payload } | null` — set when user requests action; cleared on confirm/cancel.
- `actionResult: { heading, subhead, atMs, payload, body? } | null` — last completed action's normalized display result.
- `refreshing: boolean` — gates Refresh button during the 320ms mock latency.
- `busy: boolean` — gates action buttons during the 360ms mock action latency.

Computes `selectedNode` + `orphanRequest` derived from `selectedKey`.

### `<NodesRail />`

Pure presentation. Reads `nodes`, `pairing`, `selectedKey`. Emits `onSelectNode(node)`, `onSelectPending(req)`, `onRefresh()`, `onPairRequest()`. The pending pairing surface auto-disappears when `pairing.length === 0`.

### `<NodeDetail />`

Branch on `(node, pairingMode)`:

- `node` set → full detail (hero + lifecycle + pairing + capabilities + invoke + pending + raw)
- `node` null + `pairingMode` (orphan request) → orphan-only detail (no describe, no commands, just approve/reject + raw)
- both null → empty state ("Pick a node…")

### `<PairingActions />`

Branches on:

- `pending` set → request awaiting decision (Approve / Reject)
- `node.paired === false` → unpaired (Request pairing + Verify token)
- otherwise → idle ("Trust state OK")

### `<InvokeForm />`

Local state: `command` (selects from `node.commands`), `timeout` (text input, parsed to ms), `params` (JSON textarea seeded from `COMMAND_TEMPLATES` per command), `paramsError`. Resets when the parent `nodeId` changes.

The submit handler does not send the action — it raises a `pendingAction` that the parent confirms. This is the **two-step gate** for any remote command dispatch.

### `<PendingWorkForm />`

Local state: `type: DeckGoNodePendingWorkType`, `priority: DeckGoNodePendingWorkPriority`, `wake: boolean`. Same two-step gate as InvokeForm.

### `<ConfirmRow />`

Reusable inline confirm banner. Identical UX to docs `Delete?` and memory `Reset?` confirms — promotion candidate already documented elsewhere; this is the third use case.

### `<ActionResult />`

Inline success result panel (heading + subhead + relative time + raw JSON payload). Replaces the prior `actionResult` on the next successful action; cleared when switching nodes/requests.

### `<RenameForm />`

Inline single-line rename. Disabled when name unchanged. Triggers a non-danger confirm gate (rename is reversible but still wants user attention because it changes audit logs).

## Local molecules

| Molecule          | Purpose                                                           | Promotion candidate?                                                           |
| ----------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `PlatformPill`    | Color-coded OS pill (mac / linux / windows / android / ios)       | **Promote** when 2nd module needs it (e.g., agents → device family)            |
| `StatusDot`       | 10×10 colored dot for connection × pairing tone (ok/warn/neutral) | Reusable wherever a single-glance status indicator fits                        |
| `CapsCluster`     | N caps shown + `+overflow` chip                                   | Reusable in any tag/cap surface; consider DS atom                              |
| `PermissionGrid`  | Auto-fit grid of perm chips (allowed/denied tone)                 | Reusable for any boolean key→bool map                                          |
| `JsonView`        | Pretty-printed, scrolled-bounded, copy-chip JSON viewer           | Reusable in api-explorer / memory action result / activity raw — strong DS bid |
| `ConfirmRow`      | Inline danger gate (label + hint + Cancel/Confirm)                | **Promotion candidate** (3rd use across docs/memory/nodes — gate met)          |
| `ActionResult`    | Inline action-result row with relative time + JSON payload        | Specific to action-dispatch panels (memory dreams + nodes); eligible after 3rd |
| `RenameForm`      | Inline rename with dirty-detect                                   | Specific; not promotion candidate                                              |
| `InvokeForm`      | Command + timeout + JSON params + dispatch gate                   | Specific to remote-action surfaces                                             |
| `PendingWorkForm` | Type + priority + wake + dispatch gate                            | Specific to nodes pending work                                                 |
| `PairingActions`  | Branching action card per pairing state                           | Specific to nodes; not promotion candidate                                     |

## Tone semantics

| Tone      | Use case                                          | Source                                             |
| --------- | ------------------------------------------------- | -------------------------------------------------- |
| `ok`      | connected + paired, action success                | `--ds-success`                                     |
| `warn`    | repair pending / pairing pending / paired offline | `--ds-warning`                                     |
| `neutral` | unpaired (no danger, just informational)          | `--ds-text-faint` shell                            |
| `danger`  | reject pairing (action that breaks the request)   | `--ds-danger` (only on Reject + ConfirmRow danger) |

## Depends on canonical patterns

When productionized in `frontend-new/src/components/panels/nodes/`:

- `PageShell` for the outer page chrome (`@/design-system/patterns`)
- `EmptyState` for "no node selected" / "no nodes" / "all paired"
- The 2-pane shell (rail + main column) is now shared by **3 panels** (docs / memory.browse / nodes) — formal `<TwoPaneWorkspace>` pattern is overdue. See implementation-notes.

## Depends on canonical icons

| Local        | Canonical      | Used by                                                   |
| ------------ | -------------- | --------------------------------------------------------- |
| IconNode     | `IconNode`     | rail brand, empty state                                   |
| IconRefresh  | `IconRefresh`  | rail Refresh button                                       |
| IconLink     | `IconLink`     | request pairing CTA, orphan hint                          |
| IconUnlink   | `IconUnlink`   | unpaired pill                                             |
| IconAlert    | `IconAlert`    | confirm row, error line, pending pairing label, warn pill |
| IconCheck    | `IconCheck`    | approve, action result heading                            |
| IconX        | `IconX`        | reject                                                    |
| IconPlay     | `IconPlay`     | invoke command                                            |
| IconQueue    | `IconQueue`    | pending work                                              |
| IconShield   | `IconShield`   | pairing card                                              |
| IconCpu      | `IconCpu`      | capabilities & commands header                            |
| IconWifi     | `IconWifi`     | connected lifecycle pill                                  |
| IconClock    | `IconClock`    | "seen Xs ago"                                             |
| IconCopy     | `IconCopy`     | json view copy chip                                       |
| IconTerminal | `IconTerminal` | command chips                                             |
| IconKey      | `IconKey`      | verify token                                              |
| IconHash     | `IconHash`     | raw request / raw summary                                 |
| IconWrench   | `IconWrench`   | rename action                                             |

(Additional `IconShieldOff`, `IconLock`, `IconUnlock`, `IconWifiOff`, `IconExternal`, `IconChevron` are reserved and bundled in `icons.jsx` for future use.)

## Out-of-scope (intentionally not modeled)

- **Remote shell streaming** — contract has no streaming endpoint; rendering a "shell" tab would lie about capability.
- **File transfer** — no contract.
- **Location visualization** — `location.request` is fire-and-forget; the contract doesn't return coordinates that the UI could plot.
- **Trust proofing** — pairing approval is one-button; there's no contract for inspecting CA chains, attestation, etc. The UI shows what the contract gives (request id + display name + node id + platform + isRepair + ts) and nothing more.
- **Auto-approval** — every approve is a manual operator decision per the contract intent.

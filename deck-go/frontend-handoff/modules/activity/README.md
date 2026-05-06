# Activity (Unified Feed)

**Status**: implemented (sha d7ab0bb9b612ca120ec1d1e7ced6bef92e8f2508)
**Design completed**: 2026-05-04
**Designer**: design agent (Claude)
**Depends on atoms**: Pill, Badge, Tag, Button, IconButton, Modal, KbdHint, Avatar, EmptyState
**Depends on canonical patterns**: PageShell, EmptyState
**Depends on canonical icons**: IconSearch, IconRefresh, IconCheck, IconX, IconAlert, IconInfo,
IconErrorCircle, IconClock, IconActivity, IconAgent, IconBranch, IconChevronDown/Right, IconTool,
IconShield, IconChannel, IconKey, IconKbd, IconMessage, IconArrowDown/Up, IconStop, IconTarget,
IconPower, IconCopy
**New atoms needed**: none — local prototype molecules (`event-glyph`, `agent-chip`, `feed-row`,
`feed-group-header`) all map to existing atoms
**New tokens needed**: none — uses canonical `--ds-*`
**Backend endpoints used**: see `api-usage.md` (`DeckGoActivityResponse` + BFF severity projection)

## What this module does

Single-page unified timeline across every event type the runtime emits — agent lifecycle, tool
calls, channel connect/disconnect, config changes, alert fires, approval flows. Severity is
decoded from the event type by the BFF; the raw frame stays close to the contract.

Unlike list/detail panels (channels / models / plugins / skills / subagents), this panel is
**flat**: a virtualizable feed with hour-bucket headers, click any row to inspect raw event JSON
in a modal. No detail page — a feed row IS the surface.

## How to implement

1. Open `prototype.html` in a browser:
   - 60+ events spanning 21 event types and the full severity range.
   - Filter by family (Agent / Tools / Messages / Subagents / Channels / Ops), severity (Info /
     OK / Warn / Errors), or time range (1h / 6h / 24h / All).
   - Click any row → EventDetailDialog with copyable JSON.
   - Tweaks panel exposes feed-state, every filter, and the dialog toggle.
2. Read `components.md`, `states.md`, `interactions.md`, `api-usage.md` for engineering handoff.
3. Translate each `.jsx` file to TypeScript at the production target listed in `components.md`.
   Replace `__fixtures__` mock with real fetch hooks. Keep kebab-case classes verbatim.

## Open questions for Claude Code

- **Virtualization library.** Prototype renders all 60+ events synchronously. For production
  with thousands of events, the FeedView needs `react-virtual` (or equivalent). Stack decision
  triggered: pick a virtualization library when the first chart-heavy panel ships, OR earlier
  if activity ships before then.
- **Severity projection authority.** Prototype derives severity from `type` in
  `TYPE_FAMILY`. If the BFF prefers to emit `severity` directly, drop the client-side mapping
  and treat the BFF field as authoritative.
- **Live tail vs poll.** Prototype loads a snapshot. Production needs a streaming option (SSE /
  WebSocket) for live tail. Spec the contract before implementing.
- **Group bucket size.** Prototype groups by hour. Confirm whether 5-min buckets work better
  for high-volume runtimes; this should be a per-user pref.

## File inventory (v2)

```
activity/
├── README.md                    ← this file
├── prototype.html               ← ~30-line shell loading external .jsx via Babel standalone
├── prototype-v1-codex.html      ← preserved V1 single-file prototype (reference)
├── app.jsx                      ← App shell + dialog wiring + ⌘K/⌘R/Esc
├── feed-view.jsx                ← KPI strip + filter bar + virtualized timeline (one file, no detail)
├── dialogs.jsx                  ← EventDetailDialog (raw JSON viewer)
├── data.js                      ← contract-shaped MOCK with 60+ events covering all 21 types
├── icons.jsx                    ← 24 SVG icons + EventGlyph + AgentChip + TYPE_FAMILY map
├── styles.css                   ← Linear-inspired, --ds-* tokens only, dark/light + density-aware
├── tokens.css                   ← mirror copy of canonical tokens
├── tweaks-panel.jsx             ← shared design-time tooling
├── components.md                ← production component skeleton + props shapes
├── states.md                    ← feed states + filter compose + a11y
├── interactions.md              ← keyboard / pointer / hover / dialog flows
└── api-usage.md                 ← endpoint truth + DTO shapes + BFF projections + assumptions
```

## Reverse sign-off

| Field                          | Value                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Final sign-off status          | `accepted-with-exceptions`                                                                                                      |
| Reviewer                       | Codex                                                                                                                           |
| Date                           | 2026-05-06                                                                                                                      |
| Prototype reference            | `frontend-handoff/modules/activity/prototype.html`                                                                              |
| Production reference           | `frontend-new/src/components/panels/activity/`                                                                                  |
| Mock functional evidence       | `frontend-handoff/audit/module-evidence-manifest.json` (`activity`, `mock-functional`, verdict: `recorded-by-visual-spec`)      |
| Mock prototype parity evidence | `frontend-handoff/audit/module-evidence-manifest.json` (`activity`, `mock-prototype-parity`, verdict: `pass-with-exceptions`)   |
| Real Gateway evidence          | `frontend-handoff/audit/module-evidence-manifest.json` (`activity`, `real-gateway`, status: `recorded-in-implementation-notes`) |
| Accepted exceptions            | See `frontend-handoff/audit/module-evidence-manifest.json` and `frontend-handoff/modules/activity/implementation-notes.md`.     |

This reverse sign-off is a current-code evidence index. It does not upgrade `unreviewed` prototype parity verdicts to visual acceptance; those remain explicit in the manifest.

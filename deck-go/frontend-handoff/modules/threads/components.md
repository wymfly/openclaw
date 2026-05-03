# threads — components (v2)

## Tree

```
ThreadsApp                                    [app.jsx]
├─ Topbar                                     [app.jsx — inline]
│  ├─ eyebrow / title / subtitle
│  ├─ status pill (Ready | Refreshing…)
│  └─ ⌘K kbd hint
├─ ThreadsListView (when view=list)           [list-view.jsx]
│  ├─ MetricStrip (bindings / active 24h / channels / agents / auto / visible)
│  ├─ Toolbar
│  │  ├─ Search input
│  │  ├─ ChannelKind segmented (all / discord / telegram / wecom / slack / qq)
│  │  ├─ TargetKind segmented (any / claude-code-session / agent-loop / external-bot)
│  │  ├─ Recency segmented (all / active 24h / stale)
│  │  └─ Refresh button
│  └─ ThreadList (sticky header + 6-col rows)
│     └─ ThreadRow × N                        [list-view.jsx]
└─ ThreadDetailView (when view=detail)        [detail-view.jsx]
   ├─ Hero
   │  ├─ Back button
   │  ├─ ChannelTile + arrow + agent + TargetKindPill + stale pill
   │  ├─ Title (label || threadId)
   │  ├─ Meta row (bound / last-activity / by)
   │  └─ Action row (Open chat / Rename / Re-bind / Unbind / Raw entry)
   ├─ TabBar (Overview / Recent activity / Audit / Raw entry)
   └─ Body (per-tab)
      ├─ OverviewTab — KV grid + scope warning
      ├─ ActivityTab — BFF projection timeline
      ├─ AuditTab — mutation log timeline
      └─ RawTab — DeckGoThreadEntry JSON
```

## Dialogs

| Component        | Trigger              | Body                                                   |
| ---------------- | -------------------- | ------------------------------------------------------ |
| `UnbindDialog`   | Hero "Unbind"        | confirm → 3-phase wizard (idle → running → done)       |
| `RebindDialog`   | Hero "Re-bind agent" | agent select → 3-phase wizard                          |
| `RenameDialog`   | Hero "Rename label"  | text input (max 120) → 3-phase wizard                  |
| `RawEntryDialog` | Hero "Raw entry"     | pretty-printed JSON read-only                          |
| `OpenChatStub`   | Hero "Open chat"     | placeholder modal — production navigates to Chat panel |

All dialogs share `ModalShell` (Esc + backdrop click to close).

## Local molecules

### ChannelTile

`<span class="channel-tile channel-tile--{tone}">{glyph}{label}{id}</span>`

5 tones: `accent` (telegram), `violet` (discord), `success` (wecom),
`magenta` (slack), `amber` (qq). Default `iron` for unknown channels.

Used in: list rows, detail hero. Strong promotion candidate — channels panel
already uses a near-identical shape.

### TargetKindPill

`<span class="target-pill target-pill--{tone}">{Icon}{label}</span>`

3 known tones: `accent` (claude-code-session), `violet` (agent-loop),
`amber` (external-bot). Compact uppercase pill.

### ActivityKindBadge

`<span class="activity-badge activity-badge--{tone}">{label}</span>`

5 tones: `accent` (tool.call), `violet` (model.call), `success` (channel.inbound),
`warm` (channel.outbound), `magenta` (agent.handoff).

Used only in `ActivityTab` timeline.

### MetricTile

6-column KPI strip. Variant `--accent` for the "Active 24h" tile to draw the eye.

### ThreadRow

6-column grid:

1. **Channel** — `ChannelTile` chip.
2. **Agent · session** — agent id (bold) + session key (mono small) +
   optional label.
3. **Target** — `TargetKindPill`.
4. **Account · bound by** — account id with user icon + bound-by string.
5. **Last activity** — relative time (success when active, warn when stale)
   - absolute timestamp.
6. **Bound** — relative time only.

`thread-row--stale` variant (warn-bg tint) when `now - lastActivityAt > 24h`.

## Props (production target)

```ts
type ThreadsListViewProps = {
  threads: DeckGoThreadEntry[];
  query: string;
  onQueryChange: (q: string) => void;
  channelKindFilter: string; // "__all__" | "discord" | ...
  onChannelKindChange: (k: string) => void;
  targetKindFilter: string; // "__all__" | "claude-code-session" | ...
  onTargetKindChange: (k: string) => void;
  staleFilter: "all" | "active" | "stale";
  onStaleChange: (s: string) => void;
  onSelect: (threadId: string) => void;
  channelKinds: string[];
  targetKinds: string[];
  channelKindFromId: (id: string) => string;
  now: number;
  onRefresh: () => void;
};

type ThreadDetailViewProps = {
  thread: DeckGoThreadEntry;
  recentActivity: Record<string, ActivityEvent[]>;
  auditTrail: Record<string, AuditEvent[]>;
  channelKindFromId: (id: string) => string;
  now: number;
  activeTab: "overview" | "activity" | "audit" | "raw";
  onTabChange: (t: string) => void;
  onBack: () => void;
  onUnbind: () => void;
  onRebind: () => void;
  onRename: () => void;
  onOpenChat: () => void;
  onOpenRaw: () => void;
};
```

## Class-name intent

| Class                                    | Purpose                      |
| ---------------------------------------- | ---------------------------- |
| `.threads-app`                           | Top-level grid               |
| `.threads-app__topbar`                   | Topbar with title + status   |
| `.list-view`                             | List-view container          |
| `.list-view__metrics`                    | KPI strip                    |
| `.list-view__toolbar`                    | Filter toolbar               |
| `.thread-list`                           | Binding rows wrapper         |
| `.thread-row` / `--stale`                | Single binding row variants  |
| `.channel-tile--{tone}`                  | Channel chip variants        |
| `.target-pill--{tone}`                   | Target kind pill variants    |
| `.activity-badge--{tone}`                | Activity kind badge variants |
| `.detail-view`                           | Detail-view container        |
| `.detail-view__hero`                     | Hero header                  |
| `.tab-bar` / `__tab--on`                 | Tab bar + selected tab       |
| `.kv-grid`                               | Overview KV grid             |
| `.timeline` / `.audit`                   | Detail timeline lists        |
| `.raw-json`                              | Raw entry pre block          |
| `.modal-backdrop` / `.modal`             | Modal shell                  |
| `.phase--running` / `--done` / `--error` | Mutation wizard phase rows   |

# identity — components (v2)

## Tree

```
IdentityApp                                       [app.jsx]
├─ Topbar
│  ├─ eyebrow / title / subtitle (endpoint hint)
│  ├─ baseHash chip + bootstrap status pill
│  └─ ⌘K kbd hint + Refresh
├─ IdentityNav (left rail)                        [identity-nav.jsx]
│  ├─ head: title + canonical count + New CTA
│  ├─ search input
│  ├─ canonical list × N (peer count badge + channel chips + description)
│  └─ foot: baseHash + last-fetch age + Refresh
└─ Main column                                    [app.jsx]
   └─ CanonicalDetail                             [canonical-detail.jsx]
      ├─ Hero: canonical name + description + meta pills + actions (Link / Rename / Delete)
      ├─ Banner (warn): bootstrap-not-ready alert
      ├─ Section: Peers
      │  └─ PeerRow × N (avatar + ChannelPill + peerId + display + last-seen + last-linked + actor + Unlink CTA)
      └─ Section: Recent mutations
         └─ RecentMutationRow × N (kind chip + canonical + time + peer + rename from→to + actor + status pill)
```

## Dialogs

| Component               | Trigger                           | Body                                                                                   |
| ----------------------- | --------------------------------- | -------------------------------------------------------------------------------------- | ------- |
| `LinkPeerDialog`        | Hero "Link peer" CTA              | Channel select + peerId + display + 3-phase wizard (idle → running → done              | error). |
| `UnlinkPeerDialog`      | Per-peer "Unlink" CTA             | Peer KV preview + 3-phase wizard.                                                      |
| `RenameCanonicalDialog` | Hero "Rename" CTA                 | New-name input + 3-phase wizard.                                                       |
| `CreateCanonicalDialog` | Nav "New" CTA                     | Name + description + 3-phase wizard (no drift simulation — create is non-destructive). |
| `DeleteCanonicalDialog` | Hero "Delete" CTA (only if empty) | Confirmation + 3-phase wizard.                                                         |

All dialogs share `ModalShell` (Esc + backdrop click to close, focus trap on
mount). The wizard's `running` phase is non-cancellable. Every mutation
dialog shows the current `baseHash` in the KV grid so operators
understand what version they're committing against.

## Local molecules

### ChannelPill

`<ChannelPill channel="telegram" />` — color-coded per channel (telegram /
discord / slack / wecom / email). Inline ChannelIcon + label. **Strong
promotion candidate** to design system; channels, threads, routing,
permissions panels all need the same per-channel visual cue.

### ChannelIcon

Resolves to per-channel SVG (`IconTelegram` / `IconDiscord` / `IconSlack` /
`IconWecom` / `IconMail`). Falls back to `IconHash` for unknown channels.
Promote together with `ChannelPill`.

### StatusPill

5 tones (`iron` / `accent` / `success` / `warn` / `error`), inline
icon-or-not. Same shape as in settings/threads/etc.

### HashChip

`<HashChip value="..." tone="accent" label="baseHash" />` — monospace
hash display with optional title attribute showing the labeled value.
**Strong promotion candidate** — config panel and settings test-connection
dialog use the same shape.

### ActorChip

`<ActorChip actor="operator:daisy@deck.local" />` — color-codes by actor
prefix:

- `operator:*` → success tone (human action)
- `automation:*` → accent tone (hook/bot action)
- `system` → iron tone (system event)

### PeerRow

3-cell grid: avatar + ID stack on left, meta stack in middle, action(s)
on right. `peer-row--stale` variant when last-seen > 5 hours ago.

### RecentMutationRow

5 mutation kinds (`link-peer` / `unlink-peer` / `rename-canonical` /
`create-canonical` / `delete-canonical`). Each kind has a color-coded
chip. Error variant (`mutation-row--error`) tints the row red when
`ok === false`.

## Per-section renderers

The single right pane is `CanonicalDetail` — there are no nested
schema-driven groups (unlike `config`). The detail pane is curated:
hero + peers section + recent-mutations section.

### Hero

- Eyebrow / canonical name (monospace) / description.
- Optional emoji prefix when canonical name matches agentId (uses
  `agentProfile.emoji`).
- Meta pills: peer count + channel count + baseHash chip.
- Action cluster: Link peer (primary) / Rename / Delete.
- Disabled states:
  - All actions disabled when `bootstrap.ok === false`.
  - Rename/Delete disabled for `system` canonical (immutable in prototype).
  - Delete disabled when `peers.length > 0` (must unlink first).

### Peers section

- Empty state: "No peers linked. Use Link peer to bind a channel peer."
- 3-column PeerRow grid.
- Stale badge appears when `now - lastSeen > 5h`.

### Recent mutations section

- Filtered to mutations scoped to the selected canonical (or where the
  `to` matches it for renames).
- Last 8 events.
- Each row shows kind chip + actor + time + status.

## Props (production target)

```ts
type IdentityAppProps = {}; // self-contained orchestrator

type IdentityNavProps = {
  canonicals: DeckGoIdentityLink[];
  selectedId: string | null;
  onSelect: (canonical: string) => void;
  query: string;
  onQueryChange: (q: string) => void;
  onCreate: () => void;
  fetchedAt: number;
  configHash?: string;
  onRefresh: () => void;
};

type CanonicalDetailProps = {
  canonical: DeckGoIdentityLink | null;
  configHash?: string;
  now: number;
  recentMutations: SaveEvent[]; // BFF projection
  bootstrap: DeckGoBootstrapStatusResponse;
  agentProfile?: DeckGoAgentIdentityResponse;
  onLinkPeer: () => void;
  onUnlinkPeer: (peer: DeckGoIdentityPeer) => void;
  onRename: () => void;
  onDelete: () => void;
};

type LinkPeerDialogProps = {
  canonical: string;
  channels: { id: string; label: string }[];
  configHash?: string;
  onClose: () => void;
  onCommit: (peer: { channel: string; peerId: string; displayName?: string | null }) => void;
};
```

## Class-name intent

| Class                               | Purpose                                   |
| ----------------------------------- | ----------------------------------------- |
| `.identity-app`                     | Top-level grid                            |
| `.identity-app__topbar`             | Header bar                                |
| `.identity-app__layout`             | Two-column workspace                      |
| `.identity-app__main`               | Right pane container                      |
| `.identity-app__hash`               | baseHash chip in topbar                   |
| `.identity-app__bootstrap`          | Bootstrap status pill in topbar           |
| `.identity-nav`                     | Left rail container                       |
| `.identity-nav__item--on`           | Active canonical                          |
| `.identity-nav__peer-count`         | Per-canonical peer count badge            |
| `.identity-nav__channel-chip--*`    | Per-channel mini chip variants            |
| `.canonical-detail`                 | Right pane container                      |
| `.canonical-detail--empty`          | No-canonical-selected state               |
| `.canonical-detail__hero`           | Hero card                                 |
| `.canonical-detail__banner--warn`   | Bootstrap-not-ready warn callout          |
| `.peer-row`                         | Single peer row                           |
| `.peer-row--stale`                  | Stale variant (last-seen > 5h)            |
| `.peer-row__avatar--*`              | Per-channel avatar tint                   |
| `.peer-empty`                       | Empty-peers callout                       |
| `.mutation-row`                     | Single mutation entry                     |
| `.mutation-row--error`              | Failed mutation tint                      |
| `.mutation-row__kind--*`            | Per-mutation-kind chip variants           |
| `.channel-pill--*`                  | Per-channel pill variants                 |
| `.hash-chip` / `.hash-chip--accent` | baseHash display chip                     |
| `.actor-chip--*`                    | Operator/automation/system actor variants |
| `.modal-backdrop` / `.modal`        | Modal shell                               |
| `.phase--running/done/error`        | Mutation wizard phase rows                |

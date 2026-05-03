# channels — components

> Note: this is the v2 multi-file React handoff. Engineering target is
> `frontend-new/src/components/panels/channels/`. Production component
> names will lose the `.jsx`/CSS-class kebab style and adopt PascalCase
>
> - flat tsx + same-name `.css` per module.

## Production component skeleton (target shape)

```
ChannelsPanel
  └── (route) → ChannelsListView
                 ├── ChannelsToolbar (search + filter + new-button)
                 ├── ChannelsKpiStrip
                 └── ChannelInventoryList
                      └── ChannelRow[]
  └── (route) → ChannelsDetailView
                 ├── DetailHero
                 ├── ChannelTabsBar
                 └── (tab body)
                      ├── TabOverview
                      ├── TabThroughput
                      ├── TabProbe
                      ├── TabSettings
                      ├── TabRouting
                      └── TabWeComAccess  // wecom-only
  └── ChannelDialogs
       ├── TestResultDialog
       ├── LogoutDialog
       └── CreateChannelDialog
```

## Prototype file → production target

| Prototype file     | Production target                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| `app.jsx`          | `ChannelsPanel.tsx` (orchestration, route, dialog state)                                                    |
| `list-view.jsx`    | `ChannelsListView.tsx` + `ChannelInventoryRow.tsx` + `ChannelsKpiStrip.tsx`                                 |
| `detail-view.jsx`  | `ChannelsDetailView.tsx` + 6 tab modules                                                                    |
| `dialogs.jsx`      | `dialogs/TestResultDialog.tsx` + `LogoutDialog.tsx` + `CreateChannelDialog.tsx`                             |
| `data.js`          | `__fixtures__/channels.fixture.ts` (test/mocks only — production hits BFF)                                  |
| `icons.jsx`        | re-export `@/design-system/icons` and add lucide aliases for any new symbols                                |
| `styles.css`       | `channels-panel.css`, `channel-row.css`, `channels-detail.css`, etc. (split per component, same kebab name) |
| `tweaks-panel.jsx` | dropped — Tweaks panel is design tooling only                                                               |

## Props (shape contracts)

### ChannelsListView

```ts
interface ChannelsListViewProps {
  channels: ChannelInventoryItem[]; // shaped from DeckGoChannelsStatusResponse
  listState: "ready" | "loading" | "error" | "empty";
  searchQuery: string;
  filter: "all" | "enabled" | "alerts" | "wecom";
  onSearch: (q: string) => void;
  onFilter: (f: "all" | "enabled" | "alerts" | "wecom") => void;
  onSelect: (channelId: string) => void;
  onCreateClick: () => void;
}

interface ChannelInventoryItem {
  id: string;
  label: string;
  detailLabel: string;
  meta: DeckGoChannelUiMeta;
  core: { enabled: boolean; healthy: boolean; accounts: string[] };
  defaultAccountId: string | null;
  // derived in selector:
  throughputSummary?: { messagesIn: number; messagesOut: number };
  probeSummary?: { ok: boolean; latencyMs?: number };
  alertCount?: number;
}
```

### ChannelInventoryRow

```ts
interface ChannelInventoryRowProps {
  channel: ChannelInventoryItem;
  selected: boolean;
  onSelect: (id: string) => void;
}
```

Renders 6 columns: glyph, id+meta, throughput sparkline + count, probe pill,
account count, status pill. Selectable via click or keyboard (Enter / Space).

### ChannelsDetailView

```ts
interface ChannelsDetailViewProps {
  channel: ChannelInventoryItem;
  detailState: "ready" | "loading" | "error";
  activeTab: ChannelTabId;
  onTabChange: (tab: ChannelTabId) => void;
  throughputWindow: "1h" | "6h" | "24h";
  onThroughputWindow: (w: "1h" | "6h" | "24h") => void;
  configDirty: boolean;
  onConfigDirty: (v: boolean) => void;
  onBack: () => void;
  onTest: () => void;
  onLogout: () => void;
}

type ChannelTabId = "overview" | "throughput" | "probe" | "settings" | "routing" | "wecom"; // only when channel.id === "wecom"
```

### TabOverview

KPI tiles (in/out/probe-latency/accounts) + alerts list (when alerts exist) +
quick links action row.

### TabThroughput

```ts
interface TabThroughputProps {
  channelId: string;
  buckets: DeckGoChannelThroughputBucket[];
  messagesIn: number;
  messagesOut: number;
  window: "1h" | "6h" | "24h";
  onWindow: (w: "1h" | "6h" | "24h") => void;
}
```

CSS-only stacked-bar chart (`.chart` / `.chart__bar` / `.chart__seg--in/out`).
For prototype, no chart library — engineering may swap to a chart lib if
ops demands more interactivity (see future stack-decisions trigger).

### TabProbe

Probe result card (success/fail) + manual "Run probe" trigger + account
diagnostic list (full account list, not just alerting).

### TabSettings

Form: enable toggle, retry attempts (number), jitter (number), webhook
toggle + URL, free-form JSON patch textarea. Keeps `dirty` state at the
section level. Save → `PATCH /channels/{id}` with current `baseHash`.

### TabRouting

```ts
interface TabRoutingProps {
  channelId: string;
  routing: DeckGoRoutingListResponse | null;
}
```

Binding rows showing tier · match (channel/acct/peer/guild/team) · agent.
"Add binding" opens a side flow (out-of-scope for v2 prototype; flagged
in api-usage.md).

### TabWeComAccess

```ts
interface TabWeComAccessProps {
  accounts: string[];
  accessByAccountId: Record<string, WeComAccessState>;
}

interface WeComAccessState {
  allowBots: boolean;
  allowFromAgents: string[];
  dynamicAgentsEnabled: boolean;
  failClosedRouting: boolean;
  lastSavedMs: number;
}
```

Each account renders as a card with allow-from-agents list, three toggles,
last-saved timestamp.

### Dialogs

| Dialog              | Props                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| TestResultDialog    | `{ open, channel, onClose }` — shows last probe result for the channel (or "channel disabled, no probe" banner). |
| LogoutDialog        | `{ open, channel, onCancel, onConfirm }` — confirms before `POST /channels/{id}/logout`.                         |
| CreateChannelDialog | `{ open, onClose, onCreated(id) }` — 3 steps: provider pick → account id + enable toggle → review.               |

## Class naming

Production should keep the prototype's kebab-case classes for diff
clarity, prefixed with `channels-` per component scope:

- `.list-view`, `.list-view__head`, `.list-view__title`
- `.kpi-strip`, `.kpi`, `.kpi__label`, `.kpi__value`
- `.row`, `.row__id`, `.row__throughput`, `.row__bar`
- `.detail__head`, `.hero`, `.hero__title`, `.hero__meta`
- `.tabs`, `.tab`, `.tab__count`
- `.section`, `.section__head`, `.section__title`
- `.tile-row`, `.tile`, `.tile__label`, `.tile__value`
- `.chart`, `.chart__bar`, `.chart__seg--in`, `.chart__seg--out`
- `.acct-list`, `.acct-row`, `.acct-row__indicator`
- `.binding-list`, `.binding`, `.binding__tier`, `.binding__agent`
- `.wecom-grid`, `.wecom-card`, `.wecom-card__row`
- `.modal-backdrop`, `.modal`, `.modal__head`, `.modal__body`, `.modal__foot`
- `.wizard-steps`
- `.toolbar`, `.toolbar__search`, `.toolbar__filter`
- `.pill`, `.pill--ok`, `.pill--warn`, `.pill--err`, `.pill--info`, `.pill--muted`
- `.toggle`, `.toggle__switch`

## Accessibility

- Inventory rows: `role="button"` `tabIndex={0}` `onKeyDown` for Enter/Space.
- Tabs: `role="tablist"` + `role="tab"` + `aria-selected`.
- Modals: `role="dialog"` `aria-modal="true"` `aria-label`.
- Throughput chart: `role="img"` with `aria-label` carrying the numeric
  in/out totals (color is not the only signal).
- Status pills always render text (`healthy` / `degraded` / `disabled` /
  `${latency}ms`); color is decorative.

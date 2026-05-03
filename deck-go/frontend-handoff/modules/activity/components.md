# activity — components

> v2 single-page handoff. Engineering target is
> `frontend-new/src/components/panels/activity/`.

## Production component skeleton

```
ActivityPanel
  └── ActivityFeedView
       ├── ActivityToolbar (search + family seg + severity seg + time-range seg)
       ├── ActivityKpiStrip
       └── (virtualized rows)
            ├── GroupHeader[]
            └── FeedRow[]
                 ├── EventGlyph (severity-tinted)
                 └── AgentChip (when event has agentId)
  └── ActivityDialogs
       └── EventDetailDialog
```

No `DetailView`. A feed row's primary action is opening the EventDetailDialog; navigation never
leaves the panel.

## Prototype file → production target

| Prototype file     | Production target                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| `app.jsx`          | `ActivityPanel.tsx`                                                                                         |
| `feed-view.jsx`    | `ActivityFeedView.tsx` + `ActivityKpiStrip.tsx` + `ActivityToolbar.tsx` + `FeedRow.tsx` + `GroupHeader.tsx` |
| `dialogs.jsx`      | `dialogs/EventDetailDialog.tsx`                                                                             |
| `data.js`          | `__fixtures__/activity.fixture.ts`                                                                          |
| `icons.jsx`        | `@/design-system/icons` re-exports + `EventGlyph.tsx` + `AgentChip.tsx` local                               |
| `styles.css`       | per-component `.css` files (kebab-case)                                                                     |
| `tokens.css`       | dropped (canonical lives in `frontend-new/src/design-system/tokens/`)                                       |
| `tweaks-panel.jsx` | dropped (design-time tooling only)                                                                          |

## Props (shape contracts)

### ActivityFeedView

```ts
interface ActivityFeedViewProps {
  events: ActivityEvent[]; // from DeckGoActivityResponse.events
  feedState: "ready" | "loading" | "error" | "empty";
  searchQuery: string;
  filter: "all" | "agent" | "tool" | "msg" | "subagent" | "channel" | "ops";
  severity: "all" | "info" | "ok" | "warn" | "err";
  timeRange: "1h" | "6h" | "24h" | "all";
  asOfMs: number;
  runtimeId: string;
  onSearch: (q: string) => void;
  onFilter: (f: ActivityFamilyFilter) => void;
  onSeverity: (s: ActivitySeverityFilter) => void;
  onTimeRange: (t: ActivityTimeRange) => void;
  onSelect: (eventId: string) => void;
  onRefresh: () => void;
}

interface ActivityEvent extends DeckGoActivityEvent {
  // pure pass-through; severity is derived client-side from `type`
}
```

### FeedRow

```ts
interface FeedRowProps {
  event: ActivityEvent;
  nowMs: number; // for stable relative-time rendering
  onSelect: (eventId: string) => void;
}
```

### GroupHeader

```ts
interface GroupHeaderProps {
  label: string; // hour bucket label, e.g. "2026-05-04 14:00"
  count: number;
}
```

### EventDetailDialog

```ts
interface EventDetailDialogProps {
  open: boolean;
  event: ActivityEvent | null;
  onClose: () => void;
}
```

## Class naming

- `.list-view` (feed wrapper)
- `.kpi-strip` / `.kpi`
- `.toolbar` / `.toolbar__search` / `.seg` / `.seg__btn`
- `.feed` / `.feed-group-header` / `.feed-group-header__bar` / `.feed-group-header__label`
- `.feed-row` / `.feed-row--{ok|warn|err|info|muted}` / `.feed-row__rail` / `.feed-row__main` /
  `.feed-row__head` / `.feed-row__type` / `.feed-row__desc` / `.feed-row__details` / `.feed-row__ts`
- `.event-glyph` / `.event-glyph--{ok|warn|err|info|muted}`
- `.agent-chip` / `.agent-chip__avatar`
- `.list-state` / `.list-state--{loading|error|empty}`
- `.modal-backdrop` / `.modal--event` / `.modal__head/body/foot`
- `.diag-block` / `.diag-block__label` / `.diag-block__pre`
- `.code-block` / `.code-block--inline`
- `.pill` / `.pill--{ok|warn|err|info|muted}`
- `.btn` / `.btn--{ghost|primary}`

## Accessibility

- Feed rows: `role="button"`, `tabIndex={0}`, Enter/Space activates.
- Family / severity / time-range segments: `role="tablist"` + `role="tab"` + `aria-selected`.
- Group headers: `role="separator"` (production) or visually decorative `aria-hidden="true"`
  if not load-bearing.
- Modal: `role="dialog"` + `aria-modal="true"` + `aria-label`. Focus trap; Esc close.
- Event glyph: decorative; severity also conveyed by the type label and feed-row tint, so the
  glyph carries `aria-hidden="true"`.
- Live tail (production): the feed should use `aria-live="polite"` for new events; production
  must throttle announcements (every 30s or on user-pause).

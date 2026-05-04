# States

State machines for the webhooks panel. Where transition timing is given, it represents the **prototype's simulated behavior** — production timing is bounded by network round-trips.

## App-level state

```
┌──────────────────────────────┐
│  initial-load                │
│  webhooks unknown            │
│  selectedId from URL hash    │
└────────┬─────────────────────┘
         │ fetchWebhooks
         │ fetchDeliveries (last 100)
         ▼
┌──────────────────────────────┐
│  ready                       │
│  webhooks[] populated        │
│  selectedId either:          │
│    - matches a row → detail  │
│    - null → empty pane       │
└────────┬─────────────────────┘
         │ row clicked → setSelectedId
         │ + URL hash updated (no reload)
         ▼
┌──────────────────────────────┐
│  detail-rendered             │
│  tab = "overview" by default │
│  expandedDeliveryId = null   │
│  testPhase = "idle"          │
└──────────────────────────────┘
```

## List filter state

```
filter ∈ {all | enabled | disabled | failing}
query ∈ string

filtered = webhooks
  .filter(filter rule)
  .filter(name | url | id | events.* matches query, case-insensitive)
```

Counts in seg-filter chips reflect **unfiltered-by-query** counts (so the user always sees how many webhooks fall into each bucket regardless of search). Only the visible row count uses both filter + query.

## Detail tabs

`tab ∈ {overview | deliveries | settings | audit}`. Tab switch is local to `<WebhookDetail>` — no URL change.

## Test delivery phases

```
idle ──click──▶ running ──~920ms──▶ done       (sim 85%)
                  │                ──error      (sim 15%)
                  └────────────────▶
              done / error stay 1200ms then → idle
```

Visual:

- **idle** — `<IconSend /> Test delivery`, normal accent btn
- **running** — `Sending…`, btn--running cursor:wait, disabled
- **done** — `<IconCheck /> Delivered`, ok tone
- **error** — `<IconAlert /> Test failed`, danger tone

The webhook's `lastFiredAt` and `lastStatus` should optimistically update on `done` (production should reconcile from the deliveries endpoint).

## Builder modal phases

```
closed ──new/edit──▶ idle
   ▲                 │
   │                 ├──save (valid)──▶ saving (~700ms) ──▶ done (~600ms) ──▶ closed (commit)
   │                 │
   ├──cancel─────────┤
   ├──Esc────────────┤  (only if phase === "idle")
   └──backdrop───────┘
```

While `saving`, all inputs disabled, close/cancel disabled, save button shows "Saving…". On `done`, button shows `<IconCheck /> Saved` then auto-closes. The webhook is committed to `webhooks[]` only at the close transition.

## Validation gates (builder)

Save is enabled only when **all three** are true:

- `name.trim().length > 0`
- `URL_PATTERN.test(url.trim())` (matches `^https?://[^\s]+$/i`)
- `events.length > 0`

Inline error hints surface when:

- URL field has content but doesn't match the pattern → "Must be a valid http(s) URL" under the input + `.input--invalid` border
- Events array is empty → "Select at least one event to subscribe to" under the chip grid

## Delete confirm phases

```
idle ──Delete clicked──▶ confirm-modal
                            │
                            ├──Cancel/backdrop/Esc──▶ idle
                            └──Confirm──▶ webhook removed
                                            │
                                            └──if was selected, selectedId
                                              falls back to first remaining
                                              webhook or null
```

## Delivery row expand

```
collapsed ──row click──▶ expanded
expanded ──row click again──▶ collapsed
expanded ──different row clicked──▶ that row expands, this collapses
```

Only one delivery row can be expanded at a time. Expanded content includes:

- Payload (JSON) — read-only `<pre>` block
- Response body (if present) — read-only `<pre>` block
- Error string (if present) — danger-toned single-line
- Retry tree — if `parentDeliveryId` exists, link to parent; if `nextRetryAt` exists, live `<CountdownTimer>` showing time-until-retry
- Manual retry button (only on failed deliveries with no `nextRetryAt`)

## Health derivation

Computed in `WebhookHealthBadge` from the source DTO:

```
if (!enabled)                       → "disabled"
else if (consecutiveFailures >= 3)  → "failing"
else if (consecutiveFailures > 0)   → "degraded"
else                                → "healthy"
```

The 4-bucket mapping is **client-side** because the DTO already exposes `consecutiveFailures`; no separate health endpoint needed.

## Empty / sparse states

| Condition                                                          | Surface                                                                                                 |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `webhooks.length === 0`                                            | Right pane shows hero icon + "No webhooks yet" + "New webhook" CTA. List shows "No webhooks match."     |
| `webhooks.length > 0 && filtered.length === 0` (filter+query miss) | List shows "No webhooks match." Right pane keeps current selection (or shows empty hero).               |
| `selected === null` (e.g., after delete drained the list)          | Right pane shows hero icon + CTA                                                                        |
| `deliveries (filtered to webhook).length === 0`                    | Deliveries tab shows muted "No deliveries yet — try the **Test delivery** button to send a test event." |
| `webhook.secret === null`                                          | Settings tab + hero meta cell show "no secret" muted; HMAC verify hint hidden in builder                |

## Loading vs. ready

The prototype starts in `ready` (data is in-memory). In production:

- Initial fetch shows skeleton rows (3-5 rows) in the list pane
- Detail pane shows skeleton hero + skeleton stat-grid until the selected webhook resolves
- Test delivery / save / delete buttons show inline spinners during their own RTT, not a full-pane loading state

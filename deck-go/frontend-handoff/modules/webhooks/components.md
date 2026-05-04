# Components

## Tree

```
WebhooksApp                                  app.jsx
├── webhooks-topbar                          app.jsx
│   ├── KpiCell × 4                          app.jsx (local molecule)
│   ├── btn--ghost (Refresh)                 IconRefresh from icons.jsx
│   └── btn--primary (New webhook)           IconPlus from icons.jsx
├── webhooks-workspace
│   ├── WebhooksList                         webhooks-list.jsx
│   │   ├── seg-filter (4 buttons)
│   │   ├── search-input
│   │   └── webhook-row × N
│   │       ├── name + url
│   │       ├── events count + EventTag preview × ≤2
│   │       ├── last-fired (relative time)
│   │       ├── StatusCodeBadge (last status)
│   │       ├── WebhookHealthBadge
│   │       └── IconChevronR
│   └── WebhookDetail                        webhook-detail.jsx
│       ├── webhook-detail__hero
│       │   ├── id chip + EnabledToggle + WebhookHealthBadge
│       │   ├── h2 name
│       │   ├── url with IconLink
│       │   └── 4× detail-meta-cell (events, last fired, secret, failures)
│       ├── webhook-detail__actions
│       │   ├── Test delivery (idle / running / done / error)
│       │   ├── Disable / Enable
│       │   ├── Edit
│       │   └── Delete (danger)
│       ├── webhook-tab × 4 (overview / deliveries / settings / audit)
│       └── webhook-detail__tab-content
│           ├── OverviewTab — stat-grid + last-delivery-card + subscribed-events
│           ├── DeliveriesTab — table with expandable rows
│           ├── SettingsTab — settings-row × N + SecretReveal
│           └── AuditTab — audit-list + bff-note
├── WebhookBuilder (modal)                   webhook-builder.jsx
│   ├── builder-section: identity (name + url)
│   ├── builder-section: secret (SecretReveal-style + IconKey hint)
│   ├── builder-section: events grid (grouped by prefix, multi-select chips)
│   └── builder-section: behavior (enabled toggle row)
└── ConfirmDialog (delete)                   inline in webhook-detail.jsx
```

## Component contracts

### `<WebhooksApp />`

Root orchestrator. Owns: `webhooks[]`, `deliveries[]`, `selectedId`, `filter`, `query`, `builderOpen`, `builderDraft`, `builderIsEdit`. Persists `selectedId` in URL hash for refresh-safe deep links.

### `<KpiCell label value hint? tone? />` (local molecule)

4-cell topbar grid: webhooks count / failing count / deliveries 24h / avg latency. `tone="ok"|"warn"` paints the value. `hint` is a small line under the label.

### `<WebhooksList ... />`

Props:

- `webhooks: DeckGoWebhook[]`
- `deliveries: DeckGoWebhookDelivery[]` (used to derive last-by-webhook)
- `selectedId: string | null`
- `onSelect: (id: string) => void`
- `query: string` / `onQuery: (s: string) => void`
- `filter: "all" | "enabled" | "disabled" | "failing"` / `onFilter`

Renders a 6-column table with sticky header. Search matches name / url / id / event names. Filters compose with search.

### `<WebhookDetail webhook deliveries onEdit onToggleEnabled onDelete />`

Props:

- `webhook: DeckGoWebhook` (the selected one)
- `deliveries: DeckGoWebhookDelivery[]` (already filtered to this webhook's id)
- `onEdit: () => void`
- `onToggleEnabled: () => void`
- `onDelete: () => void`

Owns local state: `tab`, `testPhase` ("idle"|"running"|"done"|"error"), `expandedDeliveryId`, `confirmDelete`.

### `<WebhookBuilder open draft isEdit onChange onClose onSave />`

Modal. Owns local state: `phase` ("idle"|"saving"|"done"), `secretShown`. Validates `name.trim()` non-empty + `url` matches `^https?://` + `events.length > 0`. Backdrop click + Esc only fire when `phase === "idle"` (cannot cancel mid-save).

## Local molecules (in `icons.jsx`)

These are **module-local**, not promoted to design-system atoms — flag for promotion review only if reused across ≥2 modules.

| Molecule              | Purpose                                                                             | Promotion candidate?                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `StatusCodeBadge`     | HTTP status pill: 2xx ok / 3xx info / 4xx warn / 5xx err / null neutral             | Yes — same pattern useful for api-explorer (US-019), gateway batch results (US-015)                                           |
| `DeliveryStatusBadge` | success / network / failed (3-tone, derived from `delivery.success` + `statusCode`) | Webhook-specific                                                                                                              |
| `WebhookHealthBadge`  | row health: healthy / degraded / failing / disabled                                 | Webhook-specific                                                                                                              |
| `EnabledToggle`       | enabled/disabled visual chip; `--lg` variant for builder use as switch              | **Promotion candidate** — every CRUD-shaped panel needs it (cron, webhooks, channels, agents)                                 |
| `EventTag`            | single event chip; supports optional remove button                                  | Webhook-specific (event-based modules only)                                                                                   |
| `SecretReveal`        | masked code with click-to-reveal IconEye/IconEyeOff                                 | **Promotion candidate** — settings panel (US-020) needs the same for API tokens                                               |
| `CountdownTimer`      | live ticking chip with imminent/soon/later/overdue tones                            | **Already promoted** from approvals (US-016) → cron (US-017) → webhooks (US-018). Move to design-system after this third use. |

## Depends on canonical patterns

When productionized in `frontend-new/src/components/panels/webhooks/`:

- `PageShell` for the outer page chrome (per `@/design-system/patterns`)
- `EmptyState` for the no-selection right pane (when `selectedId === null` and webhooks list is non-empty)
- `ConfirmDialog` for delete (move the inline confirm modal here)

## Depends on canonical icons

All icons come from `@/design-system/icons`. Mapping in this prototype (icons.jsx) → canonical name:

| Local                       | Canonical                       | Used by                                                           |
| --------------------------- | ------------------------------- | ----------------------------------------------------------------- |
| IconRefresh                 | `IconRefresh`                   | topbar refresh, deliveries refresh                                |
| IconPlus                    | `IconPlus`                      | new webhook                                                       |
| IconClose                   | `IconClose`                     | modal close, event tag remove                                     |
| IconCheck                   | `IconCheck`                     | delivery success badge, builder chip selected, save success state |
| IconAlert                   | `IconAlert`                     | delivery failure badge, failing health badge                      |
| IconBolt                    | `IconBolt`                      | brand logo, empty state                                           |
| IconLink                    | `IconLink`                      | url field decoration                                              |
| IconKey                     | `IconKey`                       | secret section header                                             |
| IconEye / IconEyeOff        | `IconEye` / `IconEyeOff`        | SecretReveal toggle                                               |
| IconSend                    | `IconSend`                      | test delivery button                                              |
| IconRetry                   | `IconRetry`                     | manual retry on failed delivery                                   |
| IconEdit                    | `IconEdit`                      | edit webhook                                                      |
| IconTrash                   | `IconTrash`                     | delete webhook                                                    |
| IconChevronR / IconChevronD | `IconChevronR` / `IconChevronD` | row chevrons, expanded delivery                                   |
| IconSearch                  | `IconSearch`                    | list filter search                                                |
| IconClock                   | `IconClock`                     | countdown chips, audit timestamps                                 |
| IconShield                  | `IconShield`                    | (reserved — settings tab future use)                              |
| IconActivity                | `IconActivity`                  | audit tab                                                         |
| IconCopy                    | `IconCopy`                      | copy URL / copy ID actions                                        |

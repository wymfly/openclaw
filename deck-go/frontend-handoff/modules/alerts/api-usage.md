# alerts — API usage

> Endpoint truth and DTO shapes are tracked in
> `deck-go/contracts/source/deck-api.contract.ts` and
> `deck-go/contracts/source/deck-endpoints.contract.json`.

## Source of truth

The alerts module consumes Deck BFF alert-rule contracts. The browser never calls Gateway
directly. Alert evaluation runs server-side; the Deck panel is a CRUD surface for rule
configuration.

## Deck-facing API

### `GET /api/deck/alerts`

Wrapper: `fetchAlerts()`. Response: `DeckGoAlertsResponse` (`rules: DeckGoAlertRule[]`).

Returns all configured alert rules.

### `POST /api/deck/alerts`

Wrapper: `createAlert(partial)`. Response: `DeckGoAlertRuleResponse` (`rule`).

Backend assigns the id. The RuleEditDialog drives this when `mode = create`.

### `PATCH /api/deck/alerts/<id>`

Wrapper: `patchAlert(id, partial)`. Response: `DeckGoAlertRuleResponse`.

Partial update. RuleEditDialog `mode = edit` drives this. Inline Power toggle on the row
also patches `{ enabled: !rule.enabled }`.

### `DELETE /api/deck/alerts/<id>`

Wrapper: `deleteAlert(id)`. Response: `{ ok: boolean }`.

Hard delete. DeleteRuleDialog drives this.

### `POST /api/deck/alerts/<id>/test-fire`

Wrapper: `testFireAlert(id)`. Response: BFF-projected payload preview (action + sample).

Does NOT trigger the real action sink and does NOT reset the cooldown. TestFireDialog drives
this.

## DTO shapes (canonical)

```ts
type DeckGoAlertAction = "toast" | "activity" | "webhook";

type DeckGoAlertRule = {
  id: string;
  name: string;
  entityType: string;
  condition: string;
  threshold: number;
  action: DeckGoAlertAction;
  cooldownMs: number;
  lastFiredAt: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type DeckGoAlertsResponse = { rules: DeckGoAlertRule[] };
type DeckGoAlertRuleResponse = { rule: DeckGoAlertRule };
```

## BFF projections (not part of the contract)

### `fires: AlertFireEvent[]`

```ts
interface AlertFireEvent {
  ts: number;
  entityId: string;
  note: string;
}
```

BFF projection over activity-log events with `type = alert.fire` and matching `ruleId`. Used
by the **Recent fires** tab.

### `audit: AlertAuditEvent[]`

```ts
interface AlertAuditEvent {
  ts: number;
  actor: "system" | string;
  action: "created" | "edited" | "deleted" | "auto-created" | string;
  note?: string;
}
```

BFF projection over the BFF mutation log. Used by the **Audit** tab.

## Endpoint summary

| Endpoint                            | Method | When                           | DTO                       |
| ----------------------------------- | ------ | ------------------------------ | ------------------------- |
| `/api/deck/alerts`                  | GET    | List view                      | `DeckGoAlertsResponse`    |
| `/api/deck/alerts`                  | POST   | RuleEditDialog (create)        | `DeckGoAlertRuleResponse` |
| `/api/deck/alerts/<id>`             | PATCH  | RuleEditDialog (edit) + toggle | `DeckGoAlertRuleResponse` |
| `/api/deck/alerts/<id>`             | DELETE | DeleteRuleDialog               | `{ ok }`                  |
| `/api/deck/alerts/<id>/test-fire`   | POST   | TestFireDialog                 | BFF-projected preview     |
| `/api/deck/alerts/<id>/fires` (BFF) | GET    | Detail Recent fires tab        | `AlertFireEvent[]`        |
| `/api/deck/alerts/<id>/audit` (BFF) | GET    | Detail Audit tab               | `AlertAuditEvent[]`       |

(The last three are BFF-only and not part of the Gateway alert-rule contract.)

## Backend chain

```
AlertsPanel
  → frontend-new/src/api/alerts.ts
  → deck-go Go BFF routes
    ├── Gateway RPC alerts.list / create / patch / delete
    └── BFF projections (fires from activity log, audit from mutation log)
  → Gateway (only via the BFF / runtime boundary)
```

## Mock requirements

- 12+ rules across all 12 entity types (channel / model / subagent / budget / approval / plugin /
  session / test / auth / pr / provider / routing).
- All 3 actions (toast / activity / webhook) represented.
- At least 2 rules disabled (one with no fire history, one created-but-never-evaluated).
- Recent fires for at least 5 rules.
- Audit projection for at least 3 rules covering creation + edits.

## Open contract assumptions

- **`condition` is a free-form string.** Prototype renders as mono code. Production may want
  syntax highlighting once the backend grammar is documented.
- **`action` enum is closed.** `toast | activity | webhook`. New actions must extend the
  contract first.
- **Webhook target binding.** Contract has no per-rule webhook URL; it lives in the webhooks
  module. Confirm whether the deck-go BFF picks the default target or requires explicit
  binding.
- **Cooldown granularity.** Prototype offers 1m / 5m / 10m / 30m / 1h / 4h / 24h presets +
  arbitrary number on the field. If the backend constrains to specific multiples, the form
  should switch to an explicit picker.
- **Test fire side effects.** Prototype assumes test fires don't reset cooldown and don't
  emit real actions. Confirm with backend.
- **`createdAt` / `updatedAt` are ISO strings.** Production renderers must parse, prototype
  uses `Date.parse`.

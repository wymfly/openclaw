# Alerts API Usage

## Source Of Truth

The alerts module consumes Deck-local alert configuration contracts. The browser
never calls Gateway directly for this module.

## Endpoints

### `GET /api/alerts`

Returns:

```json
{
  "rules": [
    {
      "id": "ar-usage-warn",
      "name": "Usage warning",
      "entityType": "usage",
      "condition": ">=",
      "threshold": 80,
      "action": "toast",
      "cooldownMs": 300000,
      "lastFiredAt": null,
      "enabled": true,
      "createdAt": "2026-05-03T00:00:00Z",
      "updatedAt": "2026-05-03T00:00:00Z"
    }
  ]
}
```

### `POST /api/alerts`

Body:

```json
{
  "name": "Agent latency breach",
  "entityType": "agent",
  "condition": ">",
  "threshold": 30,
  "action": "activity",
  "cooldownMs": 300000,
  "enabled": true
}
```

Returns `{ "rule": DeckGoAlertRule }`.

### `PATCH /api/alerts/{ruleId}`

Used for edit and toggle. Toggle sends `{ "enabled": false }` or
`{ "enabled": true }`. Edit sends the same mutable fields as create.

Returns `{ "rule": DeckGoAlertRule }`.

### `DELETE /api/alerts/{ruleId}`

Returns `{ "ok": true }`.

## Frontend Wrappers

- `fetchAlertRules()`
- `createAlertRule(input)`
- `updateAlertRule(id, patch)`
- `deleteAlertRule(id)`

## Unsupported Semantics

- No Gateway-backed fired event list.
- No delivery attempt history.
- No webhook receiver delivery confirmation.
- No escalation policy contract.
- No parser contract for `condition`; render stored fields literally.

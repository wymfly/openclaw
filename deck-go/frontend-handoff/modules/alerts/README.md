# Alerts Module Handoff

Status: implemented-awaiting-archive

## Contract Truth

- Deck DTO authority: `deck-go/contracts/source/deck-api.contract.ts`
  - `DeckGoAlertAction`
  - `DeckGoAlertRule`
  - `DeckGoAlertsResponse`
  - `DeckGoAlertRuleResponse`
- Browser API facade: `deck-go/frontend-new/src/api.ts`
  - `fetchAlertRules()`
  - `createAlertRule(input)`
  - `updateAlertRule(id, patch)`
  - `deleteAlertRule(id)`
- Public BFF routes:
  - `GET /api/alerts`
  - `POST /api/alerts`
  - `PATCH /api/alerts/{ruleId}`
  - `DELETE /api/alerts/{ruleId}`
- Runtime source: Deck-local alert rule store. Alerts are not Gateway RPC proxy traffic.

## Product Intent

Alerts is a local policy workbench for alert rules. It is not an incident feed,
delivery monitor, escalation engine, or webhook assurance dashboard. The UI
shows rule inventory, trigger/action policy, cooldown, enabled state, timestamps,
and the current fired-history limitation.

## Workflow Constraints

- Browser code must use the existing frontend API wrappers only.
- Rule mutations refresh through the same `/api/alerts` BFF path.
- Delete requires inline confirmation before calling the mutation wrapper.
- Fired-history UI may only show the unsupported-history notice and supported
  `lastFiredAt` fallback evidence.
- Mock/local visual evidence does not prove real alert delivery, webhook
  delivery, escalation, fired history, or incident assurance.

## Files

- `prototype.html` - high-fidelity static reference for the Alerts workbench.
- `components.md` - production component breakdown and prop contracts.
- `states.md` - state model and edge cases.
- `interactions.md` - keyboard, focus, mutation, and accessibility rules.
- `api-usage.md` - endpoint and DTO usage notes.

## Open Questions

- Gateway-backed fired alert history is not exposed.
- Real webhook delivery and retry assurance are not exposed.
- Escalation policy semantics are not exposed.
- Rule condition parsing is stored as fields and should not be presented as a
  validated expression language.

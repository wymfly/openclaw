## Context

`frontend-new` already contains a functional `AlertsPanel` under the `alerts` panel id. It calls Deck-facing wrappers for alert rule CRUD:

- `fetchAlertRules()` -> `GET /api/alerts`
- `createAlertRule(input)` -> `POST /api/alerts`
- `updateAlertRule(id, patch)` -> `PATCH /api/alerts/{id}`
- `deleteAlertRule(id)` -> `DELETE /api/alerts/{id}`

Alert rules are Deck-local policy configuration, not Gateway RPC proxy traffic. The DTO authority is `deck-go/contracts/source/deck-api.contract.ts`, generated into `DeckGoAlertRule`, `DeckGoAlertAction`, `DeckGoAlertsResponse`, and `DeckGoAlertRuleResponse`. The current UI preserves rule CRUD and a fired-alert tab, but the fired-alert tab can only show `lastFiredAt` fallback because Gateway-backed fired history is not exposed. The current gap is visual and verification convergence: the panel uses old `deck-ui-alerts*` global styling, relies on `window.confirm`, and has no mock/local visual E2E.

## Goals / Non-Goals

**Goals:**

- Produce a complete Alerts handoff package.
- Rewrite Alerts into a high-fidelity alert policy workbench aligned with the current design-system posture.
- Preserve load/error handling, rule selection, create/edit/toggle/delete, validation, localization, and fired-history fallback behavior.
- Add deterministic mock/local visual coverage for rule inventory, selected detail, validation, one mutation state, and fired-history fallback.
- Record Alerts-specific design-system feedback without silently promoting atoms or patterns.

**Non-Goals:**

- No new Gateway method, BFF endpoint, event history contract, or Deck-facing DTO contract unless implementation proves a deterministic mismatch.
- No browser-side direct Gateway call.
- No real alert delivery guarantee, webhook delivery verification, escalation policy, notification routing engine, or fired-history backend.
- No new dependencies, table libraries, chart libraries, schema editors, date libraries, or rule-expression parser.
- No canonical design-system atom/pattern promotion inside this module change.

## Decisions

1. **Treat Alerts as a policy workbench, not an incident feed.**
   The contract exposes rule definitions and `lastFiredAt`, not a durable fired-event stream. The first viewport should expose policy health, trigger expressions, actions, and known fallback limits without inventing incident history.

2. **Preserve the Deck-local BFF contract boundary.**
   Alerts is explicitly classified as Deck alert configuration. The rewrite should keep the current wrappers and public BFF route path.

3. **Use module-local rule, metric, trigger, action, and fallback molecules.**
   Alerts repeats prior compact workbench patterns but adds alert-specific trigger/action semantics. Promotion to shared patterns waits for a separate design-system proposal with enough Control-module evidence.

4. **Replace blocking confirm with inline confirmation.**
   Inline destructive confirmation is more consistent with Budget/Approvals and easier to cover in visual E2E. It preserves the two-step destructive guard without modal churn.

5. **Make mock/local visual seeding deterministic through public BFF routes.**
   The visual E2E should seed rules through `POST /api/alerts`, then exercise the real frontend against the backend routes. No mock Gateway methods are needed for local alert configuration.

## Risks / Trade-offs

- **Risk: UI implies a fired history that does not exist.** -> Keep fallback copy visible and label mock/local evidence as not real alert delivery or history assurance.
- **Risk: Inline delete changes the old `window.confirm` interaction.** -> Preserve two-step confirmation and update unit/E2E tests around it.
- **Risk: Trigger expression fields look more powerful than the backend validates.** -> Avoid parser claims; render entity type, condition, and numeric threshold exactly as contract fields.
- **Risk: Global CSS cleanup affects other old control panels.** -> Remove or narrow only Alerts-specific classes; keep new styling in module-local CSS.

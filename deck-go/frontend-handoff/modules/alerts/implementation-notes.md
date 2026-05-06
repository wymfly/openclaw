# Alerts Implementation Notes

Status: implemented and real-contract verified on 2026-05-04.

## Contract Chain

| Workflow         | Frontend wrapper                 | Deck endpoint                 | Go surface                                             | Capability  |
| ---------------- | -------------------------------- | ----------------------------- | ------------------------------------------------------ | ----------- |
| List rules       | `fetchAlertRules()`              | `GET /api/alerts`             | `server.registerAlertsRoutes` + `localstore.AlertRule` | supported   |
| Create rule      | `createAlertRule()`              | `POST /api/alerts`            | Go BFF validates required fields and action union      | supported   |
| Edit/toggle rule | `updateAlertRule()`              | `PATCH /api/alerts/{ruleId}`  | Go BFF validates patch fields and action union         | supported   |
| Delete rule      | `deleteAlertRule()`              | `DELETE /api/alerts/{ruleId}` | Go BFF removes local rule by id                        | supported   |
| Recent fires     | selected rule `lastFiredAt` only | existing list payload         | localstore field only                                  | degraded    |
| Audit timeline   | none                             | none                          | no durable audit store                                 | unsupported |
| Test fire        | none                             | none                          | no dry-run/evaluator endpoint                          | unsupported |
| Webhook binding  | action enum only                 | existing rule action          | no webhook target binding on alert rule                | unsupported |

## Fixes Made

- Rebuilt `frontend-new/src/components/panels/alerts/` into the v2 workbench shape: KPI strip, filters, list/detail shells, overview/condition/fires/audit tabs, create/edit/delete/test-preview dialogs, and responsive module CSS.
- Kept production behavior contract-backed. Unsupported test-fire, audit, fired-history, evaluator, condition grammar, and webhook-target semantics are surfaced as unavailable/fallback states instead of fabricated data.
- Fixed alert action closed-union drift in both active route paths:
  - `/api/alerts` rejects invalid create/update action values.
  - `/api/v1/alerts` rejects invalid create/update action values.
- Fixed real-stack browser delete by adding `DELETE` to the `controld` CORS preflight allow-list. The earlier root server CORS list was already corrected, but real `cmd/deck-go` first passes through `controld`.

## Verification Evidence

- Handoff prototype smoke: `prototype.html` loaded with HTTP 200; only expected Babel standalone warning.
- Frontend focused tests: `cd deck-go/frontend-new && npm run test:deck-ui -- src/api.chat-helpers.test.ts src/components/panels/alerts/AlertsPanel.test.tsx` passed, 50 tests.
- Backend focused tests: `cd deck-go/backend && go test ./internal/server ./internal/controld ./internal/api/http -run 'TestAlertsRoutes_CRUD|TestCORSPreflightAllowsDelete|TestNewHandlerWithDependencies_CorsAllowsDelete|TestNewHandlerWithDependencies_CorsAllowsStreamResumeHeader|TestMountAdminRoutes'` passed.
- L1 mock visual E2E: `cd deck-go && pnpm exec playwright test test/e2e/alerts-visual.spec.ts --config playwright.config.ts` passed.
- L2 real stack E2E: `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/alerts-real-gateway.spec.ts --config playwright.config.ts` passed, including safe create/patch/delete cleanup.

## Residual Risks

- Alert evaluator semantics, condition DSL grammar, durable fire history, audit history, and webhook target binding are not implemented by current Gateway/BFF contracts.
- `localstore` remains process-local JSON state. This is adequate for current CRUD verification but not an enterprise alerting engine.
- No source contract changed in this pass, so generated artifacts were not regenerated.

## Contract completion closeout

- Follow-up `deck-go-budget-alerts-webhooks-contract-completion` confirmed Alerts are Deck-local rule state with no current durable fired-alert feed or audit event stream.
- Corrected the visible fired-history fallback copy to reference the current Alerts/control contract boundary instead of implying a missing Gateway RPC.
- Rule CRUD remains fixture-safe and mutation-evidence known through `alert.rule.*`.
- Alert evaluator semantics, condition DSL grammar, test-fire execution, durable fired history, audit history, and webhook target binding remain unsupported/deferred product contracts.

## Prototype parity remediation closeout - 2026-05-05

Code truth remains authoritative over this note. The active visual target for the
remediation pass was `frontend-handoff/modules/alerts/prototype.html`;
`prototype-v1-codex.html` is reference-only.

Deterministic fixes made in this pass:

- Changed Alerts to a list-first workbench so the first viewport matches the
  active rule-management prototype more closely; selecting a row opens the
  detail surface and `Back to rules` returns to the table.
- Added table column headers, keyboard shortcuts, shorter action labels, and
  localized copy required by the prototype-shaped list/detail flow.
- Strengthened mock data to 12 representative rules covering entity variety,
  all alert actions, disabled states, fallback history/audit states, and CRUD
  dialog states.
- Strengthened real E2E to create, patch, validate, and delete one run-scoped
  alert rule through Deck BFF routes, then exercise the UI through Deck shell
  navigation under dark/en, dark/zh, light/en, and light/zh.

Accepted exceptions:

- Deck shell chrome is present in production screenshots and absent from the
  standalone prototype.
- Production title/supporting copy follows the current i18n/product contract
  rather than static prototype-only copy.
- Production rule rows keep card borders and selected-state affordances from the
  current design system, while the prototype table is flatter.
- Generated IDs, timestamps, and run-scoped fixture names differ from static
  prototype data.
- Alert evaluator execution, durable fired history, durable audit history,
  condition DSL grammar/autocomplete, real test-fire execution, and per-rule
  webhook target binding remain unsupported by current Alerts contracts.

Verification evidence:

- `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/alerts/AlertsPanel.test.tsx src/api.chat-helpers.test.ts` passed, 60 tests.
- `cd deck-go/frontend-new && npx tsc -b --pretty false` passed.
- `cd deck-go && pnpm exec playwright test test/e2e/alerts-visual.spec.ts --config playwright.config.ts --output .local/alerts-remediation-mock-visual --reporter=line` passed.
- Prototype/current contact sheet:
  `deck-go/.local/alerts-prototype-remediation-parity-report/sheet-3.png`;
  verdict `pass-with-exceptions`, score 90.
- `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/alerts-real-gateway.spec.ts --config playwright.config.ts --output .local/alerts-remediation-real-e2e --reporter=line` passed after fixing the test hook timeout from the first attempt.
- Real evidence attachment:
  `deck-go/.local/alerts-remediation-real-e2e/alerts-real-gateway-alerts-a9bb7-RUD-UI-variants-and-cleanup/attachments/alerts-real-product-surface-5b70338a3728e8a23a81375ed24cf6d761f6ab66.json`.
- `cd deck-go && make frontend-build` passed with the existing Vite chunk-size warning.

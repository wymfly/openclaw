# budget — implementation notes

Status: implemented with real-contract verification evidence on 2026-05-04.

## Code Truth

Budget is a Deck-local policy surface today. The production chain is:

```
frontend-new/src/api.ts
  -> /api/usage/budget*
  -> backend/internal/server/budget.go
  -> backend/internal/localstore/budget.go
  -> managed runtime UsageCost(ctx, { days: 30 }) for evaluation only
  -> events bus publishes budget.warn / budget.over for threshold hits
```

No upstream `gateway.usage.budget.*` RPC method chain was found or used.
`usage.cost` is the only Gateway-backed call in the current Budget chain.

## Contract Chain Matrix

| Workflow                    | Production chain                                                                                            | Classification     | Notes                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------- |
| Rule list                   | `fetchBudgetRules()` -> `GET /api/usage/budget` -> localstore `All()`                                       | supported          | Returns `DeckGoBudgetRulesResponse`.                                                        |
| Create rule                 | `createBudgetRule()` -> `POST /api/usage/budget` -> localstore append                                       | supported          | Server assigns id/timestamps and validates dimension, period, thresholds.                   |
| Edit rule                   | `updateBudgetRule()` -> `PATCH /api/usage/budget/{id}` -> localstore update                                 | supported          | Partial update; frontend full form submits current contract fields.                         |
| Toggle enabled              | `updateBudgetRule(id, { enabled })`                                                                         | supported          | Added direct hero action; refreshes rules/evaluations.                                      |
| Delete rule                 | `deleteBudgetRule()` -> `DELETE /api/usage/budget/{id}`                                                     | supported          | Current BFF returns HTTP 200 `{deleted:true}`, not 204.                                     |
| Evaluation                  | `evaluateBudgetRules()` -> `GET /api/usage/budget/evaluate` -> enabled local rules + `UsageCost({days:30})` | supported/degraded | If usage-cost fails, production now keeps rules visible and renders rules as not evaluated. |
| Status filter               | frontend selector over rules + evaluations                                                                  | supported          | Supports all/ok/warn/over/disabled.                                                         |
| Search                      | frontend selector over name/scope/agent/task/dimension/period                                               | supported          | Local only, contract-shaped.                                                                |
| Selected detail             | selected `DeckGoBudgetRule` + matching `DeckGoBudgetEvaluation`                                             | supported          | Missing evaluation renders unavailable instead of fabricated values.                        |
| Threshold meter             | CSS `<progress>` over current vs threshold                                                                  | supported          | No chart dependency.                                                                        |
| Validation                  | frontend + Go route validation                                                                              | supported          | Rejects missing target ids, non-numeric/negative thresholds, and `warn >= over`.            |
| Bootstrap mutation gating   | normal deck-go auth/runtime readiness                                                                       | degraded           | Prototype-specific `bootstrap.ok` is not wired as a Budget contract.                        |
| Recent changes              | prototype-local fixture only                                                                                | unsupported        | No durable Budget audit/change endpoint exists.                                             |
| Agent directory labels      | prototype-local join only                                                                                   | unsupported        | Production authors raw `agentId`; no Budget-specific directory enrichment.                  |
| Forecast/projection         | none                                                                                                        | unsupported        | No `projection` field or endpoint exists.                                                   |
| Per-rule history            | none                                                                                                        | unsupported        | Usage time series belongs to usage module until a Budget history contract exists.           |
| Notification routing        | events bus publishes `budget.warn`/`budget.over`                                                            | handoff-blocked    | No `notifyRuleId` or alert-rule linkage contract exists.                                    |
| Billing enforcement         | none                                                                                                        | unsupported        | Budget currently surfaces guardrail/evaluation state only.                                  |
| Workspace/channel/org scope | DTO open string, UI authors global/agent/task                                                               | handoff-blocked    | Needs target fields and semantics before production UI authors these scopes.                |

## Direct Fixes

- Corrected handoff API docs from non-existent `gateway.usage.budget.*` to Deck-local BFF/localstore + usage-cost evaluation.
- Corrected delete response semantics to HTTP 200 `{deleted:true}`.
- Clarified `recentChanges`, agent directory labels, broader periods/scopes, forecast/history/notification/enforcement as prototype-only or follow-up.
- Added production Budget search and status filter strip.
- Added direct selected-rule enable/disable and delete confirmation access.
- Decoupled rule loading from evaluation loading so usage-cost failures degrade instead of blanking the panel.
- Added frontend and backend threshold validation for non-negative values and `warnThreshold < overThreshold`.
- Added L2 real-stack Budget API/UI E2E with unique test-rule create/update/delete cleanup.

## Verification Evidence

- Handoff prototype smoke: `prototype.html` HTTP 200, title `Budget (deck-go) · v2 prototype`, 7 rule rows, no browser errors.
- `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/budget/BudgetPanel.test.tsx`: 8 tests passed.
- `cd deck-go/backend && go test ./internal/server -run 'TestBudgetRoutes_CRUDAndEvaluate|TestBudgetRoutes_RejectInvalidThresholds'`: passed.
- `cd deck-go/backend && go test ./internal/runtime/openclaw -run 'TestManagedRuntime|TestGatewayQueries|TestRuntimeFacade|TestLegacyAdmin'`: passed.
- `cd deck-go && pnpm exec playwright test test/e2e/budget-visual.spec.ts --config playwright.config.ts`: 1 passed.
- `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/budget-real-gateway.spec.ts --config playwright.config.ts`: 2 passed after fixing a strict-locator test issue found on the first run.

## Residual Risks

- Real billing accuracy and quota enforcement are not implemented by this module.
- Budget evaluates enabled local rules against a 30-day usage-cost snapshot, regardless of the rule's `period`; period-specific aggregation remains a contract follow-up.
- The legacy admin runtime path cannot distinguish omitted vs explicit `null` threshold fields in patch input; current production frontend does not rely on null-clearing through that path.
- If future product design needs workspace/channel/org scopes, the DTO must gain target fields and BFF semantics before production UI authors them.

## Contract completion closeout

- Follow-up `deck-go-budget-alerts-webhooks-contract-completion` confirmed Budget is a Deck-local control surface with Gateway-derived usage-cost input, not a Gateway budget RPC surface.
- Fixed deterministic response drift: `/api/usage/budget/evaluate` and the legacy admin runtime now emit `DeckGoBudgetEvaluation.current`; the frontend facade still tolerates older `currentValue` input as a compatibility shim.
- Real fixture-safe CRUD/evaluate evidence remains the accepted module baseline.
- Forecast, billing enforcement, quota policy semantics, period-specific aggregation, durable change history, and richer notification routing remain unsupported/deferred product contracts.

## Prototype parity remediation closeout - 2026-05-05

Code truth remains authoritative over this note. The active visual target for the
remediation pass was `frontend-handoff/modules/budget/prototype.html`;
`prototype-v1-codex.html` is reference-only.

Deterministic fixes made in this pass:

- Reworked Budget into a prototype-shaped rule workbench with four top KPIs
  (`ok`, `warning`, `over`, `rules`), a filterable rule rail, selected-rule hero,
  summary cells, threshold meter, definition table, and recent-change fallback.
- Moved create/edit/toggle/delete flows into modal dialogs instead of the older
  inline right-pane form so the interaction model matches the active prototype.
- Added run-local recent-change rows for mutations while explicitly keeping
  durable Budget history as an unsupported contract.
- Fixed a dark-mode contrast bug where rule-row button text inherited browser
  button colors instead of design-system text tokens.
- Strengthened mock visual data to seven representative rules and one created
  rule, covering every budget dimension, supported scopes/periods, enabled and
  disabled states, ok/warn/over evaluations, validation, and modal states.
- Strengthened real E2E to create two run-scoped rules through Deck BFF routes:
  one enabled rule for evaluation evidence and one disabled rule for status
  filtering. The test patches, evaluates, and deletes only run-scoped rules.

Accepted exceptions:

- Deck shell chrome is present in production screenshots and absent from the
  standalone prototype.
- Production uses current BFF-supported periods (`daily`, `weekly`, `monthly`)
  and scopes (`global`, `agent`, `task`). Prototype examples for workspace,
  channel, hourly, and task-period values remain follow-up contract decisions.
- Durable recent changes, forecast/projection, per-rule history charts, billing
  enforcement, and budget-to-alert notification binding remain unsupported by
  current Budget contracts.
- Static prototype IDs/timestamps and fixture names differ from generated
  Deck-local IDs/timestamps and run-scoped E2E fixture names.

Verification evidence:

- `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/budget/BudgetPanel.test.tsx src/api.chat-helpers.test.ts` passed, 63 tests.
- `cd deck-go/frontend-new && npx tsc -b --pretty false` passed.
- `cd deck-go && pnpm exec playwright test test/e2e/budget-visual.spec.ts --config playwright.config.ts --output .local/budget-remediation-mock-visual --reporter=line` passed.
- Prototype/current contact sheet:
  `deck-go/.local/budget-prototype-remediation-parity-report/sheet-6.png`;
  verdict `pass-with-exceptions`, score 90.
- `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/budget-real-gateway.spec.ts --config playwright.config.ts --output .local/budget-remediation-real-e2e --reporter=line` passed after two fixes: one hook timeout configuration fix and one toggle-label assertion fix.
- Real evidence attachment:
  `deck-go/.local/budget-remediation-real-e2e/budget-real-gateway-budget-c3607-RUD-UI-variants-and-cleanup/attachments/budget-real-product-surface-390f9a3e445c9894b81b3b0b97c9b171178aafbb.json`.
- `cd deck-go && make frontend-build` passed with the existing Vite chunk-size warning.

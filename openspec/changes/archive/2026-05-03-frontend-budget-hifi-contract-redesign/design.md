## Context

`frontend-new` already contains a functional `BudgetPanel` under the `budget` panel id. It calls Deck-facing wrappers for budget rule CRUD and evaluation:

- `fetchBudgetRules()` -> `GET /api/usage/budget`
- `evaluateBudgetRules()` -> `GET /api/usage/budget/evaluate`
- `createBudgetRule(input)` -> `POST /api/usage/budget`
- `updateBudgetRule(id, input)` -> `PATCH /api/usage/budget/{id}`
- `deleteBudgetRule(id)` -> `DELETE /api/usage/budget/{id}`

Budget rules are Deck-local policy views, not direct upstream Gateway contracts. The DTO authority is `deck-go/contracts/source/deck-api.contract.ts`, generated into `DeckGoBudgetRule`, `DeckGoBudgetEvaluation`, `DeckGoBudgetRulesResponse`, and `DeckGoBudgetEvaluationsResponse`. The Go BFF stores rules locally and evaluates them against runtime usage adapters. The current gap is visual and verification convergence: the panel uses old generic `deck-ui-control-*` classes, shows a limited status view, and the bundled mock Gateway/E2E setup has no deterministic Budget visual coverage.

## Goals / Non-Goals

**Goals:**

- Produce a complete Budget handoff package.
- Rewrite Budget into a high-fidelity budget governance workbench aligned with the current design-system posture.
- Preserve load/error handling, selection fallback, create/edit/delete, validation, evaluation refresh, and i18n behavior.
- Add deterministic mock/local visual coverage for rule inventory, evaluation state, and at least one mutation state.
- Record Budget-specific design-system feedback without silently promoting atoms or patterns.

**Non-Goals:**

- No new Gateway method, BFF endpoint, or Deck-facing DTO contract unless implementation proves a deterministic mismatch.
- No browser-side direct Gateway call.
- No real billing provider, quota ledger, predictive spend forecast, organization billing model, or external payment integration.
- No new dependencies, table libraries, chart libraries, schema editors, date libraries, or currency libraries.
- No canonical design-system atom/pattern promotion inside this module change.

## Decisions

1. **Treat Budget as a governance workbench, not a billing dashboard.**
   The first viewport should expose active rules, threshold state, status severity, scope targeting, and mutation consequences. Rich accounting, invoice, and forecasting experiences are out of scope because the contract only provides rule definitions and current evaluations.

2. **Preserve the Deck-local BFF contract boundary.**
   Budget is explicitly classified as a Deck BFF surface. The rewrite should keep the current wrappers and avoid any attempt to infer upstream Gateway semantics or call runtime internals from browser code.

3. **Use module-local rule, metric, threshold, and form molecules.**
   Budget repeats the compact workbench pattern from prior modules but adds budget-specific progress and threshold editing semantics. Promotion to shared patterns waits for a separate design-system proposal with enough API evidence.

4. **Make mock/local visual fixture changes deterministic and route-shaped.**
   Visual E2E should exercise the real frontend against public Deck BFF routes. Fixture additions should cover only budget routes needed by the panel, returning payloads shaped like the generated Deck DTOs and existing wrappers expect.

5. **Keep destructive delete explicit but compact.**
   Delete confirmation should remain a two-step inline action so the high-density workbench does not introduce modal churn or accidental destructive behavior.

## Risks / Trade-offs

- **Risk: Budget evaluation values drift between `current` and legacy `currentValue` envelopes.** -> Keep the existing normalization wrapper and cover ready-state values in unit/E2E tests.
- **Risk: The workbench implies billing precision that the local policy store does not provide.** -> Label values as guardrail/evaluation evidence and avoid invoice, forecast, or external billing language.
- **Risk: Progress bars or metrics overflow with large token/cost values.** -> Use constrained, wrapping regions and clipped progress percentages.
- **Risk: Mock Budget CRUD creates false confidence about production spend enforcement.** -> Label E2E as mock/local visual coverage; document real usage aggregation/enforcement assurance as follow-up.
- **Risk: Shared CSS cleanup affects other control modules.** -> Remove or narrow only Budget-specific classes when found; keep new styling in module-local CSS.

## Context

Budget, Alerts, and Webhooks are Deck-local control modules. They do not
require new OpenClaw Gateway methods for their current production workflows:
Budget rules and Alerts rules are stored by deck-go localstore, Webhooks are
stored and delivered by deck-go, and Budget evaluation consumes Gateway-derived
usage cost as an input. The head contract-chain matrix already records these
rows as verified with fixture-safe real E2E evidence, but keeps the follow-up
proposal deferred because several product claims need final boundary decisions.

Explore found two code-truth drifts that can be fixed directly:

- Budget evaluation source DTOs expose `DeckGoBudgetEvaluation.current`, while
  the Go BFF and legacy admin runtime emit `currentValue`.
- `webhook.test-delivery` mutation evidence expects `ok=true`, while the
  production BFF response exposes `success=true`, `deliveryId`, `statusCode`,
  `durationMs`, and `error`.

Explore also found visible Alerts fallback copy that says fired-alert history is
not exposed by Gateway. Since Alerts are Deck-local today, the clearer boundary
is the Alerts/control contract, not Gateway itself.

## Goals / Non-Goals

**Goals:**

- Keep Budget, Alerts, and Webhooks classified as Deck-local control surfaces
  that consume Gateway-derived signals where applicable.
- Align Budget evaluation response shape with the Deck-facing DTO authority.
- Add a named Deck-facing webhook test-delivery DTO and make mutation evidence
  match the BFF response's success semantics.
- Keep frontend compatibility for older Budget evaluation `currentValue` shapes
  while making the current BFF emit `current`.
- Update implementation notes, matrix rows, generated matrix Markdown, head
  verification evidence, and focused tests.

**Non-Goals:**

- Do not add new Gateway methods, Gateway events, or production-only E2E routes.
- Do not implement Budget forecast, billing enforcement, period-specific
  aggregation, or quota policy semantics.
- Do not implement durable Alerts fire history, alert evaluator/dry-run,
  condition DSL semantics, or webhook target binding.
- Do not implement webhook retry scheduling, retry mutation endpoints, delivery
  retention policy, stats endpoint, event catalog endpoint, audit timeline, or
  live delivery push.
- Do not introduce new frontend dependencies.

## Decisions

### Decision: Treat current Budget/Alerts/Webhooks as Deck-local

The current production source of truth is deck-go localstore plus deck-go BFF
routes. Gateway usage/activity data can feed evaluation or status, but Gateway
does not own these module states today.

Alternative rejected: describe missing forecast, alert history, or retry as
missing Gateway RPCs. That incorrectly turns Deck-local product decisions into
Gateway gaps and would raise unnecessary upstream merge cost.

### Decision: Move Budget wire shape toward `current`

The Deck-facing contract names the evaluation amount `current`. The BFF and
legacy admin runtime SHALL emit that field. The frontend normalizer can continue
accepting `currentValue` as a backward-compatible tolerance, but tests should
prove the current server response matches the generated contract.

Alternative rejected: change the source DTO to `currentValue`. The frontend and
panel code already consume `current`, and the DTO is the product contract.

### Decision: Type webhook test delivery as a first-class Deck DTO

The BFF response shape is stable enough for a named DTO:
`success`, optional `statusCode`, `durationMs`, optional `error`, and
`deliveryId`. Mutation evidence SHALL use `success=true` as its success
indicator.

Alternative rejected: keep the response dynamic and `ok=true`. The current
contract metadata would keep recording false mutation evidence for successful
test deliveries.

### Decision: Keep unsupported product leaves explicit

The UI may show fallback or unavailable states for important product
comprehension, but those states must name the correct contract boundary. The
matrix and notes SHALL keep forecast, durable history, retry, retention,
stats/catalog/live push, and notification linkage as unsupported/deferred until
a later proposal creates a concrete contract.

## Risks / Trade-offs

- **Risk:** Some older frontend or test fixtures might still return
  `currentValue`.  
  **Mitigation:** Keep frontend normalization tolerant while making current BFF
  tests assert `current`.

- **Risk:** Naming webhook test-delivery DTO may imply a retry engine exists.  
  **Mitigation:** Scope the DTO to the current manual test delivery route and
  leave retry scheduling unsupported/deferred.

- **Risk:** Alerts fallback wording could hide the fact that old Deck had a
  local fired-alert feed.  
  **Mitigation:** Copy and notes state that current deck-go exposes rule
  inventory plus last-fired timestamps only; durable history remains a future
  control contract.

## Migration Plan

1. Update Deck-facing API and mutation evidence source contracts.
2. Regenerate Deck API and mutation evidence TS/Go/docs artifacts.
3. Update Go BFF and legacy admin Budget evaluation output from `currentValue`
   to `current`.
4. Update frontend webhook test-delivery typing and Alerts fallback copy/tests.
5. Reconcile module implementation notes, contract-chain matrix rows, generated
   matrix Markdown, and head verification evidence.
6. Run focused contract, Go, frontend, build, OpenSpec, and diff checks; then
   archive this child proposal.

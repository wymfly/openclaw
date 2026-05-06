## Context

`budget` has a fresh v2 handoff package and an existing production panel. The handoff correctly centers the product around Deck budget rules and evaluations, but its API usage document currently describes an upstream `gateway.usage.budget.*` chain that does not match code truth. The current Go BFF owns Budget rule CRUD in Deck-local `localstore` and evaluates enabled rules by fetching usage cost totals from the managed runtime. Browser code still calls only the Go BFF.

Verified code-truth route chain:

- `GET /api/usage/budget` -> Go `/usage/budget` -> Deck-local `localstore.GetBudgetRuleStore().All()`
- `POST /api/usage/budget` -> Go `/usage/budget` -> Deck-local create/append
- `PATCH /api/usage/budget/{ruleId}` -> Go route -> Deck-local update
- `DELETE /api/usage/budget/{ruleId}` -> Go route -> Deck-local delete response `{ deleted: true }`
- `GET /api/usage/budget/evaluate` -> Go route -> Deck-local enabled rules + managed runtime `UsageCost(ctx, { days: 30 })`

## Goals / Non-Goals

**Goals:**

- Verify and document the Budget chain from Deck DTOs through frontend wrappers, Go routes, localstore, usage-cost evaluation, mock data, and real-stack behavior.
- Translate the v2 handoff into production while keeping only contract-backed Budget capabilities active.
- Fix deterministic Budget-scoped drift directly, including method-chain docs, endpoint wrapper paths, period/scope open-enum handling, delete response semantics, validation, mock visual coverage, and real-stack test coverage.
- Add bounded real-stack read and mutation evidence using uniquely named test rules and cleanup, with circuit-breaker handoff if the environment blocks writes.

**Non-Goals:**

- Add upstream Gateway budget RPCs.
- Add billing enforcement, forecast/projection, per-rule history, org/team billing policy, notification routing, or a durable audit endpoint.
- Add a chart library or form library dependency.
- Treat Budget as the usage time-series dashboard; that remains the usage module.

## Decisions

- **Use Deck-local BFF truth, not prototype Gateway method names.** Budget rule CRUD is a Deck-local policy layer today. The proposal will correct docs and tests to say localstore + usage-cost evaluation instead of `gateway.usage.budget.*`.
- **Keep evaluation read-through separate from rule CRUD.** Rule mutations write localstore and then refetch both rules and evaluations. Evaluation remains read-only against usage totals and publishes `budget.warn` / `budget.over` events when thresholds fire.
- **Bound real writes with unique test data.** L2 may create a rule named with an e2e prefix, verify list/evaluate/update/delete shape, and clean it up. If usage data is unavailable, CRUD evidence can still pass while evaluation may be empty or handoff-blocked with evidence.
- **Keep recent changes local/mock-only.** The prototype's `recentChanges` has no Deck-facing contract. Production may show local action result evidence, but must not claim durable audit history.
- **No dependency expansion.** The v2 threshold meter stays CSS-only; forms stay local React state unless a later shared form-system proposal justifies a dependency.

## Risks / Trade-offs

- **Localstore persistence can make L2 data sticky** -> Use unique e2e rule names and cleanup delete paths; document residual cleanup risk if a test aborts mid-run.
- **Evaluation depends on usage-cost availability** -> Treat CRUD and evaluation separately; read-only route shape remains mandatory, but evaluation values may be empty when no usage data exists.
- **Open `scope` / `period` strings may outgrow UI filters** -> Render unknown values as contract evidence rather than coercing them to known labels; propose enum tightening only as follow-up.
- **Prototype claims recent changes and automation actors** -> Keep them out of production guarantees until a BFF/contract audit endpoint exists.

## Why

`deck-go/frontend-handoff/modules/routing/` now contains a fresh v2 high-fidelity prototype that is newer than the archived routing implementation. The existing production Routing panel already uses the contract chain, but it needs to be re-checked and upgraded against the refreshed product design, then verified against both mock and real Gateway-backed BFF paths.

## What Changes

- Rebuild or refactor `frontend-new` Routing so the production panel follows the v2 handoff where it is consistent with the true contract.
- Re-audit the full routing contract chain: frontend wrappers, `/api/deck/routing` BFF routes, Go runtime adapter, generated Gateway typed methods, DTOs, config hash behavior, activity reuse, and DM scope patching.
- Fix deterministic routing-scoped drift directly when the fix is evidence-backed and does not invent unsupported Gateway behavior.
- Keep unsupported or ambiguous prototype behavior inactive, degraded, or recorded in handoff notes instead of forcing it into production.
- Add or refresh L1 mock visual E2E evidence and bounded L2 real-stack API/UI evidence for list, validate, add/remove safety shape, simulate, render, and BFF-only browser access.
- Archive the change only after tasks, OpenSpec validation, focused tests, relevant contract checks, frontend build, and final review evidence are complete.

## Capabilities

### New Capabilities

- `frontend-routing-real-contract-verification`: routing-specific real-contract verification, circuit breaker, evidence matrix, and closeout discipline.

### Modified Capabilities

- `frontend-routing-hifi-redesign`: update the existing routing hifi requirements from the prior implementation to the refreshed v2 handoff and real-contract verification standard.

## Impact

- `deck-go/frontend-handoff/modules/routing/`
- `deck-go/frontend-new/src/components/panels/routing/**`
- `deck-go/frontend-new/src/api.ts`, i18n, and focused frontend tests when wrapper or copy drift is found
- `deck-go/backend/internal/server/**`, `deck-go/backend/internal/runtime/openclaw/**`, and related Go tests when BFF/runtime drift is found
- `deck-go/contracts/source/**` and generated contract artifacts only when source contract changes are necessary
- `deck-go/test/e2e/routing-visual.spec.ts` and a routing real-gateway E2E spec
- `openspec/specs/frontend-routing-hifi-redesign/spec.md` and the new routing real-contract verification spec

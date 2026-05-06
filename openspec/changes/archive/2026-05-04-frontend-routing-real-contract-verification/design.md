## Context

Routing already has a production `frontend-new` panel and an archived hifi spec, but `deck-go/frontend-handoff/modules/routing/` now has a newer v2 multi-file prototype. The module is contract-sensitive because operators mutate config-hash-protected route bindings through `/api/deck/routing` and reuse `patchDeckConfig` for DM scope.

The current contract chain is:

1. `frontend-new/src/api.ts` wrappers (`fetchRoutingBindings`, `validateRoutingBinding`, `addRoutingBinding`, `removeRoutingBinding`, `simulateRouting`, `patchDeckConfig`, `fetchActivityEvents`)
2. Go BFF `/api/deck/routing` active route and `/api/v1/runtimes/{runtimeId}/deck/routing` runtime route
3. `ManagedRuntimeSurface` / runtime adapter
4. generated Gateway typed methods `deck.routing.list`, `deck.routing.validate`, `deck.routing.add`, `deck.routing.remove`, `deck.routing.simulate`
5. `DeckGoRouting*` DTOs in `deck-go/contracts/source/deck-api.contract.ts`

## Goals / Non-Goals

**Goals:**

- Align production Routing with the fresh v2 handoff when the prototype is backed by the true contract.
- Preserve the existing BFF-only browser boundary and wrapper-first frontend architecture.
- Verify list, simulate, validate, add/remove route shapes, DM scope patch handling, activity reuse, and real UI rendering through mock and real-stack evidence.
- Fix clear routing-scoped drift directly, including mismatches in docs, mocks, tests, wrappers, or BFF forwarding.
- Record capability gaps in `frontend-handoff/modules/routing/implementation-notes.md`.

**Non-Goals:**

- Add a new Gateway method for reorder; current reorder remains remove + add unless a deterministic backend contract already exists.
- Invent conflict severity, tier reasons, stable backend IDs, or server-side activity filtering when not present in Gateway/BFF behavior.
- Add new UI dependencies, charting dependencies, or code editor packages.
- Execute destructive real mutations against the user's real routing config unless the E2E uses a bounded fixture and can restore state.

## Decisions

1. **Code truth wins over prototype claims.** The v2 handoff is the visual/product target, but actual DTOs, BFF routes, and Gateway generated methods define production behavior. Unsupported desired behavior is documented instead of shipped as active UI.

2. **Keep `/api/deck/routing` as an action envelope.** The handoff mentions typed actions and hash-aware mutations; production continues to call the existing wrappers so raw action strings stay in the API facade and tests, not repeated throughout view code.

3. **Use safety-first real E2E.** L2 real-stack verification must cover route shapes and production render. Mutating actions can be verified with validation/simulation and, where needed, safe malformed/hash-mismatch calls instead of committing user config changes.

4. **Preserve local design-system evolution.** Routing-specific atoms such as `HashChip`, `TierBadge`, `MatchChip`, and mutation strips remain module-local unless another implemented module proves the same pattern should be promoted.

5. **Circuit breaker applies to environment or state blockers.** If real Gateway state, auth, or config prevents a scenario after at most three fresh attempts, record the failure as degraded, skipped-safe, or handoff-blocked with evidence, then continue after static review and L1 evidence are complete.

## Risks / Trade-offs

- **Real config mutation risk** -> Prefer safe reads, validate/simulate, and malformed/hash-mismatch mutation shape tests; record true add/remove as skipped-safe unless a disposable fixture exists.
- **Prototype overstates backend capabilities** -> Cross-check `api-usage.md` against generated Gateway methods and Go route forwarding before implementation.
- **Existing routing panel already has behavior not visible in prototype** -> Preserve contract-backed useful behavior when it does not damage v2 visual/product goals.
- **Activity feed may be empty in mock or real environments** -> Treat empty activity as valid, but keep the panel state explicit.
- **OpenSpec archive can overwrite spec detail if delta is partial** -> Copy full modified requirement blocks into the delta spec before archive.

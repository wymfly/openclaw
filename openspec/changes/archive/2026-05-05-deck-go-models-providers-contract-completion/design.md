## Context

`models.providers` is verified for read paths and UI boundary behavior, but its
head-matrix gap still points at provider probes and config-write conflicts. The
archived `frontend-models-real-contract-verification` change proved the
production Models workbench, typed Gateway reads (`models.configured`,
`deck.auth.overview`, `models.catalog.providers`, `deck.auth.probe`), BFF-only
browser access, and degraded real RPC handling. It also kept provider config
edits behind raw config save semantics.

Since then, `deck-go-config-write-safety-contracts` defines base-hash/conflict
truth for `models.config.save`, and `deck-go-safe-mutation-evidence-contract`
provides reusable mutation evidence metadata. This child change closes the
module by linking those platform contracts to Models-specific facades and
evidence.

## Goals / Non-Goals

**Goals:**

- Reconfirm Models workflows against Gateway methods, Deck BFF routes, DTOs,
  config-write safety, mutation evidence, frontend facades, and prior real
  evidence.
- Add mutation evidence rows for Models config save and provider auth probe
  actions.
- Route representative Models action facades through shared mutation evidence
  helpers without changing their response DTOs.
- Keep real provider probes/config writes bounded and skipped-safe unless safe
  state is proven.
- Update Models notes, the matrix, generated matrix Markdown, and head evidence.

**Non-Goals:**

- Do not redesign the Models UI.
- Do not add Gateway APIs or frontend-to-Gateway direct calls.
- Do not add force-probe semantics, pricing snapshot DTOs, or PATCH audit
  history routes.
- Do not mutate real provider credentials or config outside already governed
  config-write safety.

## Decisions

### Decision: Config-write safety remains base-hash authority

`models.config.save` already has config-write safety metadata for base-hash,
conflict, idempotency, rollback, and audit status. Mutation evidence should
reference that row instead of redefining conflict behavior from scratch.

Alternative rejected: create a Models-only config write format. That would fork
the shared config-write contract and make other config panels inconsistent.

### Decision: Treat provider probe as an evidence-known action, not a write

`deck.auth.probe` does not rewrite Deck config, but it is a user-triggered
control action that can depend on real provider state. Recording it in mutation
evidence makes fixture safety and external side-effect risk explicit.

Alternative rejected: classify probe as a normal read. That hides provider
environment dependence from future real E2E and UI design work.

### Decision: Preserve runtime Gateway client wrappers

Runtime inventory, auth overview, catalog, and probe already use the typed
Gateway client through deck-go transport. This proposal should not reintroduce
legacy BFF routes; it only wraps action responses with evidence where useful.

Alternative rejected: restore `/models/probe` style BFF routes. The endpoint
contract already records those as migrated legacy rows.

## Risks / Trade-offs

- **Risk:** Provider probe can be confused with a safe offline operation.  
  **Mitigation:** Mark fixture safety skipped-safe/deferred and keep real probe
  execution out of automation unless safe scope is proven.

- **Risk:** Mutation evidence duplicates config-write safety.  
  **Mitigation:** Use `auditCoverage.source` and notes to point back to
  `deck-go-config-write-safety-contracts`.

- **Risk:** Real Gateway model RPC can be degraded in local environments.  
  **Mitigation:** Reuse prior L2 degraded evidence and keep route/DTO/static
  checks mandatory.

## Migration Plan

1. Add Models action rows to mutation evidence and regenerate metadata/docs.
2. Route `saveModelsConfig` and `probeRuntimeModelAuth` through mutation
   evidence helpers while preserving return DTOs.
3. Add focused tests for Models action evidence and facade behavior.
4. Update Models implementation notes, matrix rows, head evidence, and generated
   matrix Markdown.
5. Run focused tests, frontend build, contract-gate, OpenSpec validation, diff
   check, then archive.

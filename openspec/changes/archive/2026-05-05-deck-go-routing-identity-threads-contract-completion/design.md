## Context

`identity.links`, `routing.bindings`, and `threads.projection` are still
degraded in the head matrix even though current code truth is more precise:

- `deck.identity.list/link/unlink` have typed Gateway params/results and
  config-hash/base-hash semantics.
- `deck.routing.list/validate/simulate/add/remove` have typed Gateway
  params/results and routing add/remove already appear in config-write safety.
- `routing.dm-scope.patch` is a product-level routing control implemented
  through the generic config patch BFF route and already covered by
  config-write safety.
- `deck.threads.list` is a read-only projection. Current Gateway/Deck contracts
  do not expose thread rename, rebind, unbind, branch, transcript, or live
  thread mutation semantics.

Prior frontend real-contract verification established safe read-path evidence
for these modules, but mutation evidence and matrix status have not been
reconciled.

## Goals / Non-Goals

**Goals:**

- Reconfirm Routing, Identity, and Threads workflows against Gateway, Deck BFF,
  Deck DTO, frontend facade, test, and real evidence truth.
- Add Deck-facing identity mutation response DTOs.
- Add mutation evidence for identity link/unlink, routing add/remove, and
  routing DM-scope patch.
- Route representative Routing and Identity mutation facades through shared
  mutation evidence helpers.
- Mark Threads as verified read-only projection with explicit unsupported
  mutation/live-refresh gaps.
- Update module notes, head matrix, generated matrix Markdown, head evidence,
  and archive this child proposal after validation.

**Non-Goals:**

- Do not add new Gateway APIs or infer unsupported thread mutation contracts.
- Do not implement first-class routing reorder, route-history persistence,
  human-readable conflict reasons, or binding-id reform.
- Do not run real config writes automatically without disposable or reversible
  config fixtures.
- Do not redesign the Routing, Identity, or Threads UI.

## Decisions

### Decision: Treat config-write safety as the write authority and mutation evidence as the product facade index

Routing and Identity writes are already governed by
`deck-config-write-safety.contract.json`. This proposal adds mutation evidence
rows so product-facing frontend actions also carry action id, DTO, success,
target, audit, conflict, and fixture-safety metadata.

Alternative rejected: keep the writes only in config-write safety. That leaves
frontend product actions invisible to the shared mutation evidence chain and
keeps the matrix degraded despite typed Gateway support.

### Decision: Keep routing validation and simulation advisory/read-like

`deck.routing.validate` and `deck.routing.simulate` do not mutate state. They
stay out of mutation evidence but remain part of the Routing product contract.

Alternative rejected: record validation/simulation as mutations. That would
blur read/advisory actions with write safety guarantees.

### Decision: Represent DM-scope patch as a dedicated Routing facade over generic config patch

The underlying BFF route remains `/api/config/patch`, but Routing needs a
product-level action id. A dedicated frontend facade can call the generic patch
route and acknowledge `routing.dm-scope.patch` without making every generic
config patch look like a routing mutation.

Alternative rejected: attach mutation evidence directly inside
`patchDeckConfig`. That would misclassify channel/config callers that use the
same generic route for different product actions.

### Decision: Mark Threads read-only verified, not mutation-complete

Threads currently supports list/filter projection only. Unsupported thread
mutations and live refresh should remain documented gaps until Gateway and Deck
contracts expose them.

Alternative rejected: product-complete thread mutations from prototype UX. That
would overclaim beyond Gateway truth.

## Risks / Trade-offs

- **Risk:** Mutation evidence can be mistaken as permission to run real config
  writes.  
  **Mitigation:** Mark fixture safety deferred and keep real config write
  execution blocked without reversible fixtures.

- **Risk:** Dedicated DM-scope facade adds one more API helper.  
  **Mitigation:** Scope it to a single product action so generic config patch
  remains reusable without incorrect evidence.

- **Risk:** Threads remains less capable than prototype notes suggested.  
  **Mitigation:** Make the unsupported contract boundary explicit in matrix and
  handoff notes instead of silently implying support.

## Migration Plan

1. Create and validate this child OpenSpec scope.
2. Add Deck-facing identity mutation DTOs and regenerate Deck API artifacts.
3. Add Routing/Identity action rows to mutation evidence and regenerate
   metadata/docs.
4. Refactor representative Routing/Identity facades through mutation evidence
   helpers, including a dedicated routing DM-scope facade.
5. Update focused tests for mutation evidence, API helper behavior, and Routing
   panel use of the dedicated facade.
6. Update Routing/Identity/Threads implementation notes, matrix rows, head
   evidence, and generated matrix Markdown.
7. Run focused contract/frontend/build/OpenSpec checks, archive the child
   change, validate the archived spec, then continue the head matrix.

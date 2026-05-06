## Context

`chat.early-pilot` and `sessions.history` are the remaining chat/session rows in
the head contract-chain matrix. The early chat pilot already established the
core transcript DTOs and production Chat panel wiring. The archived Sessions
real-contract verification already proved safe read paths, optional empty or
degraded Gateway data, missing-key mutation rejection, and browser-to-BFF-only
access.

Since that work, shared platform contracts have landed:

- `deck-go-list-query-contracts` governs session list, session detail, and chat
  history query semantics.
- `deck-go-live-projection-subscription-contract` governs chat/session live
  refresh and stream gap recovery.
- `deck-go-safe-mutation-evidence-contract` provides action-level metadata for
  writes, but chat/session actions are not yet listed.
- `deck-go-real-e2e-seed-and-evidence` provides repeatable cpa+main seed
  evidence for chat/session creation in an isolated real E2E root.

The product completion pass should therefore close the module gap with source
contract metadata, facade usage, focused tests, and durable evidence while
keeping unsafe real mutations bounded.

## Goals / Non-Goals

**Goals:**

- Reconfirm visible chat/session workflows against Gateway methods, Deck BFF
  routes, DTOs, streams, list queries, and real evidence.
- Add mutation evidence rows for production-visible chat/session write actions.
- Route chat/session mutation facades through shared mutation evidence helpers
  without changing existing response DTOs or UI behavior.
- Preserve the existing Chat and Sessions UI rather than redesigning it.
- Update matrix rows, generated matrix Markdown, Sessions implementation notes,
  and head verification evidence.

**Non-Goals:**

- Do not introduce new Gateway APIs or broaden upstream method semantics.
- Do not redesign Chat or Sessions visuals.
- Do not run destructive real reset/clear/delete/compact/restore/patch actions
  against operator history unless disposable session state and cleanup are
  proven in this change.
- Do not solve the existing `POST /chat/projection` server-side no-op beyond
  recording it as product-local/deferred behavior if it remains true.
- Do not tighten pass-through A2UI/timeline leaves beyond current Gateway
  truth.

## Decisions

### Decision: Close read-path gaps by referencing existing platform contracts

List/query and live projection behavior are no longer module-specific unknowns.
The child proposal should update the module rows to reference those archived
contract artifacts and focus new work on chat/session-specific mutation and
evidence gaps.

Alternative rejected: re-create session cursor/live semantics inside this
proposal. That would duplicate the shared platform contracts and make future
modules diverge.

### Decision: Use mutation evidence metadata for chat/session writes

Chat and session actions are Gateway-backed or Deck-local adaptations, and
future product development needs to know which writes are safe, idempotent,
audited, or handoff-blocked. `deck-mutations.contract.json` is the right source
authority for action IDs, routes, DTOs, success indicators, target IDs, fixture
safety, conflict behavior, and audit coverage.

Alternative rejected: only document chat/session writes in handoff notes. That
would not be generated, checked, or reusable by frontend code.

### Decision: Preserve existing facade DTOs

The current `frontend-new/src/api.ts` wrappers are already the browser boundary
for chat/session routes. Refactoring them through
`acknowledgeMutationResponse()` must preserve their current return DTOs so Chat
and Sessions panel behavior does not shift during a contract closure pass.

Alternative rejected: replace route-specific DTOs with one generic mutation
response. That would lose useful fields such as `key`, `runId`,
`abortedRunId`, and compaction action payloads.

### Decision: Treat real mutation proof as bounded and safety-first

Creating a cpa+main session can be safe under the isolated real E2E seed flow.
Reset, clear, delete, compact, branch, restore, patch, steer, and abort can
alter runtime or history state; they remain skipped-safe or handoff-blocked
unless this implementation proves disposable run-scoped session state and
cleanup.

Alternative rejected: run every visible mutation against the user's current
OpenClaw state. That violates the real E2E safety model.

## Risks / Trade-offs

- **Risk:** Mutation evidence can be mistaken for full real write proof.  
  **Mitigation:** Fixture safety and matrix notes must explicitly separate
  contract-known actions from automated L2 mutation execution.

- **Risk:** Chat send and abort are runtime-sensitive and may vary by model or
  channel availability.  
  **Mitigation:** Reuse bounded cpa+main seed evidence when available and record
  degraded/handoff-blocked status after limited attempts.

- **Risk:** Compaction result shapes remain broader than ideal.  
  **Mitigation:** Keep current DTO compatibility and record stricter compaction
  output typing as residual if Gateway truth is not specific enough.

- **Risk:** Projection persistence is currently Deck-local/no-op server behavior.  
  **Mitigation:** Contract it as visible product-local behavior rather than
  pretending it is Gateway-backed.

## Migration Plan

1. Add chat/session action rows to the mutation evidence source contract and
   regenerate generated TypeScript/Markdown artifacts.
2. Refactor chat/session mutation facades through the shared mutation evidence
   helper while keeping response DTOs unchanged.
3. Extend focused mutation helper tests and chat/session API or component tests.
4. Update Sessions implementation notes, matrix rows, generated matrix Markdown,
   and head verification evidence.
5. Run focused mutation contract checks, frontend tests, build,
   `contract-gate`, OpenSpec validation, diff check, then archive.

Rollback removes additive mutation metadata rows and helper calls. Existing BFF
routes, Gateway methods, and UI surfaces remain unchanged.

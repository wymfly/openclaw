## Context

`threads` has a recent v2 handoff package and a production panel that already uses `fetchThreads()` and `DeckGoThreadEntry`. The remaining risk is contract truth: the handoff describes mutation, recent activity, and audit projections that are not guaranteed by the current Deck-facing contract, while the real Gateway can legitimately return an empty thread list when no persisted thread bindings exist.

The active browser boundary remains unchanged: frontend code talks only to the Go BFF. `GET /api/deck/threads` forwards filters to Gateway `deck.threads.list`, which currently projects persisted Discord thread bindings through the runtime boundary.

## Goals / Non-Goals

**Goals:**

- Verify that production Threads remains aligned with the v2 visual direction while keeping only contract-backed behavior active.
- Prove the contract chain from `DeckGoThreadEntry` and endpoint classification through Go forwarding/projection, frontend wrapper filters, production rendering, mock visual coverage, and real-stack behavior.
- Fix deterministic Threads-scoped drift directly when evidence is clear.
- Record unsupported or ambiguous prototype claims in handoff notes instead of turning them into UI facts.

**Non-Goals:**

- Add new Gateway mutation RPCs or BFF mutation endpoints for unbind, rebind, or rename.
- Build transcript, branch, audit, or durable recent-activity storage.
- Infer non-Discord thread semantics from mock data.
- Promote local Threads molecules into shared design-system atoms during this pass.

## Decisions

- **Anchor production behavior to read-only thread inventory.** Use `fetchThreads()` and `GET /api/deck/threads` for list/filter/detail state; mutation dialogs in the handoff stay unsupported unless a real BFF contract exists. This prevents mock-only affordances from shipping as broken controls.
- **Treat empty real Gateway output as valid evidence when shaped correctly.** A real OpenClaw environment may have no persisted thread bindings, so L2 verification may pass as `real-empty-valid` if runtime readiness, BFF response shape, and production empty-state rendering are all verified.
- **Keep cross-panel handoffs local and reversible.** Copy session key and navigate to Sessions/Agents through existing Deck navigation helpers. Threads does not own transcripts.
- **Use circuit breaker for environment-dependent L2 scenarios only.** Static review, focused tests, and L1 mock visual evidence remain mandatory; real stack failures are fixed when deterministic or recorded after bounded attempts when environment/product semantics are unclear.

## Risks / Trade-offs

- **Prototype overclaims mutation/activity/audit flows** -> Production must label or omit them until a typed BFF/Gateway contract exists.
- **Real Gateway thread data can be empty** -> L2 tests must validate contract shape and empty-state behavior rather than require seeded thread bindings.
- **Free-form `targetKind`, `boundBy`, and channel ids can drift** -> UI must avoid closed-enum assumptions and record parser assumptions in handoff notes.
- **Existing implementation may already be partially aligned** -> The pass should review and surgically fix, not rewrite for churn.

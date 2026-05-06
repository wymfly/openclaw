## Context

`frontend-agents-real-contract-verification` already proved the agents read path: Gateway generated methods include `agents.*` and `deck.agents.*`, the Go BFF routes and typed gateway wrappers serve list/detail/section reads, the production UI renders real agents data, and real mutation scenarios were intentionally handoff-blocked to avoid mutating the user's OpenClaw config.

Since then, the platform prerequisites have landed:

- untyped Gateway method hardening keeps agents out of the exception list;
- config-write safety governs base-hash semantics for config-like writes;
- live projection and list-query contracts are available;
- safe mutation evidence now provides an additive metadata layer for control writes.

This module child should therefore close the agents matrix gap by documenting and checking agents/subagents write actions as contract-known, while keeping unsafe real writes deferred until disposable agent fixtures are proven.

## Goals / Non-Goals

**Goals:**

- Reconfirm that visible agents/subagents claims map to typed Gateway/Deck DTOs or explicit deferred states.
- Add action-level mutation evidence rows for agents/subagents writes.
- Route representative agents/subagents mutation facades through shared mutation evidence helpers without changing existing response DTOs.
- Keep real create/update/delete/save/steer/kill scenarios handoff-blocked unless safe disposable state is found.
- Refresh agents/subagents matrix rows and durable implementation notes.

**Non-Goals:**

- Do not redesign the agents or subagents UI.
- Do not create, update, or delete real agents in automated tests without disposable isolated state.
- Do not add Gateway APIs or change upstream method semantics.
- Do not solve subagent live run streaming beyond the archived live projection platform contract.
- Do not fold all future module completion rules into this agents change.

## Decisions

### Decision: Close module gap with metadata and evidence, not unsafe writes

Agents mutation workflows are real Gateway capabilities, but automated real writes can alter the user's OpenClaw configuration. The correct module completion step is to make those actions contract-known and helper-backed, while preserving the previous handoff-blocked status for L2 mutation execution.

Alternative rejected: run create/update/delete against the user's current config. That violates the real E2E safety model.

### Decision: Use the shared mutation evidence contract for agents actions

Adding agents action rows to `deck-mutations.contract.json` keeps action IDs, DTOs, success indicators, audit coverage, idempotency truth, conflict behavior, and fixture safety visible to future module work. It avoids inventing a second agents-only evidence format.

Alternative rejected: document agents mutations only in handoff notes. That would drift from contract-gate and generated frontend metadata.

### Decision: Preserve raw action strings inside the API facade only

`POST /deck/agents` and `POST /deck/subagents` remain multiplexed BFF routes. Panel components should continue calling typed wrappers in `frontend-new/src/api.ts`; raw action strings stay inside the facade and tests.

Alternative rejected: split every action into a new route in this proposal. Route redesign is unnecessary because the current BFF contract is already governed.

### Decision: Subagents are closed with agents for shared policy/actions

The matrix points subagents to the agents completion proposal because per-agent spawn policy lives under `/deck/agents`, while run steer/kill actions live under `/deck/subagents`. This proposal can close shared mutation evidence for both rows without redesigning the separate Subagents panel.

## Risks / Trade-offs

- **Risk:** Mutation metadata can look like full real mutation proof.  
  **Mitigation:** Mark fixture safety as `deferred` and keep implementation notes explicit about handoff-blocked L2 writes.

- **Risk:** Multiplexed routes make action ownership ambiguous.  
  **Mitigation:** Use action IDs in mutation evidence and keep wrapper tests around request bodies.

- **Risk:** Real read evidence can drift with local Gateway state.  
  **Mitigation:** Reuse shape/capability assertions and prior real evidence; do not depend on specific configured agent counts.

## Migration Plan

1. Add agents/subagents mutation evidence rows and regenerate metadata/docs.
2. Use `acknowledgeMutationResponse` in representative agents/subagents mutation wrappers.
3. Extend focused frontend tests for action routing and metadata interpretation.
4. Update agents implementation notes, head matrix rows, and verification evidence.
5. Run focused tests, `make frontend-build`, `make contract-gate`, OpenSpec validation, and archive.

Rollback removes additive mutation metadata rows and helper calls; BFF routes and Gateway methods remain unchanged.

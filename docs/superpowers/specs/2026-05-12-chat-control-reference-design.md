# Chat Control Reference Design

**Date**: 2026-05-12  
**Status**: Draft for user review  
**Related**:
`CONTEXT.md`,
`REALIGNMENT.md`,
`docs/realignment/chat-surface-inventory.md`

## Purpose

This design is part of the realignment work that followed the `AGENTS.md`
rewrite and the adoption of the new skill-driven development workflow. Its
purpose is not to assume that chat is broken. Chat has already gone through
several convergence and remediation passes and is currently considered usable.

The purpose is to use chat, the highest-value and most complete deck-go module,
as the reference module for future convergence work. Chat should define how the
project audits a control surface, separates historical artifacts from active
defects, assigns contract authority, verifies real end-to-end behavior, and
then reuses that standard for later modules such as agents, sessions, plugins,
models, memory, and skills.

## Goals

- Define the long-lived chat control reference surface across read, write,
  stream, and action layers.
- Lock the contract authority model for chat: Gateway protocol as runtime truth,
  deck-go contracts as product-facing truth, and frontend/store as view model
  only.
- Define the Phase 5 defect confirmation gate before implementation starts.
- Define how legacy remediation artifacts, old rule outputs, local shims, and
  historical specs should be classified.
- Establish a repeatable module convergence pattern for later core modules.

## Non-goals

- Do not treat every historical chat artifact as an active defect.
- Do not perform a full repository cleanup in the chat phase.
- Do not rewrite chat only because some implementation details are imperfect.
- Do not make frontend/store types the contract authority.
- Do not add new `deck.*` chat RPC methods without applying Rule R1 from
  `CONTEXT.md`.
- Do not introduce mode-specific control behavior above the deck-go runtime
  facade. Rule R2 remains in force.

## Current Baseline

Phase 3 produced a factual inventory at
`docs/realignment/chat-surface-inventory.md`. The relevant baseline is:

- There is no current `deck.chat.*` Gateway namespace.
- The active Gateway chat surface is `chat.history`, `chat.send`, and
  `chat.abort`, with chat-adjacent session wrappers under `sessions.*`.
- deck-go BFF chat routes already call typed Gateway methods through the
  runtime adapter, especially `sessions.send`, `sessions.create`,
  `sessions.abort`, `sessions.steer`, `sessions.get`, `sessions.list`, and
  `chat.history`.
- The frontend chat workbench is broader than a composer. It includes session
  selection, transcript rendering, stream handling, run state, tool progress,
  canvas/artifact integration, approval handling, search/filter, and mutation
  controls.
- Existing `.local/chat-*` remediation evidence indicates that important mock,
  real, and SSE paths have already been exercised, but Phase 4 does not treat
  those records as the target design.

## Control Surface Layers

### Read Surface

The read surface restores and displays current chat state. It should not invent
new runtime behavior.

Representative active paths:

- Session list and metadata: `/sessions`, `/chat/sessions`
- Session detail and timeline: `/sessions/{sessionKey}`
- Snapshot: `/chat/snapshot`
- History: `/chat/history`
- Preview: `/chat/sessions/preview`

Long-term rule: the frontend should consume deck-go product DTOs. The BFF may
compose Gateway `sessions.*` and `chat.history` data, but the product-facing
shape must be defined in deck-go contracts rather than in frontend shims.

### Write Surface

The write surface creates or mutates durable chat/session state.

Core writes:

- Create session: `/chat/sessions/create`
- Send message: `/chat/send`
- Patch or rename session: `/chat/sessions/patch`

Maintenance writes:

- Reset, clear, and delete session
- Compact, branch, and restore compaction state
- Persist chat projection state

Phase 5 must not blindly rewrite every write path. It must first confirm which
active writes have real defects. However, if active chat control defects are
confirmed, they should be fixed in one pass rather than left as fragmented
future cleanup.

### Stream Surface

The stream surface provides in-flight state and live feedback. It is required
for product experience but is not the only truth.

Representative active events:

- `chat` delta/final/error/aborted
- `session.message`
- `session.tool`
- `sessions.changed`
- approval events
- canvas events
- `projection.gap`

Long-term rule: stream events drive live experience, while history and snapshot
provide readback authority. A successful send path must be visible through the
stream and recoverable through history or snapshot after reload.

### Action Surface

The action surface issues commands that affect a running or contextual chat
operation but are not always simple durable writes.

Representative active actions:

- Abort a run: `/chat/abort`
- Steer a running session: `/chat/steer`
- Subscribe or unsubscribe session events: `/chat/session-events`
- Discover slash or command actions through chat-adjacent Gateway methods
- Approval and canvas bridge actions when they affect chat interaction

Action paths need explicit request/response contracts and failure semantics.
They should not rely on frontend-only conventions to define behavior.

## Contract Authority

### Gateway Protocol Is Runtime Truth

Gateway protocol defines what OpenClaw can actually do. For chat, this includes
`chat.*`, `sessions.*`, and Gateway event schemas. A field or action is not a
runtime capability merely because the frontend wants it.

### deck-go Contracts Are Product-facing Truth

deck-go contracts define the product API between BFF and frontend:

- HTTP endpoints
- DTOs
- mutations
- list/query surfaces
- stream projections
- UI metadata that governs product-facing route and action availability

Contract source files under `deck-go/contracts/source/` and their generated TS
and Go artifacts are the authority for this layer.

### BFF Is a Translation Layer

The Go BFF may compose and normalize Gateway data. For example, snapshot may
combine `sessions.get`, `sessions.list`, and local projection state. That
translation must still be explainable from Gateway protocol plus deck-go
contracts. BFF implementation shape is not a third independent truth source.

### Frontend and Store Are View Models

Frontend API adapters, local shims, and store types exist to support rendering
and interaction. They may normalize product DTOs into view models, but they do
not define the contract. If frontend/store types disagree with deck-go contracts
or Gateway protocol, Phase 5 should classify the mismatch as drift and confirm
whether it affects the active chat chain.

## Defect Confirmation Gate

Phase 5 must start with a defect confirmation table before implementation. Each
candidate issue must include:

| Field                 | Required content                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Fact evidence         | File, contract, generated artifact, test, runtime log, or prior evidence                                           |
| Chain position        | Gateway protocol, deck-go contracts, generated artifacts, BFF adapter, frontend API/store, stream, or E2E evidence |
| Active surface impact | Whether the issue affects current read/write/stream/action chat behavior                                           |
| Classification        | Real defect, historical artifact, design tradeoff, verification gap                                                |
| Recommended handling  | Fix this phase, add verification only, record follow-up, or ignore                                                 |
| User confirmation     | Explicit user decision before implementation                                                                       |

### Real Defects

A candidate should be treated as a real defect when one of these is true:

- Active contract source, generated artifacts, BFF implementation, or frontend
  consumption disagree in a way that affects current chat behavior.
- Current usability depends on an undocumented frontend-only shim that should
  instead be captured by product contracts or Gateway truth.
- Mock or real verification cannot prove the behavior it claims to prove,
  creating a false-green risk for the active chat chain.
- Stream state and readback state explain the same session differently.
- deck-go control code above the runtime facade branches on runtime mode,
  violating Rule R2.
- A proposed `deck.*` chat method triggers Rule R1 but has not been classified
  as type 1, 2, or 3 and reviewed with the user when required.

### Not Real Defects By Themselves

These are not active defects unless they affect the active chain:

- Old `.local/chat-*` remediation logs.
- Historical OpenSpec proposals, old acceptance matrices, or old planning
  documents.
- Imperfect but stable implementation details that do not mislead the reference
  design.
- Adjacent module problems outside the chat reference surface.

## Phase 5 Reference Lock

Phase 5 should be framed as a chat reference lock, not as an assumption-driven
chat repair pass.

The required trace is:

```
frontend send
  -> BFF /chat/send
  -> Gateway sessions.send
  -> Gateway chat.send
  -> stream event
  -> history or snapshot readback
  -> frontend rendered state
```

That trace is the minimum proof that chat covers the core control chain. Phase 5
may be broader than this trace if the defect confirmation gate proves active
surface defects elsewhere. It should still remain bounded to chat active control
surface issues confirmed with the user.

If Phase 5 finds that chat has no active defects requiring implementation, it
may primarily produce contract alignment evidence, generated artifact checks,
tests, and updated verification records instead of forcing code changes.

## Verification Targets

The Phase 5 plan should choose the narrowest existing commands that prove the
claims. It should not invent a heavy process for formality.

Required evidence categories:

- The send path can be traced from frontend API call to Gateway runtime call.
- Stream events and readback state agree for the same session/run.
- deck-go contract sources, generated TS/Go artifacts, BFF request/response
  handling, and frontend API consumption are aligned for active chat paths.
- Any confirmed defect is fixed or explicitly handed off with evidence.
- Historical artifacts are classified rather than silently treated as current
  truth.
- The final report explains how the same convergence pattern applies to the next
  core module.

Candidate gates include the relevant subset of deck-go contract checks, backend
tests, frontend build/tests, mock chat E2E, and real chat E2E. The exact command
set belongs in the Phase 5 implementation plan after the defect confirmation
table is approved.

## Legacy Artifact Disposition

Legacy artifacts should be classified, not bulk-deleted.

| Artifact class                                                           | Disposition                                                                                 |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `.local/chat-*` remediation evidence                                     | Preserve as evidence. Do not treat as target design.                                        |
| Phase 3 inventory                                                        | Preserve as factual baseline.                                                               |
| Old `AGENTS.md` rules and old acceptance-matrix thinking                 | Historical reference only. They no longer govern current workflow.                          |
| Active contract sources, generated artifacts, BFF routes, frontend shims | Confirm whether they affect active chat chain. If yes, include in the Phase 5 defect table. |
| Old docs, plans, mocks, or specs outside the active chain                | Record disposition or follow-up when relevant. Do not expand Phase 5 into cleanup.          |

## Reusable Module Convergence Pattern

Chat should establish this pattern for later modules:

1. Build or reuse a factual surface inventory.
2. Use brainstorming to define a reference design and surface boundaries.
3. Assign contract authority before implementation.
4. Start implementation with a defect confirmation gate.
5. Fix confirmed active defects in one pass when they belong to the current
   module surface.
6. Separate historical artifacts from active defects.
7. Lock the reference path with real verification evidence.
8. Carry the resulting standard into the next module.

## Phase 5 Entry Checklist

Phase 5 may start only after:

- This design is reviewed and approved by the user.
- The implementation session reads `CONTEXT.md`, this design, and
  `docs/realignment/chat-surface-inventory.md`.
- A defect confirmation table is prepared and reviewed with the user.
- Any proposed new `deck.*` chat RPC is classified under Rule R1.
- Any mode-specific behavior above the runtime facade is rejected or classified
  as an R2 violation.
- The implementation plan chooses verification commands based on confirmed
  active defects rather than historical assumptions.

## Success Criteria

Phase 4 succeeds when this design is reviewed and approved, and the Phase 5
entry gate is clear.

Phase 5 succeeds when the confirmed active chat defects are fixed or explicitly
handed off, the required chat reference trace is verified, and the final report
captures the reusable convergence pattern for subsequent core modules.

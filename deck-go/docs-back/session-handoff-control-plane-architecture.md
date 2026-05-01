# Session Handoff — `deck-go` Control Plane Architecture

## Purpose

This handoff file is the single entry point for the active `deck-go` migration session.

Use this file when resuming or redirecting the session.

It summarizes:

- the final target architecture
- why the current framing is too shallow
- what documents matter
- what the next session should do first
- what must not be done

The goal is to let a new or continuing session recover full context from one file without needing the full conversation transcript.

## Executive Summary

The current `deck-go/` effort should **continue**, but it should not continue as a simple:

- Go + React replacement for the current Deck runtime

It should be reframed and continued as:

- the extraction of a real control plane above `OpenClaw runtime`

The intended long-term architecture is:

- `OpenClaw runtime` stays independent and remains the runtime/protocol authority
- `deck-go` becomes the real control plane / adapter / API aggregation layer
- `React frontend` consumes `deck-go`
- future `Enterprise Agent Platform` also uses Go and should align with `deck-go` boundaries instead of bypassing them

In short:

- OpenClaw runtime = execution engine
- deck-go = control plane + projection + aggregation layer
- React = interface
- future enterprise platform = higher-level Go services built above or alongside deck-go-compatible control-plane contracts

## Decision

Do **not**:

- hard-stop the migration and restart from scratch
- let the migration continue under the old framing until it is "done"

Do:

- perform a **soft interruption**
- pause new implementation briefly
- add the architecture steering and contract framing documents
- then continue implementation under the corrected architecture

## Branch / Worktree Execution Rule

- Current branch remains the main implementation line.
- `enhanced-freeze` is a backup worktree only.
- The backup worktree exists to preserve a runnable version while current-branch architecture correction and implementation continue.
- It must not become the default implementation lane unless a later planning decision explicitly changes that.

This is the lowest-cost path.

## Why Soft Interruption Is Recommended

Current implementation depth snapshot at the time of this handoff:

- `deck-go/backend`: `22` files, about `2363` lines
- `deck-go/frontend/src`: `4` files, about `765` lines

Interpretation:

- backend skeleton is real
- frontend binding is still shallow
- this is still a low-cost correction window

Waiting until the current direction is "complete" will be much more expensive because route structure, state boundaries, and backend responsibilities will harden around the wrong framing.

## Core Architectural Judgment

The main problem is **not** "replace Next with Go".

The main problem is:

- extract Deck-specific control-plane behavior out of the shared OpenClaw runtime hot paths
- give that behavior a durable home in `deck-go`
- preserve OpenClaw runtime as the execution/runtime authority

This means `deck-go` must not become:

- a route-for-route Go translation of `dashboard/src/app/api/**`
- a private API shim only for the current React app
- a second runtime that redefines Gateway truth

## What The Active Session Should Do Next

The active session should stop adding new broad implementation work for a moment and complete the document steering package first.

### Required actions

1. Confirm `deck-go/docs/target-architecture.md` as the north-star reference
2. Update `.omx/plans/prd-deck-go-parallel-migration.md`
3. Update `deck-go/docs/contracts/deck-backend-surface.md`
4. Update `deck-go/docs/contracts/state-authority-matrix.md`
5. Update `deck-go/docs/contracts/gateway-contract-inventory.md`

After these document changes land, implementation should continue.

## Final Target Architecture

### Layer 1 — `OpenClaw runtime`

Responsibilities:

- runtime truth
- Gateway protocol authority
- execution engine
- session effects
- config authority
- actual runtime state

Must remain:

- independent
- authoritative
- not redefined by deck-go

### Layer 2 — `deck-go`

Responsibilities:

- control plane
- runtime adapter
- capability bootstrap
- projection/cache
- operator auth/bootstrap
- deck-facing API/SSE contracts
- aggregation of runtime + local control-plane state

Must become:

- the stable backend surface for Deck
- a durable control-plane boundary
- compatible with future Go platform layering

### Layer 3 — `React frontend`

Responsibilities:

- rendering
- transient UI state
- user interaction
- presentation logic

Must not:

- directly own runtime truth
- reconstruct complex backend semantics from raw OpenClaw contracts if deck-go can own them

### Layer 4 — Future `Enterprise Agent Platform`

Not in phase 1 scope.

But the architecture must remain compatible with it.

Meaning:

- do not lock `deck-go` into assumptions that only make sense for the current React screens
- do not make contracts impossible to promote into broader Go service boundaries later

## Required Document Set

These are the documents the session should use.

### First priority

- `deck-go/docs/architecture-steering-package.md`
  Why: this is the steering document that explains exactly how to correct the framing without restarting the work

- `deck-go/docs/target-architecture.md`
  Why: this is the active north-star architecture document and should now be treated as binding planning context

### Second priority

- `.omx/plans/prd-deck-go-parallel-migration.md`
  Why: this is the active migration PRD and must be reframed

- `deck-go/docs/contracts/deck-backend-surface.md`
  Why: this defines what the Go backend is actually becoming

- `deck-go/docs/contracts/state-authority-matrix.md`
  Why: this defines ownership boundaries and must be future-platform-aware

- `deck-go/docs/contracts/gateway-contract-inventory.md`
  Why: this must clearly split runtime-facing and deck-facing contracts

### Important supporting context

- `deck-go/docs/contracts/legacy-server-core.md`
  Why: proves legacy Deck already contains a local control-plane runtime

- `deck-go/contracts/README.md`
  Why: keeps Gateway authority discipline explicit

- `deck-go/backend/README.md`
  Why: current backend role framing needs to be interpreted with the new architecture in mind

## External Research Context

These research documents were written outside `deck-go/`, but they are highly relevant and should be treated as background authority for the architectural reasoning:

- `docs/plans/2026-04-19-enhanced-core-diff-audit.md`
- `docs/plans/2026-04-19-enhanced-conflict-reduction-classification.md`
- `docs/plans/2026-04-19-zero-conflict-migration-blueprint.md`
- `docs/plans/2026-04-19-conflict-reduction-execution-roadmap.md`

### Why these matter

They explain:

- why the current OpenClaw + Deck boundary causes merge and rebase pain
- why projection and control-plane behavior should move out of shared runtime hot files
- why a control-plane / adapter architecture is preferable
- why parity alone is not the final architecture

### Minimum external context if time is tight

If the session cannot read all four, read these first:

1. `docs/plans/2026-04-19-zero-conflict-migration-blueprint.md`
2. `docs/plans/2026-04-19-conflict-reduction-execution-roadmap.md`

## What Must Change In Each Existing Doc

### `.omx/plans/prd-deck-go-parallel-migration.md`

Add or change:

- objective language: not just replace runtime, but build a Go control plane above OpenClaw runtime
- a `Long-term Positioning` section
- a note that parity is a migration gate, not the final architecture
- explicit wording that phase 1 excludes enterprise-platform implementation, but not enterprise-platform compatibility

### `deck-go/docs/contracts/deck-backend-surface.md`

Expand into three backend roles:

- Adapter role
- Control-plane role
- API aggregation role

Also explicitly warn:

- deck-go must not collapse into a direct Go copy of `dashboard/src/app/api/**`

### `deck-go/docs/contracts/state-authority-matrix.md`

Add a future-facing dimension:

- `Future platform relevance`

or

- `Promotion beyond Deck`

Every row should clarify whether it is:

- Deck-only UI state
- deck-go-owned control-plane state
- a future shared platform candidate

### `deck-go/docs/contracts/gateway-contract-inventory.md`

Split contracts into:

- Runtime-facing contracts
- Deck-facing contracts

This distinction is mandatory.

Without it, the migration risks becoming a shallow route translation instead of a control-plane extraction.

## What Must Not Happen

The active session must avoid these failure modes:

- treating parity as the final architecture goal
- translating current Next API routes one-to-one into Go handlers without rethinking backend role
- redefining runtime truth inside deck-go
- making deck-go backend semantics depend too tightly on current React route/page structure
- postponing all architecture correction until after implementation is "done"

## What Good Progress Looks Like

The session is moving in the right direction if:

- documents now state that `deck-go` is a control plane above `OpenClaw runtime`
- backend surfaces are described as adapter/control-plane/aggregation, not just BFF
- contract docs distinguish runtime-facing from deck-facing interfaces
- state docs identify which responsibilities can grow into future platform capabilities
- implementation resumes only after the document package is aligned

## Suggested Working Order

1. Read `deck-go/docs/architecture-steering-package.md`
2. Create `deck-go/docs/target-architecture.md`
3. Reframe `.omx/plans/prd-deck-go-parallel-migration.md`
4. Update `deck-go/docs/contracts/deck-backend-surface.md`
5. Update `deck-go/docs/contracts/state-authority-matrix.md`
6. Update `deck-go/docs/contracts/gateway-contract-inventory.md`
7. Resume implementation

## Short Prompt For A Continuing Session

Use this if the next session needs a concise restart instruction:

> Continue the current `deck-go` migration, but first do a soft architecture correction. Do not restart from scratch and do not continue broad implementation under the old framing. Read this handoff file, then read `deck-go/docs/architecture-steering-package.md`. Add `deck-go/docs/target-architecture.md`, then update the PRD and the three key contract docs so `deck-go` is framed as a control plane / adapter / API aggregation layer above `OpenClaw runtime`, not merely a Go rewrite of the current Deck runtime. After the document package is aligned, continue implementation.

## Validation Snapshot

At handoff time:

- `deck-go/backend` contains real implementation, not just placeholders
- `deck-go/frontend/src` is still shallow enough that architectural correction is cheap
- `deck-go/docs/architecture-steering-package.md` exists and has passed basic diff hygiene

This confirms the recommendation:

- soft interruption now
- no hard restart
- no wait-until-done

## Final Instruction

If there is a choice between:

- moving forward quickly under the current shallow framing
- pausing briefly to align the architecture documents

choose the architecture alignment first.

That brief pause is cheaper than a second architectural rewrite later.

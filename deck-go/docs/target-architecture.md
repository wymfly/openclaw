# Target Architecture

> Draft status:
> This file is a **starter draft for reference only**.
> It is intended to accelerate the active `deck-go` migration session, not to
> bypass its judgment.
> The implementing session owns the final wording, structure, and refinements,
> as long as the architectural intent below is preserved.

## Purpose

Define the long-term architecture that `deck-go/` should converge toward.

This document is not a phase-1 task list.
It is the north-star boundary document for:

- `OpenClaw runtime`
- `deck-go`
- `React frontend`
- future Go-based enterprise/platform services

## Final Target

The intended architecture is:

- `OpenClaw runtime` remains an independent runtime authority
- `deck-go` becomes the control plane / adapter / API aggregation layer
- `React frontend` consumes `deck-go`
- future `Enterprise Agent Platform` services also use Go and align with `deck-go` boundaries rather than bypassing them

In shorthand:

- OpenClaw runtime = execution engine
- deck-go = control plane + projection + aggregation
- React = interface
- enterprise platform = higher-level Go services above or adjacent to the same control-plane boundary

## Stable Layers

## Layer 1 — `OpenClaw runtime`

Responsibilities:

- Gateway protocol authority
- runtime truth
- session effects
- config authority
- execution engine behavior
- actual connected-state and tool execution semantics

Constraints:

- must stay independent from Deck-specific projection concerns
- must not be redefined by deck-go
- remains the source of truth for runtime state and runtime effects

## Layer 2 — `deck-go`

Responsibilities:

- runtime adapter to OpenClaw
- capability bootstrap
- projection and aggregation
- deck-facing REST/SSE/API contracts
- operator auth/bootstrap
- local continuity, replay, and cache semantics needed for the Deck product
- stable control-plane behavior across frontend clients

Constraints:

- must not become a second runtime
- must not redefine OpenClaw runtime truth
- must not collapse into a route-for-route translation of the current Next API layer
- should become the durable backend surface for Deck and future adjacent Go services

## Layer 3 — `React frontend`

Responsibilities:

- rendering
- interaction
- transient UI state
- user workflow composition

Constraints:

- should consume stable deck-go contracts
- should not own runtime truth
- should not be forced to reconstruct deep backend semantics directly from raw OpenClaw protocol surfaces when deck-go can own that responsibility

## Layer 4 — Future `Enterprise Agent Platform`

Phase-1 status:

- not implemented
- out of current migration scope

Architectural requirement:

- deck-go must not be designed in a way that blocks future Go-based services from aligning with its contracts and state boundaries

Examples of likely future alignment areas:

- policy and approval flows
- aggregated inventory and capability surfaces
- operator/session bootstrap patterns
- projection/cache ownership
- audit and event fanout responsibilities

## Boundary Rules

### Runtime truth stays in OpenClaw

OpenClaw owns:

- runtime facts
- runtime actions
- protocol authority
- config truth

deck-go may:

- cache
- project
- normalize
- aggregate

deck-go may not:

- silently redefine
- invent incompatible runtime semantics

### Projection and control-plane semantics stay in deck-go

deck-go owns:

- client-facing aggregation
- compatibility façades
- continuity/replay responsibilities for the Deck product
- local operator/session bootstrap semantics
- deck-facing API/SSE stability

### Browser-only state stays in React

React owns:

- tabs
- filters
- unsaved local form state
- purely presentational and interaction concerns

### Future platform services must align with the control-plane boundary

Future Go services should:

- compose with deck-go
- reuse shared control-plane contracts
- build on stable deck-go-owned boundaries where appropriate

They should not:

- tunnel through ad hoc frontend-shaped route semantics
- recreate Deck-specific glue independently

## What `deck-go` Is

- a control plane for Deck
- an adapter above OpenClaw runtime
- an API aggregation layer
- a stable backend contract owner for the Deck frontend
- a bridge toward a future Go-based service ecosystem

## What `deck-go` Is Not

- not a second runtime
- not a rewrite of Gateway
- not merely a Go implementation of the current `dashboard/server` internals
- not merely a private BFF for current React pages
- not the future enterprise platform itself

## Phase-1 Implications

Phase 1 should optimize for:

- explicit boundaries
- control-plane extraction
- parity on critical workflows
- durable contract ownership

Phase 1 should not optimize only for:

- route-by-route replacement
- superficial parity without boundary improvement
- preserving current implementation shape when it conflicts with the target architecture

## Architectural Test

New backend work should be checked with these questions:

1. Is this runtime truth?
   - If yes, it belongs in OpenClaw runtime.
2. Is this projection, aggregation, or operator-facing control-plane behavior?
   - If yes, it likely belongs in deck-go.
3. Is this browser-only transient UI state?
   - If yes, it belongs in React.
4. Could this later become a shared Go platform capability?
   - If yes, do not encode it as page-specific glue.

## Migration Posture

The current migration should be interpreted as:

- extracting the first real Go control plane above OpenClaw runtime

not merely:

- swapping the current Deck runtime from Next/Node to Go

That distinction should guide every contract and state-boundary decision going forward.

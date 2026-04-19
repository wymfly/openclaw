# Architecture Steering Package For `deck-go`

## Purpose

This document is a steering artifact for the in-flight `deck-go/` migration work.

Its purpose is narrow:

- preserve the current migration momentum
- avoid derailing the active implementation session
- raise the architectural framing from "replace the current Deck runtime" to
  "evolve toward the long-term target architecture"

This file does **not** replace the current PRD or contract documents.
It tells the active migration session which documents must be added or adjusted
so the work converges on the final architecture instead of stopping at a
Go-for-Next runtime swap.

## Final Target Architecture

The long-term target is:

- `OpenClaw runtime` remains an independent runtime authority
- `deck-go` becomes the real control plane / adapter / API aggregation layer
- `React frontend` consumes `deck-go`
- `Enterprise Agent Platform` also uses Go and can align with `deck-go` instead of bypassing it

In short:

- OpenClaw runtime = execution engine
- deck-go = control plane and projection layer
- React = interface
- enterprise platform = higher-layer Go services that should align with deck-go boundaries

## Why This Steering Package Exists

The current `deck-go/` docs already contain many correct ideas:

- `deck-go/backend/README.md` already frames the backend as a local control-plane / BFF
- `deck-go/contracts/README.md` already treats Gateway as protocol authority
- `deck-go/docs/contracts/legacy-server-core.md` already recognizes that legacy Deck contains a real local control-plane runtime
- `deck-go/docs/contracts/deck-backend-surface.md` already starts separating backend and browser responsibilities

However, the current framing still risks a shallow end state:

- "Go backend replaces the current Next/Node runtime"

That is better than the current stack, but still too local and too tactical.

Without explicit architectural steering, the migration can easily converge to:

- a Go rewrite of the existing Deck backend behavior
- a stronger local BFF
- a parity-focused replacement

instead of converging to:

- a durable control-plane layer that sits above OpenClaw runtime
- a service boundary reusable by future Go-based platform services

## Required Outcome

The active migration should continue, but the document set must now enforce these rules:

1. `deck-go` is not just a replacement runtime for `dashboard/`
2. `deck-go` is a control-plane layer above `OpenClaw runtime`
3. `deck-go` owns projection, aggregation, local operator semantics, and client contracts
4. `deck-go` must not become a private API shim only for the current React app
5. future enterprise-platform alignment is out of phase-1 scope, but must remain architecturally open

## Minimum Document Package

To steer the active migration session without restarting it, use:

### 1. Add one new north-star document

Add:

- `deck-go/docs/target-architecture.md`

This new file is mandatory because no current doc fully states the final
architecture in one place.

### 2. Update four existing documents

Update:

- `.omx/plans/prd-deck-go-parallel-migration.md`
- `deck-go/docs/contracts/deck-backend-surface.md`
- `deck-go/docs/contracts/state-authority-matrix.md`
- `deck-go/docs/contracts/gateway-contract-inventory.md`

This is the minimum set that changes strategy without disrupting implementation.

## What The New North-Star Document Must Say

## `deck-go/docs/target-architecture.md`

This file should define:

### Mission

- `deck-go` is the control plane for Deck and future adjacent Go services
- `OpenClaw runtime` remains the source of runtime truth

### Stable architectural layers

- OpenClaw runtime
- deck-go control plane
- React frontend
- future enterprise Go services

### Explicit boundary rules

- runtime truth stays in OpenClaw
- projection, aggregation, local operator semantics, and deck-facing contracts stay in deck-go
- browser-only transient UI state stays in React
- future enterprise services must compose with deck-go or share its control-plane contracts, not tunnel directly through ad hoc UI glue

### Anti-goals

- deck-go must not become a second runtime
- deck-go must not hardcode current React page assumptions as its only consumer model
- deck-go must not block future service extraction by binding too tightly to current route structure

## What Must Change In The Existing PRD

## `.omx/plans/prd-deck-go-parallel-migration.md`

Keep the current migration plan, but change the framing in these ways:

### Update objective language

Current framing is too close to:

- "replace Deck's current `Next/Node` production runtime"

It should instead say:

- "replace the current Deck runtime with a Go-based control plane that sits above OpenClaw runtime and exposes stable deck-facing contracts"

### Add a "long-term positioning" section

Required content:

- phase 1 still excludes enterprise-platform implementation
- but deck-go must be shaped so it can become the first Go service in a broader agent platform stack
- future platform services should align with deck-go contracts and boundaries, not re-solve deck/runtime orchestration independently

### Add a "do not optimize for parity alone" note

Parity is required for cutover, but parity is not the final architecture.
This should explicitly say:

- parity is a migration gate
- architecture is a long-term boundary choice

## What Must Change In `deck-backend-surface.md`

## `deck-go/docs/contracts/deck-backend-surface.md`

This file is already close, but it still reads too much like a strong BFF.

It should be expanded to define three backend roles:

### 1. Adapter role

- capability bootstrap from OpenClaw runtime
- runtime compatibility checks
- protocol normalization where needed

### 2. Control-plane role

- operator auth/bootstrap
- projection/cache
- continuity/replay ownership
- health/status aggregation
- local policy and control-plane semantics

### 3. API aggregation role

- stable Deck-facing REST/SSE surface
- shield frontend from runtime churn
- support future non-React or platform consumers where appropriate

Also add:

- an explicit warning that deck-go must not collapse into a route-for-route clone of current `dashboard/src/app/api/**`

## What Must Change In `state-authority-matrix.md`

## `deck-go/docs/contracts/state-authority-matrix.md`

This file should gain a future-facing dimension.

Add either:

- a `Future platform relevance` column

or:

- a new section called `Promotion beyond Deck`

Each surface should now answer:

- Deck-only UI state?
- deck-go-owned control-plane state?
- possible shared platform capability later?

This avoids a common mistake:

- treating all newly extracted backend state as local Deck implementation detail

when some of it may actually be the seed of the future Go service layer.

Examples likely to be platform-relevant:

- capability inventory
- operator/session bootstrap semantics
- event fanout or continuity bookkeeping
- projection/cache ownership
- approval/policy/audit style state if expanded later

## What Must Change In `gateway-contract-inventory.md`

## `deck-go/docs/contracts/gateway-contract-inventory.md`

This file should explicitly split two contract classes:

### Runtime-facing contracts

- how deck-go consumes OpenClaw runtime
- generated from upstream authority
- must stay narrow and authority-respecting

### Deck-facing contracts

- how frontend consumes deck-go
- owned by deck-go
- may aggregate, project, or normalize runtime state

Why this matters:

Without this split, the migration can drift into a route-level port of current
Next handlers rather than designing a durable control-plane contract.

Also add:

- a note that future Go-based enterprise services should prefer to build on
  stable deck-go or shared control-plane contracts rather than bind directly to
  ad hoc frontend-era route semantics

## Implementation Posture For The Active Session

The active migration session should **not** be asked to restart or redesign from scratch.

Instead:

- continue current contract inventory and parity work
- keep the current phase plan intact
- inject the north-star framing into the docs now
- use that framing to guide future contract extraction and backend module boundaries

That means the session should continue as planned, but interpret its work as:

- building the first version of a Go control plane

not merely:

- rewriting the current local backend in another language

## Minimal Editing Order

To minimize disruption, the active session should edit in this order:

1. add `deck-go/docs/target-architecture.md`
2. update `.omx/plans/prd-deck-go-parallel-migration.md`
3. update `deck-go/docs/contracts/deck-backend-surface.md`
4. update `deck-go/docs/contracts/state-authority-matrix.md`
5. update `deck-go/docs/contracts/gateway-contract-inventory.md`

Why this order:

- start with target architecture
- then reframe the migration PRD
- then refine backend role
- then refine ownership
- then refine contract split

## Expected Result

If the above document package is applied, the active migration should evolve from:

- "Go + React replacement for today's Deck"

to:

- "Go control-plane migration that keeps OpenClaw runtime independent, gives
  Deck a durable adapter/control-plane layer, and leaves the door open for a
  future Go enterprise agent platform"

That is the smallest document intervention that meaningfully improves the long-term outcome.

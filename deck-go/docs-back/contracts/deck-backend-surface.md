# Deck Backend Surface

This document defines what the `deck-go` backend is becoming under the corrected architecture.

It is **not** merely a stronger BFF and it must **not** collapse into a route-for-route clone of `dashboard/src/app/api/**`.

## Backend Roles

## 1. Adapter Role

Purpose:

- adapt `OpenClaw runtime` into stable deck-go-consumable backend behavior

Responsibilities:

- capability bootstrap from runtime
- runtime compatibility checks
- protocol normalization where needed
- bounded runtime access orchestration

Examples:

- `gateway.describe` bootstrap
- runtime-facing method grouping
- lifecycle-safe runtime connection and request mediation

Non-responsibilities:

- inventing runtime truth
- redefining Gateway semantics

## 2. Control-plane Role

Purpose:

- own Deck-specific operator semantics above runtime truth

Responsibilities:

- operator auth/bootstrap
- projection/cache ownership
- continuity/replay ownership
- health/status aggregation
- bounded gateway lifecycle management
- local control-plane persistence

Allowed lifecycle ownership:

- start / stop / restart
- env / config injection
- health polling
- supervision

Forbidden lifecycle ownership:

- competing runtime state
- competing config truth
- silent redefinition of protocol semantics

## 3. API Aggregation Role

Purpose:

- expose a stable deck-facing REST/SSE contract to the React app

Responsibilities:

- deck-facing REST API
- deck-facing SSE stream
- stable deck-facing DTOs
- shield frontend from runtime churn
- provide a backend surface that can later be composed by higher-layer Go services

This role is where parity-sensitive UI consumption should stabilize, rather than forcing React to reconstruct backend semantics from raw runtime contracts.

## What The Backend Owns

- frontend REST API
- frontend SSE stream
- local auth/bootstrap
- local persistence/projection/cache
- health/status aggregation
- compatibility façade for the React SPA
- bounded gateway lifecycle management

## What The Backend Does Not Own

- Gateway protocol truth
- Gateway method semantics
- runtime execution truth
- browser-only transient UI state
- future enterprise-platform implementation scope

## Legacy Runtime Evidence

Current legacy control-plane runtime already exists across:

- `runtime.ts`
- `gateway-adapter.ts`
- `event-bus.ts`
- `access-gate.ts`
- `contracts.ts`
- `deck-settings.ts`
- `json-store.ts`
- `node-connection.ts`
- `approval-bridge.ts`
- `health-poller.ts`
- `rate-limit.ts`
- `run-aggregator.ts`

Observation:

- legacy Deck already contains a real local control-plane runtime
- `deck-go` is extracting and hardening that role, not inventing it from zero

## Backend Boundary Rules

- If the concern is runtime truth, it belongs in OpenClaw runtime.
- If the concern is operator-facing projection, aggregation, continuity, or lifecycle control above runtime truth, it likely belongs in `deck-go`.
- If the concern is purely browser interaction or transient view state, it belongs in React.
- If the concern is deck-specific and modular, consider plugin placement before backend expansion.

## Anti-patterns To Avoid

- route-for-route cloning of `dashboard/src/app/api/**` without role clarification
- pushing too much compatibility logic into React
- letting `deck-go` grow into a shadow runtime
- coupling backend contracts directly to current page structure

## Future Platform Relevance

Some backend responsibilities may later become shared Go service boundaries:

- capability inventory
- operator/session bootstrap
- projection/cache ownership
- event fanout continuity
- lifecycle supervision

That future relevance is architectural only, not current scope.

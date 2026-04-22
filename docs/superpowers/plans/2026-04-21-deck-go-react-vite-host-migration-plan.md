# Deck Go Stage 2 React and Vite Host Migration Plan

## Purpose

Define the host replacement sequence from the transitional Stage 1
`frontend-next` service to the Stage 2 React + Vite UI host.

## Boundary Rule

This host migration follows the Stage 2 contract-first rule:

- do not move UI host first and figure out contracts later
- only migrate panels/domains after the Stage 2 command/query/realtime baseline
  exists for them

## Migration Sequence

### Step 1 — React shell bootstrap

Create the Stage 2 React + Vite shell with:

- runtime dashboard frame
- chat console frame
- canvas panel slot
- event inspector slot
- settings frame

At this step the shell proves:

- routing/layout ownership
- websocket bootstrap point
- query bootstrap point

### Step 2 — Dashboard / runtime views

Migrate first:

- runtime summary
- runtime connection state
- capability summary

Reason:

- these are the lowest-risk projection consumers
- they validate `/api/v1` and `/api/v1/ws` without chat complexity

### Step 3 — Session list and timeline snapshot

Migrate next:

- session list
- timeline snapshot
- active run summary

Reason:

- this is the first serious proof that the projection strategy can replace
  legacy Stage 1 session/timeline loading behavior

### Step 4 — Streaming / run state

Add:

- message delta handling
- run state transitions
- abortability
- first-class tool summary events

Reason:

- this is where the UI proves it no longer depends on raw runtime protocol

### Step 5 — Canvas and inspector

Move:

- canvas summary/bootstrap
- patch application
- reset/resync behavior
- event inspector

Reason:

- these require the richest realtime semantics and should land only after chat
  and projection behavior are stable

### Step 6 — Settings and desktop-aware runtime connection UX

Move:

- runtime connection settings
- desktop/local vs remote runtime configuration
- control-plane preferences

## Coexistence Model

During migration:

- `frontend-next` remains the Stage 1 reference/fallback UI
- the Stage 2 React + Vite host may run side-by-side
- the same runtime-facing slice must not be owned by both hosts as canonical UI
  in the same environment

## Retirement Targets

The host migration is complete only when:

- Stage 2 React + Vite host is the default operator UI
- `frontend-next` is demoted to reference or removed
- host-specific dependencies on `Next + Node` are no longer required for the
  active operator product

## Non-Goals

- big-bang replacement of every Stage 1 surface at once
- copying every compatibility seam into the new host
- preserving `frontend-next` as a permanent dual-host product

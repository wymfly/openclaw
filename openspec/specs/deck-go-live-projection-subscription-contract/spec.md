# deck-go-live-projection-subscription-contract Specification

## Purpose

TBD - created by archiving change deck-go-live-projection-subscription-contract. Update Purpose after archive.

## Requirements

### Requirement: Live projection contract SHALL describe panel subscription semantics

Deck Go SHALL maintain a source-controlled live projection contract that maps product projections to their stream endpoint, event names, refresh endpoints, stale-state threshold, cursor persistence, and projection-gap policy.

#### Scenario: Contract lists a panel projection

- **WHEN** a panel consumes live BFF state
- **THEN** the live projection contract SHALL identify the panel, projection id, source stream, consumed events, and refresh endpoints used to recover authoritative state

#### Scenario: Contract references known streams and refresh endpoints

- **WHEN** the live projection contract is checked
- **THEN** every referenced stream endpoint SHALL exist in the stream contract or endpoint classification
- **AND** every referenced refresh endpoint SHALL exist in endpoint classification

### Requirement: Generated metadata SHALL be available to frontend code

The live projection contract SHALL generate a frontend-readable TypeScript artifact and a Markdown document from the same source.

#### Scenario: Contract is synchronized

- **WHEN** `make live-projection-contract-sync` is run
- **THEN** generated TypeScript metadata and documentation SHALL match the source contract

#### Scenario: Contract drift is checked

- **WHEN** `make live-projection-contract-check` is run
- **THEN** the command SHALL fail if generated metadata or documentation differs from the source contract

### Requirement: Frontend live subscribers SHALL share connection semantics

Frontend live stream consumers SHALL use shared subscription logic for connection status, retry status, stale marking, Last-Event-ID persistence, and abort cleanup unless a specialized dispatcher documents why it cannot.

#### Scenario: Subscriber connects successfully

- **WHEN** a live projection subscriber opens its stream
- **THEN** the shared helper SHALL report `connecting` before the request and `connected` when the stream opens
- **AND** it SHALL clear stale state for that projection

#### Scenario: Subscriber reconnects or errors

- **WHEN** the stream retries or returns an error
- **THEN** the shared helper SHALL report `reconnecting` or `error`
- **AND** it SHALL mark the projection stale after the projection's configured stale threshold

#### Scenario: Subscriber is unmounted or paused

- **WHEN** a subscriber is disabled or unmounted
- **THEN** the shared helper SHALL abort the active stream request
- **AND** it SHALL report `idle` without leaving an active retry loop

### Requirement: Projection gaps SHALL recover through configured refresh behavior

Live subscribers on streams that can emit `projection.gap` SHALL treat a gap as stale state and refresh the authoritative read model according to the live projection contract.

#### Scenario: Shared stream emits projection gap

- **WHEN** a subscribed projection receives `projection.gap`
- **THEN** the shared helper SHALL mark the projection stale
- **AND** it SHALL invoke the projection's gap recovery callback

#### Scenario: Projection refresh completes after gap

- **WHEN** the projection's configured refresh callback completes successfully
- **THEN** the panel SHALL render the refreshed read model instead of relying only on missed stream events

### Requirement: Real SSE evidence SHALL remain bounded and circuit-breaker friendly

This platform proposal SHALL verify BFF stream shape and replay behavior without requiring every module-specific live workflow to pass in one run.

#### Scenario: Stream smoke verifies reconnect surface

- **WHEN** the focused stream smoke runs against the Deck Go stack
- **THEN** `/api/stream` SHALL respond with `text/event-stream`
- **AND** reconnect attempts with `Last-Event-ID` SHALL remain accepted

#### Scenario: Module-specific live verification is blocked

- **WHEN** a module-specific real live workflow cannot be verified because of environment or Gateway state
- **THEN** the proposal SHALL record the gap in tasks or handoff notes without blocking unrelated live projection contract checks

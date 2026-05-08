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

### Requirement: Data Fabric SHALL consume live projection metadata for invalidation

Data Fabric SHALL use existing live projection metadata as an advisory invalidation and gap-recovery source for server-state queries.

#### Scenario: Projection event is received

- **WHEN** a Data Fabric live invalidation bridge receives a known projection event
- **THEN** it SHALL invalidate or mark stale the matching authoritative query keys according to the module policy
- **AND** it SHALL preserve cached data while the authoritative read model refreshes

#### Scenario: Projection gap is received

- **WHEN** a subscribed projection receives `projection.gap`
- **THEN** Data Fabric SHALL mark the projection stale
- **AND** if the projection contract has `gapPolicy` set to `refresh`, Data Fabric SHALL refresh the authoritative read model through the projection's configured refresh behavior

### Requirement: Data Fabric SHALL NOT require nonexistent projection patch fields

Data Fabric SHALL NOT depend on generated `patchStrategy` or `patchKeys` fields until a separate contract proposal adds those fields to `contracts/source/deck-live-projections.contract.json` and updates the generator.

#### Scenario: Foundation live projection handling is implemented

- **WHEN** the foundation change integrates live projection metadata
- **THEN** it SHALL use current fields such as projection id, stream, events, refresh endpoints, stale threshold, gap policy, and cursor storage key
- **AND** it SHALL NOT require generated `patchStrategy` or `patchKeys` metadata to compile or run

### Requirement: Agent-status projection SHALL map to Agents Data Fabric invalidation

The `agent-status` live projection SHALL have an explicit Data Fabric
invalidation policy for the Agents reference module based on the existing live
projection contract metadata.

#### Scenario: Agent-status event maps to Agents keys

- **WHEN** Data Fabric handles an `agent-status` event listed in the live
  projection contract
- **THEN** it SHALL invalidate or mark stale the Agents list/detail/status keys
  selected by the Agents module policy
- **AND** it SHALL preserve cached data while the refresh is in flight

#### Scenario: Agent-status gap uses refresh policy

- **WHEN** Data Fabric handles a `projection.gap` for `agent-status`
- **THEN** it SHALL follow the current contract `gapPolicy` and refresh the
  authoritative Agents read model
- **AND** it SHALL NOT require generated `patchStrategy` or `patchKeys` fields

### Requirement: Config and inventory live metadata SHALL map to Data Fabric invalidation

Data Fabric SHALL map current config/inventory live projection metadata to
module query invalidation without extending generated projection fields.

#### Scenario: Device pairing projection invalidates settings data

- **WHEN** Data Fabric handles `device-pairing` events declared in the live
  projection contract
- **THEN** it SHALL invalidate or mark stale settings/device pairing keys
- **AND** `projection.gap` SHALL follow the current refresh policy

#### Scenario: Routing bindings metadata remains non-streaming

- **WHEN** Data Fabric handles routing bindings read-model metadata
- **THEN** it SHALL use explicit query invalidation after routing mutations
- **AND** it SHALL NOT invent a stream subscription while the contract declares
  no routing-bindings stream events

### Requirement: Live workbench metadata SHALL map to Data Fabric invalidation

Data Fabric SHALL map current live workbench projection metadata to module query
invalidation without extending generated projection fields.

#### Scenario: Activity-feed projection invalidates activity data

- **WHEN** Data Fabric handles `activity-feed` events declared in the live
  projection contract
- **THEN** it SHALL invalidate or mark stale activity and monitor read-model keys
- **AND** `projection.gap` SHALL follow the current refresh policy

#### Scenario: Approval-queue projection invalidates approval data

- **WHEN** Data Fabric handles `approval-queue` events declared in the live
  projection contract
- **THEN** it SHALL invalidate or mark stale approval queue and approval list
  keys
- **AND** `projection.gap` SHALL follow the current refresh policy

#### Scenario: Session-list projection invalidates sessions data

- **WHEN** Data Fabric handles `session-list` events declared in the live
  projection contract
- **THEN** it SHALL invalidate or mark stale Sessions panel list and preview keys
- **AND** `projection.gap` SHALL follow the current refresh policy

#### Scenario: Log-tail metadata remains stream-specialized

- **WHEN** Data Fabric handles log tail metadata
- **THEN** it SHALL use explicit `GET /logs` query invalidation for the
  authoritative read model
- **AND** it SHALL NOT invent projection-gap behavior while the contract declares
  `gapPolicy: none`

#### Scenario: Usage-observability remains refresh-only

- **WHEN** Data Fabric handles usage observability metadata
- **THEN** it SHALL use explicit query freshness and manual invalidation
- **AND** it SHALL NOT create a stream subscription because the current contract
  declares no events

### Requirement: Chat surrounding metadata SHALL map to Data Fabric invalidation

Data Fabric SHALL map current `command-discovery` and `chat-session` live
projection metadata to query invalidation without extending generated projection
fields.

#### Scenario: Command-discovery projection invalidates command data

- **WHEN** Data Fabric handles `commands.changed` or `projection.gap` for the
  `command-discovery` projection
- **THEN** it SHALL invalidate or mark stale command discovery query keys
- **AND** the command registry SHALL be repopulated from the authoritative
  command discovery query result

#### Scenario: Chat-session projection invalidates surrounding read models

- **WHEN** Data Fabric handles `chat-session` events or `projection.gap` that
  affect surrounding read models
- **THEN** it SHALL invalidate or mark stale Chat snapshot and related session
  list/preview keys according to module policy
- **AND** the specialized transcript dispatcher MAY continue to reduce stream
  frames directly for immediate UI rendering

#### Scenario: Patch fields remain out of scope

- **WHEN** Chat surrounding projection code is compiled or tested
- **THEN** it SHALL NOT require generated `patchStrategy` or `patchKeys` fields

# deck-go-data-fabric-chat-surroundings Specification

## Purpose

Define Data Fabric boundaries, freshness, mutation safety, live invalidation,
and verification requirements for Chat-adjacent server state while preserving
the specialized transcript stream and local Chat interaction state.

## Requirements

### Requirement: Chat surroundings SHALL expose Data Fabric boundaries

`frontend-new` SHALL provide Data Fabric module boundaries for Chat-adjacent
server state while keeping the transcript stream, message reducer, composer
execution, canvas command queue, and artifact rendering specialized.

#### Scenario: Module directories follow the scoped shape

- **WHEN** Chat surroundings Data Fabric modules are inspected
- **THEN** `frontend-new/src/data/modules/chat/` SHALL expose stable query keys,
  query hooks or query option factories, mutation wrappers for session-event
  subscription, and projection invalidation helpers
- **AND** `frontend-new/src/data/modules/commands/` SHALL expose stable query
  keys, command discovery query hooks or query option factories, and projection
  invalidation helpers

#### Scenario: Existing session modules remain authoritative

- **WHEN** Chat UI needs session list, preview, detail, history, compaction, or
  session metadata mutation data
- **THEN** it SHALL reuse the existing `sessions` Data Fabric module
- **AND** it SHALL NOT create a parallel Chat-only cache for the same session
  read model

### Requirement: Chat surrounding reads SHALL use Data Fabric

Chat surrounding server-state reads SHALL consume server state through Data
Fabric hooks or query option factories instead of component-owned first-load or
background-refresh fetch lifecycles.

#### Scenario: ChatPanel reads are migrated

- **WHEN** `ChatPanel` loads session inventory or the active Chat snapshot
- **THEN** it SHALL use Data Fabric session list and Chat snapshot query hooks
- **AND** it SHALL NOT call session list or snapshot BFF facades from a
  component-owned `useEffect(fetch*)` lifecycle

#### Scenario: SessionSidebar preview reads are migrated

- **WHEN** `SessionSidebar` loads sidebar preview overlays
- **THEN** it SHALL use the sessions Data Fabric preview query
- **AND** it SHALL keep sidebar search, collapsed state, rename draft, delete
  confirmation, and controlled-test props outside server-state cache

#### Scenario: Command discovery reads are migrated

- **WHEN** command discovery loads or refreshes Gateway-discovered commands
- **THEN** it SHALL use a Data Fabric command discovery query that calls a
  `src/api.ts` facade
- **AND** it SHALL NOT use raw `deckFetch` or direct Gateway browser requests

### Requirement: Chat surrounding freshness SHALL match stream and inventory semantics

Chat surrounding queries SHALL declare freshness tiers according to contract and
product semantics.

#### Scenario: Snapshot uses stream-driven freshness

- **WHEN** the active Chat snapshot is queried
- **THEN** the query SHALL use `stream-driven` freshness
- **AND** the transcript stream or projection-gap recovery SHALL invalidate or
  refresh the snapshot when authoritative state may be stale

#### Scenario: Command discovery uses inventory freshness

- **WHEN** command discovery is queried
- **THEN** the query SHALL use `inventory` freshness
- **AND** `commands.changed` or `projection.gap` SHALL invalidate the command
  discovery key rather than forcing a fetch on every Chat mount

#### Scenario: Sidebar previews use lazy-detail freshness

- **WHEN** sidebar session previews are queried
- **THEN** the query SHALL use the existing sessions preview `lazy-detail`
  freshness
- **AND** fresh navigation back to Chat SHALL reuse fresh preview data

### Requirement: Chat surrounding mutations SHALL follow contract safety

Chat surrounding mutations SHALL use Data Fabric mutation wrappers or existing
module wrappers with conservative mutation defaults and explicit invalidation.

#### Scenario: Session-event subscription has no retry

- **WHEN** Chat subscribes or unsubscribes the active session message stream via
  `POST /chat/session-events`
- **THEN** the mutation SHALL use `retry: false`
- **AND** unmount cleanup SHALL attempt unsubscribe without creating an offline
  replay queue

#### Scenario: Sidebar rename and delete use sessions mutations

- **WHEN** `SessionSidebar` renames or deletes a session
- **THEN** it SHALL use the sessions Data Fabric mutation wrappers
- **AND** successful mutations SHALL invalidate the session list, detail,
  history, preview, and related read models needed for current UI correctness

#### Scenario: Destructive real writes stay bounded

- **WHEN** real Gateway E2E exercises Chat/session destructive mutations
- **THEN** the test SHALL use run-scoped disposable sessions or skip-safe route
  evidence
- **AND** it SHALL NOT delete, clear, reset, compact, or patch non-run-scoped
  operator data

### Requirement: Specialized transcript streaming SHALL remain specialized

Chat transcript streaming SHALL remain owned by the existing SSE dispatcher and
store reducer while Data Fabric owns authoritative surrounding read models and
invalidation.

#### Scenario: Transcript bytes remain out of query cache

- **WHEN** chat SSE events carry transcript, tool, thinking, approval, canvas,
  or agent frames
- **THEN** the existing dispatcher/store reducer SHALL continue to process those
  frames
- **AND** Data Fabric SHALL NOT store streaming transcript bytes as query data

#### Scenario: History seam uses API facade

- **WHEN** the dispatcher reloads bounded full content after stream finalization
- **THEN** it SHALL use the Chat history API facade or Data Fabric query option
  boundary
- **AND** it SHALL preserve the existing merge behavior for authoritative
  history text plus locally collected tool blocks

### Requirement: Chat surroundings verification SHALL include mock and real evidence

The migration SHALL provide deterministic code-level checks, L4 mock-functional
browser evidence, and L5 real Gateway evidence or documented circuit-breaker
handoffs for Chat surroundings.

#### Scenario: Focused tests cover Data Fabric boundaries

- **WHEN** focused tests run
- **THEN** they SHALL verify Chat/Commands query keys, freshness tiers, cache
  reuse, background refresh preservation where applicable, mutation
  invalidation, and projection invalidation

#### Scenario: Mock-functional Chat evidence runs

- **WHEN** L4 mock-functional evidence runs
- **THEN** it SHALL cover Chat navigation, session sidebar, snapshot/transcript
  rendering, command palette/discovery availability, search, light/dark mode,
  English/Chinese locale, and console-clean behavior

#### Scenario: Real-gateway Chat evidence is bounded

- **WHEN** L5 real Gateway evidence runs
- **THEN** it SHALL use the isolated real stack and current Chat real E2E specs
- **AND** it SHALL verify backend route shapes, command discovery, navigation
  into Chat, session sidebar behavior, and direct-Gateway request absence

#### Scenario: Repeated real environment failure uses circuit breaker

- **WHEN** real Gateway startup or environment setup fails twice without new
  narrowing evidence
- **THEN** the change SHALL record the command, failure, affected Chat
  surroundings scenario, and follow-up handoff
- **AND** deterministic code-level checks SHALL remain green before proceeding

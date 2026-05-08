# deck-go-data-fabric-governance-sweep Specification

## Purpose

Define the final Data Fabric governance sweep expectations: residual
panel/shared-shell server-state lifecycles must be migrated to Data Fabric or
represented as explicit approved exceptions with deterministic verification.

## Requirements

### Requirement: Governance sweep SHALL close residual panel server-state lifecycles

The Data Fabric governance sweep SHALL migrate residual panel/hook server-state
read lifecycles to Data Fabric or list them as approved exceptions with code
references and reasons.

#### Scenario: Residual panels are migrated

- **WHEN** API Explorer, Identity, Subagents, and shared capabilities code need
  backend or Gateway server state
- **THEN** they SHALL use Data Fabric hooks, query options, or mutation wrappers
- **AND** they SHALL NOT own component-local first-load/background-refresh
  `useEffect(fetch*)` lifecycles for those server-state reads

#### Scenario: Existing modules are reused

- **WHEN** residual code needs Gateway describe, Agents identity/config, session
  lineage, or compaction data already owned by an existing module
- **THEN** it SHALL reuse the existing Data Fabric module owner
- **AND** it SHALL NOT create a duplicate query key for the same authoritative
  read model

### Requirement: Governance sweep SHALL preserve local UI state

The governance sweep SHALL keep product interaction state outside server-state
cache.

#### Scenario: API Explorer local state remains local

- **WHEN** API Explorer is migrated
- **THEN** selected method, request body draft, response body, history, copied
  state, and tab state SHALL remain in component state

#### Scenario: Identity local state remains local

- **WHEN** Identity is migrated
- **THEN** selected canonical identity, query, dialogs, pending link/unlink
  state, and action banners SHALL remain in component state

#### Scenario: Subagents local state remains local

- **WHEN** Subagents is migrated
- **THEN** selected run, filters, permission draft, modal state, and
  auto-refresh toggle SHALL remain in component state

### Requirement: Governance sweep SHALL maintain an approved exception registry

The Data Fabric governance sweep SHALL provide a narrow, code-tested registry of
remaining intentional exceptions to the no-raw-server-lifecycle rule.

#### Scenario: Exception includes reason and owner

- **WHEN** a residual raw server-state or stream pattern remains
- **THEN** it SHALL be listed with file path, pattern, reason, owner, and
  follow-up status
- **AND** the reason SHALL distinguish specialized streams/command execution
  from ordinary panel server-state fetching

#### Scenario: New unapproved patterns fail focused governance tests

- **WHEN** focused governance tests scan frontend-new source roots
- **THEN** a new unapproved direct server-state lifecycle pattern SHALL fail the
  test
- **AND** an approved exception SHALL keep the test green only when its file and
  reason match the registry

### Requirement: Governance sweep verification SHALL prove exit readiness

The governance sweep SHALL provide deterministic tests plus scoped browser or
route evidence for the residual surfaces it touches.

#### Scenario: Focused verification covers migrated residuals

- **WHEN** focused tests run
- **THEN** they SHALL cover capabilities, API Explorer describe, Identity links,
  Identity mutations, Subagents runs/lineage/config reads, and governance
  allowlist behavior according to the implemented scope

#### Scenario: Browser evidence is bounded by existing specs

- **WHEN** L4 or L5 browser specs exist for touched residual panels
- **THEN** they SHALL run as scoped evidence
- **AND** missing panel-specific specs SHALL be recorded as a follow-up gap
  rather than silently treated as passed

#### Scenario: Deferred hardening remains deferred

- **WHEN** this governance sweep is complete
- **THEN** custom lint, DevTools, prefetch, IndexedDB persistence, offline
  mutation queues, and generated live projection patch fields SHALL remain
  absent unless separately proposed

# deck-go-data-fabric-contract-and-transport-cleanup Specification

## Purpose

Track narrow Data Fabric follow-up cleanup around runtime id authority, Gateway
RPC tracing/client construction, and query-key ordering documentation without
broadening deferred hardening scope.

## Requirements

### Requirement: Cleanup SHALL resolve promoted Data Fabric follow-ups without broadening deferred hardening

The cleanup SHALL address only the promoted runtime id, Gateway transport, and
query-key documentation follow-ups.

#### Scenario: Promoted follow-ups are tracked to resolution

- **WHEN** this cleanup is completed
- **THEN** FU-002, FU-003, and FU-004 in the Data Fabric follow-up inbox SHALL
  be updated with resolved, deferred, or still-candidate status
- **AND** each unresolved item SHALL include exact blocker evidence

#### Scenario: Deferred hardening stays deferred

- **WHEN** the cleanup is inspected
- **THEN** mutation retry, offline mutation queueing, IndexedDB persistence,
  DevTools, broad prefetch, custom lint, and generated live projection patch
  fields SHALL remain absent unless a separate OpenSpec change adds them

### Requirement: Cleanup verification SHALL prove contract and frontend behavior

The cleanup SHALL include focused evidence for runtime id authority, Gateway
request tracing, and stable query-key ordering.

#### Scenario: Focused frontend verification passes

- **WHEN** focused frontend tests run
- **THEN** they SHALL cover default runtime id usage, query-key serialization,
  and Gateway transport request id behavior according to the implemented scope

#### Scenario: Contract verification matches touched surface

- **WHEN** contract source or generated artifacts are changed
- **THEN** the relevant contract sync/check or `make contract-gate` SHALL pass
- **AND** if no contract source changes are made, the verification record SHALL
  explain why the fallback path was used

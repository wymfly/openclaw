## ADDED Requirements

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

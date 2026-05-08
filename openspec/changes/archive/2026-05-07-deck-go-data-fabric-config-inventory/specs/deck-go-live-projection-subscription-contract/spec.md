## ADDED Requirements

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

## ADDED Requirements

### Requirement: Deck Go exposes typed contract errors

Deck Go SHALL expose errors through generated or contract-defined error envelopes so frontend consumers can distinguish validation, authorization, runtime unavailable, Gateway failure, schema mismatch, and internal failure cases.

#### Scenario: Backend returns a Deck-facing API error

- **WHEN** a Deck-facing endpoint fails with a known contract error
- **THEN** the response SHALL include a typed error code, message, and optional details according to the Deck-facing error contract

#### Scenario: Frontend handles a generated error code

- **WHEN** a frontend API wrapper receives a Deck-facing error envelope
- **THEN** it SHALL expose the typed error code to callers without parsing freeform message text

### Requirement: Gateway errors are mapped at the adapter boundary

Gateway protocol errors SHALL be mapped into Deck-facing error envelopes at the Go adapter or handler boundary.

#### Scenario: Gateway returns scope denied

- **WHEN** a Gateway call returns a scope-denied or authorization error
- **THEN** Deck Go SHALL map it to the corresponding Deck-facing authorization error code while preserving diagnostic details when safe

#### Scenario: Gateway connection is unavailable

- **WHEN** Gateway is unreachable, not configured, or degraded
- **THEN** Deck Go SHALL map the failure into a runtime or Gateway-unavailable error code defined by the Deck-facing contract

#### Scenario: Gateway schema mismatch is detected

- **WHEN** generated Gateway protocol decoding or validation detects an incompatible payload
- **THEN** Deck Go SHALL map the failure to a schema-mismatch error code rather than returning an untyped internal error

### Requirement: Error metadata supports UI behavior

Deck-facing error contracts SHALL include enough metadata for the frontend to choose retry, reconnect, reauthenticate, disable action, or show validation feedback behavior.

#### Scenario: Retryable error is returned

- **WHEN** a transient Gateway or runtime error is returned
- **THEN** the error envelope or metadata SHALL indicate whether retry is appropriate and whether a retry delay is known

#### Scenario: Field validation error is returned

- **WHEN** a mutation fails because a submitted field is invalid
- **THEN** the error details SHALL identify the affected field when that information is available

# deck-go-list-query-contracts Specification

## Purpose

TBD - created by archiving change deck-go-list-query-contracts. Update Purpose after archive.

## Requirements

### Requirement: List query contract SHALL describe Deck list semantics

Deck Go SHALL maintain a source-controlled list query contract for product-facing list endpoints that records pagination mode, supported query parameters, default/max limits, response collection field, and cursor field when present.

#### Scenario: Contract describes a cursor list

- **WHEN** a list endpoint uses cursor pagination
- **THEN** the contract SHALL name the cursor request parameter
- **AND** it SHALL name the response cursor field used for the next request

#### Scenario: Contract describes a bounded list

- **WHEN** a list endpoint only supports bounded reads
- **THEN** the contract SHALL record the limit parameter and default/max limits

### Requirement: List query metadata SHALL be generated and checked

The list query contract SHALL generate Markdown docs and frontend-readable TypeScript metadata from one source.

#### Scenario: Contract generation succeeds

- **WHEN** `make list-query-contract-sync` is run
- **THEN** generated docs and TypeScript metadata SHALL match the source contract

#### Scenario: Contract drift is checked

- **WHEN** `make list-query-contract-check` is run
- **THEN** the command SHALL fail if generated docs or TypeScript metadata are stale

### Requirement: Frontend query builders SHALL use shared serialization semantics

Frontend list facades SHALL use a shared helper that serializes contract-known parameters and omits empty strings, nullish values, and non-finite numbers.

#### Scenario: Helper serializes known fields

- **WHEN** a facade passes query values for a contracted endpoint
- **THEN** the helper SHALL emit the endpoint's wire parameter names in contract order

#### Scenario: Helper rejects unknown fields

- **WHEN** a facade attempts to serialize a field not declared by the endpoint contract
- **THEN** the helper SHALL ignore the unknown field rather than inventing a wire parameter

### Requirement: Module-specific list proof SHALL remain deferred to module completion proposals

This platform contract SHALL establish shared semantics without requiring every module-specific list flow to pass real Gateway E2E in one proposal.

#### Scenario: Endpoint semantics are known but module data is environment-dependent

- **WHEN** a list endpoint depends on optional Gateway data, local files, plugins, or prior operator activity
- **THEN** this proposal SHALL validate the contract and facade serialization
- **AND** deeper data completeness SHALL be handled by the corresponding module completion proposal

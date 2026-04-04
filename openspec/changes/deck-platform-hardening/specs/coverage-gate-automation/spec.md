## ADDED Requirements

### Requirement: Coverage check script exists

The system SHALL provide a script at `scripts/protocol-coverage-check.ts` that can be invoked via `pnpm protocol:coverage:check`.

#### Scenario: Script runs successfully

- **WHEN** `pnpm protocol:coverage:check` is executed
- **THEN** it SHALL exit with code 0 and print a coverage summary to stdout

### Requirement: Script reads method registry

The script SHALL extract all registered Gateway method names from `src/gateway/method-registry-data.ts`.

#### Scenario: All registered methods are discovered

- **WHEN** the script reads the method registry
- **THEN** it SHALL list every method name that appears in `allMethodDefs` or `allMethodNames`

### Requirement: Script reads typed client allowlist

The script SHALL extract the `GENERATED_METHOD_ALLOWLIST` from `dashboard/src/types/gateway-client.generated.ts`.

#### Scenario: Typed methods are identified

- **WHEN** the script reads the allowlist
- **THEN** it SHALL classify methods in the allowlist as "typed"

### Requirement: Script detects untyped gatewayRequest calls

The script SHALL scan `dashboard/src/app/api/` for `gatewayRequest("method.name"` patterns to identify methods called without typed client.

#### Scenario: Untyped calls are detected

- **WHEN** the script scans API routes
- **THEN** it SHALL classify methods found only via `gatewayRequest()` as "untyped"

### Requirement: Coverage report output

The script SHALL output a summary table with columns: method family, total methods, typed count, untyped count, coverage status (Covered / Functional / Partial / Not covered / N/A).

#### Scenario: Report matches matrix format

- **WHEN** the script completes
- **THEN** the output SHALL be parseable and comparable to the Gateway Capability Coverage Baseline in the matrix document

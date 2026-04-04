## ADDED Requirements

### Requirement: Single ErrorCode enumeration

The system SHALL define a single `GatewayErrorCode` enumeration in `dashboard/src/lib/errors.ts` covering all Deck-recognized error conditions: `NOT_CONFIGURED`, `GATEWAY_ERROR`, `UNAUTHORIZED`, `RATE_LIMITED`, `VALIDATION`, `INTERNAL`.

#### Scenario: ErrorCode enum is importable

- **WHEN** a dashboard module imports `GatewayErrorCode` from `@/lib/errors`
- **THEN** it SHALL have access to all 6 error codes as string literal values

### Requirement: DeckApiError class

The system SHALL provide a `DeckApiError` class in `dashboard/src/lib/errors.ts` with properties: `code: GatewayErrorCode`, `message: string`, `status: number`.

#### Scenario: DeckApiError from Gateway 502

- **WHEN** gwRequest catches a `ControlPlaneGatewayError`
- **THEN** it SHALL create a `DeckApiError` with `code: "GATEWAY_ERROR"` and `status: 502`

#### Scenario: DeckApiError from missing runtime

- **WHEN** gwRequest detects no Gateway runtime
- **THEN** it SHALL create a `DeckApiError` with `code: "NOT_CONFIGURED"` and `status: 503`

### Requirement: Shared fetchApi helper

The system SHALL provide a `fetchApi<T>(url, options?)` function in `dashboard/src/lib/errors.ts` that encapsulates: fetch call, `res.ok` check, JSON parsing, and error typing into `DeckApiError`.

#### Scenario: Successful fetch

- **WHEN** `fetchApi<T>("/api/skills")` receives HTTP 200 with JSON body
- **THEN** it SHALL return the parsed body typed as `T`

#### Scenario: Failed fetch with error body

- **WHEN** `fetchApi("/api/skills")` receives HTTP 502 with `{ error: "Gateway timeout", code: "GATEWAY_ERROR" }`
- **THEN** it SHALL throw a `DeckApiError` with `code: "GATEWAY_ERROR"`, `message: "Gateway timeout"`, `status: 502`

#### Scenario: Network failure

- **WHEN** `fetchApi("/api/skills")` fails due to network error
- **THEN** it SHALL throw a `DeckApiError` with `code: "INTERNAL"` and the original error message

### Requirement: ErrorBody type consolidation

The `ErrorBody` type SHALL be defined exactly once in `dashboard/src/lib/errors.ts` as `{ error: string; code?: string }`. Duplicate definitions in `api-helpers.ts`, `with-auth.ts`, and `chat-api.ts` SHALL be removed and replaced with imports.

#### Scenario: No duplicate ErrorBody definitions

- **WHEN** searching for `type ErrorBody` or `type ApiErrorBody` in the dashboard codebase
- **THEN** only `dashboard/src/lib/errors.ts` SHALL define these types

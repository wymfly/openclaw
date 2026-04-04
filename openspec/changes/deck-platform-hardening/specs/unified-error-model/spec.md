## ADDED Requirements

### Requirement: Single ErrorCode enumeration

The system SHALL define a single `GatewayErrorCode` enumeration in `dashboard/src/lib/errors.ts` with exactly 6 values: `NOT_CONFIGURED`, `GATEWAY_ERROR`, `UNAUTHORIZED`, `RATE_LIMITED`, `VALIDATION`, `INTERNAL`.

#### Scenario: ErrorCode enum is importable

- **WHEN** a dashboard module imports `GatewayErrorCode` from `@/lib/errors`
- **THEN** it SHALL have access to all 6 error codes as string literal values

### Requirement: Error code mapping from Gateway errors

The system SHALL provide a `mapGatewayError(err: ControlPlaneGatewayError): GatewayErrorCode` function that maps Gateway error codes to the unified enum.

#### Scenario: Gateway error with known code maps correctly

- **WHEN** a `ControlPlaneGatewayError` has `code: "UNAUTHORIZED"`
- **THEN** `mapGatewayError` SHALL return `"UNAUTHORIZED"`

#### Scenario: Gateway error with unknown code maps to GATEWAY_ERROR

- **WHEN** a `ControlPlaneGatewayError` has an unrecognized `code` value
- **THEN** `mapGatewayError` SHALL return `"GATEWAY_ERROR"`

### Requirement: DeckApiError class

The system SHALL provide a `DeckApiError` class in `dashboard/src/lib/errors.ts` with properties: `code: GatewayErrorCode`, `message: string`, `status: number`.

#### Scenario: DeckApiError from Gateway 502

- **WHEN** a client-side fetch receives HTTP 502 with `{ error: "timeout", code: "GATEWAY_ERROR" }`
- **THEN** `fetchApi` SHALL throw a `DeckApiError` with `code: "GATEWAY_ERROR"`, `message: "timeout"`, `status: 502`

#### Scenario: DeckApiError from 401 Unauthorized

- **WHEN** a client-side fetch receives HTTP 401 with `{ error: "Unauthorized" }`
- **THEN** `fetchApi` SHALL throw a `DeckApiError` with `code: "UNAUTHORIZED"`, `message: "Unauthorized"`, `status: 401`

#### Scenario: DeckApiError from 429 Rate Limited

- **WHEN** a client-side fetch receives HTTP 429 with `{ error: "Too many requests" }`
- **THEN** `fetchApi` SHALL throw a `DeckApiError` with `code: "RATE_LIMITED"`, `message: "Too many requests"`, `status: 429`

#### Scenario: DeckApiError from missing runtime (503)

- **WHEN** a client-side fetch receives HTTP 503 with `{ error: "Gateway not configured" }`
- **THEN** `fetchApi` SHALL throw a `DeckApiError` with `code: "NOT_CONFIGURED"`, `message: "Gateway not configured"`, `status: 503`

### Requirement: Shared fetchApi helper

The system SHALL provide a `fetchApi<T>(url, options?)` function in `dashboard/src/lib/errors.ts` that encapsulates: fetch call, `res.ok` check, JSON parsing, and error typing into `DeckApiError`. This is a **client-side only** helper used by stores and hooks.

#### Scenario: Successful fetch

- **WHEN** `fetchApi<T>("/api/skills")` receives HTTP 200 with JSON body
- **THEN** it SHALL return the parsed body typed as `T`

#### Scenario: Network failure

- **WHEN** `fetchApi("/api/skills")` fails due to network error
- **THEN** it SHALL throw a `DeckApiError` with `code: "INTERNAL"` and the original error message

### Requirement: ErrorBody type consolidation

The `ErrorBody` type SHALL be defined exactly once in `dashboard/src/lib/errors.ts` as `{ error: string; code?: string }`. Duplicate definitions in `api-helpers.ts`, `with-auth.ts`, and `chat-api.ts` SHALL be removed and replaced with imports.

#### Scenario: No duplicate ErrorBody definitions

- **WHEN** searching for `type ErrorBody` or `type ApiErrorBody` in the dashboard codebase
- **THEN** only `dashboard/src/lib/errors.ts` SHALL define these types

### Requirement: gwRequest return contract unchanged

The `gwRequest()` function SHALL continue to return `NextResponse` (not throw). Only the internal error construction SHALL use the unified ErrorBody type from `errors.ts`.

#### Scenario: gwRequest still returns NextResponse on error

- **WHEN** gwRequest encounters a ControlPlaneGatewayError
- **THEN** it SHALL return `NextResponse.json({ error, code }, { status: 502 })` as before, not throw

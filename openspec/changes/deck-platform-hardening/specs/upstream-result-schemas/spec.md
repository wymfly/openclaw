## ADDED Requirements

### Requirement: Upstream methods have result schemas

All Gateway methods called by Deck dashboard SHALL have a TypeBox result schema registered in the method's `methodDefs` export and integrated into `method-registry-data.ts`. The 5 methods currently lacking result schemas are: `sessions.usage`, `sessions.usage.logs`, `sessions.usage.timeseries`, `tools.effective`, `skills.install`.

#### Scenario: Result schema exists for sessions.usage

- **WHEN** `pnpm protocol:gen:ts` is executed
- **THEN** `gateway-protocol.generated.ts` SHALL contain a `SessionsUsageResult` type and `sessions.usage` SHALL appear in the `GatewayMethodMap`

#### Scenario: Result schema exists for sessions.usage.logs

- **WHEN** `pnpm protocol:gen:ts` is executed
- **THEN** `gateway-protocol.generated.ts` SHALL contain a `SessionsUsageLogsResult` type and `sessions.usage.logs` SHALL appear in the `GatewayMethodMap`

#### Scenario: Result schema exists for sessions.usage.timeseries

- **WHEN** `pnpm protocol:gen:ts` is executed
- **THEN** `gateway-protocol.generated.ts` SHALL contain a `SessionsUsageTimeseriesResult` type and `sessions.usage.timeseries` SHALL appear in the `GatewayMethodMap`

#### Scenario: tools.effective route returns stub (no upstream handler)

- **GIVEN** `tools.effective` has no Gateway handler (not registered in `server-methods-list.ts`)
- **WHEN** the dashboard route `/api/deck/tools-effective` is called
- **THEN** it SHALL return `{ groups: [] }` as a placeholder until an upstream handler is implemented

#### Scenario: Result schema exists for skills.install

- **WHEN** `pnpm protocol:gen:ts` is executed
- **THEN** `gateway-protocol.generated.ts` SHALL contain a `SkillsInstallResult` type and `skills.install` SHALL appear in the `GatewayMethodMap`

### Requirement: API routes migrate to typed gwRequest

After result schemas are added, the corresponding dashboard API routes SHALL use typed `gwRequest()` instead of deprecated `gatewayRequest()`.

#### Scenario: sessions.usage route uses gwRequest

- **WHEN** `dashboard/src/app/api/usage/sessions/route.ts` calls the Gateway
- **THEN** it SHALL use `gwRequest("sessions.usage", params)` instead of `gatewayRequest("sessions.usage", params)`
  Evidence: `dashboard/src/app/api/usage/sessions/route.ts:31` currently calls `gatewayRequest("sessions.usage", params)`

#### Scenario: sessions.usage.logs route uses gwRequest

- **WHEN** `dashboard/src/app/api/usage/sessions/logs/route.ts` calls the Gateway
- **THEN** it SHALL use `gwRequest("sessions.usage.logs", params)`
  Evidence: `dashboard/src/app/api/usage/sessions/logs/route.ts:23` currently calls `gatewayRequest("sessions.usage.logs", params)`

#### Scenario: sessions.usage.timeseries route uses gwRequest

- **WHEN** `dashboard/src/app/api/usage/timeseries/route.ts` calls the Gateway
- **THEN** it SHALL use `gwRequest("sessions.usage.timeseries", params)`
  Evidence: `dashboard/src/app/api/usage/timeseries/route.ts:12` currently calls `gatewayRequest("sessions.usage.timeseries", ...)`

#### Scenario: tools.effective route uses gwRequest

- **WHEN** `dashboard/src/app/api/deck/tools-effective/route.ts` calls the Gateway
- **THEN** it SHALL use `gwRequest("tools.effective", params)`
  Evidence: `dashboard/src/app/api/deck/tools-effective/route.ts:17` currently calls `gatewayRequest("tools.effective", ...)`

#### Scenario: skills.install route uses gwRequest

- **WHEN** `dashboard/src/app/api/skills/install/route.ts` calls the Gateway
- **THEN** it SHALL use `gwRequest("skills.install", body)`
  Evidence: `dashboard/src/app/api/skills/install/route.ts:15` currently calls `gatewayRequest("skills.install", body)`

#### Scenario: pnpm protocol:gen:check passes

- **WHEN** `pnpm protocol:gen:check` is executed after all changes
- **THEN** the command SHALL exit with code 0

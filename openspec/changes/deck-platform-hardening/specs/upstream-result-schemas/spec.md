## ADDED Requirements

### Requirement: Upstream methods have result schemas

All Gateway methods called by Deck dashboard SHALL have a TypeBox result schema registered in the method's `methodDefs` export. The 6 methods currently lacking result schemas are: `sessions.usage`, `sessions.usage.logs`, `sessions.usage.timeseries`, `tools.effective`, `skills.install`, `config.set`.

#### Scenario: Result schema exists for sessions.usage

- **WHEN** `pnpm protocol:gen:ts` is executed
- **THEN** `gateway-protocol.generated.ts` SHALL contain a `SessionsUsageResult` type and `sessions.usage` SHALL appear in the `GatewayMethodMap`

#### Scenario: Result schema exists for sessions.usage.logs

- **WHEN** `pnpm protocol:gen:ts` is executed
- **THEN** `gateway-protocol.generated.ts` SHALL contain a `SessionsUsageLogsResult` type and `sessions.usage.logs` SHALL appear in the `GatewayMethodMap`

#### Scenario: Result schema exists for sessions.usage.timeseries

- **WHEN** `pnpm protocol:gen:ts` is executed
- **THEN** `gateway-protocol.generated.ts` SHALL contain a `SessionsUsageTimeseriesResult` type and `sessions.usage.timeseries` SHALL appear in the `GatewayMethodMap`

#### Scenario: Result schema exists for tools.effective

- **WHEN** `pnpm protocol:gen:ts` is executed
- **THEN** `gateway-protocol.generated.ts` SHALL contain a `ToolsEffectiveResult` type and `tools.effective` SHALL appear in the `GatewayMethodMap`

#### Scenario: Result schema exists for skills.install

- **WHEN** `pnpm protocol:gen:ts` is executed
- **THEN** `gateway-protocol.generated.ts` SHALL contain a `SkillsInstallResult` type and `skills.install` SHALL appear in the `GatewayMethodMap`

#### Scenario: Result schema exists for config.set

- **WHEN** `pnpm protocol:gen:ts` is executed
- **THEN** `gateway-protocol.generated.ts` SHALL contain a `ConfigSetResult` type and `config.set` SHALL appear in the `GatewayMethodMap`

### Requirement: API routes migrate to typed gwRequest

After result schemas are added, the corresponding dashboard API routes SHALL use typed `gwRequest()` instead of deprecated `gatewayRequest()`.

#### Scenario: sessions.usage route uses gwRequest

- **WHEN** `dashboard/src/app/api/usage/sessions/route.ts` calls the Gateway
- **THEN** it SHALL use `gwRequest("sessions.usage", params)` instead of `gatewayRequest("sessions.usage", params)`

#### Scenario: tools.effective route uses gwRequest

- **WHEN** `dashboard/src/app/api/deck/tools-effective/route.ts` calls the Gateway
- **THEN** it SHALL use `gwRequest("tools.effective", params)` instead of `gatewayRequest("tools.effective", params)`

#### Scenario: pnpm protocol:gen:check passes

- **WHEN** `pnpm protocol:gen:check` is executed after all changes
- **THEN** the command SHALL exit with code 0

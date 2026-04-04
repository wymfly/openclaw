## MODIFIED Requirements

### Requirement: Typed client coverage

The Deck typed client SHALL cover all Gateway methods that are called by the dashboard and have result schemas. The `GatewayMethodMap` SHALL include entries for every method with a registered result schema in `methodDefs`.

#### Scenario: All 5 new upstream methods appear in GatewayMethodMap

- **WHEN** `pnpm protocol:gen:ts` is executed after adding result schemas
- **THEN** the generated `GatewayMethodMap` SHALL include entries for `sessions.usage`, `sessions.usage.logs`, `sessions.usage.timeseries`, `tools.effective`, and `skills.install` in addition to all previously covered methods

#### Scenario: No regression in existing typed methods

- **WHEN** `pnpm protocol:gen:ts` is executed after adding new result schemas
- **THEN** all 25 existing `deck.*` typed methods and all previously typed `chat.*` / `sessions.*` methods SHALL remain in the generated output unchanged

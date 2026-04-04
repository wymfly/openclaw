## MODIFIED Requirements

### Requirement: Typed client coverage

The Deck typed client SHALL cover all Gateway methods that are called by the dashboard. The `GENERATED_METHOD_ALLOWLIST` SHALL include every method for which a result schema exists in the protocol schema directory.

#### Scenario: All Deck-used upstream methods are in typed client

- **WHEN** `pnpm protocol:gen:ts` is executed
- **THEN** the generated `GatewayMethodMap` SHALL include entries for `sessions.usage`, `sessions.usage.logs`, `sessions.usage.timeseries`, `tools.effective`, `skills.install`, and `config.set` in addition to all previously covered methods

#### Scenario: No regression in existing typed methods

- **WHEN** `pnpm protocol:gen:ts` is executed after adding new result schemas
- **THEN** all 25 existing `deck.*` typed methods and all previously typed `chat.*` / `sessions.*` methods SHALL remain in the generated output unchanged

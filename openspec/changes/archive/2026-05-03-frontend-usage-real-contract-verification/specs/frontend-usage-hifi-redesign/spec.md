## ADDED Requirements

### Requirement: Usage hifi completion requires real contract calibration

The Usage hifi implementation SHALL treat the handoff prototype as the visual/product target only after calibrating it against code-truth contracts, BFF routes, Gateway method support, and dependency constraints.

#### Scenario: Handoff assumptions are classified

- **WHEN** the refreshed Usage handoff references endpoint names, chart library requirements, cost or quota semantics, session detail behavior, bootstrap state, or cross-module navigation
- **THEN** implementation notes SHALL classify each assumption as supported, degraded, unsupported, environment-dependent, empty-valid, or handoff-blocked
- **AND** deterministic drift SHALL be fixed directly when no product or dependency ambiguity exists

#### Scenario: Unsupported hifi claims are not shipped as guarantees

- **WHEN** the refreshed Usage handoff claims real billing accuracy, provider quota policy, tenant accounting, cost forecast, exact timeseries granularity, or `recharts`-level chart behavior that is not verified or approved
- **THEN** production SHALL omit, degrade, or label the behavior according to code truth
- **AND** the handoff notes SHALL preserve the unresolved claim for final cross-proposal review

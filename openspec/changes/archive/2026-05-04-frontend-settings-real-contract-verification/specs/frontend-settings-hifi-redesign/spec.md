## ADDED Requirements

### Requirement: Settings handoff distinguishes product target from verified contract truth

The Settings high-fidelity handoff SHALL separate v2 product intent from currently verified Settings, runtime endpoint, device, version, and frontend behavior.

#### Scenario: Handoff notes record verified and projected behavior

- **WHEN** the Settings real-contract verification pass completes
- **THEN** the handoff package SHALL record which v2 workflows are supported by current wrappers, routes, DTOs, mocks, and tests
- **AND** token rotation, recent saves, keybindings, privacy, bundled `.env` mutation, and rich paired-device fields SHALL be labelled as projected, degraded, unsupported, or handoff-blocked rather than guaranteed
- **AND** route truth SHALL distinguish `PUT /settings` and `POST /runtime/endpoint:test` from stale handoff route names

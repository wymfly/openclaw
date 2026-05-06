## ADDED Requirements

### Requirement: Models handoff distinguishes product target from verified contract truth

The Models high-fidelity handoff SHALL separate v2 product intent from currently verified Gateway, BFF, DTO, and frontend behavior.

#### Scenario: Handoff notes record verified and projected behavior

- **WHEN** the Models real-contract verification pass completes
- **THEN** the handoff package SHALL record which v2 workflows are supported by current wrappers, routes, generated Gateway methods, DTOs, mocks, and tests
- **AND** projected pricing snapshots, PATCH audit history, force probe cache controls, and unsupported advanced settings SHALL be labelled as projected, degraded, unsupported, or handoff-blocked rather than guaranteed
- **AND** route truth SHALL distinguish canonical `/usage/*` frontend usage routes from Models-compatible `/models/usage/*` aliases

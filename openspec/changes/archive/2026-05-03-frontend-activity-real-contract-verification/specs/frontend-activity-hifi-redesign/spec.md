## ADDED Requirements

### Requirement: Activity high-fidelity completion is not real functional completion

The Activity high-fidelity workflow SHALL remain a required visual quality gate, but it SHALL NOT be considered sufficient evidence that Activity works against a real deck-go stack with real Gateway/LLM telemetry.

#### Scenario: Activity mock visual evidence is reported

- **WHEN** Activity mock visual tests or high-fidelity prototype checks pass
- **THEN** implementation closeout SHALL label the evidence as L1 mock visual evidence
- **AND** it SHALL also report L2 real verification status separately as passed, handoff-blocked, skipped, real-empty-valid, or not attempted with reason

#### Scenario: Real Activity verification contradicts mock assumptions

- **WHEN** real BFF, stream, or UI verification contradicts mock data or a prototype assumption
- **THEN** the production implementation SHALL prefer Deck contract and Go BFF projection truth
- **AND** the implementation SHALL fix deterministic scoped drift directly or update mock/prototype notes when the contradiction is not a scoped fix

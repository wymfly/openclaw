## ADDED Requirements

### Requirement: Alerts high-fidelity completion is not real functional completion

The Alerts high-fidelity workflow SHALL remain a required visual quality gate, but it SHALL NOT be considered sufficient evidence that Alerts works against the real deck-go BFF contract and real local alert store.

#### Scenario: Alerts mock visual evidence is reported

- **WHEN** Alerts mock visual tests or high-fidelity prototype checks pass
- **THEN** implementation closeout SHALL label the evidence as L1 mock/local visual evidence
- **AND** it SHALL also report L2 real verification status separately as passed, handoff-blocked, skipped, real-empty-valid, or not attempted with reason

#### Scenario: Real Alerts verification contradicts mock assumptions

- **WHEN** real BFF, localstore, or UI verification contradicts mock data or a prototype assumption
- **THEN** the production implementation SHALL prefer Deck contract and Go BFF truth
- **AND** the implementation SHALL fix deterministic scoped drift directly or update mock/prototype notes when the contradiction is not a scoped fix

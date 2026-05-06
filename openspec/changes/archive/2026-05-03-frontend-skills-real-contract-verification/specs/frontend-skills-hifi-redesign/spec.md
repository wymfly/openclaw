## ADDED Requirements

### Requirement: Skills high-fidelity completion is not real functional completion

The Skills high-fidelity workflow SHALL remain a required visual quality gate, but it SHALL NOT be considered sufficient evidence that Skills works against a real OpenClaw Gateway, real ClawHub network, real credential persistence, or safe production install/update semantics.

#### Scenario: Skills mock visual evidence is reported

- **WHEN** Skills mock visual tests or high-fidelity prototype checks pass
- **THEN** implementation closeout SHALL label the evidence as L1 mock visual evidence
- **AND** it SHALL also report L2 real verification status separately as passed, handoff-blocked, skipped, or not attempted with reason

#### Scenario: Real Skills verification contradicts mock assumptions

- **WHEN** real Gateway or Deck BFF verification contradicts mock data or a prototype assumption
- **THEN** the production implementation SHALL prefer real Gateway, Deck contract, and Go BFF truth
- **AND** the mock fixture or prototype notes SHALL be updated when the contradiction is deterministic and in scope

#### Scenario: Skills mutation safety is not proven by prototype actions

- **WHEN** the prototype or mock visual E2E demonstrates install, update, config, ClawHub, or agent assignment actions
- **THEN** the evidence SHALL remain mock/local unless the same action has disposable or reversible real-stack verification
- **AND** unsupported or unsafe mutation assumptions SHALL be recorded as handoff-blocked rather than silently presented as fully real-verified capability

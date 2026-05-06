## ADDED Requirements

### Requirement: Agents revised v2 handoff is the active implementation target

The agents production pass for this change SHALL treat the revised v2 `deck-go/frontend-handoff/modules/agents/` package as the active visual and interaction target, subject to real Gateway capability calibration.

#### Scenario: Revised handoff is read before implementation

- **WHEN** implementation begins for this change
- **THEN** the implementer SHALL read the agents v2 `README.md`, `prototype.html`, `app.jsx`, `data.js`, `list-view.jsx`, `detail-view.jsx`, `dialogs.jsx`, `tweaks-panel.jsx`, `components.md`, `states.md`, `interactions.md`, and `api-usage.md`
- **AND** the implementation SHALL preserve the v2 prototype's product intent unless contract or real Gateway evidence requires a documented adjustment

#### Scenario: Prototype exceeds real capability

- **WHEN** the revised v2 prototype expects a field, action, or state that real Gateway capability or Deck-facing contracts do not support
- **THEN** the production implementation SHALL adjust the UI to supported behavior or add a justified contract/adapter change
- **AND** the unsupported prototype expectation SHALL be recorded in agents implementation notes or OpenSpec task evidence

### Requirement: Agents high-fidelity completion is not real functional completion

The agents high-fidelity workflow SHALL remain a required visual quality gate, but it SHALL NOT be considered sufficient evidence that the module works against a real OpenClaw Gateway.

#### Scenario: Mock visual evidence is reported

- **WHEN** agents mock visual tests or high-fidelity prototype checks pass
- **THEN** the implementation closeout SHALL label the evidence as L1 mock visual evidence
- **AND** it SHALL also report L2 real verification status separately as passed, handoff-blocked, or not attempted with reason

#### Scenario: Real verification contradicts mock assumptions

- **WHEN** real Gateway verification contradicts the mock data or prototype assumption
- **THEN** the production implementation SHALL prefer real Gateway and Deck contract truth
- **AND** the mock fixture or prototype notes SHALL be updated if the contradiction is deterministic and in scope

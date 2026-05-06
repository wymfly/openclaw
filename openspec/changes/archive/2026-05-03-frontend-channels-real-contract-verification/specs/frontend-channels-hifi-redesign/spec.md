## ADDED Requirements

### Requirement: Channels revised v2 handoff is the active implementation target

The channels production pass for this change SHALL treat the revised v2 multi-file `deck-go/frontend-handoff/modules/channels/` package as the active visual and interaction target, subject to real Gateway and Deck BFF capability calibration.

#### Scenario: Revised channels handoff is read before implementation

- **WHEN** implementation begins for this change
- **THEN** the implementer SHALL read the channels v2 `README.md`, `prototype.html`, `app.jsx`, `data.js`, `list-view.jsx`, `detail-view.jsx`, `dialogs.jsx`, `tweaks-panel.jsx`, `components.md`, `states.md`, `interactions.md`, and `api-usage.md`
- **AND** the implementation SHALL preserve the v2 prototype's product intent unless contract or real Gateway/BFF evidence requires a documented adjustment

#### Scenario: Channels prototype exceeds real capability

- **WHEN** the channels v2 prototype expects a field, action, projection, or state that real Gateway capability or Deck-facing contracts do not support
- **THEN** the production implementation SHALL adjust the UI to supported behavior or add a justified contract/adapter change
- **AND** the unsupported prototype expectation SHALL be recorded in channels implementation notes or OpenSpec task evidence

### Requirement: Channels high-fidelity completion is not real functional completion

The channels high-fidelity workflow SHALL remain a required visual quality gate, but it SHALL NOT be considered sufficient evidence that the module works against a real OpenClaw Gateway.

#### Scenario: Channels mock visual evidence is reported

- **WHEN** channels mock visual tests or high-fidelity prototype checks pass
- **THEN** the implementation closeout SHALL label the evidence as L1 mock visual evidence
- **AND** it SHALL also report L2 real verification status separately as passed, handoff-blocked, skipped, or not attempted with reason

#### Scenario: Real channels verification contradicts mock assumptions

- **WHEN** real Gateway or Deck BFF verification contradicts mock data or a prototype assumption
- **THEN** the production implementation SHALL prefer real Gateway, Deck contract, and Go BFF truth
- **AND** the mock fixture or prototype notes SHALL be updated when the contradiction is deterministic and in scope

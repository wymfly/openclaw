# frontend-channels-hifi-redesign Specification

## Purpose

TBD - created by archiving change frontend-channels-hifi-contract-redesign. Update Purpose after archive.

## Requirements

### Requirement: Channels handoff package defines the visual contract

The channels module SHALL have a complete handoff package under `deck-go/frontend-handoff/modules/channels/` before the production UI rewrite is marked complete. The package SHALL use the current Deck-facing channel status, probe, throughput, config, WeCom access, and routing DTOs/routes as source truth.

#### Scenario: Handoff package is reviewed

- **WHEN** the channels handoff package is created
- **THEN** it SHALL include `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, and `api-usage.md`
- **AND** unsupported or uncertain provider/WeCom/Gateway behavior SHALL be documented as discrepancy notes or open questions rather than guaranteed UI behavior
- **AND** probe, logout, enable/disable, config patch, account policy, WeCom access, and routing handoff behavior SHALL be documented explicitly

### Requirement: Channels production panel follows contract-backed workflows

The production channels panel SHALL render and operate from contract-backed channel inventory, account diagnostics, selected-channel metadata, probe, throughput, logout, channel config, WeCom access, and routing data while preserving the existing panel registry and API facade boundaries.

#### Scenario: Channels data is loaded

- **WHEN** channel status, accounts, selected detail, throughput, optional probe result, and optional WeCom/routing data resolve
- **THEN** the panel SHALL show inventory status, timestamp, channel/account metrics, selected-channel identity, diagnostics, throughput evidence, account policy controls, WeCom access controls when applicable, and action controls
- **AND** missing optional fields SHALL render as unavailable, empty, or omitted rather than fabricated values

#### Scenario: Channel selection and navigation are used

- **WHEN** an operator selects a channel or opens the panel with channel navigation params
- **THEN** the panel SHALL keep selected-channel detail, throughput, plugin navigation, WeCom account focus, and routing handoff consistent with the selected channel/account

#### Scenario: Channel actions are executed

- **WHEN** an operator probes, logs out, enables/disables, patches channel config, patches account DM policy, saves WeCom access, or opens routing/plugin handoff
- **THEN** the panel SHALL call the existing wrapper with the current selected channel/account and required payload
- **AND** logout and enable/disable SHALL retain a confirmation gate
- **AND** successful mutations SHALL refresh the channel state according to the existing selection-preservation behavior

### Requirement: Channels UI aligns with the settled frontend design system

The channels panel SHALL use the chat/agents/routing/subagents/logs/settings/sessions design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens, compact workbench density, low-radius surfaces, clear focus states, and local molecules only when canonical atoms are not yet justified.

#### Scenario: Channels UI is rendered

- **WHEN** the channels panel is rendered with contract-shaped mock data
- **THEN** the first viewport SHALL expose inventory health, selected-channel identity, account diagnostics, status/count metrics, throughput evidence, and action affordances without overlapping text or nested decorative cards
- **AND** destructive/state-changing actions SHALL remain visually distinct from read-only actions

### Requirement: Channels mock visual verification is available

The channels rewrite SHALL include focused mock visual verification that exercises the real frontend against contract-shaped channel/status/test/throughput/config/routing data without requiring a real Gateway or LLM.

#### Scenario: Mock visual E2E runs

- **WHEN** the channels mock visual E2E is executed
- **THEN** it SHALL load channel data through the frontend API path
- **AND** it SHALL capture or assert the ready workbench state and at least one interaction state such as probe result, throughput window, channel toggle confirmation, JSON patch result, or WeCom access state
- **AND** closeout evidence SHALL label the test as mock visual coverage, not real Gateway/LLM E2E

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

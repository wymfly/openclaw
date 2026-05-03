# frontend-settings-hifi-redesign Specification

## Purpose

Defines the settings module high-fidelity redesign contract for the
contract-led frontend rollout.

## Requirements

### Requirement: Settings handoff package defines the visual contract

The settings module SHALL have a complete handoff package under `deck-go/frontend-handoff/modules/settings/` before the production UI rewrite is marked complete. The package SHALL use the current Deck-facing settings/runtime/device DTOs, BFF routes, and device-pair SSE behavior as source truth.

#### Scenario: Handoff package is reviewed

- **WHEN** the settings handoff package is created
- **THEN** it SHALL include `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, and `api-usage.md`
- **AND** the package SHALL document unsupported or uncertain product behavior as discrepancy notes or open questions rather than guaranteed UI behavior
- **AND** security-sensitive token behavior SHALL be documented explicitly

### Requirement: Settings production panel follows contract-backed workflows

The production settings panel SHALL render and operate from contract-backed settings, runtime endpoint, version, and device data while preserving the existing panel registry and API facade boundaries.

#### Scenario: Settings and runtime data are loaded

- **WHEN** settings, capabilities, runtime endpoint, version, devices, and self-device calls resolve
- **THEN** the panel SHALL show settings status, Gateway/runtime status, endpoint source/token/TLS state, settings path, theme/locale controls, notification placeholders, version summary, pending devices, paired devices, and token lifecycle actions
- **AND** missing optional fields SHALL render as unavailable or omitted rather than fabricated values

#### Scenario: Settings are saved

- **WHEN** an operator saves settings
- **THEN** the panel SHALL send only the allowed local preferences payload (`appearance`, `notifications`, `pairedDevices`)
- **AND** access token or runtime-managed fields SHALL NOT be sent through `saveSettings`

#### Scenario: Runtime endpoint is edited or tested

- **WHEN** the runtime endpoint is mutable and an operator saves or tests an edited endpoint
- **THEN** the panel SHALL preserve the existing `__unchanged__` token sentinel behavior for configured tokens left blank
- **AND** immutable endpoint state SHALL render as read-only configured status, not as editable secrets or unsupported test actions

#### Scenario: Device actions are confirmed

- **WHEN** an operator approves, rejects, rotates, revokes, or removes a device
- **THEN** the panel SHALL show the confirmation gate before executing the existing device API wrapper
- **AND** self-device destructive actions SHALL remain disabled
- **AND** rotated tokens MAY be shown only in the one-time token dialog

### Requirement: Settings UI aligns with the settled frontend design system

The settings panel SHALL use the chat/agents/routing/subagents/logs design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens, compact workbench density, low-radius surfaces, clear focus states, and local molecules only when canonical atoms are not yet justified.

#### Scenario: Settings UI is rendered

- **WHEN** the settings panel is rendered with contract-shaped mock data
- **THEN** the first viewport SHALL expose runtime/settings status, endpoint state, key settings path/token configured state, appearance/locale controls, version diagnostics, and device counts without overlapping text or nested decorative cards
- **AND** token values SHALL be absent or masked except for the one-time rotated token dialog

### Requirement: Settings mock visual verification is available

The settings rewrite SHALL include focused mock visual verification that exercises the real frontend against contract-shaped settings/runtime/device data without requiring a real Gateway or LLM.

#### Scenario: Mock visual E2E runs

- **WHEN** the settings mock visual E2E is executed
- **THEN** it SHALL load settings/runtime/device data through the frontend API path
- **AND** it SHALL capture or assert the ready workbench state and at least one interaction state such as endpoint test, device confirmation, or token rotation
- **AND** closeout evidence SHALL label the test as mock visual coverage, not real Gateway/LLM E2E

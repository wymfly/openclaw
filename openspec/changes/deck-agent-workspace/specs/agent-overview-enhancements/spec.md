## ADDED Requirements

### Requirement: Model fallback chain in Overview tab

The Overview tab SHALL display the agent's model fallback chain using the existing `FallbackChain` component from the Models panel, showing the primary model and ordered fallback models.

#### Scenario: Agent with fallback chain configured

- **WHEN** user views the Overview tab for an agent that has a primary model and fallback models configured
- **THEN** the FallbackChain component renders the primary model card followed by fallback model cards in order, with connector arrows between them

#### Scenario: Agent with only primary model

- **WHEN** user views the Overview tab for an agent with a primary model but no fallbacks
- **THEN** the FallbackChain component renders only the primary model card with an "Add fallback" option

#### Scenario: Agent with no model configured (uses default)

- **WHEN** user views the Overview tab for an agent that inherits the default model configuration
- **THEN** the section displays an "Using default model" indicator with the resolved default model name

### Requirement: Sandbox mode display with impact explanation

The Overview tab SHALL display the agent's sandbox mode setting with a brief explanation of its security impact.

#### Scenario: Agent in sandbox mode

- **WHEN** user views the Overview tab for an agent with sandbox mode enabled
- **THEN** a badge displays "Sandboxed" with an explanation tooltip describing the restrictions (isolated filesystem, restricted network, limited tool access)

#### Scenario: Agent not sandboxed

- **WHEN** user views the Overview tab for an agent without sandbox mode
- **THEN** a badge displays "Unrestricted" with an explanation tooltip describing the full-access implications

### Requirement: Identity preview card

The Overview tab SHALL display an identity preview card showing the agent's configured avatar/emoji, display theme, and a brief identity summary.

#### Scenario: Agent with custom identity

- **WHEN** user views the Overview tab for an agent that has a custom identity file (IDENTITY.md) with avatar emoji and theme configured
- **THEN** the identity preview card renders the avatar emoji, theme color indicator, and first few lines of the identity description

#### Scenario: Agent with default identity

- **WHEN** user views the Overview tab for an agent with no custom identity
- **THEN** the identity preview card shows the default agent icon with an "unconfigured" label and a link to the Context tab for setup

### Requirement: Overview stat cards link to Context tab

The existing stat cards in the Overview tab SHALL include a new "Context" card that links to the Context tab and shows prompt composition summary stats (total prompt chars, bootstrap file count).

#### Scenario: User clicks Context stat card

- **WHEN** user clicks the Context stat card in the Overview tab
- **THEN** the tab navigates to the Context tab

## ADDED Requirements

### Requirement: First-Run Detection

The onboarding wizard SHALL automatically activate on first run when the system detects an unconfigured state via `config.get` (no Gateway connection or no provider configured).

#### Scenario: Auto-launch on unconfigured state

- **WHEN** the user opens openclaw-deck for the first time and no Gateway URL is configured
- **THEN** the wizard SHALL launch automatically, presenting Step 1 (Gateway Connection)

#### Scenario: Skip when already configured

- **WHEN** the user opens openclaw-deck and a Gateway connection is already established with at least one provider configured
- **THEN** the wizard SHALL NOT launch and the user SHALL see the main dashboard

### Requirement: Step 1 — Gateway Connection

The wizard SHALL guide the user through configuring the Gateway connection URL and authentication token.

#### Scenario: Configure Gateway connection

- **WHEN** the user enters a Gateway URL and token in Step 1
- **THEN** the wizard SHALL attempt to connect to the Gateway, and on success, display a green checkmark and enable the "Next" button

#### Scenario: Connection failure feedback

- **WHEN** the user enters an invalid Gateway URL or token
- **THEN** the wizard SHALL display an error message describing the failure (unreachable, auth failed) and keep the "Next" button disabled

### Requirement: Step 2 — Provider Setup

The wizard SHALL guide the user through configuring at least one model provider (model selection + API key).

#### Scenario: Configure provider

- **WHEN** the user selects a provider, enters an API key, and selects a model
- **THEN** the wizard SHALL persist the provider configuration via `config.patch` and enable the "Next" button

### Requirement: Step 3 — First Chat Test

The wizard SHALL allow the user to send a test message to verify the full pipeline (Gateway + Provider + Model) is working.

#### Scenario: Successful test chat

- **WHEN** the user sends a test message in Step 3
- **THEN** the wizard SHALL display the streaming response and show a completion screen with a "Go to Dashboard" button

#### Scenario: Test chat failure

- **WHEN** the test chat fails (model error, API key invalid)
- **THEN** the wizard SHALL display the error and offer a "Back" button to return to Step 2 for reconfiguration

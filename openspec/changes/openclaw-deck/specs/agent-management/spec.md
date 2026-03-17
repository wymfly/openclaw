## ADDED Requirements

### Requirement: Agent Fleet CRUD

The agent management panel SHALL support creating, reading, updating, and deleting agents via Gateway RPC methods `agents.create`, `agents.list`, `agents.update`, and `agents.delete`.

#### Scenario: List all agents

- **WHEN** the user navigates to the Agents panel
- **THEN** the panel SHALL fetch and display all agents via `agents.list` with status indicators for each agent

#### Scenario: Create a new agent

- **WHEN** the user fills in the agent creation form and submits
- **THEN** the panel SHALL call `agents.create` with the provided name and configuration, and the new agent SHALL appear in the list upon success

#### Scenario: Delete an agent

- **WHEN** the user confirms deletion of an agent
- **THEN** the panel SHALL call `agents.delete` and remove the agent from the list upon success

### Requirement: Per-Agent Configuration

The panel SHALL allow editing per-agent configuration including model selection, personality (SOUL.md), and workspace settings via `agents.update`.

#### Scenario: Edit agent model assignment

- **WHEN** the user selects a different model for an agent and saves
- **THEN** the panel SHALL call `agents.update` with the new model configuration

#### Scenario: Edit SOUL.md

- **WHEN** the user opens the SOUL.md editor for an agent
- **THEN** the panel SHALL fetch the file content via `agents.files.get` and display it in an editable text area; on save, it SHALL call `agents.files.set` to persist changes

### Requirement: Agent File Management

The panel SHALL provide file browsing for agent workspace files via `agents.files.list` and `agents.files.get`.

#### Scenario: Browse agent files

- **WHEN** the user expands the files section of an agent
- **THEN** the panel SHALL call `agents.files.list` and display the file tree for that agent's workspace

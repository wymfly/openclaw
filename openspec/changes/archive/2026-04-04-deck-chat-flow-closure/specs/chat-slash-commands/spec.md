## MODIFIED Requirements

### Requirement: Slash commands execute corresponding actions

Each chat slash command SHALL map to its intended backend or local action with matching semantics.

#### Scenario: /reset uses sessions.reset

- **WHEN** the user executes `/reset` in an existing session
- **THEN** the client SHALL call `sessions.reset` for the current `sessionKey`
- **AND** SHALL NOT create a brand-new session key as a substitute for reset

#### Scenario: /clear uses backend clear API

- **WHEN** the user executes `/clear`
- **THEN** the client SHALL call the backend clear API for the current session
- **AND** the session history SHALL remain empty after page refresh until new messages are sent

#### Scenario: /clear preserves session identity and directives

- **WHEN** `/clear` completes successfully
- **THEN** the current `sessionKey` and session-level directives (such as model and thinking configuration) SHALL remain associated with the session

#### Scenario: /kill all is not offered

- **WHEN** the user opens the slash command palette
- **THEN** the chat panel SHALL NOT offer a `/kill all` action unless a real backend bulk-abort capability exists

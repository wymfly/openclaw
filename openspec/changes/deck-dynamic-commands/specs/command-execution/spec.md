## ADDED Requirements

### Requirement: Local command execution
Commands with `execMode: "local"` SHALL be executed by calling their `execute()` handler directly, preserving the existing toast feedback, optimistic update, and SSE correction behavior from the coherence fix.

#### Scenario: Execute local config command
- **WHEN** user executes `/think high` and the command has `execMode: "local"`
- **THEN** the executor SHALL call `command.execute(sessionKey, "high")` and apply the returned `configUpdate` optimistically to the store

#### Scenario: Execute local UI action
- **WHEN** user executes `/new` with `execMode: "local"`
- **THEN** the executor SHALL call `command.execute()` and perform the returned `action: "new-session"` side-effect

#### Scenario: Local command toast feedback
- **WHEN** a local command returns a `toastKey`
- **THEN** the executor SHALL resolve the i18n key via `t()` and show a toast notification

### Requirement: Remote command execution via chat.send
Commands with `execMode: "remote"` SHALL be executed by sending the command text via the `chat.send` Gateway RPC, delegating processing to the backend auto-reply command handler pipeline.

#### Scenario: Execute remote builtin command
- **WHEN** user executes `/config show` with `execMode: "remote"`
- **THEN** the executor SHALL call `gw.chatSend({ sessionKey, message: "/config show" })`
- **AND** show a "Command sent" toast

#### Scenario: Execute remote skill command
- **WHEN** user executes `/github pr list` with `source: "skill"`
- **THEN** the executor SHALL call `gw.chatSend({ sessionKey, message: "/github pr list" })`

#### Scenario: Remote command result via SSE
- **WHEN** a remote command is executed via `chat.send`
- **THEN** the command result SHALL appear as an assistant message through the existing SSE streaming pipeline

#### Scenario: Remote command error handling
- **WHEN** `chat.send` returns an error (e.g., 500 or network failure)
- **THEN** the executor SHALL show an error toast and NOT inject any message into the chat

### Requirement: Unified executor dispatch
The executor SHALL dispatch commands based on their `execMode` field from the registry, replacing the current switch-case implementation with a registry-driven lookup.

#### Scenario: Registered command dispatches correctly
- **WHEN** user inputs `/think high` and the registry has a command named "think" with `execMode: "local"`
- **THEN** the executor SHALL route to the local handler

#### Scenario: Unknown command fallback
- **WHEN** user inputs `/nonexistent` and no command named "nonexistent" exists in the registry
- **THEN** the executor SHALL show an "Unknown command" error toast and NOT send the text as a chat message

#### Scenario: Remote command dispatches to chat.send
- **WHEN** user inputs `/status` and the registry has it with `execMode: "remote"`
- **THEN** the executor SHALL route to the remote handler (chat.send)

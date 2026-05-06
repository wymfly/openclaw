## ADDED Requirements

### Requirement: Command convergence matrix

Deck Go SHALL maintain a command convergence matrix for every visible Chat command or command family.

#### Scenario: Command is visible in the Chat UI

- **WHEN** a command appears in the slash palette, command tag mode, command argument mode, or documented Chat command list
- **THEN** the matrix SHALL record its name, aliases, source, discovery authority, argument shape, execution path, mutation safety class, expected UI state, output renderer, and verification status

#### Scenario: Command real execution is unsafe

- **WHEN** a command can affect filesystem, process state, credentials, external services, destructive session state, or non-disposable operator data
- **THEN** the matrix SHALL mark the command as skipped-safe, degraded, or handoff-blocked for real E2E
- **AND** the row SHALL still include code-level review evidence and the exact reason real execution was not performed

#### Scenario: Command row is marked complete

- **WHEN** a command matrix row is marked complete
- **THEN** it SHALL include both backend/OpenClaw execution-path evidence and frontend UI-state/rendering evidence
- **AND** no command SHALL be marked complete solely because it is listed in the palette or returns a successful HTTP response

### Requirement: Command execution authority

Deck Go SHALL execute commands through the correct authority path according to command source and product semantics.

#### Scenario: Local command is product-owned

- **WHEN** a command is classified as frontend-local or Deck-product-local
- **THEN** it SHALL execute through the local command executor or Deck BFF route named in the matrix
- **AND** any local shadowing of a Gateway builtin command SHALL be explicitly recorded with rationale

#### Scenario: Gateway command is remote-owned

- **WHEN** a command is classified as a Gateway builtin, skill, or plugin command
- **THEN** it SHALL be discovered or mapped from Gateway command truth
- **AND** manual input and palette selection SHALL route it through the remote command path without being treated as an unknown command or plain chat text

#### Scenario: Alias is supported

- **WHEN** an alias is accepted by the Chat command parser
- **THEN** the alias SHALL resolve to the same command authority, argument handling, execution path, and UI state transitions as the canonical command

### Requirement: Command UI state convergence

Deck Go SHALL provide correct frontend state before, during, and after command execution.

#### Scenario: Instant configuration command completes

- **WHEN** a local configuration command such as thinking, reasoning, fast mode, usage display, model, or send policy succeeds
- **THEN** the relevant Chat context UI SHALL update without waiting for a full page reload
- **AND** success or failure feedback SHALL be visible to the user

#### Scenario: Long-running mutation command is in flight

- **WHEN** a mutation command starts and its execution can take noticeable time
- **THEN** the Chat UI SHALL show an in-flight state tied to that command or session
- **AND** the input/palette behavior SHALL not leave stale command UI open after dispatch

#### Scenario: Long-running mutation command finishes

- **WHEN** a mutation command finishes successfully or fails
- **THEN** the in-flight state SHALL clear
- **AND** the durable session state, metadata, output, or error display SHALL reflect the final result

#### Scenario: Compaction command executes

- **WHEN** the user executes a compaction command for an active session
- **THEN** Deck Go SHALL call the correct OpenClaw-backed compaction path
- **AND** the frontend SHALL show that compaction is running
- **AND** after completion the frontend SHALL show updated compaction/session/checkpoint state or a clear failure state

### Requirement: Command output renderers

Deck Go SHALL render command outputs according to output class rather than raw text alone.

#### Scenario: OpenClaw status output is received

- **WHEN** a command response is an OpenClaw status report
- **THEN** the Chat transcript SHALL render a structured status card with model, runtime, token, context, cost, session, queue, and authentication summary fields when present

#### Scenario: Tool output is received

- **WHEN** command execution emits tool calls or tool results
- **THEN** tool calls and results SHALL use the standard collapsed tool card presentation by default

#### Scenario: Command error is received

- **WHEN** command execution fails or returns an error response
- **THEN** the Chat UI SHALL display an error treatment that identifies the command and reason without corrupting the input state

#### Scenario: Normal assistant reply is received

- **WHEN** command execution produces normal assistant prose
- **THEN** the reply SHALL continue to render through the standard Markdown transcript renderer

### Requirement: Representative real command E2E

Deck Go SHALL verify command convergence with representative real Gateway E2E samples.

#### Scenario: Safe representative command classes are tested

- **WHEN** real command E2E is run against the isolated real Gateway stack
- **THEN** the run SHALL include at least one representative local config command, local query command, local mutation command, Gateway builtin command, alias command, unknown command, and skill/plugin discovery or dispatch path when safe

#### Scenario: Real E2E attempts are bounded

- **WHEN** a representative real command E2E scenario fails due to runtime, credentials, model, workspace fixture, network, or Gateway availability
- **THEN** the scenario SHALL stop after bounded attempts
- **AND** redacted evidence SHALL record the blocker instead of silently passing or blocking unrelated command classes forever

## ADDED Requirements

### Requirement: Streaming Message Display

The chat panel SHALL display messages in real-time as they stream from the Gateway via `chat.send`. Streaming tokens SHALL be rendered incrementally without waiting for the full response.

#### Scenario: Incremental token rendering

- **WHEN** the user sends a message and the Gateway streams back tokens via `chat.send`
- **THEN** the chat panel SHALL render each token chunk as it arrives via SSE, with no visible delay between chunks

#### Scenario: Tool use block display

- **WHEN** a streamed response contains a `tool_use` block
- **THEN** the panel SHALL render the tool name, input parameters, and output result in a distinct collapsible block within the message flow

### Requirement: Thinking Trace Display

The chat panel SHALL render thinking/reasoning traces from the model as collapsible sections, visually distinct from the final response content.

#### Scenario: Collapsible thinking section

- **WHEN** a response includes thinking trace content
- **THEN** the panel SHALL display a collapsible "Thinking" section above the response that is collapsed by default and can be expanded by the user

### Requirement: File Attachment

The chat panel SHALL support file attachments via drag-and-drop and a file picker button. Attached files SHALL be sent with the message via the `chat.send` RPC.

#### Scenario: Drag and drop file attachment

- **WHEN** the user drags a file onto the chat input area
- **THEN** the panel SHALL show a file preview chip in the input area and include the file content in the next `chat.send` request

### Requirement: Session Management

The chat panel SHALL provide a session selector sidebar allowing users to switch between existing sessions or start a new one. Sessions SHALL be fetched via `sessions.list`.

#### Scenario: Session switching

- **WHEN** the user selects a different session from the sidebar
- **THEN** the panel SHALL load the conversation history for that session via `chat.history` and display it in the message area

#### Scenario: New session creation

- **WHEN** the user clicks "New Session"
- **THEN** the panel SHALL clear the message area and begin a fresh session context for the next `chat.send` call

### Requirement: Chat Abort

The chat panel SHALL allow the user to abort an in-progress streaming response via the `chat.abort` RPC.

#### Scenario: Abort streaming response

- **WHEN** the user clicks the abort button during an active streaming response
- **THEN** the panel SHALL send a `chat.abort` request to the server, stop rendering new tokens, and display the partial response received so far

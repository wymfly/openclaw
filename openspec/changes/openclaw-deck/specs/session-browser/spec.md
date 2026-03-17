## ADDED Requirements

### Requirement: Session List Display

The session browser SHALL display all sessions fetched via `sessions.list` with kind badges (direct / group / global / unknown) and model name.

#### Scenario: List sessions with kind badges

- **WHEN** the user navigates to the Sessions panel
- **THEN** the panel SHALL call `sessions.list` and display each session with a colored badge indicating its kind (direct, group, global, or unknown)

### Requirement: Context Usage Visualization

Each session entry SHALL display a visual context usage bar showing the ratio of consumed tokens to the model's context window limit.

#### Scenario: Context bar rendering

- **WHEN** sessions are listed
- **THEN** each session SHALL show a horizontal progress bar representing context window utilization as a percentage, with color coding (green < 60%, yellow 60-80%, red > 80%)

### Requirement: Token Statistics

The session browser SHALL display token statistics (input tokens, output tokens, total) for each session.

#### Scenario: Token stats display

- **WHEN** a session is listed or selected
- **THEN** the panel SHALL display input token count, output token count, and total token count for that session

### Requirement: Conversation History Viewer

The session browser SHALL allow viewing the full conversation history for a selected session via `chat.history`.

#### Scenario: View session history

- **WHEN** the user clicks on a session entry
- **THEN** the panel SHALL call `chat.history` for that session and render the full conversation with user messages, assistant responses, and tool use blocks

#### Scenario: Session ID and model display

- **WHEN** a session's detail view is open
- **THEN** the panel SHALL display the session ID and the model used for the session in the detail header

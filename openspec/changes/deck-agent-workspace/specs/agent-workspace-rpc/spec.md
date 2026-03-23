## ADDED Requirements

### Requirement: Tool policy preview RPC

The gateway SHALL expose a `deck.agents.toolPolicy.preview` RPC method that returns the resolved per-tool allow/deny list after all 7 policy pipeline layers are applied for a given agent.

#### Scenario: Basic tool policy preview

- **WHEN** client calls `deck.agents.toolPolicy.preview` with `{ agentId: "agent-1" }`
- **THEN** the response SHALL include:
  - `layers`: array of pipeline layer objects, each with `label`, `ruleCount`, and `effect` (allow/deny/passthrough)
  - `tools`: array of tool objects, each with `name`, `allowed` (boolean), `decisiveLayer` (label of the layer that made the final decision), and `trace` (array of per-layer decisions)
  - `configHash`: hash of the config state used for this preview

#### Scenario: Context-sensitive tool policy preview

- **WHEN** client calls `deck.agents.toolPolicy.preview` with `{ agentId: "agent-1", context: { channel: "voice" } }`
- **THEN** the response SHALL reflect channel-specific tool restrictions (e.g., TTS tool denied for voice channel) in addition to the standard policy pipeline

#### Scenario: Unknown agent ID

- **WHEN** client calls `deck.agents.toolPolicy.preview` with a non-existent agent ID
- **THEN** the response SHALL return an error with code `NOT_FOUND`

### Requirement: System prompt preview RPC

The gateway SHALL expose a `deck.agents.systemPrompt.preview` RPC method that returns the fully assembled system prompt for a given agent, including per-layer breakdowns.

#### Scenario: Basic system prompt preview

- **WHEN** client calls `deck.agents.systemPrompt.preview` with `{ agentId: "agent-1" }`
- **THEN** the response SHALL include:
  - `layers`: array of prompt layer objects, each with `label`, `source` (file path or config key), `charCount`, and optionally `content` (the layer's text, when available without a live session)
  - `assembledPrompt` (optional, best-effort): an approximation of the system prompt text. NOTE: accurate prompt assembly requires an active session with live tools, model selection, and session context; this field is approximation-only when returned and MAY be omitted.
  - `totalChars`: total character count of the known prompt layers (excludes runtime-only layers like skills injection)
  - `bootstrapFiles`: array of bootstrap file entries with `name`, `charCount`, and `exists` (boolean)
  - `configHash`: hash of the config state used for this preview

#### Scenario: Context-sensitive prompt preview

- **WHEN** client calls `deck.agents.systemPrompt.preview` with `{ agentId: "agent-1", context: { channel: "telegram", chatType: "group" } }`
- **THEN** the response SHALL include channel-specific prompt additions (e.g., Telegram reaction level hints, group chat instructions)

#### Scenario: Unknown agent ID

- **WHEN** client calls `deck.agents.systemPrompt.preview` with a non-existent agent ID
- **THEN** the response SHALL return an error with code `NOT_FOUND`

### Requirement: Both preview RPCs are read-only

Both `deck.agents.toolPolicy.preview` and `deck.agents.systemPrompt.preview` SHALL be pure read operations that compute results on-the-fly without persisting state, creating sessions, or producing side effects.

#### Scenario: No side effects from preview

- **WHEN** client calls either preview RPC multiple times
- **THEN** no new sessions, files, or config entries are created; the gateway state remains unchanged

### Requirement: Preview RPCs registered in method scopes and allowlists

Both new RPC methods SHALL be registered in `src/gateway/method-scopes.ts`, `src/gateway/server-methods-list.ts`, and `dashboard/server/gateway-allowlist.ts`.

#### Scenario: Dashboard can call preview RPCs

- **WHEN** the dashboard API route dispatches a preview RPC action
- **THEN** the gateway allowlist permits the call and the response is returned to the frontend

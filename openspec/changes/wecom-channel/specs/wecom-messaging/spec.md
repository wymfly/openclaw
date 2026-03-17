## ADDED Requirements

### Requirement: WebSocket long connection messaging

The system SHALL establish a WebSocket long connection to the WeCom AI Bot server using `@wecom/aibot-node-sdk`, supporting authentication, heartbeat, automatic reconnection, and bidirectional message delivery.

#### Scenario: Successful authentication and message reception

- **WHEN** gateway starts with valid botId and secret configured at `channels.wecom.bot.ws.botId` and `channels.wecom.bot.ws.secret` (or per-account at `channels.wecom.accounts.<id>.bot.ws.botId`)
- **THEN** system establishes WSS connection to `wss://openws.work.weixin.qq.com` with `maxReconnectAttempts: 100`, authenticates via `aibot_subscribe`, and begins receiving `aibot_msg_callback` messages

#### Scenario: Automatic reconnection on disconnect

- **WHEN** WebSocket connection drops unexpectedly
- **THEN** system attempts reconnection with exponential backoff, up to 100 retries, maintaining heartbeat at 30-second intervals

#### Scenario: Heartbeat keepalive

- **WHEN** connection is idle for 30 seconds
- **THEN** system sends a ping frame to prevent server-side timeout

### Requirement: Streaming reply support

The system SHALL support native WeCom streaming replies via the `aibot_respond_msg` command with stream mode, delivering incremental text chunks to users in real-time.

#### Scenario: Stream reply with thinking placeholder

- **WHEN** Agent begins processing a user message
- **THEN** system sends a `<think></think>` thinking placeholder via stream, then delivers incremental content as the Agent generates output, and finalizes with `finish: true`

#### Scenario: Stream timeout handling

- **WHEN** a streaming reply exceeds 6 minutes without completion
- **THEN** system forces stream finalization and delivers accumulated content

### Requirement: Direct message and group chat support

The system SHALL support both direct messages (1:1) and group chat messages, with configurable access policies for each.

#### Scenario: DM with open policy

- **WHEN** `channels.wecom.bot.dm.policy` is set to `"open"` and a user sends a direct message
- **THEN** system processes the message and routes to the Agent without access check

#### Scenario: DM with allowlist policy

- **WHEN** `channels.wecom.bot.dm.policy` is set to `"allowlist"` and a user not in `channels.wecom.bot.dm.allowFrom` sends a direct message
- **THEN** system silently ignores the message

#### Scenario: Group chat via dynamic agent groupEnabled

- **WHEN** `channels.wecom.dynamicAgents.groupEnabled` is `true` and a user sends a group message
- **THEN** system creates or routes to a per-group dynamic Agent

### Requirement: Multi-account support

The system SHALL support multiple WeCom bot accounts under `channels.wecom.accounts.*`, each with independent bot credentials, access policies, and Agent routing.

#### Scenario: Independent account configuration

- **WHEN** two accounts `sales` and `ops` are configured under `channels.wecom.accounts`
- **THEN** each account establishes its own WebSocket connection, maintains independent message state, and routes to separate Agents

#### Scenario: Account conflict detection

- **WHEN** two accounts share the same botId
- **THEN** system logs a warning at startup identifying the duplicate configuration

### Requirement: Dynamic Agent isolation

The system SHALL support per-user or per-group Agent isolation, generating deterministic Agent IDs based on account ID, chat type, and peer ID.

#### Scenario: Per-user Agent workspace

- **WHEN** `channels.wecom.dynamicAgents.enabled` is `true` and `channels.wecom.dynamicAgents.dmCreateAgent` is `true` and user A sends a DM
- **THEN** system routes to Agent `wecom-{accountId}-dm-{userId}` with an isolated workspace directory

#### Scenario: Admin bypass

- **WHEN** a user listed in `channels.wecom.dynamicAgents.adminUsers` sends a message
- **THEN** system routes to the main Agent instead of creating an isolated workspace

### Requirement: Agent API proactive messaging

The system SHALL support proactive message delivery via WeCom Agent API (corpId + corpSecret + agentId), enabling push notifications to users, groups, departments, and tags.

#### Scenario: Proactive push to user

- **WHEN** Agent invokes outbound send to a specific user and Agent API credentials are configured
- **THEN** system sends the message via `https://qyapi.weixin.qq.com/cgi-bin/message/send` with cached access token

#### Scenario: Fallback from WebSocket to Agent API

- **WHEN** WebSocket reply fails (connection dropped or stream expired)
- **THEN** system falls back to Agent API for message delivery

### Requirement: Media message handling

The system SHALL support receiving and sending images, voice, video, and file messages through the WeCom channel.

#### Scenario: Inbound image processing

- **WHEN** a user sends an image message
- **THEN** system downloads the image (URL or base64), saves to temp directory, and passes the local path to the Agent

#### Scenario: Outbound file via MEDIA directive

- **WHEN** Agent output contains `MEDIA: /path/to/file.pdf`
- **THEN** system detects file type, uploads to WeCom, and sends as the appropriate media message type (image/voice/video/file)

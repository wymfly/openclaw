## ADDED Requirements

### Requirement: Passive reply quota tracking

The system SHALL track the 24-hour passive reply window per conversation (WeCom limit: 30 conversations max within 24 hours), providing forecast status of "ok", "nearLimit", or "exhausted".

#### Scenario: Quota near limit warning

- **WHEN** passive reply count reaches 24 out of 30 conversations in the 24-hour window
- **THEN** system logs a "nearLimit" warning and includes quota status in `openclaw channels status` output

#### Scenario: Quota exhausted blocking

- **WHEN** passive reply count reaches 30 out of 30 conversations
- **THEN** system logs an "exhausted" alert and attempts delivery via Agent API active send instead

### Requirement: Active send quota tracking

The system SHALL track daily active send quota per conversation (WeCom limit: 10 conversations per day), resetting at UTC midnight.

#### Scenario: Daily quota reset

- **WHEN** UTC midnight passes
- **THEN** active send counters for all conversations reset to zero

#### Scenario: Active send quota forecast

- **WHEN** Agent requests proactive message delivery
- **THEN** system checks `forecastActiveSendQuota()` and proceeds only if status is not "exhausted"

### Requirement: Persistent message deduplication

The system SHALL deduplicate inbound messages using both in-memory cache (5-minute TTL) and persistent reqId store (7-day TTL, per-account JSON files), surviving WebSocket reconnections.

#### Scenario: Duplicate rejection after reconnect

- **WHEN** WebSocket reconnects and WeCom server replays a previously processed message
- **THEN** system detects the duplicate via persistent reqId store and skips processing

#### Scenario: ReqId store persistence

- **WHEN** system writes a new reqId entry
- **THEN** entry is written to `~/.openclaw/wecomConfig/reqids-{accountId}.json` with debounced flush (1-second debounce, max 200 entries, 7-day TTL)

### Requirement: Reasoning visibility control

The system SHALL support three modes for displaying LLM reasoning/thinking content: "separate" (thinking as separate collapsed section), "append" (thinking prepended to reply), and "hidden" (thinking stripped from output).

#### Scenario: Separate mode display

- **WHEN** `channels.wecom.enhanced.reasoningMode` is `"separate"` and Agent output contains `<think>...</think>` tags
- **THEN** system sends thinking content as a separate message with title "思考过程" (max 1200 chars, truncated with ellipsis), followed by the visible reply

#### Scenario: Hidden mode stripping

- **WHEN** `channels.wecom.enhanced.reasoningMode` is `"hidden"` and Agent output contains `<think>...</think>` tags
- **THEN** system strips all thinking content and delivers only the visible reply

#### Scenario: Code block protection

- **WHEN** Agent output contains `<think>` tags inside a code block (``` delimiters)
- **THEN** system does NOT treat these as reasoning tags (preserves code block content)

### Requirement: Reliable delivery with retry

The system SHALL maintain a persistent pending reply queue for failed message deliveries, with configurable exponential backoff retry and sweep interval.

#### Scenario: Failed delivery enqueue

- **WHEN** a reply fails to deliver via both WebSocket and Agent API
- **THEN** system enqueues the reply to the pending queue with initial retry timestamp

#### Scenario: Retry sweep

- **WHEN** sweep timer fires (default every 15 seconds)
- **THEN** system retries all due pending replies with exponential backoff, removing entries that succeed or exceed `maxRetries` (default 3)

#### Scenario: Persistence across restart

- **WHEN** gateway restarts
- **THEN** system loads pending replies from persistent JSONL store and resumes sweep timer

# OpenClaw Deck API Reference

Complete API reference for the openclaw-deck dashboard. All endpoints are served
by the Next.js API layer and proxy to the OpenClaw Gateway via RPC or operate on
local SQLite storage.

---

## Table of Contents

- [Authentication](#authentication)
- [Platform Headers](#platform-headers)
- [Error Format](#error-format)
- [Gateway](#gateway)
- [Chat](#chat)
- [Agents](#agents)
- [Models](#models)
- [Sessions](#sessions)
- [Usage](#usage)
- [Budget](#budget)
- [Memory](#memory)
- [Logs](#logs)
- [Activity](#activity)
- [Channels](#channels)
- [Config](#config)
- [Cron](#cron)
- [Webhooks](#webhooks)
- [Approvals](#approvals)
- [Skills](#skills)
- [Alerts](#alerts)
- [Docs (Knowledge Base)](#docs-knowledge-base)
- [Settings](#settings)
- [Stream (SSE)](#stream-sse)
- [Onboarding](#onboarding)
- [Platform Integration](#platform-integration)

---

## Authentication

All endpoints (except `/api/stream` and `/api/onboarding/status`) are wrapped
with `withAuth`, which performs two checks:

1. **Access-gate validation** -- reads `Authorization` (Bearer) or `X-Deck-Token`
   headers and validates against the SQLite settings table. When no token is
   configured (initial onboarding), all requests are allowed.
2. **Rate limiting** -- per-IP sliding window. Returns `429` with `Retry-After`,
   `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers when exceeded.

Failure responses:

| Status | Body                               | Meaning                  |
| ------ | ---------------------------------- | ------------------------ |
| 401    | `{ "error": "Unauthorized" }`      | Missing or invalid token |
| 429    | `{ "error": "Too many requests" }` | Rate limit exceeded      |

## Platform Headers

The dashboard recognizes two optional platform headers for multi-tenant tracing.
These headers are **not** injected into Gateway RPC params (Gateway schemas use
`additionalProperties: false`); they are used for Deck-layer logging only.

| Header        | Type   | Description                        |
| ------------- | ------ | ---------------------------------- |
| `X-Tenant-Id` | string | Tenant identifier (platform layer) |
| `X-User-Id`   | string | User identifier (platform layer)   |

## Error Format

All error responses follow a consistent shape:

```json
{
  "error": "Human-readable message",
  "code": "OPTIONAL_ERROR_CODE"
}
```

- `code` is present only for Gateway RPC errors (`ControlPlaneGatewayError`).
- In production (`NODE_ENV=production`), internal error details are suppressed.

Common status codes:

| Status | Meaning                                      |
| ------ | -------------------------------------------- |
| 400    | Bad request / validation error               |
| 401    | Authentication failed                        |
| 404    | Resource not found                           |
| 429    | Rate limit exceeded                          |
| 500    | Internal server error                        |
| 502    | Gateway RPC error                            |
| 503    | Gateway not configured / runtime unavailable |

---

## Gateway

### GET /api/gateway/health

**Description:** Gateway health check.

**Gateway RPC:** `health` `{}`

**Response:**

```json
{
  "sessions": { ... },
  "channels": { ... },
  "auth": { ... }
}
```

---

### GET /api/gateway/status

**Description:** Gateway status summary including session count, channels, and heartbeat info.

**Gateway RPC:** `status` `{}`

**Response:**

```json
{
  "sessionCount": 5,
  "channels": { ... },
  "heartbeat": { ... }
}
```

---

## Chat

### POST /api/chat/send

**Description:** Send a chat message through the Gateway.

**Gateway RPC:** `chat.send` `{ sessionKey, message, thinking?, idempotencyKey }`

**Request body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | yes | Message text |
| `sessionKey` | string | yes | Target session key |
| `thinking` | string | no | Thinking mode hint |
| `idempotencyKey` | string | no | Dedup key (auto-generated UUID if omitted) |

**Response:** Gateway chat.send result (proxied).

**Errors:**

- `400` -- `message` or `sessionKey` missing/empty

---

### GET /api/chat/history

**Description:** Fetch chat message history for a session.

**Gateway RPC:** `chat.history` `{ sessionKey, limit? }`

**Query params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionKey` | string | yes | Session to fetch history for |
| `limit` | number | no | Max messages to return |

**Response:** Gateway chat.history result (proxied).

**Errors:**

- `400` -- `sessionKey` missing

---

### POST /api/chat/abort

**Description:** Abort an in-progress chat response.

**Gateway RPC:** `chat.abort` `{ sessionKey, runId? }`

**Request body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionKey` | string | yes | Session key |
| `runId` | string | no | Specific run to abort |

**Response:** Gateway chat.abort result (proxied).

**Errors:**

- `400` -- `sessionKey` missing/empty

---

### GET /api/chat/sessions

**Description:** List all chat sessions.

**Gateway RPC:** `sessions.list` `{ agentId?, includeDerivedTitles: true, includeLastMessage: true, limit: 50 }`

**Query params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | string | no | Filter sessions by agent |

**Response:** Gateway sessions.list result (proxied).

---

### DELETE /api/chat/sessions

**Description:** Delete a session by key.

**Gateway RPC:** `sessions.delete` `{ key }`

**Request body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionKey` | string | yes | Session key to delete |

**Response:** Gateway sessions.delete result (proxied).

**Errors:**

- `400` -- `sessionKey` missing

---

## Agents

### GET /api/agents

**Description:** List all agents.

**Gateway RPC:** `agents.list` `{}`

**Response:**

```json
{
  "agents": [
    { "id": "...", "name": "...", "workspace": "...", ... }
  ]
}
```

---

### POST /api/agents

**Description:** Create a new agent.

**Gateway RPC:** `agents.create` `{ name, workspace, emoji?, avatar? }`

**Request body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Agent display name |
| `workspace` | string | yes | Workspace directory path |
| `emoji` | string | no | Agent emoji icon |
| `avatar` | string | no | Agent avatar URL |

**Response:** Gateway agents.create result (proxied).

**Errors:**

- `400` -- `name` or `workspace` missing/empty

---

### DELETE /api/agents

**Description:** Delete an agent by ID.

**Gateway RPC:** `agents.delete` `{ agentId }`

**Query params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | string | yes | Agent ID to delete |

**Response:** Gateway agents.delete result (proxied).

**Errors:**

- `400` -- `agentId` missing

---

### GET /api/agents/:agentId

**Description:** Get agent details. Fetches all agents via `agents.list` and filters by ID.

**Gateway RPC:** `agents.list` `{}` (filtered client-side)

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `agentId` | string | Agent ID |

**Response:** Single agent object.

**Errors:**

- `404` -- Agent not found

---

### PATCH /api/agents/:agentId

**Description:** Update agent configuration.

**Gateway RPC:** `agents.update` `{ agentId, name?, workspace?, model?, avatar? }`

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `agentId` | string | Agent ID |

**Request body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | no | Updated name |
| `workspace` | string | no | Updated workspace path |
| `model` | string | no | Updated model name |
| `avatar` | string | no | Updated avatar URL |

**Response:** Gateway agents.update result (proxied).

---

### GET /api/agents/:agentId/files

**Description:** List agent files.

**Gateway RPC:** `agents.files.list` `{ agentId }`

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `agentId` | string | Agent ID |

**Response:** Gateway agents.files.list result (proxied).

---

### POST /api/agents/:agentId/files

**Description:** Write a file to the agent workspace.

**Gateway RPC:** `agents.files.set` `{ agentId, name, content }`

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `agentId` | string | Agent ID |

**Request body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | File name/path |
| `content` | string | yes | File content |

**Response:** Gateway agents.files.set result (proxied).

**Errors:**

- `400` -- `name` or `content` missing

---

### GET /api/agents/:agentId/files/\*path

**Description:** Read a single agent file by path.

**Gateway RPC:** `agents.files.get` `{ agentId, name }`

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `agentId` | string | Agent ID |
| `*path` | string[] | File path segments (joined with `/`) |

**Response:** Gateway agents.files.get result (proxied).

---

## Models

### GET /api/models

**Description:** List available models from all providers.

**Gateway RPC:** `models.list` `{}`

**Response:** Gateway models.list result (proxied).

---

### GET /api/models/config

**Description:** Read provider configuration (API keys, base URLs).

**Gateway RPC:** `config.get` `{}`

**Response:**

```json
{
  "raw": "...",
  "hash": "abc123"
}
```

---

### PATCH /api/models/config

**Description:** Update provider configuration.

**Gateway RPC:** `config.patch` `{ raw, baseHash?, note? }`

**Request body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `raw` | string | yes | Raw config content |
| `baseHash` | string | no | Optimistic concurrency hash |
| `note` | string | no | Change note |

**Response:** Gateway config.patch result (proxied).

**Errors:**

- `400` -- `raw` missing or invalid body

---

## Sessions

### GET /api/sessions

**Description:** List all sessions.

**Gateway RPC:** `sessions.list` `{}`

**Response:** Gateway sessions.list result (proxied).

---

### GET /api/sessions/:sessionKey

**Description:** Fetch conversation history for a session.

**Gateway RPC:** `chat.history` `{ sessionKey }`

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `sessionKey` | string | Session key |

**Response:** Gateway chat.history result (proxied).

---

### DELETE /api/sessions/:sessionKey

**Description:** Delete a session.

**Gateway RPC:** `sessions.delete` `{ key }`

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `sessionKey` | string | Session key to delete |

**Response:** Gateway sessions.delete result (proxied).

---

## Usage

### GET /api/usage

**Description:** Fetch provider usage summary.

**Gateway RPC:** `usage.status` `{}`

**Response:** Gateway usage.status result (proxied).

---

### GET /api/usage/cost

**Description:** Fetch usage cost breakdown.

**Gateway RPC:** `usage.cost` `{ days }`

**Query params:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `days` | number | no | 1 | Number of days to aggregate |

**Response:** Gateway usage.cost result (proxied).

---

### GET /api/usage/timeseries

**Description:** Fetch usage timeseries data.

**Gateway RPC:** `sessions.usage.timeseries` `{ days }`

**Query params:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `days` | number | no | 1 | Number of days for timeseries |

**Response:** Gateway sessions.usage.timeseries result (proxied).

---

## Budget

### GET /api/usage/budget

**Description:** List all budget rules.

**Storage:** Local SQLite (`budget_rules` table).

**Response:**

```json
{
  "rules": [
    {
      "id": "uuid",
      "name": "Monthly cost cap",
      "scope": "global",
      "agentId": null,
      "taskId": null,
      "dimension": "cost",
      "warnThreshold": 50,
      "overThreshold": 100,
      "period": "monthly",
      "enabled": true,
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

### POST /api/usage/budget

**Description:** Create a new budget rule.

**Storage:** Local SQLite (`budget_rules` table).

**Request body:**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | yes | -- | Rule display name |
| `dimension` | string | yes | -- | One of: `tokensIn`, `tokensOut`, `totalTokens`, `cost` |
| `scope` | string | no | `"global"` | Scope: `global`, `agent`, `task` |
| `agentId` | string | no | null | Agent ID (when scope is `agent`) |
| `taskId` | string | no | null | Task ID (when scope is `task`) |
| `warnThreshold` | number | no | null | Warning threshold value |
| `overThreshold` | number | no | null | Over-budget threshold value |
| `period` | string | no | `"monthly"` | One of: `daily`, `weekly`, `monthly` |
| `enabled` | boolean | no | true | Whether rule is active |

**Response:** `201` -- Created rule object.

**Errors:**

- `400` -- `name` or `dimension` missing, invalid dimension/period

---

### PATCH /api/usage/budget/:ruleId

**Description:** Update a budget rule.

**Storage:** Local SQLite (`budget_rules` table).

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `ruleId` | string | Budget rule ID |

**Request body:** Any subset of `name`, `scope`, `agentId`, `taskId`, `dimension`, `warnThreshold`, `overThreshold`, `period`, `enabled`.

**Response:** Updated rule object.

**Errors:**

- `400` -- No fields to update, invalid dimension/period
- `404` -- Rule not found

---

### DELETE /api/usage/budget/:ruleId

**Description:** Delete a budget rule.

**Storage:** Local SQLite (`budget_rules` table).

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `ruleId` | string | Budget rule ID |

**Response:** `{ "deleted": true }`

**Errors:**

- `404` -- Rule not found

---

### GET /api/usage/budget/evaluate

**Description:** Evaluate all enabled budget rules against current usage. Fetches live usage from Gateway (`usage.cost`), evaluates each rule, and broadcasts `budget.warn` / `budget.over` events via EventBus.

**Storage:** Local SQLite (`budget_rules` table) + Gateway RPC (`usage.cost`).

**Response:**

```json
{
  "evaluations": [
    {
      "ruleId": "uuid",
      "ruleName": "Monthly cost cap",
      "dimension": "cost",
      "status": "ok | warn | over",
      "currentValue": 42.5,
      "warnThreshold": 50,
      "overThreshold": 100,
      "percent": 42.5
    }
  ]
}
```

**Errors:**

- `502` -- Failed to fetch usage data from Gateway

---

## Memory

### GET /api/memory/browse

**Description:** Browse memory files for an agent. Supports listing directories and reading file content.

**Storage:** Direct filesystem access (resolves path via Gateway RPC or conventional `~/.openclaw/agents/{agentId}`).

**Query params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | string | yes | Agent whose memory to browse |
| `path` | string | no | Sub-path within the memory directory |
| `read` | string | no | Set to `"1"` to read file content instead of listing |

**Response (directory listing):**

```json
{
  "files": [
    { "name": "notes", "path": "notes", "type": "directory" },
    { "name": "config.json", "path": "config.json", "type": "file", "size": 1024 }
  ]
}
```

**Response (file read):**

```json
{
  "content": "file contents here",
  "path": "notes/todo.md"
}
```

**Security:**

- `agentId` must be alphanumeric, hyphens, or underscores only
- Path traversal protection with `realpath()` symlink resolution
- Hidden files (`.` prefix) are excluded from listings

**Errors:**

- `400` -- `agentId` missing, invalid agentId format, invalid path
- `403` -- Path traversal detected
- `503` -- Could not resolve memory path

---

### GET /api/memory/health

**Description:** Memory system health diagnostics.

**Gateway RPC:** `doctor.memory.status` `{}` (falls back to empty result for older gateways).

**Response:**

```json
{
  "entries": [
    {
      "agentId": "...",
      "provider": "lancedb",
      "embeddingStatus": "ok | error | unknown",
      "error": "optional error message"
    }
  ],
  "lanceDbEnabled": true
}
```

---

### GET /api/memory/search

**Description:** Vector search over memory. Currently returns 501 (requires LanceDB extension).

**Query params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `q` | string | yes | Search query |
| `agentId` | string | no | Scope search to an agent |

**Response:** `501` -- Not implemented (requires LanceDB extension).

**Errors:**

- `400` -- `q` missing/empty

---

## Logs

### GET /api/logs

**Description:** Tail gateway log lines.

**Gateway RPC:** `logs.tail` `{ cursor?, limit? }`

**Query params:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `cursor` | number | no | -- | Resume from cursor position |
| `limit` | number | no | 500 | Max lines to return (max 5000) |

**Response:**

```json
{
  "file": "/path/to/log",
  "cursor": 12345,
  "size": 67890,
  "lines": ["line1", "line2"],
  "truncated": false,
  "reset": false
}
```

**Note:** `logs.tail` does not support level/source/session filters. Client-side filtering is done in the `useLogPolling` hook.

---

## Activity

### GET /api/activity

**Description:** Recent activity events from the projection store outbox.

**Storage:** Local projection store (outbox events).

**Query params:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `limit` | number | no | 100 | Max events to return (max 500) |
| `since` | number | no | 0 | Outbox ID to read events after |

**Response:**

```json
{
  "events": [
    {
      "id": "evt-123",
      "timestamp": 1710000000000,
      "type": "system",
      "agentId": "agent-1",
      "agentName": "My Agent",
      "description": "Agent started new session",
      "details": "optional extra info"
    }
  ]
}
```

---

## Channels

### GET /api/channels

**Description:** List all channels and their status.

**Gateway RPC:** `channels.status` `{ probe: false }`

**Response:**

```json
{
  "ts": 1710000000,
  "channelOrder": ["telegram", "discord", "slack"],
  "channelLabels": { "telegram": "Telegram", ... },
  "channels": { "telegram": { "status": "connected", ... }, ... },
  "channelAccounts": { ... },
  "channelDefaultAccountId": { ... }
}
```

---

### PATCH /api/channels/:channelId

**Description:** Update channel configuration. Reads current config, merges changes into the `channels` section, and writes back via `config.patch`.

**Gateway RPC:** `config.get` then `config.patch` `{ raw, baseHash? }`

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `channelId` | string | Channel identifier |

**Request body:** Arbitrary key-value pairs to merge into the channel config.

**Response:** Gateway config.patch result (proxied).

---

### POST /api/channels/:channelId/logout

**Description:** Disconnect/logout a channel.

**Gateway RPC:** `channels.logout` `{ channel }`

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `channelId` | string | Channel identifier |

**Response:** Gateway channels.logout result (proxied).

---

## Config

### GET /api/config

**Description:** Read current gateway configuration.

**Gateway RPC:** `config.get` `{}`

**Response:**

```json
{
  "config": { ... },
  "baseHash": "abc123",
  "valid": true,
  "exists": true
}
```

---

### GET /api/config/schema

**Description:** Get the JSON Schema for openclaw configuration.

**Gateway RPC:** `config.schema` `{}`

**Response:** JSON Schema object.

---

### POST /api/config/apply

**Description:** Apply configuration changes. Supports optimistic concurrency via `baseHash`.

**Gateway RPC:** `config.apply` `{ raw, baseHash? }`

**Request body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `raw` | string | yes | Raw config content (JSON string) |
| `baseHash` | string | no | Hash for conflict detection |

**Response:**

```json
{
  "ok": true,
  "path": "/path/to/config",
  "config": { ... },
  "restart": false,
  "sentinel": "..."
}
```

**Errors:**

- `400` -- `raw` missing
- `502` -- Gateway error (includes conflict: "config changed")

---

## Cron

### GET /api/cron

**Description:** List cron jobs with optional filtering and sorting.

**Gateway RPC:** `cron.list` `{ includeDisabled?, limit?, offset?, query?, enabled?, sortBy?, sortDir? }`

**Query params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `limit` | number | no | Page size |
| `offset` | number | no | Offset for pagination |
| `query` | string | no | Search query |
| `enabled` | string | no | Filter by enabled status |
| `sortBy` | string | no | Sort field |
| `sortDir` | string | no | Sort direction (`asc` / `desc`) |
| `includeDisabled` | boolean | no | Include disabled jobs |

**Response:** Gateway cron.list result (proxied).

---

### POST /api/cron

**Description:** Create a new cron job.

**Gateway RPC:** `cron.add` `{ name, schedule, sessionTarget, wakeMode, payload, ... }`

**Request body:** Full cron job definition (forwarded directly to Gateway).

**Response:** Gateway cron.add result (proxied).

---

### GET /api/cron/status

**Description:** Fetch cron service status.

**Gateway RPC:** `cron.status` `{}`

**Response:** Gateway cron.status result (proxied).

---

### PATCH /api/cron/:jobId

**Description:** Update a cron job.

**Gateway RPC:** `cron.update` `{ id, patch }`

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `jobId` | string | Cron job ID |

**Request body:** Patch object (forwarded as `patch` field to Gateway).

**Response:** Gateway cron.update result (proxied).

---

### DELETE /api/cron/:jobId

**Description:** Remove a cron job.

**Gateway RPC:** `cron.remove` `{ id }`

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `jobId` | string | Cron job ID |

**Response:** Gateway cron.remove result (proxied).

---

### POST /api/cron/:jobId/run

**Description:** Manually trigger a cron job.

**Gateway RPC:** `cron.run` `{ id, mode? }`

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `jobId` | string | Cron job ID |

**Request body (optional):**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mode` | string | no | `"force"` (default) or `"due"` |

**Response:** Gateway cron.run result (proxied).

---

### GET /api/cron/:jobId/runs

**Description:** Fetch run history for a cron job.

**Gateway RPC:** `cron.runs` `{ scope: "job", jobId, limit?, offset?, statuses?, sortDir? }`

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `jobId` | string | Cron job ID |

**Query params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `limit` | number | no | Page size |
| `offset` | number | no | Offset for pagination |
| `sortDir` | string | no | Sort direction (`asc` / `desc`) |
| `statuses` | string | no | Comma-separated status filter |

**Response:** Gateway cron.runs result (proxied).

---

## Webhooks

### GET /api/webhooks

**Description:** List all webhooks.

**Storage:** Local SQLite (`webhooks` table).

**Response:**

```json
{
  "webhooks": [
    {
      "id": "uuid",
      "name": "My Webhook",
      "url": "https://example.com/hook",
      "secret": "optional-secret",
      "events": ["chat.message", "session.created"],
      "enabled": true,
      "consecutiveFailures": 0,
      "lastFiredAt": "2026-01-01T00:00:00Z",
      "lastStatus": 200,
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

### POST /api/webhooks

**Description:** Create a new webhook.

**Storage:** Local SQLite (`webhooks` table).

**Request body:**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | yes | -- | Webhook display name |
| `url` | string | yes | -- | Delivery URL (validated) |
| `secret` | string | no | null | HMAC signing secret |
| `events` | string[] | no | `[]` | Event types to subscribe to |
| `enabled` | boolean | no | true | Whether webhook is active |

**Response:** `201` -- Created webhook object.

**Errors:**

- `400` -- `name` or `url` missing, invalid URL

---

### PATCH /api/webhooks/:webhookId

**Description:** Update a webhook.

**Storage:** Local SQLite (`webhooks` table).

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `webhookId` | string | Webhook ID |

**Request body:** Any subset of `name`, `url`, `secret` (null to clear), `events`, `enabled`.

**Response:** Updated webhook object.

**Errors:**

- `400` -- No fields to update, invalid URL
- `404` -- Webhook not found

---

### DELETE /api/webhooks/:webhookId

**Description:** Delete a webhook.

**Storage:** Local SQLite (`webhooks` table).

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `webhookId` | string | Webhook ID |

**Response:** `{ "deleted": true }`

**Errors:**

- `404` -- Webhook not found

---

### GET /api/webhooks/:webhookId/deliveries

**Description:** List delivery history for a webhook (up to 100 most recent).

**Storage:** Local SQLite (`webhook_deliveries` table).

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `webhookId` | string | Webhook ID |

**Response:**

```json
{
  "deliveries": [
    {
      "id": "uuid",
      "webhookId": "uuid",
      "eventType": "chat.message",
      "statusCode": 200,
      "error": null,
      "durationMs": 150,
      "success": true,
      "isRetry": false,
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

### POST /api/webhooks/:webhookId/test

**Description:** Send a test delivery (`test.ping` event) to a webhook.

**Storage:** Local SQLite + HTTP delivery via `deliverWebhook()`.

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `webhookId` | string | Webhook ID |

**Response:**

```json
{
  "success": true,
  "statusCode": 200,
  "durationMs": 120,
  "error": null,
  "deliveryId": "uuid"
}
```

**Errors:**

- `404` -- Webhook not found

---

## Approvals

### GET /api/approvals

**Description:** Fetch approval file snapshot.

**Gateway RPC:** `exec.approvals.get` `{}`

**Response:**

```json
{
  "path": "/path/to/approvals",
  "exists": true,
  "hash": "abc123",
  "file": { ... }
}
```

---

### POST /api/approvals

**Description:** Resolve a pending approval.

**Gateway RPC:** `exec.approval.resolve` `{ id, decision }`

**Request body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Approval request ID |
| `decision` | string | yes | Decision: `"approve"` or `"deny"` |

**Response:** `{ "ok": true }`

---

### GET /api/approvals/pending

**Description:** Return current pending approvals from in-memory map. Enables refresh recovery -- client calls on mount, then SSE keeps the list updated in real time.

**Storage:** In-memory approval bridge.

**Response:**

```json
{
  "pending": [
    {
      "id": "approval-123",
      "type": "tool_execution",
      "agentId": "agent-1",
      "description": "Run shell command: ls -la",
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

### GET /api/approvals/policy

**Description:** Read approval policy.

**Gateway RPC:** `exec.approvals.get` `{}`

**Response:** Same as `GET /api/approvals`.

---

### PUT /api/approvals/policy

**Description:** Update approval policy.

**Gateway RPC:** `exec.approvals.set` `{ file, baseHash? }`

**Request body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | object | yes | Approval policy file content |
| `baseHash` | string | no | Optimistic concurrency hash |

**Response:** Updated approval snapshot.

---

## Skills

### GET /api/skills

**Description:** Fetch skill status from the Gateway.

**Gateway RPC:** `skills.status` `{ agentId? }`

**Query params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | string | no | Scope to a specific agent |

**Response:** Gateway skills.status result (proxied).

---

### PATCH /api/skills/:skillKey

**Description:** Update a skill's configuration (enable/disable, set API key, env vars).

**Gateway RPC:** `skills.update` `{ skillKey, enabled?, apiKey?, env? }`

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `skillKey` | string | Skill identifier |

**Request body:** Forwarded to Gateway (merged with `skillKey`).
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `enabled` | boolean | no | Enable/disable skill |
| `apiKey` | string | no | Skill API key (empty to delete) |
| `env` | object | no | Environment variables (empty to delete) |

**Response:** Gateway skills.update result (proxied).

---

### POST /api/skills/install

**Description:** Install a skill.

**Gateway RPC:** `skills.install` `{ name, installId, timeoutMs? }`

**Request body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Skill package name |
| `installId` | string | yes | Client-generated install ID (`crypto.randomUUID()`) |
| `timeoutMs` | number | no | Install timeout in milliseconds |

**Response:** Gateway skills.install result (proxied).

---

## Alerts

### GET /api/alerts

**Description:** List all alert rules.

**Storage:** Local SQLite (`alert_rules` table).

**Response:**

```json
{
  "rules": [
    {
      "id": "ar-1710000000-abc123",
      "name": "High token usage",
      "entityType": "agent",
      "condition": "gt",
      "threshold": 10000,
      "action": "toast",
      "cooldownMs": 300000,
      "lastFiredAt": null,
      "enabled": true,
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

### POST /api/alerts

**Description:** Create a new alert rule.

**Storage:** Local SQLite (`alert_rules` table).

**Request body:**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | yes | -- | Rule display name |
| `entityType` | string | yes | -- | Entity type to monitor |
| `condition` | string | yes | -- | Condition operator (e.g. `gt`, `lt`, `eq`) |
| `threshold` | number | yes | -- | Threshold value |
| `action` | string | no | `"toast"` | Action on trigger |
| `cooldownMs` | number | no | 300000 | Cooldown between alerts (ms) |
| `enabled` | boolean | no | true | Whether rule is active |

**Response:** `201` -- `{ "rule": { ... } }`

**Errors:**

- `400` -- Missing required fields

---

### PATCH /api/alerts/:ruleId

**Description:** Update an alert rule.

**Storage:** Local SQLite (`alert_rules` table).

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `ruleId` | string | Alert rule ID |

**Request body:** Any subset of `name`, `entityType`, `condition`, `threshold`, `action`, `cooldownMs`, `enabled`.

**Response:** `{ "rule": { ... } }`

**Errors:**

- `400` -- No fields to update
- `404` -- Rule not found

---

### DELETE /api/alerts/:ruleId

**Description:** Delete an alert rule.

**Storage:** Local SQLite (`alert_rules` table).

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `ruleId` | string | Alert rule ID |

**Response:** `{ "ok": true }`

**Errors:**

- `404` -- Rule not found

---

## Docs (Knowledge Base)

### GET /api/docs

**Description:** List documents with optional category filter and full-text search.

**Storage:** Local SQLite (`docs` table).

**Query params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `category` | string | no | Filter by category |
| `q` | string | no | Search in title, content, and keywords |

**Response:**

```json
{
  "docs": [
    {
      "id": "doc-1710000000-abc123",
      "title": "Deployment Guide",
      "category": "operations",
      "content": "...",
      "sourceSession": "session-key",
      "sourceAgent": null,
      "keywords": ["deploy", "production"],
      "language": "en",
      "extractedAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

### GET /api/docs/:docId

**Description:** Fetch a single document by ID.

**Storage:** Local SQLite (`docs` table).

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `docId` | string | Document ID |

**Response:** Single document object (same shape as list items).

**Errors:**

- `404` -- Document not found

---

### DELETE /api/docs/:docId

**Description:** Delete a document.

**Storage:** Local SQLite (`docs` table).

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `docId` | string | Document ID |

**Response:** `{ "ok": true }`

**Errors:**

- `404` -- Document not found

---

### POST /api/docs/extract

**Description:** Extract documents from conversation history. Reads messages via Gateway RPC, runs extraction logic, and inserts results into SQLite.

**Storage:** Local SQLite (`docs` table) + Gateway RPC (`chat.history`).

**Request body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionKey` | string | no | Session to extract docs from (all if omitted) |

**Response:**

```json
{
  "extracted": 3,
  "docs": [
    { "id": "doc-...", "title": "...", "category": "...", "content": "...", "keywords": [...], "language": "en" }
  ]
}
```

**Errors:**

- `502` -- Failed to fetch conversation history

---

## Settings

### GET /api/settings

**Description:** Read dashboard settings. Token value is masked (`***`) in the response.

**Storage:** Local SQLite (projection store settings).

**Response:**

```json
{
  "gatewayUrl": "ws://localhost:18789",
  "gatewayToken": "***",
  "notificationPrefs": {
    "approvals": true,
    "budget": true,
    "alerts": true
  }
}
```

---

### PATCH /api/settings

**Description:** Update dashboard settings.

**Storage:** Local SQLite (projection store settings).

**Request body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `gatewayUrl` | string | no | Gateway WebSocket URL |
| `gatewayToken` | string | no | Gateway auth token (masked placeholder is ignored) |
| `notificationPrefs` | object | no | `{ approvals, budget, alerts }` booleans |

**Response:** `{ "ok": true }`

---

### GET /api/settings/version

**Description:** Return version info for deck, gateway, and CLI.

**Storage:** `package.json` (deck version) + runtime adapter status.

**Response:**

```json
{
  "deck": "0.1.0",
  "gateway": "connected",
  "cli": "connected"
}
```

---

### POST /api/settings/test-connection

**Description:** Test WebSocket connectivity to a gateway URL.

**Request body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | yes | Gateway URL (ws:// or wss://) |
| `token` | string | no | Auth token (used in Bearer header) |

**Response:** `{ "ok": true }` or `{ "ok": false, "error": "..." }`

---

## Stream (SSE)

### GET /api/stream

**Description:** Server-Sent Events stream for real-time updates. Supports event replay via `Last-Event-ID` header. Sends heartbeats every 15 seconds.

**Authentication:** No auth required (used by onboarding flow too).

**Headers:**
| Header | Type | Description |
|--------|------|-------------|
| `Last-Event-ID` | number | Resume from a specific event ID |

**Response:** `text/event-stream`

**SSE event format:**

```
id: 42
event: chat.message
data: {"sessionKey":"...","message":"..."}

```

**Limits:**

- Maximum 50 concurrent SSE connections
- Returns `503` with `Retry-After: 5` header when exceeded

**Event types:** All events broadcast via the server EventBus, including:

- `chat.message` -- New chat messages
- `approval.request` / `approval.resolved` -- Approval lifecycle
- `budget.warn` / `budget.over` -- Budget threshold alerts
- `activity.event` -- Activity feed events

---

## Onboarding

### GET /api/onboarding/status

**Description:** Check whether onboarding is needed. Returns `true` when gateway URL or token settings are absent.

**Authentication:** No auth required.

**Storage:** Local SQLite (projection store settings).

**Response:**

```json
{ "needsOnboarding": true }
```

---

### POST /api/onboarding/save-settings

**Description:** Persist onboarding configuration. Saves gateway URL/token and optional provider fields, then triggers runtime re-initialization.

**Storage:** Local SQLite (projection store settings).

**Request body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `gatewayUrl` | string | yes | Gateway WebSocket URL |
| `gatewayToken` | string | yes | Gateway auth token |
| `providerName` | string | no | Default provider name |
| `apiKey` | string | no | Provider API key |
| `model` | string | no | Default model name |

**Response:** `{ "success": true }`

**Errors:**

- `400` -- `gatewayUrl` or `gatewayToken` missing

---

### POST /api/onboarding/test-connection

**Description:** Test gateway WebSocket connectivity during onboarding. Opens a temporary WebSocket, waits for connection, then closes.

**Authentication:** No auth required.

**SSRF protection:**

- Only `ws://` and `wss://` protocols allowed
- Private/reserved IP ranges blocked (except `localhost` / `127.0.0.1` for local Gateway)
- Timeout: 6 seconds

**Request body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | yes | Gateway WebSocket URL |
| `token` | string | yes | Gateway auth token |

**Response:** `{ "success": true }` or `{ "success": false, "error": "..." }`

**Errors:**

- `400` -- Missing fields, invalid URL, non-WS protocol, private network address

---

## Platform Integration

The openclaw-deck API layer is designed for three integration modes with
enterprise platforms (claw-platform or custom deployments).

### Mode 1: Reverse Proxy

The simplest integration. Deploy openclaw-deck as a standalone service and route
traffic through an enterprise reverse proxy (nginx, Envoy, Kong, etc.).

```
Client -> Enterprise Proxy -> openclaw-deck -> Gateway
                 |
         (inject X-Tenant-Id, X-User-Id headers)
         (enforce enterprise SSO / OAuth)
```

**Setup:**

1. Deploy openclaw-deck with `DECK_AUTH_TOKEN` configured
2. Configure proxy to inject `X-Tenant-Id` and `X-User-Id` headers after SSO validation
3. Forward the `Authorization: Bearer <DECK_AUTH_TOKEN>` or `X-Deck-Token` header

**Advantages:** Zero code changes, works with any auth provider.

### Mode 2: Module Import

Import openclaw-deck's API route handlers directly into a larger Next.js application.

```typescript
// In your platform's Next.js app:
// app/api/deck/[...path]/route.ts
export { GET, POST, PATCH, DELETE } from "openclaw-deck/api";
```

**Setup:**

1. Add `openclaw-deck` as a dependency
2. Mount the API routes under a sub-path (e.g. `/api/deck/...`)
3. Wrap with your own auth middleware that sets platform headers

**Advantages:** Single deployment, shared auth layer, TypeScript type safety.

### Mode 3: Middleware Injection

Extend openclaw-deck's runtime with custom middleware for enterprise concerns
(audit logging, RBAC, tenant isolation).

```typescript
// server/middleware/enterprise.ts
import { withAuth } from "openclaw-deck/lib/with-auth";

export function withEnterprise(handler) {
  return withAuth(async (req, ...args) => {
    // 1. Extract tenant context
    const tenantId = req.headers.get("x-tenant-id");

    // 2. Enforce RBAC
    const user = await validateEnterpriseUser(req);
    if (!user.hasPermission("deck:read")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. Audit log
    await auditLog({ tenantId, userId: user.id, action: req.method, path: req.url });

    return handler(req, ...args);
  });
}
```

**Advantages:** Full control over auth/authz, audit trail, tenant isolation.

### Endpoint Summary by Storage Backend

| Backend          | Endpoints                                                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gateway RPC**  | gateway/_, chat/_, agents/_, models/_, sessions/_, usage (status/cost/timeseries), logs/_, channels/_, config/_, cron/_, approvals (get/resolve/policy), skills/_ |
| **Local SQLite** | webhooks/_, usage/budget/_, alerts/_, docs/_, settings/\*, onboarding/save-settings                                                                               |
| **In-Memory**    | approvals/pending, activity/\*, stream                                                                                                                            |
| **Filesystem**   | memory/browse                                                                                                                                                     |

### Endpoint Count by Domain

| Domain     | Count  |
| ---------- | ------ |
| Gateway    | 2      |
| Chat       | 5      |
| Agents     | 7      |
| Models     | 3      |
| Sessions   | 3      |
| Usage      | 3      |
| Budget     | 4      |
| Memory     | 3      |
| Logs       | 1      |
| Activity   | 1      |
| Channels   | 3      |
| Config     | 3      |
| Cron       | 6      |
| Webhooks   | 5      |
| Approvals  | 4      |
| Skills     | 3      |
| Alerts     | 3      |
| Docs       | 4      |
| Settings   | 3      |
| Stream     | 1      |
| Onboarding | 3      |
| **Total**  | **70** |

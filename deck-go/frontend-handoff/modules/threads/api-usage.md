# API Usage

## Frontend Wrapper

Use only the existing wrapper from `frontend-new/src/api.ts`:

| Wrapper                | Endpoint            | Gateway method / source                |
| ---------------------- | ------------------- | -------------------------------------- |
| `fetchThreads(params)` | `GET /deck/threads` | Go BFF forwards to `deck.threads.list` |

Browser code must not call Gateway RPC directly.

## DTOs

The production UI and mocks should remain shaped by:

- `DeckThreadsListParams`
- `DeckThreadsListResult`
- `DeckGoThreadEntry`
- `DeckGoThreadsResponse`

Required thread entry fields:

- `threadId`
- `channelId`
- `agentId`
- `targetSessionKey`
- `targetKind`
- `boundAt`
- `lastActivityAt`
- `accountId`
- `boundBy`

Optional thread entry fields:

- `label`

## Query Parameters

| Parameter | Source      | Notes                             |
| --------- | ----------- | --------------------------------- |
| `agentId` | text filter | trim before send; omit when empty |
| `channel` | text filter | trim before send; omit when empty |
| `status`  | select      | contract enum: `active` or `all`  |

## Mock Fixture Requirements

The mock Gateway should include `deck.threads.list` with at least:

- three contract-shaped thread bindings
- multiple agents
- multiple channels, including `discord`
- long identifiers to validate wrapping/truncation
- optional `label` on some rows and no label on at least one row
- deterministic filtering for `agentId`, `channel`, and `status`

## Drift Handling

Fix deterministic mock/API drift when the contract shape is clear. Do not infer
real non-Discord thread support, archived status semantics, or label lifecycle
from mock data alone.

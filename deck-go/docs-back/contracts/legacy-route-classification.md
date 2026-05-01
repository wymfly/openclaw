# Legacy Route Classification

This document classifies the legacy Next API surface by migration type.

## Classification types

- `gateway-passthrough`
  - the route mostly validates input then proxies to Gateway
- `normalized-facade`
  - the route reshapes or aggregates Gateway and local runtime semantics
- `local-control-plane`
  - the route is primarily serving local Deck runtime/state behavior
- `deferred`
  - not needed for the first cutover-critical migration slice

## Initial cutover-critical classification

| Legacy route/group                 | Type                  | Notes                                                           |
| ---------------------------------- | --------------------- | --------------------------------------------------------------- |
| `/api/gateway/describe`            | `gateway-passthrough` | direct capability bootstrap surface                             |
| `/api/gateway/health`              | `gateway-passthrough` | health probe façade                                             |
| `/api/gateway/status`              | `gateway-passthrough` | currently uses generic gateway request path                     |
| `/api/config`                      | `gateway-passthrough` | direct `config.get`                                             |
| `/api/config/schema-lookup`        | `gateway-passthrough` | direct `config.schema.lookup`                                   |
| `/api/config/patch`                | `gateway-passthrough` | direct `config.patch` with body shaping                         |
| `/api/config/apply`                | `gateway-passthrough` | direct `config.apply`                                           |
| `/api/channels`                    | `gateway-passthrough` | direct `channels.status`                                        |
| `/api/channels/[channelId]`        | `normalized-facade`   | reads config then applies channel subtree patch                 |
| `/api/channels/[channelId]/logout` | `gateway-passthrough` | direct `channels.logout`                                        |
| `/api/sessions`                    | `gateway-passthrough` | direct `sessions.list`                                          |
| `/api/chat/sessions/create`        | `gateway-passthrough` | direct `sessions.create`                                        |
| `/api/chat/send`                   | `gateway-passthrough` | direct `sessions.send`                                          |
| `/api/chat/abort`                  | `gateway-passthrough` | direct `sessions.abort`                                         |
| `/api/chat/snapshot`               | `normalized-facade`   | merges history/meta/approval/A2UI state                         |
| `/api/stream`                      | `local-control-plane` | owns Deck SSE auth, replay, heartbeat, projection-gap signaling |
| `/api/logs`                        | `gateway-passthrough` | direct `logs.tail`                                              |
| `/api/logs/stream`                 | `local-control-plane` | stream/cursor semantics local to Deck                           |
| `/api/deck/plugins`                | `gateway-passthrough` | direct `deck.plugins.list`                                      |

## Phase 1 tasks

- extend this table to all cutover-critical workflows
- annotate each row with target `deck-go` endpoint path
- mark which routes can be collapsed/merged in the Go backend

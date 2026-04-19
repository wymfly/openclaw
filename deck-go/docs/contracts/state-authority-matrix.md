# State Authority Matrix

This file is the working copy for state ownership during migration.

| Surface                                  | Authority                        | Migration note                           |
| ---------------------------------------- | -------------------------------- | ---------------------------------------- |
| Gateway capabilities/method support      | Gateway                          | Imported, never invented                 |
| Session runtime truth                    | Gateway                          | Backend may cache/project only           |
| Session send/abort effects               | Gateway                          | Backend is façade only                   |
| Chat transcript truth                    | Gateway                          | Canonical message/event truth            |
| Chat transcript continuity/replay cursor | Go backend                       | Deck-facing continuity bookkeeping       |
| Tool result rendering payloads           | Gateway -> Go backend projection | Normalize only                           |
| Config truth backed by Gateway           | Gateway                          | Backend exposes editor DTOs              |
| Durable local Deck preferences           | Go backend store                 | Theme/language/operator durable settings |
| Ephemeral UI state                       | Browser only                     | Tabs, filters, unsaved view state        |
| Inventory snapshots                      | Go backend cache/projection      | Derived from Gateway                     |
| Health/connection UI status              | Go backend projection            | Combines local + Gateway reachability    |
| Auth/session bootstrap for Deck app      | Go backend                       | Local app semantics                      |
| Stream fanout/reconnect bookkeeping      | Go backend                       | Local control-plane responsibility       |

## Legacy evidence notes

- local durable settings currently live in `dashboard/server/deck-settings.ts` backed by `dashboard/server/json-store.ts`
- request auth currently runs through `dashboard/server/access-gate.ts`
- stream replay currently runs through `dashboard/server/event-bus.ts` plus `dashboard/src/app/api/stream/route.ts`
- browser stream client behavior currently lives in `dashboard/src/lib/deck-client.ts`
- chat SSE dispatch and projection-gap recovery currently live in `dashboard/src/components/panels/chat/useChatSSE.ts`

## Immediate migration implications

- `access_token`, `gateway_url`, `gateway_token`, and similar durable Deck settings should move to Go-owned local persistence
- `Last-Event-ID` handling and `projection.gap` behavior become Go backend compatibility obligations
- browser-only state must stay out of the Go service even if legacy code currently mixes concerns nearby

## Phase 1 Tasks

- validate each row against current legacy implementation
- identify unresolved authority conflicts
- add per-surface migration owner

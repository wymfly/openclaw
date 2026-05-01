# Cutover Workflow Dependency Map

This document maps each canonical cutover-critical workflow to the legacy Deck surfaces
that currently implement or influence it.

## 1. Launch Deck and authenticate operator

Primary legacy surfaces:

- `dashboard/server/access-gate.ts`
- `dashboard/src/lib/with-auth.ts`
- `dashboard/src/lib/deck-client.ts`
- `dashboard/server/deck-settings.ts`

## 2. Connect to Gateway and obtain capability/bootstrap snapshot

Primary legacy surfaces:

- `dashboard/server/runtime.ts`
- `dashboard/server/gateway-adapter.ts`
- `dashboard/server/contracts.ts`
- `dashboard/src/app/api/gateway/describe/route.ts`
- `dashboard/src/app/api/gateway/health/route.ts`
- `dashboard/src/app/api/gateway/status/route.ts`

## 3. Load overview/status/inventory surfaces

Primary legacy surfaces:

- `dashboard/src/app/api/gateway/status/route.ts`
- `dashboard/src/app/api/gateway/health/route.ts`
- `dashboard/src/app/api/channels/route.ts`
- `dashboard/src/app/api/deck/plugins/route.ts`
- `dashboard/src/app/api/models/route.ts`
- `dashboard/src/app/api/usage/route.ts`

## 4. Load channels/plugins/models inventory

Primary legacy surfaces:

- `dashboard/src/app/api/channels/route.ts`
- `dashboard/src/app/api/deck/plugins/route.ts`
- `dashboard/src/app/api/models/route.ts`
- `dashboard/src/app/api/models/configured/route.ts`
- `dashboard/src/app/api/models/catalog-providers/route.ts`

## 5. Load and save critical config surfaces

Primary legacy surfaces:

- `dashboard/src/app/api/config/route.ts`
- `dashboard/src/app/api/config/patch/route.ts`
- `dashboard/src/app/api/config/apply/route.ts`
- `dashboard/src/app/api/config/schema/route.ts`
- `dashboard/src/app/api/config/schema-lookup/route.ts`

## 6. List sessions and open session detail

Primary legacy surfaces:

- `dashboard/src/app/api/sessions/route.ts`
- `dashboard/src/app/api/sessions/[sessionKey]/route.ts`
- `dashboard/src/app/api/chat/history/route.ts`
- `dashboard/src/app/api/chat/snapshot/route.ts`

## 7. Send chat message and receive streamed response

Primary legacy surfaces:

- `dashboard/src/app/api/chat/sessions/create/route.ts`
- `dashboard/src/app/api/chat/send/route.ts`
- `dashboard/src/app/api/stream/route.ts`
- `dashboard/src/lib/deck-client.ts`
- `dashboard/src/components/panels/chat/useChatSSE.ts`
- `dashboard/server/event-bus.ts`
- `dashboard/server/runtime.ts`

## 8. Abort an active chat/session run

Primary legacy surfaces:

- `dashboard/src/app/api/chat/abort/route.ts`
- `dashboard/src/app/api/chat/steer/route.ts`
- `dashboard/src/components/panels/chat/useChatSSE.ts`

## 9. Recover chat continuity after reconnect/reload

Primary legacy surfaces:

- `dashboard/server/event-bus.ts`
- `dashboard/src/app/api/stream/route.ts`
- `dashboard/src/lib/deck-client.ts`
- `dashboard/src/components/panels/chat/useChatSSE.ts`
- `dashboard/src/app/api/chat/snapshot/route.ts`

## 10. Render tool/result content without regression

Primary legacy surfaces:

- `dashboard/src/components/panels/chat/useChatSSE.ts`
- chat dispatch/store path behind `session-tool`, `agent`, and `chat` events
- `dashboard/src/app/api/chat/snapshot/route.ts`

## 11. Read logs/basic operator observability surfaces

Primary legacy surfaces:

- `dashboard/src/app/api/logs/route.ts`
- `dashboard/src/app/api/logs/stream/route.ts`
- `dashboard/src/app/api/activity/route.ts`
- `dashboard/server/event-bus.ts`

## 12. Perform upgrade/restart and restore working state

Primary legacy surfaces:

- local settings persistence:
  - `dashboard/server/deck-settings.ts`
  - `dashboard/server/json-store.ts`
- runtime bootstrap:
  - `dashboard/server/runtime.ts`
- auth/bootstrap and stream reconnect:
  - `dashboard/server/access-gate.ts`
  - `dashboard/src/lib/deck-client.ts`
  - `dashboard/src/app/api/stream/route.ts`

## Phase 1 Notes

- This is the first-pass dependency map, not the final full inventory.
- Every workflow above must later be annotated with:
  - Gateway-owned methods/events
  - Go backend-owned façade surfaces
  - browser-only state assumptions

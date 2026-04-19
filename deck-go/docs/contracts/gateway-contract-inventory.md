# Gateway Contract Inventory

This document tracks the Gateway-facing contract surfaces that `deck-go/` depends on.

## Authority

Gateway remains the only runtime/protocol authority.

Primary sources:

- `src/gateway/method-registry.ts`
- `src/gateway/server-methods.ts`
- `src/gateway/protocol/schema.ts`
- generated TS protocol artifacts currently used by legacy Deck

## Inventory Categories

### Capability bootstrap

- `gateway.describe`
- capability/status compatibility checks

### Session runtime

- `sessions.create`
- `sessions.send`
- `sessions.abort`
- `sessions.subscribe`
- `sessions.messages.subscribe`

### Config

- `config.schema.lookup`
- config read / patch / apply methods to be enumerated in execution phase

### Inventory / control

- channels, plugins, models, skills, logs, usage, and other operator-facing method families

## Legacy evidence snapshot

Current hard dependencies already visible in legacy Deck:

- `dashboard/server/runtime.ts`
  - requires `gateway.describe`
  - requires `sessions.create`
  - requires `sessions.send`
  - requires `sessions.abort`
  - requires `config.schema.lookup`
- `dashboard/src/app/api/chat/sessions/create/route.ts`
  - proxies `sessions.create`
- `dashboard/src/app/api/chat/send/route.ts`
  - proxies `sessions.send`
- `dashboard/src/app/api/chat/abort/route.ts`
  - proxies `sessions.abort`
- `dashboard/src/app/api/config/schema-lookup/route.ts`
  - proxies `config.schema.lookup`
- `dashboard/src/app/api/gateway/describe/route.ts`
  - exposes `gateway.describe` to the frontend

## Legacy API route footprint

Top-level route groups currently present under `dashboard/src/app/api/`:

| Group        | Route files |
| ------------ | ----------: |
| `chat`       |          15 |
| `deck`       |           9 |
| `models`     |           8 |
| `usage`      |           8 |
| `devices`    |           7 |
| `channels`   |           6 |
| `agents`     |           5 |
| `config`     |           5 |
| `cron`       |           5 |
| `skills`     |           5 |
| `approvals`  |           4 |
| `memory`     |           4 |
| `webhooks`   |           4 |
| `docs`       |           3 |
| `gateway`    |           3 |
| `monitor`    |           3 |
| `onboarding` |           3 |
| others       |   remaining |

Observations:

- the legacy app has `170` route files under `dashboard/src/app/api/`
- the route layer is already acting as a backend façade, not just a thin SSR convenience layer
- `chat`, `deck`, `models`, `usage`, `channels`, and `config` are the densest migration surfaces

## Initial method family classification

### Phase 1 cutover-critical Gateway families

- capability bootstrap
  - `gateway.describe`
- session runtime
  - `sessions.create`
  - `sessions.send`
  - `sessions.abort`
  - session subscription families referenced by runtime/chat SSE
- config authority
  - `config.schema.lookup`
  - critical config read/write families to be enumerated from route inventory
- inventory/control
  - channels
  - plugins / deck plugin inventory
  - models
  - logs

### Phase 1 contract work required

- enumerate exact method names consumed by each cutover-critical workflow
- separate:
  - direct Gateway passthrough
  - normalized/backend-owned Deck API
  - local-only Deck state
- lock the first export bundle for:
  - bootstrap
  - chat send/abort/create
  - config schema lookup
  - channels/plugins/models inventory

## Phase 1 Tasks

- enumerate exact method families consumed by legacy Deck
- map each family to generated TS authority and future Go binding target
- mark each family as `required for cutover`, `required for parity`, or `deferred`

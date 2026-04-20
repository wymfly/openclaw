# Gateway Contract Inventory

This document separates:

- **runtime-facing contracts**: how `deck-go` consumes `OpenClaw runtime`
- **deck-facing contracts**: how the React frontend consumes `deck-go`

This split is mandatory. Without it, the migration risks collapsing into a route-level port of the legacy Next handlers.

## Authority

OpenClaw runtime remains the only runtime/protocol authority.

Primary runtime-facing authority sources:

- `src/gateway/method-registry.ts`
- `src/gateway/server-methods.ts`
- `src/gateway/protocol/schema.ts`
- generated TS protocol artifacts currently used by legacy Deck

## Runtime-Facing Contracts

These are contracts where `deck-go` is the consumer.

### Capability bootstrap

- `gateway.describe`
- runtime health / status capability checks

### Session runtime

- `sessions.create`
- `sessions.send`
- `sessions.abort`
- `sessions.subscribe`
- `sessions.messages.subscribe`
- `sessions.messages.unsubscribe`
- `sessions.preview`
- `sessions.reset`
- `sessions.clear`
- `sessions.patch`

### Transcript seam

- `chat.history`

This is still an explicit transcript-read compatibility seam until a native `sessions.*` replacement with equivalent semantics exists.

### Config authority

- `config.get`
- `config.patch`
- `config.apply`
- `config.schema.lookup`

### Inventory / control

- channels
- deck plugin inventory
- models
- logs

## Deck-Facing Contracts

These are contracts where React is the consumer and `deck-go` is the owner.

Examples:

- backend bootstrap payload
- deck-facing REST endpoints
- deck-facing SSE event taxonomy
- deck-owned projection/cache DTOs
- compatibility façades for chat/session/config/inventory surfaces

These contracts may normalize and aggregate runtime data, but must not redefine runtime truth.

## Contract Governance

### Runtime-facing governance

- prefer generated or authority-derived bindings
- keep runtime-facing consumption narrow
- do not hand-redefine runtime semantics unless there is no upstream authority surface

### Deck-facing governance

- deck-go owns versioning and stability for frontend-facing APIs/SSE
- deck-facing contracts must not be shaped purely by current page structure
- contracts should remain reusable by future adjacent Go services where appropriate

### Isomorphic vs normalized rule

Must remain Gateway-isomorphic:

- bootstrap capability discovery semantics
- raw runtime truth boundaries
- session side effects
- config truth

May be Deck-normalized:

- operator auth/bootstrap views
- inventory aggregation
- transcript/UI projection
- event fanout and replay continuity
- health/status aggregation

## Legacy Evidence Snapshot

Current hard runtime-facing dependencies already visible in legacy Deck:

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
- `dashboard/src/app/api/chat/history/route.ts`
  - proxies `chat.history`
- `dashboard/src/app/api/config/schema-lookup/route.ts`
  - proxies `config.schema.lookup`
- `dashboard/src/app/api/gateway/describe/route.ts`
  - exposes `gateway.describe` to the frontend

## Migration Rule

When a new Deck need appears, choose in this order:

1. upstream/runtime-facing generic capability if it belongs in core
2. plugin if it is modular and deck-specific
3. deck-go if it is control-plane, projection, aggregation, or compatibility logic
4. frontend only if it is purely presentational/transient

Do not default to new shared core divergence.

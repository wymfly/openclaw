# Execution Trace

This file maps current `deck-go/` work back to the approved PRD phases so execution
stays auditable against plan scope.

Source of truth:

- `.omx/specs/deep-interview-deck-go-react-platform-stack.md`
- `.omx/plans/prd-deck-go-parallel-migration.md`
- `.omx/plans/test-spec-deck-go-parallel-migration.md`

## Phase mapping

### Phase 0 — Parallel Project Bootstrap

Status: **completed**

Delivered:

- `deck-go/backend/`
- `deck-go/frontend/`
- `deck-go/contracts/`
- `deck-go/dev/`
- `deck-go/docs/parity-matrix.md`
- `deck-go/docs/cutover-checklist.md`
- `deck-go/docs/deployment-baseline.md`
- `deck-go/docs/cutover-critical-workflows.md`
- `deck-go/docs/legacy-freeze-policy.md`
- `deck-go/docs/rollback-runbook.md`

Evidence:

- `deck-go/dev/run-side-by-side.sh` exists and executes
- `deck-go/` project tree exists in parallel to legacy `dashboard/`

### Phase 1 — Backbone Contract Inventory

Status: **substantially completed**

Delivered:

- `deck-go/docs/contracts/gateway-contract-inventory.md`
- `deck-go/docs/contracts/deck-backend-surface.md`
- `deck-go/docs/contracts/state-authority-matrix.md`
- `deck-go/docs/contracts/legacy-stream-semantics.md`
- `deck-go/docs/contracts/cutover-workflow-dependency-map.md`
- `deck-go/docs/contracts/legacy-api-route-groups.md`
- `deck-go/docs/contracts/legacy-route-classification.md`
- `deck-go/docs/contracts/legacy-server-core.md`

Evidence:

- legacy API route topology captured (`170` route files)
- legacy server core captured (`18` top-level files)
- cutover-critical workflows mapped to concrete legacy file dependencies
- stream/auth/config/projection semantics captured in docs

Remaining phase-1 gaps:

- route classification still needs broader expansion beyond current cutover-critical surfaces
- authority matrix can still be refined as more real slices are implemented

### Phase 2 — Contract + Compatibility Façade

Status: **started and partially implemented**

Delivered:

- first generated/shared TS contract:
  - `deck-go/contracts/generated/ts/deck-api.generated.ts`
- first Go-side internal DTOs:
  - `deck-go/backend/internal/deckapi/types.go`
- first frontend consumption of shared contract types:
  - settings
  - bootstrap
  - inventory
  - snapshot
  - stream/log stream event types
- first real Go façade routes:
  - settings
  - bootstrap
  - gateway describe/health/status
  - config get/patch/apply/schema-lookup
  - channels list/logout/patch
  - sessions list
  - chat create/send/abort/snapshot
  - deck plugins
  - logs tail
  - stream
  - logs stream

Evidence:

- backend test suite passes
- frontend build passes
- runtime smoke proved:
  - `/healthz`
  - authenticated `/`
  - authenticated `/api/settings`
  - authenticated `/api/bootstrap/status`
  - authenticated `/api/stream` event delivery after settings save

Remaining phase-2 gaps:

- no real generated Go bindings from Gateway export bundle yet
- no `pnpm protocol:gen:deck-go` pipeline yet
- fixtures are still mostly placeholders

### Phase 3 — Go Backbone Implementation

Status: **started via minimal slices, not complete**

Implemented early backbone slices:

- local settings persistence
- access gate
- minimal Gateway request client
- local event bus
- minimal SSE serving
- static SPA serving through Go

Why this phase is marked started:

- these are required backbone pieces and already exist in working form

Why this phase is not complete:

- no persistent long-lived Gateway subscription adapter yet
- no full replay/projection continuity parity yet
- no complete config/session backbone replacement yet

### Phase 4+ — Vertical slice migration / parity hardening / cutover

Status: **not complete**

Current work in these phases is limited to:

- minimal proof slices only
- verification scaffolding only

Not yet delivered:

- full page migration
- chat parity
- cutover gates
- rollback rehearsal sign-off

## Scope guard

The following approved non-goals have **not** been violated:

- no future enterprise-platform work
- no Gateway rewrite
- no desktop shell work
- no chat split into another frontend product
- no in-place architecture rewrite inside `dashboard/`

## Interpretation rule

If future execution risks expanding beyond the approved phases or non-goals,
update this file first and pause for plan review before continuing.

# State Authority Matrix

This document defines ownership of state in the corrected `deck-go` architecture.

## Matrix

| Surface                                                      | Authority        | Deck-facing role                                      | Future platform relevance |
| ------------------------------------------------------------ | ---------------- | ----------------------------------------------------- | ------------------------- |
| Gateway capabilities/method support                          | OpenClaw runtime | imported into deck-go, never invented                 | medium                    |
| Runtime execution truth                                      | OpenClaw runtime | not owned by deck-go                                  | low                       |
| Session runtime truth                                        | OpenClaw runtime | backend may cache/project only                        | medium                    |
| Session send/abort effects                                   | OpenClaw runtime | backend façade only                                   | low                       |
| Chat transcript truth                                        | OpenClaw runtime | canonical message/event truth                         | medium                    |
| Chat continuity / replay cursor                              | deck-go          | control-plane continuity bookkeeping                  | high                      |
| Tool/result rendering payload normalization                  | deck-go          | projection/compatibility role                         | medium                    |
| Config truth backed by Gateway                               | OpenClaw runtime | backend exposes editor-friendly DTOs                  | medium                    |
| Gateway lifecycle ownership (start/stop/restart/supervision) | deck-go          | bounded control-plane supervision above runtime truth | high                      |
| Durable local Deck preferences                               | deck-go          | local control-plane persistence                       | medium                    |
| Inventory snapshots                                          | deck-go          | cache/projection layer                                | high                      |
| Health/connection status shown in UI                         | deck-go          | aggregated control-plane view                         | high                      |
| Operator auth/session bootstrap                              | deck-go          | control-plane responsibility                          | high                      |
| Stream fanout/reconnect bookkeeping                          | deck-go          | control-plane responsibility                          | high                      |
| Browser tabs/filters/unsaved local state                     | React frontend   | transient UI only                                     | low                       |

## Current package seams for lifecycle/state ownership

The Stage 2 backend currently splits lifecycle and inventory ownership across
three packages. Keep the seam explicit:

| Package                               | Owns                                                                                                                                                                     | Must not own                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `backend/internal/runtime/supervisor` | managed process lifecycle, probe state, exit bookkeeping, snapshots                                                                                                      | deck-facing DTOs, runtime inventory summaries, frontend contracts                        |
| `backend/internal/runtime/openclaw`   | Deck control-plane facade, transport binding, lifecycle route wiring, legacy `/api/runtime/gateway*` contract ownership, external route/status + registry helper surface | generic process supervision internals, standalone runtime truth, inventory-only concerns |
| `backend/internal/runtime/registry`   | read-only runtime inventory, summary projection, replay/subscription feed                                                                                                | start/stop/restart control, config mutation, supervisor policy                           |

Practical rule:

- lifecycle **control** flows through `openclaw -> supervisor`
- lifecycle **observation** flows through `supervisor -> registry`
- runtime-gateway route **ownership** flows through `openclaw.ManagedRuntime`;
  `backend/internal/server/runtime.go` should be treated as thin HTTP wiring,
  not the long-term owner of lifecycle response shaping
- external packages should consume `ManagedRuntime` route/status helpers
  (`RuntimeGatewayStatusResponse`, `StartRuntimeGateway`, `StopRuntimeGateway`,
  `RestartRuntimeGateway`) instead of binding themselves to raw supervisor
  lifecycle methods
- external packages should also consume `ManagedRuntime` registry/replay
  surfaces (`ListRuntimes`, `GetRuntime`, `Replay`, `SupportsRuntime`,
  `Subscribe`) instead of binding themselves to `RuntimeSupervisor()` or other
  raw supervisor accessors
- frontend/API routes consume the `openclaw.ManagedRuntime` facade instead of
  stitching supervisor and registry together ad hoc

## Stage 3 frontend host boundary

The active browser host is now `frontend`, not `frontend-next`.

Active host-specific shell:

- `frontend/src/lib/deck-client.ts`
  - owns browser transport/auth/reconnect behavior for the active Vite host
  - reads `VITE_DECK_GO_API_BASE`, otherwise keeps browser requests on the current host origin
  - owns `x-deck-token` and `Last-Event-ID` browser headers

Active host invariants:

- every panel id in `frontend/src/restoration/panel-registry.tsx` must have a concrete
  `ActivePanelHost` implementation
- `frontend/src/restoration/contract-readiness.ts` must not regress any panel to
  `frontend-blocked`
- restored panels must stay within the current frontend TypeScript/lib target;
  compile-target-incompatible helper patterns are guarded by the frontend build

Archive/reference-only host:

- `frontend-next/`
  - may remain in-repo for comparison or historical evidence
  - must not be treated as the default build/run/verify host path

Must not grow back inside the active Vite host:

- local runtime fallback handlers
- route-owned business or config truth
- durable control-plane persistence outside `deck-go`
- host-local loopback Gateway ownership seams

## Promotion Beyond Deck

Surfaces with likely future service relevance:

- capability inventory
- operator/session bootstrap
- projection/cache ownership
- event fanout/reconnect continuity
- health/status aggregation
- lifecycle supervision

These are **architecturally promotable**, but not current scope.

## Legacy Evidence

- local durable settings currently live in `dashboard/server/deck-settings.ts` backed by `dashboard/server/json-store.ts`
- request auth currently runs through `dashboard/server/access-gate.ts`
- stream replay currently runs through `dashboard/server/event-bus.ts` plus `dashboard/src/app/api/stream/route.ts`
- browser stream client behavior currently lives in `dashboard/src/lib/deck-client.ts`
- chat SSE dispatch and projection-gap recovery currently live in `dashboard/src/components/panels/chat/useChatSSE.ts`

## Immediate Migration Implications

- `access_token`, `gateway_url`, `gateway_token`, and similar durable Deck settings belong in Go-owned persistence
- `Last-Event-ID` handling and `projection.gap` are deck-go compatibility obligations
- runtime truth must remain explicitly outside deck-go even when deck-go owns lifecycle supervision
- browser-only state must stay out of Go service logic

## Guardrail

If a new piece of state cannot be clearly assigned to one of:

- OpenClaw runtime
- deck-go
- React frontend

then implementation should pause and the placement should be reviewed before code continues.

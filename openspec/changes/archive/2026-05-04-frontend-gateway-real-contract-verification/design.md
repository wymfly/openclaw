## Context

`gateway` already has an archived implementation pass, but `deck-go/frontend-handoff/modules/gateway/` now contains a revised v2 prototype. The current production implementation renders runtime diagnostics, Gateway health/status/describe evidence, activity, and monitor projections, but it does not expose the v2 control-plane section model.

Verified contract facts for this pass:

- Browser code must call only deck-go backend routes.
- Runtime/bootstrap truth comes from `GET /api/bootstrap/status`, `GET /api/runtime/gateway`, and `GET /api/runtime/capabilities`.
- Gateway diagnostic snapshots come from `GET /api/gateway/health`, `GET /api/gateway/status`, and `GET /api/gateway/describe`.
- Typed Gateway RPC and batch transports exist at `/api/v1/runtimes/{runtimeId}/gateway/rpc` and `/api/v1/runtimes/{runtimeId}/gateway/batch`.
- The v2 handoff's `/api/gateway/batch` path is stale; production batch transport is runtime-scoped.
- `gateway.batch` is not a synthetic dry run. It executes child calls, so production UI must restrict the composer to read-only methods and disable it in remote mode.
- Activity and monitor data are Deck event-bus projections, not guaranteed Gateway durable history.

## Goals / Non-Goals

**Goals:**

- Implement the Gateway v2 visual/product model where supported by the current contract chain.
- Add a full read-only describe explorer using `fetchGatewayDescribe()`.
- Add a bundled-only read-only batch console backed by `/api/v1/runtimes/{runtimeId}/gateway/batch`.
- Keep remote mode read-only with explicit disabled batch affordance.
- Update contract metadata and handoff notes so future frontend work can follow code truth.
- Provide L1 mock visual evidence and bounded L2 real-stack evidence, with circuit-breaker behavior for environment-dependent real Gateway scenarios.

**Non-Goals:**

- Add runtime start/stop/restart controls to the Gateway panel.
- Allow arbitrary mutating Gateway batch calls from the Gateway panel.
- Add durable audit/history storage or a new live streaming Gateway throughput endpoint.
- Add new dependencies or promote local Gateway molecules into the shared design system in this pass.
- Force real LLM traffic solely to create monitor events.

## Decisions

- **Use v2 as product target, code truth as authority.** The production panel should look and behave like the v2 handoff only where Gateway/BFF contracts support it. Stale prototype assumptions are corrected in handoff notes instead of being hard-coded.
- **Route batch through the typed runtime endpoint.** The BFF exposes `POST /api/v1/runtimes/{runtimeId}/gateway/batch`; production should not invent `/api/gateway/batch`.
- **Make batch read-only in this panel.** Because `gateway.batch` is a real execution surface, the composer filters methods to scopes other than `operator.write`, validates JSON params locally, submits only bundled-mode read calls, and labels failures per slot.
- **Project throughput locally from existing data.** Until a typed throughput endpoint exists, the Gateway panel computes a bounded projection from activity/monitor/batch state and marks it as a BFF/UI projection.
- **Keep monitor history as supporting evidence.** The v2 Activity tab is the primary tab; monitor projections can still feed throughput and real verification, but they should not dominate the Gateway panel.

## Risks / Trade-offs

- **Real Gateway may expose partial health/status fields** -> UI uses optional-field normalization and tests assert shape rather than exact rich payloads.
- **Real monitor history may be empty** -> L2 treats empty list/stats as valid route-shape evidence and does not fabricate runs.
- **Batch may fail due method availability or environment** -> The composer validates locally, displays per-slot errors, and L2 uses safe read-only calls with a three-attempt circuit breaker.
- **Handoff and implementation may drift again** -> Update handoff README/API notes/implementation notes during the same change and run OpenSpec validation before archive.

## Migration Plan

1. Add/validate OpenSpec artifacts for the v2 Gateway pass.
2. Rework the Gateway panel and focused tests in small vertical slices: data normalization, describe explorer, batch console, activity/throughput, visual polish.
3. Update contract metadata, generated UI docs, handoff docs, and E2E tests.
4. Run focused frontend/backend/visual/real/contract/build/OpenSpec checks.
5. Archive only after task and verification evidence is recorded.

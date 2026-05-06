## Context

Gateway is Deck's runtime control-plane dashboard. The current contract chain is:

`GatewayPanel` -> `frontend-new/src/api.ts` wrappers -> Deck BFF routes:

- `GET /api/bootstrap/status`
- `GET /api/runtime/gateway`
- `GET /api/runtime/capabilities`
- `GET /api/gateway/health`
- `GET /api/gateway/status`
- `GET /api/gateway/describe`
- `POST /api/v1/runtimes/{runtimeId}/gateway/batch`
- `GET /api/activity`
- `GET /api/monitor/runs`
- `GET /api/monitor/stats`

Those routes adapt Gateway health/status/describe/batch plus Deck runtime and
event-bus projections. Deck-facing DTO authority lives in
`contracts/source/deck-api.contract.ts`; endpoint and mutation policies live in
the corresponding `contracts/source/deck-*.contract.*` files.

The active visual target is
`frontend-handoff/modules/gateway/prototype.html`. Production already exposes a
v2 workbench with topbar, KPI hero, channel and heartbeat rails, throughput
projection, Methods & Events explorer, batch console, Activity tab, and runtime
facts. This child proposal must close strict parity evidence and strengthen real
Gateway validation.

## Goals / Non-Goals

**Goals:**

- Confirm the active Gateway prototype and reconcile it with current Gateway,
  runtime, and Deck projection contracts.
- Audit production Gateway code, handoff files, mock fixtures, and real E2E
  against the strengthened head remediation standard.
- Fix deterministic visual, interaction, i18n, batch-gating, fixture,
  projection, route-wrapper, or documentation drift when supported by code
  truth.
- Preserve BFF-only browser access for Gateway diagnostics, describe, batch,
  runtime, activity, and monitor data.
- Exercise representative real product data through real health/status/describe
  routes and a safe read-only `gateway.describe` batch call.
- Validate that arbitrary/mutating batch work remains skipped-safe from this
  panel.
- Upgrade mock visual and real Gateway E2E to cover shell navigation, all four
  theme/locale variants, meaningful safe tabs/dialogs/subviews, route-shape
  evidence, BFF-only transport, unexpected error checks, and structured
  accepted exceptions.
- Update Gateway implementation notes, the remediation matrix, and head task
  `6.5`.

**Non-Goals:**

- Do not replace the existing Gateway implementation wholesale with prototype
  files.
- Do not expose mutating Gateway methods through the batch composer.
- Do not fabricate throughput, activity, monitor, or audit data as real Gateway
  truth when they are Deck BFF/event-bus projections.
- Do not add lifecycle start/stop/restart actions to the Gateway panel.
- Do not require non-empty monitor runs in a fresh real stack.

## Decisions

### D1: Runtime/BFF contract truth wins over static prototype assumptions

The prototype is the visual and interaction reference, but runtime-mode, BFF
route, Gateway describe, endpoint classification, and mutation-evidence truth
win when the prototype is stale or speculative.

### D2: Real evidence uses read-only product operations

Gateway real E2E should verify health/status/describe, activity and monitor
route shapes, and a read-only `gateway.describe` batch call through Deck BFF.
No user-owned runtime lifecycle or mutating Gateway method should be executed.

### D3: Batch remains restricted

The panel may submit only bundled-mode read-only methods advertised by
`gateway.describe`, excluding `gateway.batch`, subscriptions, and
`operator.write` methods. Remote or unsafe paths stay locked/skipped-safe.

### D4: Browser transport remains BFF-only

Gateway browser code may call relative `/api/*` routes through the frontend API
facade, but it must not call the Gateway port or websocket directly. Real E2E
records direct Gateway HTTP or websocket attempts as failures.

### D5: Projections stay honest

Throughput, activity, and monitor history are useful product surfaces but are
BFF/event-bus projections today. Empty real monitor history is valid evidence
when route shapes are verified and the UI labels it honestly.

## Risks / Trade-offs

- **Risk: batch can execute real upstream calls.** -> Keep composer filtered to
  read-only described methods and assert no lifecycle/mutating controls.
- **Risk: real monitor/activity history is empty.** -> Treat empty arrays as
  valid route-shape evidence and record the projection limitation.
- **Risk: prototype includes richer static telemetry.** -> Use accepted
  exceptions tied to current BFF/Gateway contracts.
- **Risk: direct Gateway access might slip into UI code.** -> Real E2E records
  direct Gateway HTTP/websocket attempts as failures.

## Migration Plan

1. Audit prototype files, production Gateway code, contract sources, BFF routes,
   mock Gateway support, visual spec, real E2E, and mutation-evidence policy.
2. Patch deterministic Gateway UI, i18n, API facade, batch filter, fixture, or
   documentation drift.
3. Upgrade mock visual E2E to capture prototype-shaped dashboard, describe
   explorer, batch console, activity/projection states, and all required
   localized theme variants.
4. Upgrade real Gateway E2E to verify route shapes, read-only batch evidence,
   shell navigation, all localized theme variants, safe child interactions,
   BFF-only transport, and unexpected-error evidence.
5. Update implementation notes and the head matrix, validate, then archive this
   child proposal.

## Open Questions

- Whether Gateway throughput should become a first-class typed endpoint.
- Whether monitor/activity projections should gain durable pagination and
  dedicated contracts.
- Whether remote-mode batch should ever be allowed through a stricter dry-run
  or confirmation design.

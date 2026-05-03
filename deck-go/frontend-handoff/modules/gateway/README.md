# gateway - high-fidelity handoff

**Status:** `implemented (sha pending-final-commit)`
**Protocol version:** `protocol-v1`
**Active visual target:** [`./prototype.html`](./prototype.html)
**OpenSpec change:** `frontend-gateway-hifi-contract-redesign`

This package defines the visual and interaction target for the `gateway/`
module rewrite in `frontend-new`. The existing panel already uses the Deck BFF
contract chain, but its layout still comes from the old global
`deck-ui-gateway` surface. Code and contracts remain the final authority when a
handoff note drifts.

## What this module does

`gateway/` is the runtime diagnostics workbench. Operators use it to answer:
is the deck-go runtime configured, is the Gateway reachable, what did the
Gateway health/status endpoints report, what activity just happened, and which
monitor run explains the latest timeline evidence.

The design keeps runtime facts and diagnostics in the first viewport, with
monitor history and timeline evidence one click away. It intentionally does not
add start, stop, or restart actions.

## Contract truth

Production and mocks must use the current Deck-facing DTOs:

- `DeckGoBootstrapStatusResponse`
- `DeckGoRuntimeGatewayStatus`
- `DeckGoRuntimeCapabilities`
- `DeckGoGatewayHealthResponse`
- `DeckGoGatewayStatusResponse`
- `DeckGoActivityResponse`
- `DeckGoActivityEvent`
- `DeckGoMonitorRunsResponse`
- `DeckGoMonitorRun`
- `DeckGoMonitorStatsResponse`
- `DeckGoMonitorRunDetailResponse`
- `DeckGoMonitorRunEvent`
- `DeckGoMonitorRunSummary`

Endpoint truth:

- `GET /bootstrap/status`
- `GET /runtime/gateway`
- `GET /runtime/capabilities`
- `GET /gateway/health`
- `GET /gateway/status`
- `GET /activity`
- `GET /monitor/runs`
- `GET /monitor/runs/{runId}`
- `GET /monitor/stats`

Browser code must continue through `frontend-new/src/api.ts` wrappers and the
Deck backend. It must not call Gateway RPC directly.

## Workflow constraints

- Visual convergence is the goal of this module pass: mock + frontend should
  become stable against the contract and design system.
- Code truth wins over this handoff when the two disagree.
- Deterministic fixture/API drift may be fixed in this change. Uncertain real
  Gateway, monitor projection, or lifecycle semantics must be recorded as
  follow-up instead of invented in the UI.
- Runtime mode is environment-driven and not switched from this panel.
- Lifecycle controls remain absent unless a separate runtime lifecycle proposal
  introduces them.
- Gateway health/status are BFF diagnostic routes over OpenClaw Gateway RPC.
- Activity and monitor runs are Deck backend projections over runtime events.

## Depends on canonical atoms

`Badge`, `Button`, `Card`, `Code`, `SegmentedControl`, `Spinner`, `Tag`, and
text atoms can be used where production fit is straightforward.

No canonical atom or token is required by this handoff. Local molecules:

- runtime metric tile
- runtime status strip
- diagnostic evidence tile
- activity row
- monitor run row
- timeline stat tile
- timeline event row
- first-run empty state slot

## How to implement

1. Open `prototype.html` and inspect ready, runtime, history, selected
   timeline, not-configured, loading, and error states.
2. Read `api-usage.md` before touching mocks, API wrappers, or backend
   behavior.
3. Translate the prototype into `frontend-new/src/components/panels/gateway/`,
   preserving API wrappers, runtime refresh, first-run empty behavior, and no
   lifecycle action buttons.
4. Move gateway styling out of global `theme.css` into module-local CSS.
5. Add mock visual E2E with contract-shaped data and label evidence as mock
   visual coverage.

## Open questions for follow-up

- Whether real Gateway emits enough `chat` / `agent` event frames for monitor
  projections in every runtime mode, or whether deck-go should own a stronger
  event normalization layer.
- Whether Gateway health/status responses should get stricter generated result
  schemas once upstream exposes richer method result schemas.
- Whether monitor history belongs in this runtime workbench long-term or should
  deep-link into a separate Activity/Monitor module after all panels converge.
- Whether runtime lifecycle actions should appear here at all, or stay in a
  dedicated operations proposal with stronger safeguards.
- Whether runtime metric tiles and timeline rows should be promoted to shared
  design-system patterns after models/activity/usage repeat them.

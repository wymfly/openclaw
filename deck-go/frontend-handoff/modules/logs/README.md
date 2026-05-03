# logs - high-fidelity handoff

**Status:** `implemented (sha pending-final-commit)`
**Protocol version:** `protocol-v1`
**Active visual target:** [`./prototype.html`](./prototype.html)
**OpenSpec change:** `frontend-logs-hifi-contract-redesign`

This package defines the visual and interaction target for the `logs/` module
rewrite in `frontend-new`. The existing panel already owns useful behavior, but
this package is the visual truth for the high-fidelity pass. Code and contracts
remain the final authority when a handoff note drifts.

## What this module does

`logs/` is a read-only operations workbench for recent Gateway log tail data and
live `/logs/stream` events. Operators use it to verify that the stack is
producing logs, scan recent lines, filter loaded lines locally, pause/resume the
live stream, clear the local buffer, inspect stream event payloads, and prepare
copyable export text.

The design is compact and code-heavy. It repeats the chat/agents/routing/
subagents typography and token posture while keeping log rows, live tape, and
event payload seams local until a separate design-system proposal promotes them.

## Contract truth

Production and mocks must use the current Deck-facing DTOs:

- `DeckGoLogsTailResponse`
- `DeckGoLogStreamEvent`

Endpoint truth:

- `GET /logs` with optional `cursor`, `limit`, and `maxBytes` query params.
- `GET /logs/stream` SSE events with `log.batch` and `log.reset` payloads.

Gateway truth:

- The Go BFF forwards `cursor`, `limit`, and `maxBytes` to Gateway `logs.tail`.
- `logs.tail` is currently an upstream-schema-missing exception in the generated
  Gateway protocol chain. This UI pass does not add a generated schema.
- Level, source, and session filters are local filters over already-loaded lines;
  they are not server-side query parameters.

## Depends on canonical atoms

`Badge`, `Button`, `Card`, `Code`, `Input`, `Select`, `Spinner`, and `Toggle`
where production fit is straightforward.

No canonical atom or token is required by this handoff. Local molecules:

- logs metric tile
- level filter toggle row
- log line row
- live tape row
- stream event summary strip
- raw payload seam

## How to implement

1. Open `prototype.html` and inspect ready, filtered, paused, empty, and error
   states.
2. Read `api-usage.md` before touching mocks, API wrappers, or backend
   forwarding.
3. Translate the prototype into `frontend-new/src/components/panels/logs/`,
   preserving existing API wrappers, cursor persistence, stream event parsing,
   local filtering, and export preview behavior.
4. Do not expose local level/source/session filters as Gateway filters.
5. Add mock visual E2E with contract-shaped data and label evidence as mock
   visual coverage.
6. Update `implementation-notes.md` with production divergence and
   design-system feedback.

## Open questions for follow-up

- Whether OpenClaw should publish a generated schema for `logs.tail`.
- Whether `/logs` should eventually support server-side level/source/session
  filtering instead of local-only filtering.
- Whether a durable export/download endpoint is needed, or copyable preview is
  sufficient.
- Whether stream events should expose structured fields beyond the current SSE
  envelope and arbitrary JSON payload.
- Whether log rows and live tape rows repeat enough with future observability
  modules to become canonical design-system patterns.

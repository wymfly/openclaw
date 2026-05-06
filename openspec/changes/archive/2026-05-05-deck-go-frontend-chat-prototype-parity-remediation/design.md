## Context

Chat is Deck's primary operator workspace. The current contract chain is:

`ChatPanel` -> `frontend-new/src/components/panels/chat/chat-api.ts` ->
`frontend-new/src/api.ts` wrappers -> Deck BFF routes:

- `GET /api/sessions`
- `GET /api/chat/sessions`
- `DELETE /api/chat/sessions`
- `POST /api/chat/sessions/create`
- `POST /api/chat/sessions/preview`
- `GET /api/chat/snapshot`
- `GET /api/chat/history`
- `POST /api/chat/send`
- `POST /api/chat/abort`
- `POST /api/chat/steer`
- `POST /api/chat/sessions/reset`
- `POST /api/chat/sessions/clear`
- `POST /api/chat/sessions/patch`
- `POST /api/chat/compact`
- `POST /api/chat/compaction`
- `POST /api/chat/session-events`
- `POST /api/chat/projection`
- `POST /api/deck/canvas`
- `GET /api/stream`
- `GET /api/media`
- `GET /api/canvas/{path}`
- `POST /api/deck/commands/discover`

Those BFF routes adapt Gateway session, chat, command, approval, and stream
capabilities where Gateway exposes them. The active handoff prototype in
`frontend-handoff/modules/chat/prototype.html` is explicitly reverse-derived
from the engineering implementation, so it is useful as a high-fidelity
reference for the shell shape but not a standalone product authority.

Production already has a rich shell, session sidebar, transcript, composer,
right drawer, artifact/canvas support, approval dialog, SSE status, and visual
state seeding. The head matrix still records Chat as mock-functional only. This
child proposal must generate strict parity proof, fix deterministic drift, and
upgrade real E2E to the strengthened standard.

## Goals / Non-Goals

**Goals:**

- Confirm `frontend-handoff/modules/chat/prototype.html` is the active visual
  target and document that it is reverse-derived.
- Audit production Chat against the prototype and current contract sources.
- Fix deterministic drift in layout, component states, localized text, keyboard
  flows, route wrappers, visual fixtures, or cleanup guards when deck-go truth
  supports it.
- Preserve BFF-only browser access for chat/session data, streaming,
  approvals, media, commands, and canvas routes.
- Create representative real data by using a run-scoped real Gateway session
  seeded through the Deck BFF/Gateway chain, preferably with the configured
  `cpa` + `main` path when safe.
- Cleanup only run-scoped sessions created by this test run.
- Upgrade mock visual E2E and real Gateway E2E to cover shell navigation, all
  four theme/locale variants, safe child surfaces, fixture evidence, and
  unexpected error checks.
- Update Chat implementation notes, matrix row, and head task `6.3`.

**Non-Goals:**

- Do not replace the existing Chat implementation wholesale with prototype
  files.
- Do not fabricate Gateway-backed streaming, compaction, approval, canvas, or
  artifact behavior that the current BFF cannot expose.
- Do not add a new chat data model unless deterministic contract drift requires
  a focused source-contract fix.
- Do not run a destructive session cleanup against non-run-scoped user
  sessions.
- Do not make real LLM success a hard archive blocker; record bounded
  environment/model failures as handoff evidence after route and UI evidence is
  collected.

## Decisions

### D1: Treat production and contracts as code truth

The prototype is reverse-derived from production. This child will use it for
visual/state parity checks, but current generated Deck DTOs, BFF routes, Gateway
method behavior, and production code win when conflicts are found.

Alternative considered: make the prototype the only visual authority. Rejected
because the handoff explicitly says Chat has evolved past the prototype in some
details.

### D2: Real fixture data uses a run-scoped session

Chat real data should be created through the product path: create/send a
run-scoped session through Deck BFF/Gateway, verify it appears in list/history,
exercise safe UI child surfaces, and delete only that run-scoped session.

Alternative considered: use only `deckVisualState=chat-rich`. Rejected because
the strengthened standard requires representative real data before accepting
empty or mock-only evidence.

### D3: Real LLM is evidence, not an infinite blocker

The preferred real path is the configured `cpa` channel with `main`, but model
latency, provider outage, or Gateway environment setup can fail independently of
Deck UI correctness. The test should make bounded attempts, attach exact route
and UI evidence, and circuit-break with a concrete handoff if the model run is
environment-blocked.

Alternative considered: require a full assistant response every archive. Rejected
because it can block all remaining module remediation on external runtime
conditions.

### D4: Browser transport remains BFF-only

The Chat browser may use relative `/api/*` routes served by deck-go, including
SSE/media/canvas endpoints, but must not call the Gateway port or websocket
directly. Real E2E records direct Gateway HTTP or websocket attempts as failures.

Alternative considered: validate Gateway directly from the browser page. Rejected
because Deck's contract chain intentionally keeps Gateway behind the Go BFF.

### D5: Unsupported projections stay honest

If approval expiration, replay recovery, durable canvas/a2ui typing, or
artifact/projection behavior is not safely creatable in the real stack, the UI
can validate available controls and mock-rich states while the notes record the
real limitation.

Alternative considered: inject fake runtime events into production during real
E2E. Rejected because it would not prove Gateway/BFF product behavior.

## Risks / Trade-offs

- **Risk: real chat send starts a long or failed model run.** -> Use bounded
  attempts/timeouts and record route/UI evidence; do not loop indefinitely.
- **Risk: session cleanup could delete user data.** -> Delete only sessions whose
  title/key/prompt contains the current run id.
- **Risk: prototype and production intentionally differ.** -> Use structured
  accepted exceptions tied to contract or product-shell truth.
- **Risk: rich child surfaces need runtime events to become visible.** -> Use
  mock visual seed for full visual parity and real run-scoped data for product
  readiness; do not claim unsupported real child surfaces passed.
- **Risk: Chat touches many shared stores and contracts.** -> Prefer focused
  tests and minimal patches before broad changes.

## Migration Plan

1. Audit prototype files, production Chat code, contract sources, BFF routes,
   mock visual spec, existing real smoke, and session fixture helpers.
2. Generate or inspect prototype-current parity evidence for the active Chat
   target.
3. Patch deterministic UI, i18n, fixture, route, state, or test drift found by
   the audit.
4. Upgrade mock visual E2E to capture rich and empty states, composer, search,
   filters, approval, artifact, canvas, keyboard interactions, and localized
   theme variants.
5. Add or extract Chat real Gateway E2E that verifies route shapes, shell
   navigation, all four theme/locale variants, safe child interactions,
   BFF-only transport, unexpected errors, run-scoped session fixture evidence,
   and cleanup guards.
6. Update implementation notes and the head matrix, validate, then archive this
   child proposal.

## Open Questions

- Whether future Chat should add stronger durable a2ui/canvas state typing from
  Gateway protocol truth.
- Whether approval expiration and always-approve flows need first-class
  disposable real fixtures.
- Whether real model response quality should become a separate LLM E2E lane
  after all module control-surface remediation is complete.
- Whether `real-gateway.spec.ts` should keep broad Chat smoke or split fully
  into `chat-real-gateway.spec.ts` for module ownership.

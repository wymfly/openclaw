## Context

Threads is Deck's channel-to-agent binding registry. The current contract chain
is:

`ThreadsPanel` -> `frontend-new/src/api.ts` `fetchThreads()` ->
`GET /api/deck/threads` -> Go BFF inventory route -> Gateway
`deck.threads.list`.

The source DTO is `DeckGoThreadEntry` in
`contracts/source/deck-api.contract.ts`. The record is intentionally flat:
`threadId`, `channelId`, `agentId`, `targetSessionKey`, `targetKind`,
`boundAt`, `lastActivityAt`, `accountId`, `boundBy`, and optional `label`.
There is no verified Deck/Gateway contract for thread mutation, per-thread
activity projection, audit history, transcript, or branch topology.

The active visual target is
`frontend-handoff/modules/threads/prototype.html`. Production already exposes a
read-only relation list/detail workbench, but the head matrix has not verified
strict prototype parity or strengthened real Gateway product-flow evidence.

## Goals / Non-Goals

**Goals:**

- Confirm the active Threads prototype and reconcile it with current Gateway,
  BFF, Deck-facing DTO, and frontend wrapper truth.
- Audit production Threads code, handoff files, mock fixtures, and real E2E
  against the strengthened head remediation standard.
- Fix deterministic visual, interaction, i18n, fixture, route-wrapper, or
  documentation drift when supported by code truth.
- Preserve BFF-only browser access for list/filter/detail/copy/navigation/raw
  flows.
- Exercise representative real route shapes and UI states without fabricating
  thread bindings when the real Gateway returns an empty list.
- Upgrade mock visual and real Gateway E2E to cover shell navigation, all four
  localized theme variants, safe child interactions, route-shape evidence,
  BFF-only transport, unexpected-error evidence, and accepted exceptions.
- Update Threads implementation notes, the remediation matrix, and head task
  `6.11`.

**Non-Goals:**

- Do not add thread unbind/rebind/rename endpoints.
- Do not add per-thread activity or audit BFF projections.
- Do not add transcript, message, branch, or parent/child thread topology.
- Do not mutate user OpenClaw config or workspace state for Threads real E2E.
- Do not replace the production module wholesale with prototype files.

## Decisions

### D1: Threads remains a read-only binding registry

The prototype is the visual and interaction reference, but the Deck/Gateway/BFF
contract truth wins. Production can display list/detail/raw data and local UI
filters derived from list data, but it must not expose mutation controls as
working product controls until contracts exist.

### D2: Prototype-only activity/audit tabs become accepted exceptions

Recent activity and audit tabs are useful product ideas, but the verified
Threads chain does not expose those projections. Production may show raw payload
or explanatory unsupported states, but archive evidence must not claim those
tabs as live contract-backed features.

### D3: Real evidence is route-shape and empty-valid first

The real Gateway may return zero persisted bindings. That is valid evidence for
the current contract. The real E2E must still verify runtime readiness, route
shape, filtered empty shape, shell navigation, theme/locale variants,
BFF-only transport, and unexpected-error checks.

### D4: Browser transport remains BFF-only

Threads browser code may call relative `/api/*` routes through the frontend API
facade, but it must not call the Gateway port directly.

## Risks / Trade-offs

- **Risk: prototype includes unsupported controls.** -> Record accepted
  exceptions instead of wiring fake endpoints.
- **Risk: mock rows imply Gateway supports all channel kinds.** -> Use mock
  rows for visual coverage only; implementation notes must state real Gateway
  projection may be Discord-only or empty.
- **Risk: real stack has no thread bindings.** -> Verify empty-valid UI and
  route shape, and avoid claiming real multi-channel behavior.
- **Risk: dense table overfits mock data.** -> Keep rows responsive and
  truncate long identifiers without changing DTO truth.

## Migration Plan

1. Audit prototype files, production Threads code, contract sources, BFF route,
   mock Gateway support, visual spec, and real E2E.
2. Patch deterministic Threads UI, i18n, API facade, fixture, or documentation
   drift.
3. Upgrade mock visual E2E to capture dense binding inventory, selected detail,
   copy feedback, filters, raw payload, and all required localized theme
   variants.
4. Upgrade real Gateway E2E to verify route shapes, shell navigation, all
   localized theme variants, safe child interactions, BFF-only transport,
   unexpected-error evidence, and empty-valid/skipped-safe policy.
5. Update implementation notes and the head matrix, validate, then archive this
   child proposal.

## Open Questions

- Whether Gateway should expose typed thread mutation methods for unbind,
  rebind, and label rename.
- Whether Deck should expose per-thread activity and audit projections.
- Whether `boundBy` should become a typed enum instead of a free-form string.
- Whether `targetKind` should become a closed enum or remain extensible string.

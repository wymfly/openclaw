## Context

Identity is Deck's canonical-to-channel-peer registry. The current contract
chain is:

`IdentityPanel` -> `frontend-new/src/api.ts` wrappers -> Deck BFF routes:

- `GET /api/deck/identity`
- `POST /api/deck/identity` with `action: "link"`
- `POST /api/deck/identity` with `action: "unlink"`
- `GET /api/agents/{agentId}/identity`

Those routes adapt Gateway `deck.identity.list`, `deck.identity.link`,
`deck.identity.unlink`, and agent identity methods through the deck-go backend.
Deck-facing DTO authority lives in `contracts/source/deck-api.contract.ts`;
endpoint and mutation policies live in the corresponding
`contracts/source/deck-*.contract.*` files.

The active visual target is
`frontend-handoff/modules/identity/prototype.html`. Production already exposes a
two-pane registry workbench with canonical rail, selected canonical detail,
peer rows, mutation-safety banner, raw payload disclosure, and guarded
unsupported actions. This child proposal must close strict parity evidence and
strengthen real Gateway validation.

## Goals / Non-Goals

**Goals:**

- Confirm the active Identity prototype and reconcile it with current Gateway,
  BFF, and Deck-facing identity contract truth.
- Audit production Identity code, handoff files, mock fixtures, and real E2E
  against the strengthened head remediation standard.
- Fix deterministic visual, interaction, i18n, fixture, route-wrapper,
  mutation-evidence, or documentation drift when supported by code truth.
- Preserve BFF-only browser access for identity list, link, unlink, and agent
  identity data.
- Exercise representative real product data through identity list and, when
  `configHash` is available, a run-scoped disposable link/unlink fixture.
- Validate that unsupported create, rename, delete, peer activity, and recent
  mutation audit remain explicit skipped-safe or projection states.
- Upgrade mock visual and real Gateway E2E to cover shell navigation, all four
  localized theme variants, safe child interactions, route-shape evidence,
  BFF-only transport, unexpected-error evidence, and structured accepted
  exceptions.
- Update Identity implementation notes, the remediation matrix, and head task
  `6.6`.

**Non-Goals:**

- Do not replace the existing Identity implementation wholesale with prototype
  files.
- Do not add create/rename/delete canonical contracts in this pass.
- Do not fabricate peer activity or recent mutation audit data as direct
  Gateway truth.
- Do not mutate user-owned identity state unless the test fixture is
  run-scoped and cleanup can refuse non-run-id targets.

## Decisions

### D1: Identity is a registry, not a user-profile/admin-key surface

The prototype is the visual and interaction reference, but the Deck/Gateway
contract truth wins. Identity product flow centers on canonical names and
channel peers.

### D2: Real mutation evidence is opportunistic and reversible

Real E2E may create a run-scoped link only when `configHash` is present and the
route accepts the fixture. Cleanup must unlink only the current run-id peer. If
real identity state is missing `configHash` or rejects the fixture for
environment reasons, record a skipped-safe handoff instead of inventing data.

### D3: Unsupported prototype actions remain explicit

Create, rename, delete, peer activity, and recent audit remain disabled,
projection, unsupported, or follow-up contract states until the Gateway/BFF
chain supports them.

### D4: Browser transport remains BFF-only

Identity browser code may call relative `/api/*` routes through the frontend
API facade, but it must not call the Gateway port or websocket directly. Real
E2E records direct Gateway HTTP or websocket attempts as failures.

## Risks / Trade-offs

- **Risk: link/unlink changes real user config.** -> Use run-scoped fixture
  names and cleanup guards; skip-safe when no reversible fixture can be proven.
- **Risk: prototype includes richer peer activity.** -> Keep explicit
  unavailable/projection states and accepted exceptions tied to current
  contracts.
- **Risk: empty real identity state.** -> Treat empty list as valid
  route-shape evidence only after route shape and UI empty state are verified.
- **Risk: direct Gateway access might slip into UI code.** -> Real E2E records
  direct Gateway HTTP/websocket attempts as failures.

## Migration Plan

1. Audit prototype files, production Identity code, contract sources, BFF
   routes, mock Gateway support, visual spec, real E2E, and mutation-evidence
   policy.
2. Patch deterministic Identity UI, i18n, API facade, fixture, mutation guard,
   or documentation drift.
3. Upgrade mock visual E2E to capture prototype-shaped registry, raw payload,
   link dialog, link mutation, unsupported actions, and all required localized
   theme variants.
4. Upgrade real Gateway E2E to verify route shapes, optional run-scoped
   link/unlink evidence, shell navigation, all localized theme variants, safe
   child interactions, BFF-only transport, and unexpected-error evidence.
5. Update implementation notes and the head matrix, validate, then archive this
   child proposal.

## Open Questions

- Whether create/rename/delete canonical actions should be added to the Deck
  identity contract.
- Whether peer activity and recent mutation audit should be first-class BFF or
  Gateway projections.
- Whether channel ids should remain open strings or become a governed taxonomy.

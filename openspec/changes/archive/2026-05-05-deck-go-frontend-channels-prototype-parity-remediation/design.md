## Context

Channels is the operator surface for OpenClaw provider connections. Its current
contract chain is already established:

`ChannelsPanel` -> `frontend-new/src/api.ts` wrappers -> Deck BFF routes:

- `GET /api/channels`
- `POST /api/channels/{channelId}/test`
- `GET /api/channels/{channelId}/throughput`
- `POST /api/channels/{channelId}/logout`
- `PATCH /api/channels/{channelId}`
- `GET /api/routing?channel=...`
- config routes used by WeCom access controls

The active prototype in `frontend-handoff/modules/channels/prototype.html`
presents a full-width list-to-detail operations workbench with KPI strip,
search/filter toolbar, channel rows, detail hero, six tabs, probe and logout
dialogs, settings forms, routing rows, and WeCom-specific access cards.

Production already moved toward that shape during the earlier real-contract
pass, but the remediation head still records Channels as "mock functional green;
parity unreviewed." This child change must therefore produce the missing
evidence and fix deterministic mismatches instead of assuming the previous pass
is enough.

## Goals / Non-Goals

**Goals:**

- Confirm `frontend-handoff/modules/channels/prototype.html` is the active
  target and `prototype-v1-codex.html` is reference-only.
- Audit production Channels against the active v2 list-to-detail prototype.
- Fix deterministic drift in list/detail layout, tab behavior, dialogs,
  localized text, mock fixtures, or route wrappers when Gateway/deck-go contract
  truth supports the prototype.
- Preserve BFF-only browser access for all channel operations.
- Keep throughput honest when the real BFF returns empty buckets.
- Keep channel creation, logout, provider config mutation, and WeCom mutations
  safe in real E2E by using skipped-safe or reversible fixture evidence unless
  disposable run-scoped channel state is established.
- Upgrade mock visual E2E and real Gateway E2E to the strengthened head standard.
- Update Channels implementation notes, matrix row, and head task `5.6`.

**Non-Goals:**

- Do not add a first-class channel creation route in this child.
- Do not invent real throughput metrics when Gateway/BFF returns zero buckets.
- Do not promote `accountDiagnostics` or `wecomAccess` into Deck-facing DTOs
  unless verification proves the BFF already supports those fields.
- Do not run destructive logout, provider account, or config mutations against
  non-disposable real OpenClaw state.
- Do not use `gateway.describe` as the Channels capability authority while the
  known describe visibility drift exists for `channels.*`.
- Do not edit generated contract artifacts unless a source contract fix requires
  regeneration.

## Decisions

### D1: Treat current implementation as a candidate, not proof

Production Channels already resembles the v2 prototype. This child should first
generate prototype-current evidence and only patch concrete gaps found by that
comparison, instead of rewriting a module that may already be near the target.

Alternative considered: rebuild Channels from the handoff files. Rejected
because the existing implementation already preserves the correct contract
wrappers and several provider-specific controls; rewriting would increase risk
without evidence.

### D2: Safe real fixture attempts stop at disposable or reversible state

Channels data normally comes from `openclaw.json` provider configuration and
real provider account state. Real E2E may inspect routes, create isolated
config-shaped fixtures only when they are reversible and run-scoped, or record a
skipped-safe circuit breaker for destructive account/provider actions.

Alternative considered: mutate a real channel config or run logout to prove the
buttons. Rejected because those actions can affect the user's real OpenClaw
channels and external provider sessions.

### D3: Rich throughput remains mock-only until a real metric source exists

The prototype uses dense throughput bars, but the current BFF throughput route
returns explicit empty buckets and zero totals in real stacks. Production should
render real buckets only when returned, and otherwise show an honest empty or
unavailable state.

Alternative considered: generate synthetic bars from timestamps or account
counts. Rejected because that would blur mock visual data with real Gateway
capability.

### D4: Dialogs should replace native confirm only if done narrowly

The prototype has modal dialogs for probe result, logout, and channel creation.
If production still uses native confirm for logout/toggle, this child may replace
only deterministic, scoped dialog behavior that can be tested without unsafe
real mutation. First-class create remains disabled or follow-up because no
create contract exists.

Alternative considered: implement the full create wizard as a local-only
surface. Rejected because it would imply unsupported channel creation.

### D5: Known BFF projections stay frontend-derived unless contract-backed

Account diagnostics, DM policy display, and WeCom access display can be
frontend/config-derived over provider-shaped payloads. They should not be
claimed as normalized server DTOs unless the contract source is extended in a
separate decision.

Alternative considered: add normalized `accountDiagnostics` and `wecomAccess`
fields now. Rejected because the current Gateway result schema is intentionally
schema-light and the previous contract pass found no requirement to expand it.

## Risks / Trade-offs

- **Risk: Real fixture creation is too risky for configured channels.** ->
  Use read-only route-shape checks plus skipped-safe evidence for destructive
  mutations, and record the missing disposable channel fixture.
- **Risk: Existing UI differs subtly from prototype but looks acceptable.** ->
  Record source-linked accepted exceptions rather than silent drift.
- **Risk: `gateway.describe` omits `channels.*`.** -> Verify direct typed RPC
  and Deck BFF route shape, and keep describe drift as a handoff issue rather
  than a UI blocker.
- **Risk: Mock rich data can overstate real capability.** -> Label rich
  throughput and provider diagnostics as mock visual coverage only when not
  backed by real routes.
- **Risk: Dialog changes touch destructive flows.** -> Keep real mutation
  skipped-safe unless the test can prove run-scoped rollback.

## Migration Plan

1. Audit prototype files, production Channels code, contract sources, BFF routes,
   mock visual spec, and real E2E spec.
2. Generate or inspect prototype-current parity evidence for the active v2
   Channels target.
3. Patch deterministic UI, i18n, fixture, or test drift found by the audit.
4. Upgrade mock visual E2E to capture list, detail, probe/settings/routing,
   WeCom, dialogs or disabled create state, and localized light variant.
5. Upgrade real E2E to verify route shapes, shell navigation, dark/en and
   light/zh variants, search/filter/detail/tab interactions, BFF-only transport,
   unexpected errors, and skipped-safe or reversible fixture evidence.
6. Update implementation notes and the head matrix, validate, then archive this
   child proposal.

## Open Questions

- Whether a future proposal should add disposable channel fixtures through an
  isolated `openclaw.json` copy for config patch coverage.
- Whether a future Gateway/BFF metric source should back real channel
  throughput.
- Whether `gateway.describe` should advertise `channels.status` and
  `channels.logout` consistently with typed RPC availability.

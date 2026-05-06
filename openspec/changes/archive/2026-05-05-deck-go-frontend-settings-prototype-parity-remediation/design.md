## Context

Settings is the operator preference surface for deck-go itself. Its contract
chain is:

`frontend-new/src/api.ts` -> Deck BFF routes:

- `GET /api/settings`
- `PUT /api/settings`
- `POST /api/settings/test-connection`
- `GET /api/settings/version`
- `GET /api/bootstrap/status`
- `GET /api/runtime/capabilities`
- `GET /api/runtime/endpoint`
- `PUT /api/runtime/endpoint`
- `POST /api/runtime/endpoint:test`
- `GET /api/devices`
- `GET /api/devices/self`
- device mutation routes for pairing and token actions

The active prototype in `frontend-handoff/modules/settings/prototype.html`
presents Settings as a focused app-preferences product:

- topbar with saved/unsaved state;
- left rail with search and six sections;
- right-side group renderer for identity, runtime, appearance, notifications,
  paired devices, and version;
- explicit bundled/remote runtime semantics;
- draft state, reset, save, test-connection, rotate-token, unpair, and save
  confirmation dialogs.

Production already uses the right BFF route family and enforces some write
safety, but it currently renders a KPI strip and two-column card workbench. Its
real E2E checks mostly direct-open the panel in dark/en and do not prove shell
navigation, light/zh, section interactions, or safe run-scoped data creation.

## Goals / Non-Goals

**Goals:**

- Align Settings production UI with the active section-rail prototype while
  preserving current BFF and runtime-mode contract truth.
- Keep all browser access behind deck-go BFF wrappers.
- Keep bundled runtime endpoint fields read-only and remote endpoint edits
  gated by `endpointMutable`.
- Make local settings edits draft-based, with reset/save confirmation and
  structured save result evidence.
- Strengthen mock evidence for section switching, search, draft edits, dialogs,
  localized state, and no inline styles.
- Strengthen real E2E for shell navigation, dark/light, English/Chinese,
  section/subpage interactions, BFF-only transport, rejected unsafe writes, and
  safe run-scoped settings fixture data.
- Record unsupported prototype projections and destructive real mutations as
  accepted exceptions instead of hiding them.

**Non-Goals:**

- Do not add access-token rotation support unless a current deck-go/Gateway
  contract is found to support it safely.
- Do not mutate device tokens, installed devices, external accounts, user
  memory, or global OpenClaw state in real E2E.
- Do not add recent-save audit history, keybinding, privacy, or notification
  delivery contracts in this child.
- Do not change runtime mode at runtime; mode remains `.env`-driven.
- Do not edit generated contract artifacts unless a source contract fix requires
  regeneration.

## Decisions

### D1: Translate the active section-rail prototype rather than restyling cards

Production should use the prototype's topbar + searchable section rail + single
group editor. The existing two-column card workbench is contract-useful but not
the visual/interaction target for this remediation.

Alternative considered: keep the current cards and improve density. Rejected
because the head remediation requires active prototype parity or explicit
accepted exceptions, and Settings has a clear active v2 prototype.

### D2: Draft settings own only safe local preferences

The draft save payload should continue to include only `appearance`,
`notifications`, and `pairedDevices`, matching backend write safety. The UI may
display identity/runtime/device concepts, but it must not send `accessToken`,
`managedGateway`, supervisor, or runtime endpoint fields through
`PUT /api/settings`.

Alternative considered: use one large draft object and let the backend reject
unsafe keys. Rejected because the frontend should not imply unsupported writes
and tests should prove the safe payload shape.

### D3: Runtime endpoint editing remains delegated to `EndpointSection`

The existing runtime endpoint component already understands capability-gated
remote edits and the `__unchanged__` token sentinel. Settings should embed that
capability in the Runtime section rather than reimplementing endpoint save/test
logic.

Alternative considered: implement a bespoke runtime group from the prototype.
Rejected because it risks drifting from proven remote/bundled semantics.

### D4: Real fixture data uses isolated Settings save, not destructive device actions

Real E2E can safely create a run-scoped settings fixture through
`PUT /api/settings` in the isolated stack by writing appearance,
notifications, and a synthetic paired-device record containing the current run
id. Cleanup must restore only the original safe settings snapshot or remove only
run-scoped paired-device entries.

Device token rotation/revoke/remove and access-token rotation remain
skipped-safe in real E2E unless a future proposal provides disposable device
fixtures and rollback.

### D5: Unsupported projections stay visible but labelled

The prototype includes recent-save history, access-token rotation, and richer
notification/device stories than current Deck-facing contracts guarantee.
Production may show unavailable, projected, or read-only states, but it must not
claim those as real contract-backed capabilities.

## Risks / Trade-offs

- **Risk: Settings touches security-sensitive concepts.** -> Keep mutation
  payloads narrow, preserve secret redaction, and verify unsafe writes are
  rejected.
- **Risk: Paired-device local settings fixture can be confused with real device
  inventory.** -> Label local settings paired devices separately from real
  device route data and record fixture origin in evidence.
- **Risk: Remote endpoint tests are environment-dependent.** -> Treat endpoint
  test failures as degraded only when route shape is proven and bundled
  immutability is respected.
- **Risk: Prototype has richer history than contracts.** -> Use accepted
  exceptions for recent saves and destructive token/device actions.
- **Risk: Section rail can hide important status context.** -> Keep summary
  status badges in the topbar and per-section badges in the nav.

## Migration Plan

1. Audit prototype, production Settings code, contract sources, backend routes,
   mock visual spec, and real E2E fixture options.
2. Rework `SettingsPanel` and CSS into the prototype-shaped section rail while
   preserving API wrappers and runtime/device logic.
3. Add or update i18n for section labels, field rows, dialogs, and accepted
   unavailable states.
4. Update unit tests for section search/switching, draft save/reset, runtime
   endpoint safety, device dialogs, and localized rendering.
5. Update mock visual E2E to capture the prototype-shaped ready state,
   representative dialogs, and localized/light variant.
6. Update real E2E to seed run-scoped safe Settings data, verify shell
   navigation and variants, assert BFF-only transport, and record skipped-safe
   destructive mutations.
7. Update implementation notes and matrix, validate, then archive this child
   proposal.

## Open Questions

- Whether a future proposal should add a durable recent-save audit route.
- Whether access-token rotation should be a deck-go BFF feature, a Gateway
  feature, or remain config-file-only.
- Whether paired devices should be product-owned local settings or fully
  derived from Gateway/device inventory routes.

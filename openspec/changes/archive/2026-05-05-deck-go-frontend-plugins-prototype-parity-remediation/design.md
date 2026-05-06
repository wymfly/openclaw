## Context

Plugins is a read-only Deck BFF/Gateway inventory surface. The contract chain is:

`frontend-new/src/api.ts` -> `GET /api/deck/plugins` or
`GET /api/deck/plugins?capability=all` -> Go backend route
`/deck/plugins` -> Gateway RPC `deck.plugins.list` -> OpenClaw plugin snapshot
report.

The active prototype in `frontend-handoff/modules/plugins/prototype.html`
presents that inventory as a focused list/detail product:

- list view with KPI strip, toolbar filters, dense rows, and status/source/
  diagnostics columns;
- detail view opened from a row, with back navigation and tabs for Overview,
  Capabilities, Diagnostics, Activation, Manifest, and Audit;
- dialogs for diagnostic detail, manifest preview, and raw inventory JSON;
- explicit read-only posture, with no install/uninstall/enable/disable/reload
  controls.

The current production panel already uses the correct BFF route and handles
empty real inventory, but its layout is a two-pane workbench and its real E2E
does not satisfy the strengthened head standard for shell navigation, theme and
locale variants, child interaction, or fixture attempts.

## Goals / Non-Goals

**Goals:**

- Align Plugins production UI with the active list-to-detail prototype while
  preserving contract truth.
- Keep every data load behind deck-go BFF wrappers.
- Strengthen mock evidence to cover populated list, detail tabs, dialogs,
  filters, scope switching, and localized UI.
- Strengthen real E2E to cover shell navigation, dark/light, English/Chinese,
  tabs/dialogs or empty-valid fallback, BFF-only transport, and a bounded
  attempt at representative run-scoped plugin fixture data.
- Record unsupported prototype projections as explicit accepted exceptions.

**Non-Goals:**

- Do not add plugin lifecycle mutations.
- Do not add marketplace, trust-source, or package-signature contracts.
- Do not add a new manifest or audit BFF route in this child proposal.
- Do not mutate operator-global plugin state or external channel accounts.

## Decisions

### D1: Product shell follows the active list/detail prototype

Production should open with a Plugins list view. Selecting a row transitions to
a detail view with a back button rather than keeping the old split-pane
workbench as the primary layout.

Alternative considered: keep the current two-pane implementation and only style
it more densely. Rejected because the head remediation goal is prototype parity,
and this module's active prototype explicitly models a page-transition flow.

### D2: Unsupported projections stay visible but degraded

The prototype includes Manifest and Audit tabs plus manifest/raw dialogs. The
current contract only guarantees `DeckGoPluginInventoryEntry`. Production may
render a synthetic manifest projection and activation evidence from inventory
fields, but it must clearly label absent route-backed data.

Alternative considered: hide unsupported tabs. Rejected because hiding them
would reduce parity and obscure useful contract gaps that operators need to see.

### D3: Real fixture creation is attempted through safe config/workspace paths

Plugins inventory is derived from the OpenClaw plugin registry and
`openclaw.json` policy. The real E2E should attempt a run-scoped fixture only
when it can be written into the isolated real E2E config/workspace without
touching installed plugin packages, external accounts, credentials, or global
state.

If the registry cannot include a new plugin from config alone, or if loading an
external plugin would require package installation/runtime side effects, the
test records a skipped-safe fixture attempt and still validates real route
envelopes, shell navigation, variants, empty-valid handling, and BFF-only
transport.

### D4: Deterministic defects are fixed in this child

If the remediation finds stale mock data, missing i18n, tab/dialog interaction
bugs, DTO nullability issues, direct Gateway transport, or route-shape drift, it
must fix them before archive. Only environment-dependent real Gateway blockers
or unsupported Gateway capabilities can be handed off.

## Risks / Trade-offs

- **Risk: Real plugin inventory may remain empty in allow-unconfigured stacks.**
  -> Attempt safe fixture creation first; if unsafe or unsupported, record the
  method and reason as skipped-safe while still validating real read/UI paths.
- **Risk: Prototype includes richer manifest/audit concepts than current DTOs.**
  -> Render synthetic/degraded states and document them as accepted exceptions.
- **Risk: List/detail rewrite disrupts existing useful channel handoffs.**
  -> Preserve handoff buttons/actions inside Overview or Capabilities and keep
  tests for channel/routing/access handoffs.
- **Risk: More UI state increases test fragility.** -> Add focused unit tests
  for list/detail/tabs/dialogs and keep Playwright assertions user-visible.

## Migration Plan

1. Audit active prototype, production code, API wrappers, mock data, and real
   E2E fixture options.
2. Rework `PluginsPanel` into the prototype-shaped list/detail flow.
3. Update i18n and CSS for dense rows, detail tabs, activation chain, and
   dialogs.
4. Update unit and mock visual coverage for the prototype states.
5. Strengthen real Gateway E2E with fixture attempt evidence, shell navigation,
   variants, child interactions, and BFF-only guards.
6. Update implementation notes and the remediation matrix, then validate and
   archive this child proposal.

## Open Questions

- Whether a future proposal should add dedicated manifest and activation-audit
  BFF projection routes.
- Whether plugin lifecycle controls should ever be Deck-owned, Gateway-owned, or
  kept CLI-only.

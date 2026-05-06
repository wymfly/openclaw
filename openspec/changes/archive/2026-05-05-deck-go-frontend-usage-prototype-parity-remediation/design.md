## Context

Usage is Deck's read-only model cost, provider quota, and session-usage
cockpit. The current browser-to-Gateway contract chain is:

`UsagePanel` -> `frontend-new/src/api.ts` Usage wrappers -> `/api/usage/*` Deck
BFF routes -> Go inventory route handlers -> Gateway usage/session telemetry.

The Deck-facing DTO authority is `contracts/source/deck-api.contract.ts`.
Usage currently exposes cost daily entries, provider quota windows, session
usage rows, session logs, and session timeseries. The active visual target is
`frontend-handoff/modules/usage/prototype.html`. Production already has a
read-only cockpit with KPI cards, charts, provider quota detail, and expandable
session rows, but the head matrix has not verified strict prototype parity or
the strengthened real Gateway product-flow evidence.

## Goals / Non-Goals

**Goals:**

- Confirm the active Usage prototype and reconcile it with current Gateway,
  BFF, Deck-facing DTO, and frontend wrapper truth.
- Audit production Usage code, handoff files, mock fixtures, and real E2E
  against the strengthened head remediation standard.
- Fix deterministic visual, interaction, i18n, fixture, route-wrapper, or
  documentation drift when supported by code truth.
- Preserve BFF-only browser access for cost, providers, sessions, logs, and
  timeseries.
- Exercise representative real route shapes and UI states without claiming
  billing-grade accuracy or unsupported quota/forecast behavior.
- Upgrade mock visual and real Gateway E2E to cover shell navigation, all four
  localized theme variants, safe child interactions, route-shape evidence,
  BFF-only transport, unexpected-error evidence, and accepted exceptions.
- Update Usage implementation notes, the remediation matrix, and head task
  `6.12`.

**Non-Goals:**

- Do not add Usage mutations.
- Do not add tenant accounting, billing export, forecast, or budget
  recommendation endpoints.
- Do not add a new charting dependency.
- Do not replace the production module wholesale with prototype files.
- Do not mutate user OpenClaw config or workspace state for Usage real E2E.

## Decisions

### D1: Usage remains a read-only product cockpit

The prototype is the visual and interaction reference, but the
Deck/Gateway/BFF contract truth wins. Production can display cost, provider,
session, log, and timeseries DTOs and local UI filters/sorts derived from those
DTOs, but it must not expose unsupported billing, forecast, tenant, or quota
mutation controls as working product features.

### D2: Chart fidelity follows current dependencies

The prototype may show richer chart treatments. Production must use the current
design-system/CSS/React primitives unless a dependency decision is separately
approved. Dependency-gated Recharts fidelity is an accepted exception for this
child proposal.

### D3: Real evidence is route-shape and product-flow first

The real Gateway may return empty or sparse usage data. That is valid evidence
for current contract behavior. Real E2E must still verify runtime readiness,
route shapes, shell navigation, theme/locale variants, BFF-only transport, and
unexpected-error checks.

### D4: Browser transport remains BFF-only

Usage browser code may call relative `/api/*` routes through the frontend API
facade, but it must not call the Gateway port directly.

## Risks / Trade-offs

- **Risk: prototype implies billing authority.** -> Record billing-grade
  accuracy, exports, and forecasts as accepted exceptions unless verified
  Gateway contracts exist.
- **Risk: mock fixtures overstate real telemetry richness.** -> Use dense
  mock rows for visual coverage only; real E2E records sparse/empty outcomes
  honestly.
- **Risk: dependency-gated charts drift visually.** -> Keep chart treatment
  close within existing primitives and record Recharts-grade fidelity as a
  non-goal.
- **Risk: session detail rows are absent in real data.** -> Verify empty-valid
  UI and route shape, and only exercise logs/timeseries when a real session key
  is available.

## Migration Plan

1. Audit prototype files, production Usage code, contract sources, BFF routes,
   mock Gateway support, visual spec, and real E2E.
2. Patch deterministic Usage UI, i18n, API facade, fixture, or documentation
   drift.
3. Upgrade mock visual E2E to capture cost cockpit, provider quota, sessions,
   detail tabs, filters/sorts, and all required localized theme variants.
4. Upgrade real Gateway E2E to verify route shapes, shell navigation, all
   localized theme variants, safe child interactions, BFF-only transport,
   unexpected-error evidence, and empty-valid/skipped-safe policy.
5. Update implementation notes and the head matrix, validate, then archive this
   child proposal.

## Open Questions

- Whether Deck should add billing export and forecast contracts.
- Whether quota policy should become configurable from Deck or remain read-only
  Gateway telemetry.
- Whether tenant/account-level accounting should be a Gateway source contract
  or a Deck product aggregation.
- Whether richer chart dependencies should be adopted globally by the frontend
  design system.

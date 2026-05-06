## Context

Activity has two overlapping histories:

- the archived high-fidelity and real-contract passes proved useful BFF routes, monitor projections, and current UI behavior;
- the active `frontend-handoff/modules/activity/prototype.html` package now defines a different product surface: a single unified event feed with a modal inspector.

The head remediation change makes the active prototype visual truth unless it conflicts with Gateway/deck-go contract truth. For Activity, the prototype does not require unsupported Gateway features. It uses the already-supported `DeckGoActivityResponse` snapshot and can keep `activity.event` live updates. The monitor run read models remain valid contracts, but the active Activity page no longer needs to expose them directly.

## Goals / Non-Goals

**Goals:**

- Bring the production Activity page into structural alignment with the active flat-feed prototype.
- Keep the browser on Deck BFF endpoints only.
- Preserve live `activity.event` merge behavior.
- Make unknown event types safe and visible through generic family/severity handling.
- Add mock functional, mock prototype parity, and strengthened real Gateway evidence.
- Use safe run-scoped real seed attempts so real Activity evidence can show representative data when the cpa/main environment allows it.

**Non-Goals:**

- Do not delete `/api/monitor/runs`, `/api/monitor/stats`, or monitor projection code.
- Do not introduce a virtualization dependency in this child proposal.
- Do not invent closed schemas for every activity event `details` payload.
- Do not require real LLM seeding to pass unconditionally; use the bounded circuit breaker if the environment blocks it.
- Do not move monitor diagnostics into a new production module in this child proposal.

## Decisions

### D1: Active prototype wins for Activity page structure

The Activity page will become the flat feed from the active prototype. The older monitor diagnostics surface is a useful observability capability, but keeping it inside Activity would preserve the largest source of prototype drift.

Alternative considered: keep monitor cards as accepted exceptions. Rejected because the difference is structural and would make Activity fail the remediation head's parity goal.

### D2: Preserve monitor contracts outside Activity UI

The remediation removes monitor cards from the Activity page but leaves backend routes, frontend wrappers, and existing contracts intact. Other surfaces such as Gateway or Usage can still use those read models.

Alternative considered: delete unused monitor wrappers. Rejected because they are part of the broader control/observability contract chain and previous proposals verified them.

### D3: Derive family and severity client-side until contract expands

`DeckGoActivityEvent.type` remains an open string. The panel will derive display family and severity from known type prefixes and fall back to muted/generic presentation for unknown types.

Alternative considered: add severity/family to Deck API now. Rejected because Gateway truth does not currently require that product contract change and client-side projection is sufficient for the UI.

### D4: Use modal inspection instead of inline selected detail

Each feed row opens an `EventDetailDialog` with raw JSON and copy support, matching the prototype and keeping the main page dense but scannable.

Alternative considered: retain the selected-event side card. Rejected because it is one of the production/prototype layout mismatches.

### D5: Real E2E seeds through safe cpa/main chat when possible

Activity's real data comes from event projections. The safest representative seed is a run-scoped chat/session create attempt using existing real E2E helper isolation. The test records whether the seed passed, degraded, or circuit-broke, then still validates the Activity UI against whatever real BFF state exists.

Alternative considered: hand-edit projection files or inject event bus rows from the test. Rejected because that would not validate real Gateway/deck-go behavior.

## Risks / Trade-offs

- **Risk: Removing monitor cards looks like capability loss.** -> The monitor contracts and routes remain; this child proposal only changes the Activity page product surface.
- **Risk: Real Activity data remains sparse when cpa/main seed fails.** -> Record bounded seed evidence and still validate empty/degraded UI, BFF shape, navigation, variants, and interactions.
- **Risk: Large feeds could need virtualization.** -> Keep the no-new-dependency implementation now; record virtualization as future performance work if real volumes require it.
- **Risk: Prototype labels are English-only.** -> Production keeps i18n for English and Chinese while matching structure and density.

## Migration Plan

1. Replace Activity production layout with the flat feed, filter toolbar, KPI strip, and dialog inspector.
2. Update unit tests to cover filters, SSE merge, keyboard/pointer dialog behavior, unknown event types, and BFF-only wrapper use.
3. Update mock visual E2E to assert prototype-shaped UI and interactions.
4. Update real Gateway E2E to seed safe run-scoped activity data when possible and validate navigation/theme/locale/interaction coverage.
5. Generate Activity prototype parity evidence and record verdict/accepted exceptions.
6. Validate and archive the child proposal, then mark the Activity row/task complete in the head change.

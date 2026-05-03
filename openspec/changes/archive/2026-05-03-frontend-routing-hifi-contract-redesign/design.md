## Context

`frontend-new` already has a functional `RoutingPanel` with filters, binding validation, add/remove/reorder flows, route simulation, DM scope patching, conflict detection, and routing-related activity feed. It is wired through `src/api.ts` wrappers that call `GET /deck/routing` and `POST /deck/routing` action envelopes, which the Go backend adapts to `deck.routing.list/add/remove/validate/simulate` Gateway methods when available.

The missing piece is convergence: `frontend-handoff/modules/routing/` does not exist, the current UI is visually and structurally legacy, and `test/fixtures/mock-gateway.mjs` does not currently provide routing data for a focused visual E2E. Current contract truth is limited to the `DeckGoRouting*` DTOs and BFF route envelope; any richer ideal product behavior must be documented as future work unless supported by Gateway/backend code.

## Goals / Non-Goals

**Goals:**

- Produce a complete routing handoff package with a high-fidelity `prototype.html` and protocol documents.
- Rewrite the production routing panel into a compact enterprise workbench aligned with chat/agents typography, spacing, color, and density.
- Preserve known-correct routing behavior: filters, DM scope patching, validate/add/remove/reorder, selected binding navigation, route simulation, activity feed, conflict detection, and first-run Gateway-not-configured handling.
- Add contract-shaped mock routing data and visual E2E coverage.
- Record routing design-system learnings after agents so repeated molecules can be promoted deliberately rather than accidentally.

**Non-Goals:**

- No real Gateway/LLM routing E2E in this change; verification is mock visual and frontend-focused.
- No generated contract edits unless implementation finds deterministic source drift.
- No new dependencies or broad atom re-architecture.
- No UI that implies unsupported server-side pagination, route history persistence, live conflict subscriptions, or richer Gateway fields.

## Decisions

1. **Treat `DeckGoRouting*` as the UI data boundary.**
   The panel will continue consuming `fetchRoutingBindings`, `validateRoutingBinding`, `addRoutingBinding`, `removeRoutingBinding`, and `simulateRouting`. Raw endpoint/action strings remain in `src/api.ts` and tests only. This keeps production code aligned with the existing contract chain and avoids mixing Gateway method names into view code.

2. **Use a three-region workbench instead of the old two-card shell.**
   Routing needs simultaneous scan, selection, and test-loop behavior. The handoff and production panel will prioritize:
   - a top command/health strip,
   - a left binding queue with deterministic order and conflict markers,
   - a right detail/simulator/activity workspace.
     On small viewports this collapses to one column without changing the workflow.

3. **Keep mutation affordances explicit and hash-aware.**
   Add/remove/reorder and DM scope patching depend on `configHash`/base-hash behavior. The UI must keep hash state visible enough for operators to understand stale-write risk, but it must not expose implementation noise as the primary task.

4. **Promote nothing to canonical atoms in this pass unless routing repeats agents patterns exactly and the implementation benefit is clear.**
   Agents introduced local metric tiles, section headers, status dots, and preview rows. Routing will reuse the same token posture and can reuse similar local CSS, but canonical promotion waits until routing evidence is recorded. This avoids locking premature atoms before subagents and other panels test the same patterns.

5. **Mock visual E2E uses backend-shaped routes, not component-only mocks.**
   The visual test should run the real Vite frontend against `test/fixtures/mock-gateway.mjs` or the existing mock stack path so CSS/layout, route wiring, and API facade behavior are exercised together. Unit tests still cover payload normalization and action calls.

## Risks / Trade-offs

- **Risk: Routing UI remains information-heavy.** → Mitigate by grouping data into queue, selected binding, simulator, and activity sections, with raw JSON payloads collapsed behind details.
- **Risk: Current local conflict detection differs from backend/Gateway validation.** → Keep local conflict detection as advisory UI only and preserve validate action as the contract-backed result.
- **Risk: Reorder via remove+add is operationally lossy if Gateway later gains a first-class reorder action.** → Preserve current behavior but document it in handoff discrepancy notes.
- **Risk: Mock visual coverage could be mistaken for real Gateway proof.** → Name the E2E and closeout evidence explicitly as mock visual only.
- **Risk: Existing theme.css routing selectors conflict with the redesigned panel.** → Prefer a module-local `routing-panel.css` using `--ds-*` tokens and remove or narrow obsolete global routing selectors when safe.

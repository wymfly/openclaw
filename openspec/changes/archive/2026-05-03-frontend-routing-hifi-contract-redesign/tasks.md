## 1. Contract And Baseline

- [x] 1.1 Record the current routing contract chain from `DeckGoRouting*` DTOs, `/deck/routing` API wrappers, Go BFF handlers, and Gateway adapter methods.
- [x] 1.2 Identify deterministic UI/API drift that can be safely fixed in this change and document uncertain product/Gateway gaps for handoff.

## 2. Handoff Package

- [x] 2.1 Create `frontend-handoff/modules/routing/README.md` with status, contract truth, implementation notes, and open questions.
- [x] 2.2 Create `prototype.html` as a high-fidelity routing workbench aligned with chat/agents design-system posture.
- [x] 2.3 Create `components.md`, `states.md`, `interactions.md`, and `api-usage.md` covering tree, state machine, accessibility, and endpoint usage.

## 3. Production Routing UI

- [x] 3.1 Rewrite `RoutingPanel` around the handoff workbench while preserving existing API wrappers, navigation hooks, and core actions.
- [x] 3.2 Replace obsolete routing global styling with module-local or narrowed CSS using `--ds-*` tokens and responsive constraints.
- [x] 3.3 Preserve or update routing unit tests for load, filter, simulation, validation, mutation, reorder, navigation, i18n, and Gateway-not-configured behavior.

## 4. Mock Visual Verification

- [x] 4.1 Add contract-shaped routing data and action responses to the mock Gateway fixture.
- [x] 4.2 Add a focused routing mock visual E2E covering the ready workbench and at least one interaction state.

## 5. Design-System Feedback

- [x] 5.1 Update the cross-module readiness record with routing evidence, repeated agents/routing molecules, and follow-up promotion candidates.
- [x] 5.2 Update the OpenSpec design-system delta target if implementation changes the readiness requirement details.

## 6. Verification

- [x] 6.1 Run `openspec validate frontend-routing-hifi-contract-redesign --strict`.
- [x] 6.2 Run focused routing unit tests and mock visual E2E.
- [x] 6.3 Run the relevant frontend build/check and confirm the change is archive-ready.

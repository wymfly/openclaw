## 1. Contract And Baseline

- [x] 1.1 Record the current subagents contract chain from `DeckGoSubagent*` DTOs, `/deck/subagents` API wrappers, Go BFF handlers, and Gateway adapter methods.
- [x] 1.2 Fix deterministic BFF/query drift where `agentId` is not forwarded from `GET /deck/subagents`.
- [x] 1.3 Identify uncertain product/Gateway gaps and document them for handoff.

## 2. Handoff Package

- [x] 2.1 Create `frontend-handoff/modules/subagents/README.md` with status, contract truth, implementation notes, and open questions.
- [x] 2.2 Create `prototype.html` as a high-fidelity subagents operations workbench aligned with chat/agents/routing.
- [x] 2.3 Create `components.md`, `states.md`, `interactions.md`, and `api-usage.md` covering tree, state machine, accessibility, and endpoint usage.

## 3. Production Subagents UI

- [x] 3.1 Rewrite `SubagentsPanel` around the handoff workbench while preserving existing API wrappers, navigation hooks, polling, and core actions.
- [x] 3.2 Replace obsolete subagents global styling with module-local or narrowed CSS using `--ds-*` tokens and responsive constraints.
- [x] 3.3 Preserve or update subagents unit tests for load, filter, lineage, config defaults, steer, kill, navigation, i18n, and child-agent filter forwarding.

## 4. Mock Visual Verification

- [x] 4.1 Add contract-shaped subagents data and action responses to the mock Gateway fixture.
- [x] 4.2 Add a focused subagents mock visual E2E covering the ready workbench and at least one interaction state.

## 5. Design-System Feedback

- [x] 5.1 Update the cross-module readiness record with subagents evidence, repeated agents/routing/subagents molecules, and promotion candidates.
- [x] 5.2 Update the OpenSpec design-system delta target if implementation changes the readiness requirement details.

## 6. Verification

- [x] 6.1 Run `openspec validate frontend-subagents-hifi-contract-redesign --strict`.
- [x] 6.2 Run focused subagents unit tests and mock visual E2E.
- [x] 6.3 Run the relevant backend/frontend build/check and confirm the change is archive-ready.

## 1. Contract And Baseline

- [x] 1.1 Record the current gateway contract chain from runtime status/capabilities DTOs, Gateway health/status DTOs, activity/monitor DTOs, API wrappers, UI store inputs, and Go BFF handlers.
- [x] 1.2 Confirm whether there is deterministic runtime/Gateway/activity/monitor mock or forwarding drift; fix only if found.
- [x] 1.3 Identify uncertain runtime lifecycle, Gateway health/status, or monitor projection gaps and document them for handoff.

## 2. Handoff Package

- [x] 2.1 Create `frontend-handoff/modules/gateway/README.md` with status, contract truth, implementation notes, workflow constraints, and open questions.
- [x] 2.2 Create `prototype.html` as a high-fidelity runtime diagnostics workbench aligned with the current design-system posture.
- [x] 2.3 Create `components.md`, `states.md`, `interactions.md`, and `api-usage.md` covering runtime summary, diagnostics, activity feed, monitor history, timeline detail, first-run empty state, refresh, accessibility, and endpoint usage.

## 3. Production Gateway UI

- [x] 3.1 Rewrite `GatewayPanel` around the handoff workbench while preserving runtime tabs or equivalent navigation, runtime load/refresh, diagnostics, activity feed, monitor history, timeline detail, remote/bundled runtime fields, and first-run empty behavior.
- [x] 3.2 Restyle gateway runtime/diagnostic/history/timeline rows with design-system atoms/local classes without widening public API unnecessarily.
- [x] 3.3 Replace obsolete gateway global styling with module-local or narrowed CSS using `--ds-*` tokens and responsive constraints.
- [x] 3.4 Preserve or update gateway unit tests for bundled summary, no lifecycle action buttons, runtime state matrix, remote fields, first-run empty state, history-to-timeline selection, and inline style absence.

## 4. Mock Visual Verification

- [x] 4.1 Add or update contract-shaped runtime/Gateway health/status/activity/monitor data in the mock stack if visual E2E gaps are found.
- [x] 4.2 Add a focused gateway mock visual E2E covering the ready workbench and at least one interaction state such as runtime tab, history-to-timeline selection, or Gateway-not-configured state.

## 5. Design-System Feedback

- [x] 5.1 Update the cross-module readiness record with gateway evidence, repeated molecules, runtime diagnostics/activity/timeline molecules, and promotion candidates.
- [x] 5.2 Update the OpenSpec design-system delta target if implementation changes the readiness requirement details.

## 6. Verification

- [x] 6.1 Run `openspec validate frontend-gateway-hifi-contract-redesign --strict`.
- [x] 6.2 Run focused gateway unit tests and mock visual E2E.
- [x] 6.3 Run the relevant frontend build/check and confirm the change is archive-ready.

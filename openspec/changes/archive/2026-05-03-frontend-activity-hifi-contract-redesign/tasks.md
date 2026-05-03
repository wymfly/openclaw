## 1. Contract And Baseline

- [x] 1.1 Record the current Activity contract chain from Deck-facing DTOs, Go BFF handlers, API wrappers, UI metadata, SSE stream, and mock Gateway payloads.
- [x] 1.2 Confirm deterministic drift in mock Gateway activity/monitor data, endpoint classification, or generated DTOs; fix only if found.
- [x] 1.3 Identify uncertain real Gateway projection behavior and document it for handoff.

## 2. Handoff Package

- [x] 2.1 Create `frontend-handoff/modules/activity/README.md` with status, contract truth, workflow constraints, implementation notes, and open questions.
- [x] 2.2 Create `prototype.html` as a high-fidelity activity operations timeline workspace aligned with the current design-system posture.
- [x] 2.3 Create `components.md`, `states.md`, `interactions.md`, and `api-usage.md` covering filters, grouped timeline, run inventory, diagnostics, cross-panel handoffs, payload detail, and empty/error/loading states.

## 3. Production Activity UI

- [x] 3.1 Rewrite `ActivityPanel` around the handoff workspace while preserving fetch, SSE merge, filter, grouping, selection, pagination, run detail, diagnostics, and navigation behavior.
- [x] 3.2 Restyle activity timeline rows, monitor run rows, metrics, top-agent shortcuts, diagnostic stacks, and payload detail with design-system tokens/local classes without widening public API unnecessarily.
- [x] 3.3 Replace obsolete Activity global styling with module-local or narrowed CSS using `--ds-*` tokens and responsive constraints.
- [x] 3.4 Preserve or update Activity unit tests for load/sort/select, monitor data, filters, pagination, navigation handoffs, grouping, SSE merge, empty, and error states.

## 4. Mock Visual Verification

- [x] 4.1 Add or update contract-shaped activity/monitor data in the mock Gateway if visual E2E gaps are found.
- [x] 4.2 Add a focused Activity mock visual E2E covering the ready workspace and at least one interaction state such as filtering, group collapse, selected run diagnostics, or handoff affordances.
- [x] 4.3 Inspect generated screenshots for text overlap, blank panes, density problems, and incorrect mock-only labeling.

## 5. Design-System Feedback

- [x] 5.1 Update the cross-module readiness record with Activity evidence, repeated molecules, timeline/list/diagnostic/detail patterns, and promotion candidates.
- [x] 5.2 Update the OpenSpec design-system delta target if implementation changes the readiness requirement details.

## 6. Verification

- [x] 6.1 Run `openspec validate frontend-activity-hifi-contract-redesign --strict`.
- [x] 6.2 Run focused Activity unit tests and mock visual E2E.
- [x] 6.3 Run the relevant frontend build checks and confirm the change is archive-ready.

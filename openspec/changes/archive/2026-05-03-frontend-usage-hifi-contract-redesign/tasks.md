## 1. Contract And Baseline

- [x] 1.1 Record the current Usage contract chain from Deck-facing DTOs, generated Gateway usage/session DTOs, API wrappers, UI metadata, Go BFF handlers, and mock Gateway methods.
- [x] 1.2 Confirm deterministic drift in mock Gateway usage/session/provider/context data, endpoint classification, or generated Deck-facing DTOs; fix only if found.
- [x] 1.3 Identify uncertain real Gateway billing/quota/session/context aggregation semantics and document them for handoff.

## 2. Handoff Package

- [x] 2.1 Create `frontend-handoff/modules/usage/README.md` with status, contract truth, workflow constraints, implementation notes, and open questions.
- [x] 2.2 Create `prototype.html` as a high-fidelity usage operations cockpit aligned with the current design-system posture.
- [x] 2.3 Create `components.md`, `states.md`, `interactions.md`, and `api-usage.md` covering summaries, trends, provider quota, session drilldown, aggregates, behavior signals, context pressure, refresh, and navigation handoffs.

## 3. Production Usage UI

- [x] 3.1 Rewrite `UsagePanel` around the handoff cockpit while preserving load/refresh, range, provider selection, trend switching, session expansion, logs, timeseries, context weight, and navigation behavior.
- [x] 3.2 Update Usage subcomponents only as needed to fit the new module-local cockpit without changing their data semantics.
- [x] 3.3 Restyle KPI/chart/quota/table/session/context rows with design-system tokens/local classes without widening public API unnecessarily.
- [x] 3.4 Replace obsolete Usage global styling with module-local or narrowed CSS using `--ds-*` tokens and responsive constraints.
- [x] 3.5 Preserve or update Usage unit tests for load calls, range refresh, provider selection, trend switching, session drilldown, lazy detail loading, and navigation handoffs.

## 4. Mock Visual Verification

- [x] 4.1 Add or update contract-shaped usage cost/provider/session/log/timeseries/context data in the mock Gateway if visual E2E gaps are found.
- [x] 4.2 Add a focused Usage mock visual E2E covering the ready cockpit and at least two interaction states such as range refresh, trend view switching, provider quota selection, or session drilldown.
- [x] 4.3 Inspect generated screenshots for text overlap, blank panes, density problems, and incorrect mock-only labeling.

## 5. Design-System Feedback

- [x] 5.1 Update the cross-module readiness record with Usage evidence, repeated molecules, chart/KPI/quota/table/session/context patterns, and promotion candidates.
- [x] 5.2 Update the OpenSpec design-system delta target if implementation changes the readiness requirement details.

## 6. Verification

- [x] 6.1 Run `openspec validate frontend-usage-hifi-contract-redesign --strict`.
- [x] 6.2 Run focused Usage unit tests and mock visual E2E.
- [x] 6.3 Run the relevant contract/frontend build checks and confirm the change is archive-ready.

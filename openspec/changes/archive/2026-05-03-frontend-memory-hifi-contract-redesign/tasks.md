## 1. Contract And Baseline

- [x] 1.1 Record the current Memory contract chain from Deck-facing DTOs, generated Gateway doctor-memory DTOs, API wrappers, UI metadata, Go BFF handlers, and mock Gateway methods.
- [x] 1.2 Confirm deterministic drift in mock Gateway memory browse/search/health/dream data, endpoint classification, or generated Deck-facing DTOs; fix only if found.
- [x] 1.3 Identify uncertain real Gateway memory/search/LanceDB/dream semantics and document them for handoff.

## 2. Handoff Package

- [x] 2.1 Create `frontend-handoff/modules/memory/README.md` with status, contract truth, workflow constraints, implementation notes, and open questions.
- [x] 2.2 Create `prototype.html` as a high-fidelity memory operations workspace aligned with the current design-system posture.
- [x] 2.3 Create `components.md`, `states.md`, `interactions.md`, and `api-usage.md` covering browse/read, search, graph, health, dreams, confirmations, detail sidecar, and navigation states.

## 3. Production Memory UI

- [x] 3.1 Rewrite `MemoryPanel` around the handoff workspace while preserving agent selection, browse/read, search, graph, health, dreams, confirmations, and detail rendering behavior.
- [x] 3.2 Restyle file/search/graph/health/dream/detail rows with design-system tokens/local classes without widening public API unnecessarily.
- [x] 3.3 Replace obsolete Memory global styling with module-local or narrowed CSS using `--ds-*` tokens and responsive constraints.
- [x] 3.4 Preserve or update Memory unit tests for browse/read, agent switching, directory navigation, search fallback, health, dreams, confirmation guards, and detail states.

## 4. Mock Visual Verification

- [x] 4.1 Add or update contract-shaped memory browse/search/health/dream data in the mock Gateway if visual E2E gaps are found.
- [x] 4.2 Add a focused Memory mock visual E2E covering the ready workspace and at least two interaction states such as file read, search, health, dreams, or graph.
- [x] 4.3 Inspect generated screenshots for text overlap, blank panes, density problems, and incorrect mock-only labeling.

## 5. Design-System Feedback

- [x] 5.1 Update the cross-module readiness record with Memory evidence, repeated molecules, file-tree/search/graph/diagnostics/dream/detail patterns, and promotion candidates.
- [x] 5.2 Update the OpenSpec design-system delta target if implementation changes the readiness requirement details.

## 6. Verification

- [x] 6.1 Run `openspec validate frontend-memory-hifi-contract-redesign --strict`.
- [x] 6.2 Run focused Memory unit tests and mock visual E2E.
- [x] 6.3 Run the relevant contract/frontend build checks and confirm the change is archive-ready.

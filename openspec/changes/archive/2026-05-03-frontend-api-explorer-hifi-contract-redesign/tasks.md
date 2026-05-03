## 1. Contract And Baseline

- [x] 1.1 Record the current API Explorer contract chain from Deck-facing DTOs, Go BFF handlers, API wrapper, UI metadata, and mock Gateway `gateway.describe` payloads.
- [x] 1.2 Confirm deterministic drift in mock Gateway describe data, endpoint classification, or generated DTOs; fix only if found.
- [x] 1.3 Identify unsupported or missing upstream schema behavior and document it for handoff.

## 2. Handoff Package

- [x] 2.1 Create `frontend-handoff/modules/api-explorer/README.md` with status, contract truth, workflow constraints, implementation notes, and open questions.
- [x] 2.2 Create `prototype.html` as a high-fidelity contract catalog workspace aligned with the current design-system posture.
- [x] 2.3 Create `components.md`, `states.md`, `interactions.md`, and `api-usage.md` covering method catalog, event catalog, schema tree, selected method, untyped methods, and empty/error/loading states.

## 3. Production API Explorer UI

- [x] 3.1 Rewrite `ApiExplorerPanel` around the handoff workspace while preserving fetch, grouping, search, tab switching, selection, schema rendering, and collapse/expand behavior.
- [x] 3.2 Restyle catalog rows, metrics, tabs, schema tree rows, selected method detail, events, and untyped detail with design-system tokens/local classes without widening public API unnecessarily.
- [x] 3.3 Replace obsolete API Explorer global styling with module-local or narrowed CSS using `--ds-*` tokens and responsive constraints.
- [x] 3.4 Preserve or update API Explorer unit tests for load/group/select, schema collapse, retry, not-configured empty state, filtering, events, and schema rendering.

## 4. Mock Visual Verification

- [x] 4.1 Add or update contract-shaped `gateway.describe` data in the mock Gateway if visual E2E gaps are found.
- [x] 4.2 Add a focused API Explorer mock visual E2E covering the ready workspace and at least one interaction state such as filtering, event tab inspection, schema collapse, or untyped visibility.
- [x] 4.3 Inspect generated screenshots for text overlap, blank panes, density problems, and incorrect mock-only labeling.

## 5. Design-System Feedback

- [x] 5.1 Update the cross-module readiness record with API Explorer evidence, repeated molecules, schema/catalog/detail patterns, and promotion candidates.
- [x] 5.2 Update the OpenSpec design-system delta target if implementation changes the readiness requirement details.

## 6. Verification

- [x] 6.1 Run `openspec validate frontend-api-explorer-hifi-contract-redesign --strict`.
- [x] 6.2 Run focused API Explorer unit tests and mock visual E2E.
- [x] 6.3 Run the relevant frontend build checks and confirm the change is archive-ready.

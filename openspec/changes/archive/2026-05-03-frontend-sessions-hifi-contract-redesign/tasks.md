## 1. Contract And Baseline

- [x] 1.1 Record the current sessions contract chain from `DeckGoSession*`, chat history/session mutation DTOs, usage DTOs, compaction DTOs, subagent lineage DTOs, API wrappers, and Go BFF handlers.
- [x] 1.2 Confirm whether there is deterministic sessions/history/usage/compaction/lineage forwarding drift; fix only if found.
- [x] 1.3 Identify uncertain product/Gateway gaps and document them for handoff.

## 2. Handoff Package

- [x] 2.1 Create `frontend-handoff/modules/sessions/README.md` with status, contract truth, implementation notes, workflow constraints, and open questions.
- [x] 2.2 Create `prototype.html` as a high-fidelity sessions operations workbench aligned with the current design-system posture.
- [x] 2.3 Create `components.md`, `states.md`, `interactions.md`, and `api-usage.md` covering inventory, detail, transcript, usage/context, compaction, lineage, export, actions, accessibility, and endpoint usage.

## 3. Production Sessions UI

- [x] 3.1 Rewrite `SessionsPanel` around the handoff workbench while preserving inventory load/filter/page, selection, detail/history, transcript cache, transcript search/export, usage/context, compaction, lineage, and actions.
- [x] 3.2 Restyle `SessionUsageDetails`, `SessionCompactionHistory`, and `SessionSubagentDetails` with design-system atoms/local classes without widening their public API unnecessarily.
- [x] 3.3 Replace obsolete sessions global styling with module-local or narrowed CSS using `--ds-*` tokens and responsive constraints.
- [x] 3.4 Preserve or update sessions unit tests for load/selection, filters, navigation params, transcript cache, usage/context, compaction actions, lineage navigation, export, and session mutations.

## 4. Mock Visual Verification

- [x] 4.1 Add or update contract-shaped sessions/history/usage/compaction/lineage data in the mock stack if visual E2E gaps are found.
- [x] 4.2 Add a focused sessions mock visual E2E covering the ready workbench and at least one interaction state such as transcript export, filter state, compaction confirmation, patch result, or delete confirmation.

## 5. Design-System Feedback

- [x] 5.1 Update the cross-module readiness record with sessions evidence, repeated molecules, list/detail/timeline molecules, and promotion candidates.
- [x] 5.2 Update the OpenSpec design-system delta target if implementation changes the readiness requirement details.

## 6. Verification

- [x] 6.1 Run `openspec validate frontend-sessions-hifi-contract-redesign --strict`.
- [x] 6.2 Run focused sessions unit tests and mock visual E2E.
- [x] 6.3 Run the relevant frontend build/check and confirm the change is archive-ready.

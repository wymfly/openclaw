## 1. Contract And Baseline

- [x] 1.1 Record the current logs contract chain from `DeckGoLogsTailResponse`, `DeckGoLogStreamEvent`, `/logs` API wrappers, Go BFF handlers, SSE stream helper, and Gateway adapter methods.
- [x] 1.2 Confirm whether there is deterministic `/logs` query-forwarding drift; fix only if found.
- [x] 1.3 Identify uncertain product/Gateway gaps and document them for handoff.

## 2. Handoff Package

- [x] 2.1 Create `frontend-handoff/modules/logs/README.md` with status, contract truth, implementation notes, and open questions.
- [x] 2.2 Create `prototype.html` as a high-fidelity logs observability workbench aligned with the current design-system posture.
- [x] 2.3 Create `components.md`, `states.md`, `interactions.md`, and `api-usage.md` covering tail, stream, filtering, export, accessibility, and endpoint usage.

## 3. Production Logs UI

- [x] 3.1 Rewrite `LogsPanel` around the handoff workbench while preserving existing API wrappers, streaming behavior, cursor persistence, local filters, and export behavior.
- [x] 3.2 Replace obsolete logs global styling with module-local or narrowed CSS using `--ds-*` tokens and responsive constraints.
- [x] 3.3 Preserve or update logs unit tests for tail load, stream connection, filters, export, reset handling, clear behavior, and i18n.

## 4. Mock Visual Verification

- [x] 4.1 Add or update contract-shaped logs tail data and stream-compatible behavior in the mock Gateway fixture.
- [x] 4.2 Add a focused logs mock visual E2E covering the ready workbench and at least one interaction state.

## 5. Design-System Feedback

- [x] 5.1 Update the cross-module readiness record with logs evidence, repeated molecules, and promotion candidates.
- [x] 5.2 Update the OpenSpec design-system delta target if implementation changes the readiness requirement details.

## 6. Verification

- [x] 6.1 Run `openspec validate frontend-logs-hifi-contract-redesign --strict`.
- [x] 6.2 Run focused logs unit tests and mock visual E2E.
- [x] 6.3 Run the relevant frontend build/check and confirm the change is archive-ready.

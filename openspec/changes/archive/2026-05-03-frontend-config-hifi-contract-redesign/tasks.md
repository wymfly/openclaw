## 1. Contract And Baseline

- [x] 1.1 Record the current Config contract chain from Deck-facing DTOs, Go BFF handlers, Gateway adapter methods, frontend API wrappers, UI metadata, schema lookup helpers, and generated method coverage.
- [x] 1.2 Confirm deterministic drift in mock/local E2E data for config snapshot, schema lookup, raw apply, patch, conflict shape, structured field hints, and sensitive-field examples; fix only if found.
- [x] 1.3 Identify unsupported or uncertain schema authoring, schema migration generation, history/version restore, config import/export, secret vault integration, collaborative editing, and production rollback semantics and document them for handoff.

## 2. Handoff Package

- [x] 2.1 Create `frontend-handoff/modules/config/README.md` with status, contract truth, workflow constraints, implementation notes, and open questions.
- [x] 2.2 Create `prototype.html` as a high-fidelity config governance workbench aligned with the current design-system posture.
- [x] 2.3 Create `components.md`, `states.md`, `interactions.md`, and `api-usage.md` covering config snapshot, raw editor, diff preview, apply, conflict recovery, schema sections, lookup, structured fields, sensitive controls, payload disclosure, empty/error/loading states, and mock/local visual states.

## 3. Production Config UI

- [x] 3.1 Rewrite or restage `ConfigPanel` around the handoff workspace while preserving load, raw edit dirty state, reset, diff preview, apply, conflict recovery, schema lookup, section filtering, structured field editing, sensitive reveal/hide, JSON draft apply/reset, payload disclosure, and i18n behavior.
- [x] 3.2 Restyle config metrics, raw editor, schema section rows, lookup controls, structured field cards, diff preview, conflict recovery strip, sensitive controls, payload seams, and empty/error states with design-system tokens/local classes without widening public API unnecessarily.
- [x] 3.3 Replace obsolete Config global styling with module-local or narrowed CSS using `--ds-*` tokens and responsive constraints.
- [x] 3.4 Preserve or update Config unit tests for load, lookup, structure rendering, raw apply preview, apply success, conflict recovery, structured field edits, sensitive reveal/hide, JSON field apply/reset, invalid raw JSON, and localization.

## 4. Mock Visual Verification

- [x] 4.1 Add deterministic E2E seed support for Config mock/local visual coverage if existing mock Gateway setup is insufficient.
- [x] 4.2 Add a focused Config mock/local visual E2E covering the ready workspace and at least one interaction state such as schema lookup, structured field edit, diff preview, apply success, conflict preview, sensitive reveal, or raw payload expansion.
- [x] 4.3 Inspect generated screenshots for text overlap, blank panes, density problems, and incorrect mock/local evidence labeling.

## 5. Design-System Feedback

- [x] 5.1 Update the cross-module readiness record with Config evidence, repeated configuration/governance molecules, and promotion candidates.
- [x] 5.2 Update the OpenSpec design-system delta target if implementation changes the readiness requirement details.

## 6. Verification

- [x] 6.1 Run `openspec validate frontend-config-hifi-contract-redesign --strict`.
- [x] 6.2 Run focused Config unit tests and mock/local visual E2E.
- [x] 6.3 Run the relevant frontend build checks and confirm the change is archive-ready.

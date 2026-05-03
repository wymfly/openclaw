## 1. Contract And Baseline

- [x] 1.1 Record the current Identity contract chain from Deck-facing DTOs, Go BFF handlers, Gateway adapter methods, frontend API wrappers, UI metadata, and generated Gateway method coverage.
- [x] 1.2 Confirm deterministic drift in mock/local E2E data for identity links, config hash, link mutation, unlink mutation, failed mutation refresh, and missing-hash guards; fix only if found.
- [x] 1.3 Identify unsupported or uncertain bulk merge, split, rename, deduplicate, trust, identity proofing, channel lookup, directory sync, contact graph inference, and production audit semantics and document them for handoff.

## 2. Handoff Package

- [x] 2.1 Create `frontend-handoff/modules/identity/README.md` with status, contract truth, workflow constraints, implementation notes, and open questions.
- [x] 2.2 Create `prototype.html` as a high-fidelity canonical identity relationship workbench aligned with the current design-system posture.
- [x] 2.3 Create `components.md`, `states.md`, `interactions.md`, and `api-usage.md` covering canonical inventory, selected canonical detail, peer mappings, mutation safety, link dialog, confirmed unlink, missing-hash guard, failed mutation refresh, raw payload disclosure, empty/error/loading states, and mock/local visual states.

## 3. Production Identity UI

- [x] 3.1 Rewrite `IdentityPanel` and local Identity subcomponents around the handoff workspace while preserving load, selection, direct peer unlink, guarded link, confirmed unlink, missing-hash blocking, failed-mutation refresh, last-action feedback, raw payload disclosure, and i18n behavior.
- [x] 3.2 Restyle identity metrics, canonical rows, selected canonical hero, peer mapping rows, mutation guard strip, link dialog, last-action/error surfaces, raw payload seam, and empty states with design-system tokens/local classes without widening public API unnecessarily.
- [x] 3.3 Replace obsolete Identity global styling with module-local or narrowed CSS using `--ds-*` tokens and responsive constraints.
- [x] 3.4 Preserve or update Identity unit tests for load/select, direct peer unlink, selected-detail unlink, confirmation cancellation, guarded link, missing config hash, failed mutation refresh, empty peers, raw payload state, and localization.

## 4. Mock Visual Verification

- [x] 4.1 Add deterministic E2E seed support for Identity mock/local visual coverage if existing mock Gateway setup is insufficient.
- [x] 4.2 Add a focused Identity mock/local visual E2E covering the ready workspace and at least one interaction state such as selected canonical detail, link dialog, missing-hash guard, unlink confirmation path, mutation feedback, or raw payload expansion.
- [x] 4.3 Inspect generated screenshots for text overlap, blank panes, density problems, and incorrect mock/local evidence labeling.

## 5. Design-System Feedback

- [x] 5.1 Update the cross-module readiness record with Identity evidence, repeated relationship/mutation molecules, and promotion candidates.
- [x] 5.2 Update the OpenSpec design-system delta target if implementation changes the readiness requirement details.

## 6. Verification

- [x] 6.1 Run `openspec validate frontend-identity-hifi-contract-redesign --strict`.
- [x] 6.2 Run focused Identity unit tests and mock/local visual E2E.
- [x] 6.3 Run the relevant frontend build checks and confirm the change is archive-ready.

## 1. Contract And Baseline

- [x] 1.1 Record the current Models contract chain from Deck config DTOs, generated Gateway model/auth/catalog DTOs, usage DTOs, API wrappers, UI store inputs, Go BFF handlers, and mock Gateway methods.
- [x] 1.2 Confirm deterministic drift in mock Gateway model/auth/catalog data, endpoint classification, or generated Deck-facing DTOs; fix only if found.
- [x] 1.3 Identify uncertain real Gateway model/auth/catalog/usage semantics and document them for handoff.

## 2. Handoff Package

- [x] 2.1 Create `frontend-handoff/modules/models/README.md` with status, contract truth, workflow constraints, implementation notes, and open questions.
- [x] 2.2 Create `prototype.html` as a high-fidelity model operations workbench aligned with the current design-system posture.
- [x] 2.3 Create `components.md`, `states.md`, `interactions.md`, and `api-usage.md` covering runtime inventory, auth overview, catalog, provider config, fallback chains, allowlist controls, usage evidence, raw config, schema lookup, save, and probe.

## 3. Production Models UI

- [x] 3.1 Rewrite `ModelsPanel` around the handoff workbench while preserving load/refresh, save/hash, schema lookup, runtime inventory, auth overview, catalog discovery, provider config, fallback chains, allowlist, usage, and probe behavior.
- [x] 3.2 Update `ProviderModelsEditor` and `StringRecordEditor` only as needed to fit the new module-local workbench without changing their config mutation semantics.
- [x] 3.3 Restyle model table/tree/quota/chart/config/fallback/allowlist rows with design-system atoms/local classes without widening public API unnecessarily.
- [x] 3.4 Replace obsolete Models global styling with module-local or narrowed CSS using `--ds-*` tokens and responsive constraints.
- [x] 3.5 Preserve or update Models unit tests for load calls, localization, save/hash behavior, fallback edits, catalog quick actions, provider config edits, allowlist edits, Bedrock discovery edits, probe, and inline style absence.

## 4. Mock Visual Verification

- [x] 4.1 Add or update contract-shaped `models.configured`, `deck.auth.overview`, `models.catalog.providers`, and `deck.auth.probe` data in the mock Gateway if visual E2E gaps are found.
- [x] 4.2 Add a focused Models mock visual E2E covering the ready workbench and at least two interaction states such as provider config, fallback chain, catalog selection, usage pressure, or probe result.
- [x] 4.3 Inspect generated screenshots for text overlap, blank panes, density problems, and incorrect mock-only labeling.

## 5. Design-System Feedback

- [x] 5.1 Update the cross-module readiness record with Models evidence, repeated molecules, table/tree/quota/chart/config/fallback/allowlist molecules, and promotion candidates.
- [x] 5.2 Update the OpenSpec design-system delta target if implementation changes the readiness requirement details.

## 6. Verification

- [x] 6.1 Run `openspec validate frontend-models-hifi-contract-redesign --strict`.
- [x] 6.2 Run focused Models unit tests and mock visual E2E.
- [x] 6.3 Run the relevant contract/frontend build checks and confirm the change is archive-ready.

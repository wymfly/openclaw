## 1. Truth Baseline

- [x] 1.1 Re-read this change's proposal, design, and spec deltas before code edits; record the OpenClaw truth that model inputs are `text` / `image` and policy roles come from `agents.defaults` / agent references.
- [x] 1.2 Audit current Models frontend for raw-editor imports, state, copy, tests, CSS, and E2E assumptions.
- [x] 1.3 Audit current Models default/reference projection to confirm whether `DeckGoModelsConfigDetail.defaults` is sufficient for a read-only usage-policy overview.

## 2. Models Product UI

- [x] 2.1 Remove the Models-page raw editor button, drawer, state, raw config query dependency, raw save mutation dependency, and raw-editor-only CSS if no longer used.
- [x] 2.2 Add a read-only usage-policy overview backed by `DeckGoModelsConfigDetail.defaults`, covering text, image, image generation, video generation, music generation, PDF, summary, compaction, memory search, and subagents where present.
- [x] 2.3 Ensure model input controls remain limited to OpenClaw-supported model input modalities and do not expose PDF or role defaults as input checkboxes.
- [x] 2.4 Reword provider/model drawer advanced hints and impact copy so unsupported leaves are summarized or deferred without pointing operators to a Models raw editor.
- [x] 2.5 Update English and Chinese i18n for raw-editor removal, usage-policy overview, model capability wording, and Agents ownership.

## 3. Handoff And Documentation

- [x] 3.1 Update `openspec/follow-ups/2026-05-09-agents-model-policy-redesign-handoff.md` with the final Models/Agents boundary and acceptance hints for Agents policy editing.
- [x] 3.2 Update `deck-go/frontend-handoff/modules/models` notes that mention raw editor fallback, model-policy editing, or model input modalities so they match the implemented boundary.
- [x] 3.3 Record any unsupported advanced leaves found during implementation as follow-up candidates rather than adding raw editing back.

## 4. Tests And Verification

- [x] 4.1 Update focused Models component tests to assert raw-editor absence, usage-policy overview rendering, typed provider/model actions, and model input modality limits.
- [x] 4.2 Update mock Models E2E/visual expectations if they reference the raw editor or miss the new usage-policy overview.
- [x] 4.3 Run `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/models/ModelsPanel.test.tsx`.
- [x] 4.4 Run `cd deck-go && make frontend-build`.
- [x] 4.5 Run `cd deck-go && make e2e-mock-module MODULE=models`.
- [x] 4.6 Run `cd deck-go && make e2e-real-module MODULE=models` when the real stack is available; if it is blocked by environment, record exact circuit-breaker evidence.
- [x] 4.7 Run `openspec validate deck-go-models-product-contract-completion --type change --strict`.
- [x] 4.8 Confirm archive readiness, update tasks with fresh evidence, and report any remaining handoff before moving to Agents.

## Implementation Evidence

- 2026-05-11: `node -e "JSON.parse(...en.json); JSON.parse(...zh.json)"` passed for Models i18n edits.
- 2026-05-11: `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/models/ModelsPanel.test.tsx` passed, 10 tests.
- 2026-05-11: `cd deck-go && make frontend-build` passed.
- 2026-05-11: `cd deck-go && make e2e-mock-module MODULE=models` passed after updating the mock spec to verify usage policy and raw-editor absence.
- 2026-05-11: `cd deck-go && make e2e-real-module MODULE=models` passed, including real create/read/preview/cleanup of run-scoped provider/model data.
- 2026-05-11: `openspec validate deck-go-models-product-contract-completion --type change --strict` passed.
- 2026-05-11: `git diff --check` passed for touched Models/OpenSpec/handoff files.

## 1. Truth Baseline

- [x] 1.1 Re-read this change's proposal, design, and spec deltas; record assumptions before implementation.
- [x] 1.2 Enumerate OpenClaw model reference truth from `src/config/types.agents-shared.ts`, `src/config/types.agent-defaults.ts`, `src/config/types.agents.ts`, and current Gateway generated agent/model DTOs.
- [x] 1.3 Audit current Models projection code for string-only parsing, derived defaults, fallback omission, stale labels, and unsafe delete-impact gaps.
- [x] 1.4 Audit current Models frontend and handoff prototype copy for raw primitive labels (`merge`, `replace`, `preview delete`) and stale default/fallback editing assumptions.

## 2. Contract And BFF Projection

- [x] 2.1 Update Deck-facing DTOs only if needed to represent model-reference role metadata such as primary/default/fallback and derived display source.
- [x] 2.2 Regenerate generated TypeScript/Go contract artifacts when contract sources change.
- [x] 2.3 Repair `modelReferenceIndex` parsing so string refs and `{ primary, fallbacks }` refs are both scanned deterministically.
- [x] 2.4 Repair Models defaults projection so explicit `agents.defaults.model` is not confused with a derived first-agent display fallback.
- [x] 2.5 Extend backend tests for primary/fallback references, malformed refs, role labels, defaults projection, and delete-impact protection.

## 3. Frontend Product Semantics

- [x] 3.1 Reword Models catalog mode controls as product-level catalog sync policy while keeping raw mode values as secondary technical detail where useful.
- [x] 3.2 Rework delete actions so the common user action is delete with an impact-check step, not a standalone "preview delete" primary row action.
- [x] 3.3 Add or refine usage/default/fallback display in Models rows, drawers, and impact dialogs using typed projection data.
- [x] 3.4 Add owner-module/deferred affordances for agent model-policy editing instead of presenting Models as the canonical editor.
- [x] 3.5 Update English and Chinese i18n copy for product semantics, owner boundaries, and deferred Agents editing.

## 4. Handoff And Follow-up

- [x] 4.1 Update `deck-go/frontend-handoff/modules/models` to classify older Set default/Add fallback/fallback-chain prototype ideas as Agents-owned unless implemented by this change.
- [x] 4.2 Create or update `openspec/follow-ups/` with a precise Agents model-policy handoff covering `agents.defaults.model`, role defaults, per-agent model, subagent model defaults, and `{ primary, fallbacks }`.
- [x] 4.3 Update any existing Models follow-up text that uses stale paths such as `agents.<id>.defaultModel` so it matches current OpenClaw config truth.

## 5. Verification

- [x] 5.1 Run `openspec validate deck-go-models-product-semantics-convergence --type change --strict`.
- [x] 5.2 Run focused backend tests covering Models reference projection and impact previews.
- [x] 5.3 Run focused frontend tests for Models product semantics, usage display, and owner-boundary/deferred states.
- [x] 5.4 Run `cd deck-go && make contract-gate` if contracts/generated artifacts changed.
- [x] 5.5 Run `cd deck-go && make frontend-build` after frontend changes.
- [x] 5.6 Run the relevant mock Models E2E/visual smoke for impact/delete/catalog/usage states.
- [x] 5.7 Run bounded real Gateway smoke for route shape and read-only usage projection when the real stack is available; record a circuit-breaker handoff if environment blocks it.
- [x] 5.8 Update verification/follow-up evidence and confirm archive readiness before implementation is marked complete.

## Implementation Evidence

- 2026-05-09: `openspec validate deck-go-models-product-semantics-convergence --type change --strict` passed.
- 2026-05-09: `cd deck-go/backend && go test ./internal/server/... -run 'TestModels|TestModelReferenceIndex' -count=1` passed.
- 2026-05-09: `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/models/ModelsPanel.test.tsx` passed with 7 tests.
- 2026-05-09: `cd deck-go && make e2e-mock-module MODULE=models` passed.
- 2026-05-09: `cd deck-go && make e2e-real-module MODULE=models` passed after a transient startup timeout retry; the passing run created, read, impact-checked, and cleaned up a run-scoped provider/model through the real Gateway.
- 2026-05-09: `cd deck-go && make frontend-build` passed.
- 2026-05-09: `cd deck-go && make contract-gate` passed after syncing derived contract metadata.
- 2026-05-09: follow-up evidence updated in `openspec/follow-ups/2026-05-09-agents-model-policy-redesign-handoff.md` and `openspec/follow-ups/2026-05-09-deck-go-models-config-control-plane-follow-ups.md`.

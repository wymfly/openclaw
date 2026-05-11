## 1. Truth Baseline And Plan

- [x] 1.1 Re-read this change's proposal, design, and spec deltas before code edits; record any implementation assumptions in the change notes or verification artifact.
- [x] 1.2 Re-confirm OpenClaw model truth from `src/config/types.models.ts`, generated schema help, model config planning, implicit provider catalog, and runtime catalog assembly.
- [x] 1.3 Audit current deck-go Models BFF DTOs/routes, generated frontend/Go contracts, mutation evidence metadata, and Data Fabric hooks for provider source/configured/template state.
- [x] 1.4 Audit current Models frontend and handoff artifacts for raw mode-first UI, template mutation implications, custom-provider no-op behavior, and custom-model write assumptions.

## 2. Contract And BFF Alignment

- [x] 2.1 Decide from code truth whether existing DTOs can represent provider-library template, configured provider, and mixed template-plus-configured states; update contract source and generated TS/Go artifacts only if needed.
- [x] 2.2 Ensure typed provider upsert can configure a built-in provider template by writing an authored `models.providers.<id>` entry while preserving OpenClaw validation, secret handling, and optional fields.
- [x] 2.3 Ensure typed model upsert rejects, converts, or guides template-only providers before writing custom model entries; no custom model may be saved only to frontend state or implicit catalog data.
- [x] 2.4 Ensure delete/edit behavior for template-only providers is guarded so the product cannot imply built-in catalog mutation.
- [x] 2.5 Add or update backend/contract tests for provider source classification, template-to-configured upsert, custom model write target, collision/conflict handling, and template-only guardrails.

## 3. Frontend Product Implementation

- [x] 3.1 Rework Models page IA and copy so the normal surface is configured providers with nested models; Provider Library templates are copy sources inside Add Provider instead of a main-page or right-panel management surface, and raw `merge` / `replace` mode remains secondary.
- [x] 3.2 Preserve truthful display for existing `models.mode = replace` configs as a strict-configured-only or advanced-policy state with impact-aware advanced actions.
- [x] 3.3 Rework built-in provider cards/actions so template-only providers expose Configure, mixed providers expose configured editing, and unsupported template mutation actions are absent.
- [x] 3.4 Fix the Add Provider wizard so blank custom creation and template-copy creation visibly open or select the configuration path; add UI state for back/cancel/error without hidden no-op behavior.
- [x] 3.4a Support copying any provider template into an editable provider draft, including selectable default model entries written through provider upsert.
- [x] 3.5 Implement or repair custom model authoring so it writes to authored configured provider assets and requires provider configuration first when starting from a template-only provider.
- [x] 3.6 Update English and Chinese i18n copy for Provider Library, Configured Providers, custom provider, custom model, advanced catalog policy, collision, conflict, loading, empty, and degraded states.
- [x] 3.7 Update `deck-go/frontend-handoff/modules/models` when needed so handoff/prototype notes do not contradict the implemented Provider Library product semantics.

## 4. Mock, Real, And Regression Verification

- [x] 4.1 Add or update focused frontend component tests for configured provider/model grouping, absence of a separate provider-library main panel, template-copy/default-model behavior, blank custom-provider click behavior, `replace` mode display, and custom-model guarded save behavior.
- [x] 4.2 Add or update mock E2E/visual smoke for the configured provider/model main page, Add Provider template-copy/custom-provider wizard, provider/model drawers, custom model, collision/conflict, loading, true-empty, filtered-empty, error, and degraded states that are touched by this change.
- [x] 4.3 Run real-safe Models smoke against an isolated Gateway config/workspace using run-scoped provider/model ids; create/read/update or impact-check/cleanup through typed deck-go routes when the real stack is available.
- [x] 4.4 If real-safe smoke is blocked, record the exact environment blocker, completed lower-level evidence, and retry criteria in `verification.yaml` or `openspec/follow-ups/`.
- [x] 4.5 Confirm no mock result is used as proof of real Gateway behavior and no real smoke result is used as proof of visual/product completeness.

## 5. Closure And Validation

- [x] 5.1 Initialize or update scenario-level verification evidence for this change, including archive readiness and any gaps.
- [x] 5.2 Run `openspec validate deck-go-models-provider-library-productization --type change --strict`.
- [x] 5.3 Run focused backend tests for touched Models BFF/contract behavior.
- [x] 5.4 Run focused frontend tests for touched Models components and hooks.
- [x] 5.5 Run `cd deck-go && make contract-gate` if contract source or generated artifacts change.
- [x] 5.6 Run `cd deck-go && make frontend-build` after frontend changes.
- [x] 5.7 Run the relevant mock Models E2E/visual command after frontend changes.
- [x] 5.8 Record implementation evidence, remaining risks, and follow-ups; do not mark the change archive-ready while scenario evidence or applicable validation is missing.

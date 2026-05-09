## 1. Truth Baseline

- [ ] 1.1 Re-read `proposal.md`, `design.md`, and all spec deltas; record implementation assumptions before touching code.
- [ ] 1.2 Enumerate OpenClaw Models config truth from `src/config/types.models.ts`, `src/config/zod-schema.core.ts`, and `src/config/schema.help.ts`, including provider/model fields, enum values, sensitive fields, and zod optionality.
- [ ] 1.3 Audit current deck-go Models contract/source/generated/UI paths against the OpenClaw truth map and classify every drift as `repair-now`, `defer`, or `reject`.
- [ ] 1.4 Enumerate model-reference source paths from current config types for agents, channels, hooks, tools, and runtime/session sources; correct the design/spec before implementation if code truth contradicts the listed reference sources.
- [ ] 1.5 Verify existing runtime read capabilities (`models.configured`, `models.catalog.providers`, `deck.auth.overview`, `deck.auth.probe`) and existing config write routes (`GET/PATCH /models/config`, runtime `config:patch`) so new routes do not duplicate or mislabel upstream behavior.

## 2. Contract Chain

- [ ] 2.1 Add Deck-facing DTOs for Models config detail, provider detail, model detail, SecretInput status/ref, advanced summaries, reference index entries, impact preview, and typed mutation responses.
- [ ] 2.2 Add endpoint/action contract entries for config detail, provider upsert, provider delete preview, provider delete commit, model upsert, model delete preview, model delete commit, and mode set.
- [ ] 2.3 Update mutation evidence metadata for all typed Models actions with owner module, route/action id, Gateway support basis, base-hash requirement, next-hash behavior, conflict behavior, idempotency/audit/rollback status, and fixture safety.
- [ ] 2.4 Update UI metadata and module capability metadata so the frontend can distinguish config-authority, runtime inventory, probe, advanced raw fallback, and typed mutation paths.
- [ ] 2.5 Regenerate generated TypeScript/Go contract artifacts and ensure no generated drift remains.
- [ ] 2.6 Run `cd deck-go && make contract-gate` and fix contract governance failures related to this change.

## 3. Backend BFF

- [ ] 3.1 Add the Go request/response types and route mounting for the typed Models BFF actions using the contract naming chosen in Task 2.
- [ ] 3.2 Implement `GET /models/config/detail` projection from Gateway `config.get`, runtime catalog/auth/probe summaries where available, and redacted sensitive status without literal secret exposure.
- [ ] 3.3 Implement minimal `models` merge-patch helpers that preserve unedited config leaves, preserve zod-optional omitted fields, forward expected base hash, and normalize config conflict errors.
- [ ] 3.4 Implement provider upsert with validation for provider id, baseUrl, api/auth enum, SecretInput ref policy, provider headers, authHeader, injectNumCtxForOpenAICompat, request preservation, and generated patch evidence.
- [ ] 3.5 Implement model upsert with validation for model id/name, API inherit/override, reasoning, input modalities, capacity fields, cost fields, per-model headers, compat preservation, and generated patch evidence.
- [ ] 3.6 Implement `modelReferenceIndex` with tests covering every code-truth reference source enumerated in Task 1.4.
- [ ] 3.7 Implement provider/model delete preview and commit with impact token or reference hash, service-side re-scan on commit, stale-preview rejection, base-hash conflict handling, and type-confirm payload validation.
- [ ] 3.8 Implement mode set dry-run and commit with catalog/config-derived impact preview, no frontend hardcoded provider assumptions, and stale preview/base-hash conflict handling.
- [ ] 3.9 Add backend tests for happy paths, validation failures, base-hash conflicts, SecretInput redaction/ref handling, partial-config preservation, reference drift, delete guardrails, and mode impact preview.
- [ ] 3.10 Run focused Go tests for the changed backend packages and fix failures caused by this change.

## 4. Frontend Data Layer

- [ ] 4.1 Update frontend API types/facades to consume generated Models DTOs and typed BFF routes rather than ad hoc raw config shapes.
- [ ] 4.2 Extend `frontend-new/src/data/modules/models` query keys, query options, mutation hooks, invalidation, and Data Fabric source labels for config detail and typed actions.
- [ ] 4.3 Update mock fixtures and API mocks for config detail, catalog projection, auth/probe summaries, SecretInput states, impact previews, conflicts, and degraded responses.
- [ ] 4.4 Add focused frontend data-layer tests proving normal create/edit/delete/mode flows call typed facades and raw config save remains advanced-only.
- [ ] 4.5 Confirm old raw-save helpers remain available only for advanced fallback and are not used by normal Models CRUD components.

## 5. Frontend Product UI

- [ ] 5.1 Replace the Models monolith with a focused component tree under `frontend-new/src/components/panels/models`, keeping files reviewable and reusing existing design-system tokens/patterns.
- [ ] 5.2 Implement the catalog header with mode, configured/runtime counts, refresh/stale state, Add Provider, and advanced raw editor access.
- [ ] 5.3 Implement provider-grouped list sections and model rows with capacity, cost, modality/reasoning indicators, default/reference badges, health/probe summaries, search/filter, and explicit loading/error/empty/degraded states.
- [ ] 5.4 Implement ProviderDrawer tabs for overview, identity, networking, models-lite, and advanced summaries while preserving dirty state and base-hash conflict banners.
- [ ] 5.5 Implement ModelDrawer tabs for overview, identity, capacity, cost, networking, and advanced summaries while preserving partial config and validation errors.
- [ ] 5.6 Implement Add Provider wizard driven by Gateway/BFF catalog projection, including custom provider fallback, SecretRef/ref-template entry, starter models when available, and review/submit.
- [ ] 5.7 Implement ImpactPreviewDialog and TypeToConfirmDialog for delete and mode-changing flows using BFF impact preview responses.
- [ ] 5.8 Update i18n strings for English/Chinese product copy, including unsupported/deferred states without claiming unsupported audit, rollback, secret-store, OAuth, quota, or rate-limit behavior.
- [ ] 5.9 Add focused component tests for list rendering, drawers, wizard, SecretInput states, partial config, conflicts, delete/mode guardrails, raw fallback boundary, dark/light mode classes where practical, and Chinese/English copy coverage.

## 6. Handoff And Follow-ups

- [ ] 6.1 Rewrite `deck-go/frontend-handoff/modules/models/README.md`, `components.md`, `interactions.md`, `states.md`, `api-usage.md`, and `implementation-notes.md` to match OpenClaw config truth and the final typed contract chain.
- [ ] 6.2 Rewrite or update the Models handoff prototype files so the prototype shows catalog header, provider grouped list, drawers, wizard, impact dialogs, and advanced raw fallback without decorative unsupported KPIs.
- [ ] 6.3 Keep historical prototype artifacts as clearly labeled references where they already exist; do not overwrite historical files that are intended as backups.
- [ ] 6.4 Create or update `openspec/follow-ups/` entries for out-of-scope model default editing, rate-limit/schema additions, OAuth runner, secret-store CRUD, and any implementation-discovered gaps that are not safely resolved in this change.

## 7. Verification And Closure

- [ ] 7.1 Run `openspec validate deck-go-models-config-control-plane --type change --strict` and fix OpenSpec artifact errors.
- [ ] 7.2 Run contract verification including `cd deck-go && make contract-gate`; run `make protocol-check` if generated Gateway protocol artifacts are touched.
- [ ] 7.3 Run focused backend tests for the new Models BFF routes/reference index/config patch helpers.
- [ ] 7.4 Run focused frontend tests for Models data hooks/components and then `cd deck-go && make frontend-build`.
- [ ] 7.5 Run mock E2E or browser smoke covering list, drawer, wizard, typed save, conflict, SecretInput, delete preview/commit, mode preview/commit, and raw fallback states.
- [ ] 7.6 Run bounded real Gateway smoke in the isolated real E2E environment for reversible provider/model create, readback, runtime configured visibility where possible, and cleanup; if blocked after bounded attempts, record exact blocker and keep code-level checks mandatory.
- [ ] 7.7 Update `verification.yaml` with fresh scenario evidence, gap status, and archive readiness.
- [ ] 7.8 Ensure accepted spec deltas are ready to archive into `openspec/specs/**`, then run strict validation for affected accepted specs if archive is performed.

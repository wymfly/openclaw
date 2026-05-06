## 1. Baseline And Scope Lock

- [x] 1.1 Read `proposal.md`, `design.md`, spec deltas, and `verification.yaml` before editing implementation files.
- [x] 1.2 Inspect `deck-go/frontend-handoff/modules/models/**` and confirm prototype freshness, v2 file structure, status metadata, and backend assumptions.
- [x] 1.3 Smoke-test `deck-go/frontend-handoff/modules/models/prototype.html` and record whether it loads without browser errors.
- [x] 1.4 Inspect current `frontend-models-hifi-redesign` and `frontend-models-real-contract-verification` specs plus current production Models implementation.
- [x] 1.5 Inspect frontend API wrappers, endpoint classification, UI metadata, Go BFF Models/usage/config routes, runtime-scoped Gateway routes, generated Gateway method mapping, mock fixtures, and related tests.

## 2. Contract And Capability Audit

- [x] 2.1 Inspect Deck DTO authority for Models config, runtime configured models, auth overview, catalog providers, probe responses, usage cost, usage providers, config apply, and schema lookup.
- [x] 2.2 Inspect endpoint classification and UI metadata for `/models/config`, `/usage/cost`, `/usage/providers`, `/models/usage/cost`, `/models/usage/providers`, runtime model/auth/catalog/probe routes, and prototype-mentioned projected routes.
- [x] 2.3 Inspect Go BFF/admin routes, server inventory routes, runtime facade, generated Gateway wrappers, response envelopes, auth/error handling, and mock Gateway shape.
- [x] 2.4 Inspect frontend Models behavior for BFF-only access, v2 workbench, load/refresh, structured-to-raw config edits, baseHash save, schema lookup, catalog apply, fallback chain edits, allowlist edits, Bedrock discovery edits, usage panels, probe behavior, empty/error states, and raw payload handling.
- [x] 2.5 Build and record the Models contract-chain matrix.
- [x] 2.6 Classify Models workflows as supported, degraded, unsupported, environment-dependent, empty-valid, skipped-safe, or handoff-blocked.

## 3. Production Implementation And Scoped Fixes

- [x] 3.1 Compare refreshed handoff mock data and UI assumptions with Deck DTOs, Gateway/BFF route behavior, endpoint classification, UI metadata, dependency constraints, and real-stack shape.
- [x] 3.2 Refactor or tighten the production Models panel only where contract-backed drift is found, preserving useful existing v2 workbench behavior and raw config/baseHash semantics.
- [x] 3.3 Keep projected pricing snapshot, PATCH audit history, force probe cache, richer provider-specific settings, inline fallback reorder, bulk import, streaming usage, and rate-limit override workflows inactive, degraded, or documented unless current support is verified.
- [x] 3.4 Fix deterministic Models-scoped drift in contracts, BFF behavior, wrappers, mock data, UI, i18n, handoff docs, metadata, or tests when backed by evidence.
- [x] 3.5 Regenerate generated artifacts only when a source contract changes, then run the matching check target.
- [x] 3.6 Update Models handoff notes for route truth, method-name truth, usage alias truth, raw config/baseHash safety, unsupported projections, real-stack variation, and source-of-truth assumptions.

## 4. Verification

- [x] 4.1 Run focused Models frontend tests.
- [x] 4.2 Run focused Go BFF/runtime route tests for Models config, usage aliases, runtime model/auth/catalog/probe, and generated Gateway wrappers.
- [x] 4.3 Add or run Models mock visual E2E and label it L1 mock/local visual coverage.
- [x] 4.4 Add or run Models real-stack API/UI E2E for safe read paths, safe mutation/probe when available, empty/degraded handling, and BFF-only browser access.
- [x] 4.5 Apply the circuit breaker after at most three fresh attempts for any real scenario without a scoped deterministic fix.
- [x] 4.6 Run `openspec change validate frontend-models-real-contract-verification --strict`.
- [x] 4.7 Run relevant contract checks if contracts or generated artifacts changed.
- [x] 4.8 Run `cd deck-go && make frontend-build`.
- [x] 4.9 Run `git diff --check`.

## 5. Review And Archive Readiness

- [x] 5.1 Perform code-level review of Models panel, API facade, Go route/runtime behavior, contracts, mocks, and real evidence.
- [x] 5.2 Create or update `deck-go/frontend-handoff/modules/models/implementation-notes.md` with findings, fixes, matrix, evidence, and residual risks.
- [x] 5.3 Update `deck-go/frontend-handoff/modules/models/README.md` status when implementation and real-contract verification are complete.
- [x] 5.4 Update `verification.yaml` for every L1/L2 scenario and mark archive-ready only when all non-L2 tasks are complete and L2 scenarios are passed, empty-valid, degraded, skipped-safe, or handoff-blocked with evidence.

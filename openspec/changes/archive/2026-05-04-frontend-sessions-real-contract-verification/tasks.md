## 1. Baseline And Scope Lock

- [x] 1.1 Read `proposal.md`, `design.md`, spec deltas, and `verification.yaml` before editing implementation files.
- [x] 1.2 Inspect `deck-go/frontend-handoff/modules/sessions/**` and confirm prototype freshness, file structure, status metadata, and backend assumptions.
- [x] 1.3 Smoke-test `deck-go/frontend-handoff/modules/sessions/prototype.html` and record whether it loads without browser errors.
- [x] 1.4 Inspect current `frontend-sessions-hifi-redesign` and `frontend-sessions-real-contract-verification` specs plus current production Sessions implementation.
- [x] 1.5 Inspect frontend API wrappers, endpoint classification, UI metadata, Go BFF session/chat/usage/compaction/subagent routes, mock fixtures, and related tests.

## 2. Contract And Capability Audit

- [x] 2.1 Inspect Deck DTO authority for sessions list/detail/preview/history, transcript message, usage sessions/logs/context weight, compaction list/action, subagent lineage, and session mutation request/response types.
- [x] 2.2 Inspect endpoint classification and UI metadata for session inventory/detail/history, chat session mutations, compaction, usage/context, subagent lineage, and prototype-mentioned projected routes.
- [x] 2.3 Inspect Go BFF/server/admin/runtime routes, response envelopes, auth/error handling, and mock Gateway shape.
- [x] 2.4 Inspect frontend Sessions behavior for BFF-only access, workbench structure, transcript cache, search/export, filters, usage/context, compaction, lineage, mutations, confirmation gates, empty/error states, and raw payload handling.
- [x] 2.5 Build and record the Sessions contract-chain matrix.
- [x] 2.6 Classify Sessions workflows as supported, degraded, unsupported, environment-dependent, empty-valid, skipped-safe, or handoff-blocked.

## 3. Production Implementation And Scoped Fixes

- [x] 3.1 Compare refreshed handoff assumptions with Deck DTOs, BFF route behavior, endpoint classification, UI metadata, dependency constraints, and real-stack shape.
- [x] 3.2 Refactor or tighten the production Sessions panel only where contract-backed drift is found, preserving useful existing workbench behavior, transcript cache, and mutation safety.
- [x] 3.3 Keep server-side cursors, exhaustive patch schemas, real-time panel refresh, destructive real mutation proof, and stronger compaction result schemas inactive, degraded, skipped-safe, or documented unless current support is verified.
- [x] 3.4 Fix deterministic Sessions-scoped drift in contracts, BFF behavior, wrappers, mock data, UI, i18n, handoff docs, metadata, or tests when backed by evidence.
- [x] 3.5 Regenerate generated artifacts only when a source contract changes, then run the matching check target.
- [x] 3.6 Update Sessions handoff notes for route truth, cache/export truth, mutation safety, unsupported projections, real-stack variation, and source-of-truth assumptions.

## 4. Verification

- [x] 4.1 Run focused Sessions frontend tests.
- [x] 4.2 Run focused Go BFF/runtime route tests for sessions, chat session aliases/mutations, compaction, usage/context, subagent lineage, and generated Gateway wrappers.
- [x] 4.3 Add or run Sessions mock visual E2E and label it L1 mock/local visual coverage.
- [x] 4.4 Add or run Sessions real-stack API/UI E2E for safe read paths, empty/degraded handling, skipped-safe mutation boundaries, and BFF-only browser access.
- [x] 4.5 Apply the circuit breaker after at most three fresh attempts for any real scenario without a scoped deterministic fix.
- [x] 4.6 Run `openspec change validate frontend-sessions-real-contract-verification --strict`.
- [x] 4.7 Run relevant contract checks if contracts or generated artifacts changed.
- [x] 4.8 Run `cd deck-go && make frontend-build`.
- [x] 4.9 Run `git diff --check`.

## 5. Review And Archive Readiness

- [x] 5.1 Perform code-level review of Sessions panel, API facade, Go route/runtime behavior, contracts, mocks, and real evidence.
- [x] 5.2 Update `deck-go/frontend-handoff/modules/sessions/implementation-notes.md` with findings, fixes, matrix, evidence, and residual risks.
- [x] 5.3 Update `deck-go/frontend-handoff/modules/sessions/README.md` status when implementation and real-contract verification are complete.
- [x] 5.4 Update `verification.yaml` for every L1/L2 scenario and mark archive-ready only when all non-L2 tasks are complete and L2 scenarios are passed, empty-valid, degraded, skipped-safe, or handoff-blocked with evidence.

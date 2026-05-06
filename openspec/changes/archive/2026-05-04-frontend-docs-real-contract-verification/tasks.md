## 1. Baseline And Scope Lock

- [x] 1.1 Read `proposal.md`, `design.md`, spec deltas, and `verification.yaml` before editing implementation files.
- [x] 1.2 Inspect `deck-go/frontend-handoff/modules/docs/**` and confirm prototype freshness, v2 file structure, status metadata, and dependency assumptions.
- [x] 1.3 Smoke-test `deck-go/frontend-handoff/modules/docs/prototype.html` and record whether it loads without browser errors.
- [x] 1.4 Inspect current `frontend-docs-hifi-redesign` spec and current production Docs implementation.
- [x] 1.5 Inspect frontend API wrappers, endpoint classification, Go BFF/runtime/localstore behavior, mock fixtures, and related tests.

## 2. Contract And Capability Audit

- [x] 2.1 Inspect Deck DTO authority for docs list, detail, extract, delete, category, content, provenance, and timestamps.
- [x] 2.2 Inspect endpoint classification for `/api/docs`, `/api/docs/{docId}`, `/api/docs/extract`, and admin/runtime route mirrors.
- [x] 2.3 Inspect Go BFF route mapping, local docs store, extraction implementation, managed runtime chat-history dependency, auth handling, and not-configured behavior.
- [x] 2.4 Inspect frontend panel behavior for BFF-only access, v2 rail/viewer/search layout, extract/delete confirmation, Markdown rendering, empty/error states, and no unsupported Gateway behavior.
- [x] 2.5 Build and record the Docs contract-chain matrix.
- [x] 2.6 Classify Docs workflows as supported, degraded, unsupported, environment-dependent, empty-valid, skipped-safe, or handoff-blocked.

## 3. Production Implementation And Scoped Fixes

- [x] 3.1 Compare refreshed handoff mock data and UI assumptions with Deck DTOs, Go BFF/localstore behavior, Gateway chat-history support, dependency constraints, and real-stack shape.
- [x] 3.2 Refactor the production Docs panel to the v2 workbench where contract-backed, preserving useful existing behavior that the prototype omits.
- [x] 3.3 Fix deterministic Docs-scoped drift in contracts, BFF forwarding, mock data, wrappers, UI, i18n, handoff docs, or tests when backed by evidence.
- [x] 3.4 Keep unsupported prototype capabilities inactive, degraded, or documented rather than adding speculative behavior.
- [x] 3.5 Regenerate generated artifacts only when a source contract changes, then run the matching check target.
- [x] 3.6 Update Docs handoff notes for Markdown dependency state, extraction quality, session picker, delete safety, search scale, audit, and source-of-truth assumptions.

## 4. Verification

- [x] 4.1 Run focused Docs frontend tests.
- [x] 4.2 Run focused Go route/runtime/localstore tests for docs routes and extraction.
- [x] 4.3 Add or run Docs mock visual E2E and label it L1 mock/local visual coverage.
- [x] 4.4 Add or run Docs real-stack API/UI E2E for list, safe detail, extract/delete safe shapes, production render, and BFF-only browser access.
- [x] 4.5 Apply the circuit breaker after at most three fresh attempts for any real scenario without a scoped deterministic fix.
- [x] 4.6 Run `openspec validate frontend-docs-real-contract-verification --strict`.
- [x] 4.7 Run relevant contract checks if contracts or generated artifacts changed.
- [x] 4.8 Run `cd deck-go && make frontend-build`.
- [x] 4.9 Run `git diff --check`.

## 5. Review And Archive Readiness

- [x] 5.1 Perform code-level review of Docs panel, API facade, Go route/runtime/localstore behavior, contracts, mocks, and real evidence.
- [x] 5.2 Update `deck-go/frontend-handoff/modules/docs/implementation-notes.md` with findings, fixes, matrix, evidence, and residual risks.
- [x] 5.3 Update `deck-go/frontend-handoff/modules/docs/README.md` status when implementation and real-contract verification are complete.
- [x] 5.4 Update `verification.yaml` for every L1/L2 scenario and mark archive-ready only when all non-L2 tasks are complete and L2 scenarios are passed, empty-valid, degraded, skipped-safe, or handoff-blocked with evidence.

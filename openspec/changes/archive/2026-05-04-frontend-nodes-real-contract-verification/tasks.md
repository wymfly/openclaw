## 1. Baseline And Scope Lock

- [x] 1.1 Read `proposal.md`, `design.md`, spec deltas, and `verification.yaml` before editing implementation files.
- [x] 1.2 Inspect `deck-go/frontend-handoff/modules/nodes/**` and confirm prototype freshness, v2 file structure, status metadata, and dependency assumptions.
- [x] 1.3 Smoke-test `deck-go/frontend-handoff/modules/nodes/prototype.html` and record whether it loads without browser errors.
- [x] 1.4 Inspect current `frontend-nodes-hifi-redesign` spec and current production Nodes implementation.
- [x] 1.5 Inspect frontend API wrappers, endpoint classification, Go BFF/runtime behavior, mock fixtures, and related tests.

## 2. Contract And Capability Audit

- [x] 2.1 Inspect Deck DTO authority for node inventory, pairing, pair request, invoke, and pending-work payloads.
- [x] 2.2 Inspect endpoint classification for `/api/nodes`, `/api/nodes/pair`, runtime route mirrors, and dynamic-envelope exceptions.
- [x] 2.3 Inspect Go BFF route mapping, OpenClaw runtime adapters, generated Gateway method mapping, auth handling, dynamic exception handling, and not-configured behavior.
- [x] 2.4 Inspect frontend panel behavior for BFF-only access, v2 rail/detail layout, pairing confirmation, dynamic envelope labels, JSON validation, empty/error states, and no unsupported Gateway behavior.
- [x] 2.5 Build and record the Nodes contract-chain matrix.
- [x] 2.6 Classify Nodes workflows as supported, degraded, unsupported, environment-dependent, empty-valid, skipped-safe, or handoff-blocked.

## 3. Production Implementation And Scoped Fixes

- [x] 3.1 Compare refreshed handoff mock data and UI assumptions with Deck DTOs, Go BFF behavior, Gateway method support, dependency constraints, and real-stack shape.
- [x] 3.2 Refactor the production Nodes panel to the v2 workbench where contract-backed, preserving useful existing behavior that the prototype omits.
- [x] 3.3 Fix deterministic Nodes-scoped drift in contracts, BFF forwarding, mock data, wrappers, UI, i18n, handoff docs, or tests when backed by evidence.
- [x] 3.4 Keep unsupported prototype capabilities inactive, degraded, or documented rather than adding speculative behavior.
- [x] 3.5 Regenerate generated artifacts only when a source contract changes, then run the matching check target.
- [x] 3.6 Update Nodes handoff notes for command schemas, pairing audit, token UX, polling, dynamic envelopes, trust evidence, and mutation safety assumptions.

## 4. Verification

- [x] 4.1 Run focused Nodes frontend tests.
- [x] 4.2 Run focused Go route/runtime tests for nodes routes and action envelopes.
- [x] 4.3 Add or run Nodes mock visual E2E and label it L1 mock/local visual coverage.
- [x] 4.4 Add or run Nodes real-stack API/UI E2E for inventory, pairing list, safe action shapes, production render, and BFF-only browser access.
- [x] 4.5 Apply the circuit breaker after at most three fresh attempts for any real scenario without a scoped deterministic fix.
- [x] 4.6 Run `openspec validate frontend-nodes-real-contract-verification --strict`.
- [x] 4.7 Run relevant contract checks if contracts or generated artifacts changed.
- [x] 4.8 Run `cd deck-go && make frontend-build`.
- [x] 4.9 Run `git diff --check`.

## 5. Review And Archive Readiness

- [x] 5.1 Perform code-level review of Nodes panel, API facade, Go route/runtime behavior, contracts, mocks, and real evidence.
- [x] 5.2 Update `deck-go/frontend-handoff/modules/nodes/implementation-notes.md` with findings, fixes, matrix, evidence, and residual risks.
- [x] 5.3 Update `deck-go/frontend-handoff/modules/nodes/README.md` status when implementation and real-contract verification are complete.
- [x] 5.4 Update `verification.yaml` for every L1/L2 scenario and mark archive-ready only when all non-L2 tasks are complete and L2 scenarios are passed, empty-valid, degraded, skipped-safe, or handoff-blocked with evidence.

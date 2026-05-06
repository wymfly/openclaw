## 1. Explore Existing Fixture Usage

- [x] 1.1 Review the current shared run-id helpers and writable real specs for budget, alerts, webhooks, routing, docs, agents, and cron.
- [x] 1.2 Classify which resource classes already have proven disposable create/delete semantics and which must remain skipped-safe or deferred.

## 2. Shared Fixture Library

- [x] 2.1 Add shared fixture helper types and functions for budget rules, alert rules, and webhooks.
- [x] 2.2 Ensure each cleanup helper asserts current-run ownership before issuing a cleanup request.
- [x] 2.3 Keep unsafe and unproven fixture classes recorded as skipped-safe/deferred.

## 3. Migrate Existing Specs

- [x] 3.1 Update budget real E2E specs to use shared budget fixture helpers.
- [x] 3.2 Update alerts real E2E specs to use shared alert fixture helpers.
- [x] 3.3 Update webhooks real E2E specs to use shared webhook fixture helpers.

## 4. Verification And Matrix Closure

- [x] 4.1 Add or update focused helper tests for shared fixture naming and cleanup refusal.
- [x] 4.2 Run `openspec validate --type change deck-go-real-e2e-fixture-library --strict`.
- [x] 4.3 Run focused Playwright/helper tests for the migrated fixture surfaces.
- [x] 4.4 Update the head proposal matrix JSON and generated Markdown so `deck-go-real-e2e-fixture-library` reflects the completed/archived lifecycle.
- [x] 4.5 Run `git diff --check`.
- [x] 4.6 Archive this child change after tasks and validation pass, syncing the spec delta into top-level specs as needed.

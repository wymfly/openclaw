## 1. Budget / Alerts / Webhooks Contract Audit

- [x] 1.1 Re-read Budget, Alerts, and Webhooks matrix rows, implementation notes, Deck-facing contracts, mutation evidence metadata, generated artifacts, BFF/runtime routes, frontend facades, panel copy, and mock/real E2E specs.
- [x] 1.2 Confirm supported, Deck-local, Gateway-derived-input, unsupported, or deferred workflows with source evidence.

## 2. Contract And Runtime Alignment

- [x] 2.1 Align Budget evaluation BFF and legacy admin runtime output with `DeckGoBudgetEvaluation.current`.
- [x] 2.2 Add a typed Deck-facing webhook test-delivery response DTO and regenerate Deck API artifacts.
- [x] 2.3 Update webhook test-delivery mutation evidence to use `success=true` and regenerate mutation evidence artifacts.
- [x] 2.4 Update frontend webhook facade typing, mutation evidence tests, API helper tests, and Alerts fallback copy/tests.

## 3. Evidence And Verification

- [x] 3.1 Update Budget, Alerts, and Webhooks implementation notes, contract-chain audit matrix rows, generated matrix Markdown, and head verification evidence.
- [x] 3.2 Run focused contract, backend, frontend, build, OpenSpec, and diff checks.
- [x] 3.3 Archive the OpenSpec change and validate the archived spec.

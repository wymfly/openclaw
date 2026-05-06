## 1. Contract And Prototype Audit

- [x] 1.1 Confirm `frontend-handoff/modules/webhooks/prototype.html` is the active visual target and map its workflows to current Webhooks/BFF/localstore contract truth.
- [x] 1.2 Map every Webhooks prototype workflow to current frontend API wrappers, Deck BFF routes, source contracts, generated DTOs, real fixtures, tests, or accepted prototype-only projections.
- [x] 1.3 Investigate safe real BFF evidence through run-scoped receiver creation, test delivery, delivery history, cleanup, BFF-only checks, or skipped-safe circuit breaker before accepting sparse evidence.
- [x] 1.4 Record unsupported projections and real E2E fixture strategy in Webhooks implementation notes.

## 2. Production UI Remediation

- [x] 2.1 Compare current `WebhooksPanel` and child surfaces against the active handoff prototype and identify deterministic mismatches.
- [x] 2.2 Fix deterministic layout, receiver inventory, selected detail, builder, guarded delete, test delivery, delivery expansion, localized text, fixture, API facade, or route drift that is supported by contract truth.
- [x] 2.3 Preserve existing BFF wrappers for `GET/POST/PATCH/DELETE /api/webhooks`, `GET /api/webhooks/{id}/deliveries`, and `POST /api/webhooks/{id}/test`.
- [x] 2.4 Preserve honest empty-valid, skipped-safe, or accepted-exception states for retry, stats, event catalog, audit timeline, live push, and platform-event dispatch gaps.
- [x] 2.5 Keep frontend code free of direct Gateway/localstore browser calls and inline styles.

## 3. Mock Evidence

- [x] 3.1 Update or confirm unit coverage for inventory, filters/search, selection, tabs, builder validation, create/edit/delete, test delivery, delivery expansion, redacted secrets, localized copy, and empty/error states.
- [x] 3.2 Update mock/seed expectations if needed to provide prototype-shaped receivers, delivery rows, failed/retry metadata, disabled/failing states, and a disposable receiver.
- [x] 3.3 Update `webhooks-visual.spec.ts` to capture receiver workbench, selected detail, filters, builder, delete confirmation, test delivery result, delivery expansion, localized theme variants, and unsupported accepted exceptions.
- [x] 3.4 Generate prototype-vs-current parity report and record pass or structured accepted exceptions.

## 4. Real BFF Evidence

- [x] 4.1 Add or update Webhooks real E2E to verify runtime readiness, route shapes, run-scoped CRUD/test/delete, and unsupported/skipped-safe outcomes.
- [x] 4.2 Verify real route shapes for list, create, patch, test delivery, deliveries, not-found/delete, and cleanup.
- [x] 4.3 Verify shell navigation into Webhooks, all four dark/English, dark/Chinese, light/English, and light/Chinese variants, selected-webhook or empty fallback, builder, delete confirmation, delivery tab, and filter behavior with Playwright.
- [x] 4.4 Record unexpected console, page, BFF API, direct Gateway request, and direct Gateway websocket errors.
- [x] 4.5 Record skipped-safe retry, stats, event catalog, audit, live-push, and platform-event-dispatch evidence instead of fabricating unsupported Webhooks semantics.

## 5. Verification And Archive

- [x] 5.1 Run focused Webhooks unit/API tests.
- [x] 5.2 Run Webhooks mock visual E2E.
- [x] 5.3 Run Webhooks real BFF E2E with `DECK_GO_REAL_GATEWAY_E2E=1`, or circuit-break after bounded evidence.
- [x] 5.4 Run `make frontend-build`.
- [x] 5.5 Run `openspec validate deck-go-frontend-webhooks-prototype-parity-remediation --strict`.
- [x] 5.6 Update the head matrix and mark head task `6.13` complete only after verified evidence is recorded.
- [x] 5.7 Archive this child proposal after tasks complete.

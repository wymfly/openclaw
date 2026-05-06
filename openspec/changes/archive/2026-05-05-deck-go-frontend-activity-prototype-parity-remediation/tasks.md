## 1. Exploration And Reconciliation

- [x] 1.1 Confirm the active Activity prototype path, production panel paths, BFF wrappers, mock visual spec, real Gateway spec, and existing archived evidence.
- [x] 1.2 Decide prototype-vs-contract ownership for monitor run diagnostics and record any accepted exceptions before UI edits.
- [x] 1.3 Run or inspect baseline mock/current evidence enough to confirm the structural drift being fixed.

## 2. Production Activity UI

- [x] 2.1 Replace the Activity page layout with the active prototype structure: header, KPI strip, toolbar segments, grouped feed, row glyphs/chips, empty/error/loading states, and event detail dialog.
- [x] 2.2 Preserve BFF-only `GET /activity` snapshot fetching and `activity.event` SSE merge with duplicate suppression.
- [x] 2.3 Add family/severity/time/search filtering over open-string activity event types with safe unknown-type fallback.
- [x] 2.4 Add or update English and Chinese Activity translations for the rewritten surface.
- [x] 2.5 Remove obsolete Activity monitor-card UI dependencies from the production panel without deleting monitor contracts or routes.

## 3. Focused Tests And Mock Evidence

- [x] 3.1 Update Activity unit tests for snapshot load, filter composition, unknown type fallback, SSE merge, dialog open/copy/close, refresh, and i18n-safe labels.
- [x] 3.2 Update Activity mock visual E2E to assert prototype-shaped UI and exercise row dialog plus filter interactions.
- [x] 3.3 Run focused Activity unit tests and mock visual E2E.
- [x] 3.4 Generate Activity prototype-vs-current contact-sheet evidence and write a structured visual verdict with accepted exceptions if needed.

## 4. Strengthened Real Gateway Evidence

- [x] 4.1 Update Activity real Gateway E2E to navigate from shell to Activity instead of relying only on direct panel URLs.
- [x] 4.2 Add dark/English and light/Chinese real UI variants.
- [x] 4.3 Add real UI interactions for refresh, search, family/severity/time filters, row detail dialog, copy/close, and empty-state recovery.
- [x] 4.4 Attempt safe run-scoped cpa/main chat/session seed data through the isolated real E2E helper, record bounded seed evidence, and refuse non-run-scoped cleanup/mutation.
- [x] 4.5 Record BFF response shape, seed status, unexpected console/page/API errors, and direct Gateway browser access evidence.
- [x] 4.6 Run the strengthened Activity real Gateway E2E or record circuit-breaker handoff after bounded failures.

## 5. Documentation, Validation, And Archive

- [x] 5.1 Update Activity implementation notes with prototype decisions, deterministic fixes, mock parity verdict, real E2E evidence, and residual risks.
- [x] 5.2 Run `openspec validate deck-go-frontend-activity-prototype-parity-remediation --strict`.
- [x] 5.3 Run relevant frontend build/type verification for the touched Activity surface.
- [x] 5.4 Archive the Activity child proposal after all child tasks and evidence are complete.
- [x] 5.5 Update the head remediation matrix and mark head task `5.1` complete after archive.
- [x] 5.6 Re-run `openspec validate deck-go-frontend-prototype-parity-remediation --strict` and `openspec validate --changes --strict`.

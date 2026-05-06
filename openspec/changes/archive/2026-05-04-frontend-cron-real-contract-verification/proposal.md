## Why

`deck-go/frontend-handoff/modules/cron/` now contains a refreshed v2 high-fidelity prototype for the scheduled-job control surface, but the handoff still says pending and the production panel remains closer to the earlier compact implementation. Cron also has mutation surfaces that must be verified against the real Deck BFF/Gateway contract chain before this module can be treated as complete.

Cron is a control-plane workflow over Gateway `cron.*` methods. The implementation must not invent scheduler preview, bulk operations, live history streams, optimistic concurrency, or delivery semantics beyond the current DTOs and BFF routes.

## What Changes

- Refactor `frontend-new` Cron so production follows the v2 handoff where backed by current Deck cron contracts.
- Re-audit the Cron contract chain: `DeckGoCron*` DTOs, `/api/cron*` BFF routes, frontend wrappers, Go runtime route mapping, Gateway `cron.*` methods, endpoint classification, mock gateway fixtures, and real-stack behavior.
- Fix deterministic Cron drift directly when evidence-backed, including route naming drift in handoff docs, unsupported `PUT /api/cron/jobs/:id` claims, stale tests, `window.confirm` deletion, shallow filter/table behavior, or copy that overstates backend scheduler guarantees.
- Keep unsupported prototype behavior inactive, degraded, or documented rather than adding speculative routes/dependencies such as cron-expression parser previews, schedule preview RPCs, bulk actions, live run streams, or cursor pagination.
- Add or refresh L1 mock visual E2E and bounded L2 real-stack API/UI evidence for status, job list, run history, safe read paths, safe mutation error/empty handling, and BFF-only browser access.
- Archive only after tasks, OpenSpec validation, focused tests, relevant contract checks, frontend build, diff check, and final review evidence are complete.

## Capabilities

### New Capabilities

- `frontend-cron-real-contract-verification`: Cron-specific real-contract verification, Gateway/BFF scheduler safety, evidence matrix, circuit breaker, and closeout discipline.

### Modified Capabilities

- `frontend-cron-hifi-redesign`: update the Cron hifi requirements from the earlier contract-backed panel to the refreshed v2 scheduled-job workbench where supported by the real BFF/Gateway contract.

## Impact

- `deck-go/frontend-handoff/modules/cron/`
- `deck-go/frontend-new/src/components/panels/cron/**`
- `deck-go/frontend-new/src/api.ts`, i18n, and focused frontend tests when wrapper/copy drift is found
- `deck-go/backend/internal/server/inventory.go`, runtime query paths, mock gateway fixtures, and related Go tests when BFF route behavior drift is found
- `deck-go/contracts/source/**` and generated artifacts only when source contract changes are necessary
- `deck-go/test/e2e/cron-visual.spec.ts` and a real-gateway/BFF E2E spec for Cron
- `openspec/specs/frontend-cron-hifi-redesign/spec.md` and the new Cron real-contract verification spec

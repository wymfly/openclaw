## Why

`deck-go/frontend-handoff/modules/docs/` now contains a fresh v2 high-fidelity prototype for the runtime-extracted document reader. The existing production Docs panel is already wired to the BFF, but it needs to be re-checked against the refreshed prototype and verified through the real docs BFF/local-store/Gateway extraction path before the module can be treated as complete.

## What Changes

- Rebuild or refactor `frontend-new` Docs so the production panel follows the v2 handoff where it is consistent with the true contract.
- Re-audit the full docs contract chain: frontend wrappers, `/api/docs` BFF routes, Go local docs store/extraction behavior, chat-history Gateway dependency for extraction, DTOs, delete semantics, and Markdown/rendering assumptions.
- Fix deterministic docs-scoped drift directly when the fix is evidence-backed and does not invent unsupported Gateway or knowledge-base behavior.
- Keep unsupported or ambiguous prototype behavior inactive, degraded, or recorded in handoff notes instead of forcing it into production.
- Add or refresh L1 mock visual E2E evidence and bounded L2 real-stack API/UI evidence for list, detail, extract-safe shape, delete-safe shape, render, and BFF-only browser access.
- Archive the change only after tasks, OpenSpec validation, focused tests, relevant contract checks, frontend build, and final review evidence are complete.

## Capabilities

### New Capabilities

- `frontend-docs-real-contract-verification`: docs-specific real-contract verification, local-store/extraction safety, circuit breaker, evidence matrix, and closeout discipline.

### Modified Capabilities

- `frontend-docs-hifi-redesign`: update the existing docs hifi requirements from the prior implementation to the refreshed v2 handoff and real-contract verification standard.

## Impact

- `deck-go/frontend-handoff/modules/docs/`
- `deck-go/frontend-new/src/components/panels/docs/**`
- `deck-go/frontend-new/src/api.ts`, i18n, and focused frontend tests when wrapper or copy drift is found
- `deck-go/backend/internal/server/docs.go`, `deck-go/backend/internal/api/http/admin.go`, `deck-go/backend/internal/runtime/openclaw/legacy_admin_docs_memory.go`, local store behavior, and related Go tests when BFF/runtime drift is found
- `deck-go/contracts/source/**` and generated contract artifacts only when source contract changes are necessary
- `deck-go/test/e2e/docs-visual.spec.ts` and a docs real-gateway E2E spec
- `openspec/specs/frontend-docs-hifi-redesign/spec.md` and the new docs real-contract verification spec

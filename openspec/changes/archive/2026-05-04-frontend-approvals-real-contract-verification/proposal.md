## Why

`deck-go/frontend-handoff/modules/approvals/` now contains a refreshed v2 high-fidelity prototype for the security approval operations workspace, but the production panel and handoff notes still reflect a prior mock-visual-only pass. Approvals is decision-critical and mutation-heavy, so completion must be based on the real Deck BFF/Gateway contract chain rather than prototype shape alone.

Approvals controls Gateway exec and plugin approval decisions plus policy writes. The implementation must not invent bulk approval, audit pagination, typed approval-list schemas, summary aggregation, server-authoritative countdown guarantees, or policy semantics beyond current contracts.

## What Changes

- Re-audit the Approvals contract chain: `DeckGoApproval*` DTOs, `/api/approvals*` BFF routes, `/api/stream` SSE behavior, frontend wrappers, Go runtime route mapping, Gateway `exec.approvals.*`, `exec.approval.*`, and `plugin.approval.*` methods, endpoint classification, mock fixtures, and real-stack behavior.
- Refactor or tighten `frontend-new` Approvals so production follows the v2 handoff where backed by current Deck approval contracts.
- Fix deterministic Approvals drift directly when evidence-backed, including stale stream route documentation, incorrect decision examples, incomplete UI metadata, unsupported summary/audit claims, stale tests, hardcoded copy, or missing safe real-stack coverage.
- Keep unsupported prototype behavior inactive, degraded, or documented rather than adding speculative routes such as bulk decisions, typed recent-decision audit pagination, typed summary KPIs, or policy reason validation.
- Add or refresh L1 mock visual E2E and bounded L2 real-stack API/UI evidence for safe read paths, mutation shape review, empty/degraded handling, approval stream boundary, and BFF-only browser access.
- Archive only after tasks, OpenSpec validation, focused tests, relevant contract checks, frontend build, diff check, and final review evidence are complete.

## Capabilities

### New Capabilities

- `frontend-approvals-real-contract-verification`: Approvals-specific real-contract verification, decision/policy mutation safety, evidence matrix, circuit breaker, and closeout discipline.

### Modified Capabilities

- `frontend-approvals-hifi-redesign`: update the Approvals hifi requirements from the earlier mock-visual workbench to the refreshed v2 security operations workspace where supported by the real BFF/Gateway contract.

## Impact

- `deck-go/frontend-handoff/modules/approvals/`
- `deck-go/frontend-new/src/components/panels/approvals/**`
- `deck-go/frontend-new/src/api.ts`, i18n, and focused frontend tests when wrapper/copy drift is found
- `deck-go/backend/internal/server/inventory.go`, runtime query paths, mock gateway fixtures, and related Go tests when BFF route behavior drift is found
- `deck-go/contracts/source/**` and generated artifacts only when source contract changes are necessary
- `deck-go/test/e2e/approvals-visual.spec.ts` and a real-gateway/BFF E2E spec for Approvals
- `openspec/specs/frontend-approvals-hifi-redesign/spec.md` and the new Approvals real-contract verification spec

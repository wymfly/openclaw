## Why

`deck-go/frontend-handoff/modules/subagents/` now contains a refreshed v2 high-fidelity prototype for the Subagents runs and permissions workspace, but the production panel still reflects an earlier contract-led pass and the handoff docs contain route/status assumptions that do not match current code truth.

Subagents is both an operational live-view and a mutation surface for kill, steer, and per-agent subagent permissions. Completion must therefore be based on the real OpenClaw Gateway -> Go BFF -> Deck DTO -> frontend contract chain rather than prototype shape alone.

## What Changes

- Re-audit the Subagents contract chain: `DeckGoSubagent*` DTOs, `/api/deck/subagents` BFF action routes, `/api/deck/agents` subagent-config actions, frontend wrappers, Go route mapping, generated Gateway params/results, endpoint classification, mock Gateway fixtures, and real-stack behavior.
- Refactor or tighten `frontend-new` Subagents so production follows the v2 handoff where backed by current Deck contracts: runs/permissions modes, compact toolbar, KPI strip, selected-run detail, lineage, outcome/raw inspection, steer/kill dialogs, and per-agent permission editing.
- Fix deterministic Subagents drift directly when evidence-backed, including stale REST-style route documentation, unsupported status values, obsolete BFF-forwarding notes, missing UI metadata, stale tests, and action payload/hash handling.
- Keep unsupported prototype behavior inactive, degraded, or documented rather than inventing audit endpoints, client-generated dedup keys, kill-cascade guarantees, stalled-state inference, or status enums unsupported by Gateway schemas.
- Add or refresh L1 mock visual E2E and bounded L2 real-stack API/UI evidence for safe read paths, empty/degraded handling, mutation envelope review, and BFF-only browser access.
- Archive only after tasks, OpenSpec validation, focused tests, relevant contract checks, frontend build, diff check, and final review evidence are complete.

## Capabilities

### New Capabilities

- `frontend-subagents-real-contract-verification`: Subagents-specific real-contract verification, action/permission mutation safety, evidence matrix, circuit breaker, and closeout discipline.

### Modified Capabilities

- `frontend-subagents-hifi-redesign`: update the Subagents hifi requirements from the earlier mock-visual workbench to the refreshed v2 runs/permissions workspace where supported by the real BFF/Gateway contract.

## Impact

- `deck-go/frontend-handoff/modules/subagents/`
- `deck-go/frontend-new/src/components/panels/subagents/**`
- `deck-go/frontend-new/src/api.ts`, i18n, and focused frontend tests when wrapper/copy drift is found
- `deck-go/backend/internal/server/inventory.go`, runtime query paths, mock Gateway fixtures, and related Go tests when BFF route behavior drift is found
- `deck-go/contracts/source/**` and generated artifacts only when source contract changes are necessary
- `deck-go/test/e2e/subagents-visual.spec.ts` and a real-gateway/BFF E2E spec for Subagents
- `openspec/specs/frontend-subagents-hifi-redesign/spec.md` and the new Subagents real-contract verification spec

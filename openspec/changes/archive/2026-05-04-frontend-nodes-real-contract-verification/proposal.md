## Why

`deck-go/frontend-handoff/modules/nodes/` now contains a fresh v2 high-fidelity prototype for the device trust and remote-control workbench. The existing production Nodes panel is contract-backed, but it needs to be re-checked against the refreshed prototype and verified through real Gateway/BFF paths before the module can be treated as complete.

## What Changes

- Rebuild or refactor `frontend-new` Nodes so the production panel follows the v2 handoff where it is consistent with the true contract.
- Re-audit the full nodes contract chain: frontend wrappers, `/api/nodes` and `/api/nodes/pair` BFF routes, Go runtime adapter, generated Gateway typed/dynamic methods, DTOs, pairing action semantics, and dynamic node action envelopes.
- Fix deterministic nodes-scoped drift directly when the fix is evidence-backed and does not invent unsupported Gateway behavior.
- Keep unsupported or ambiguous prototype behavior inactive, degraded, or recorded in handoff notes instead of forcing it into production.
- Add or refresh L1 mock visual E2E evidence and bounded L2 real-stack API/UI evidence for inventory, describe, safe dynamic envelopes, pairing routes, render, and BFF-only browser access.
- Archive the change only after tasks, OpenSpec validation, focused tests, relevant contract checks, frontend build, and final review evidence are complete.

## Capabilities

### New Capabilities

- `frontend-nodes-real-contract-verification`: nodes-specific real-contract verification, dynamic-envelope safety, circuit breaker, evidence matrix, and closeout discipline.

### Modified Capabilities

- `frontend-nodes-hifi-redesign`: update the existing nodes hifi requirements from the prior implementation to the refreshed v2 handoff and real-contract verification standard.

## Impact

- `deck-go/frontend-handoff/modules/nodes/`
- `deck-go/frontend-new/src/components/panels/nodes/**`
- `deck-go/frontend-new/src/api.ts`, i18n, and focused frontend tests when wrapper or copy drift is found
- `deck-go/backend/internal/server/**`, `deck-go/backend/internal/runtime/openclaw/**`, and related Go tests when BFF/runtime drift is found
- `deck-go/contracts/source/**` and generated contract artifacts only when source contract changes are necessary
- `deck-go/test/e2e/nodes-visual.spec.ts` and a nodes real-gateway E2E spec
- `openspec/specs/frontend-nodes-hifi-redesign/spec.md` and the new nodes real-contract verification spec

## Why

Agents is the first module with prior mock visual, contract-chain, and real Gateway read-path evidence, but the head matrix still records narrowed action payload/write-safety evidence as the remaining gap. Now that Gateway method hardening, config-write safety, safe mutation evidence, live projections, and list-query contracts are archived, agents can be closed as a module/product contract by making every visible agents/subagents control claim either typed, real-read verified, or explicitly mutation-deferred.

## What Changes

- Re-audit current agents and subagents product workflows against Gateway generated methods, Deck BFF wrappers, frontend facades, prior L2 evidence, and matrix gaps.
- Extend mutation evidence metadata for agents/subagents actions that remain unsafe for automated real writes, including create/update/delete, skills save, event stream save, subagent policy save, file save, steer, and kill.
- Add or update focused frontend tests proving agents/subagents mutation facades are routed through shared mutation evidence where safe to interpret.
- Keep real create/update/delete/save scenarios handoff-blocked unless disposable isolated agent state is proven during implementation.
- Update agents/subagents matrix rows and head proposal evidence so the module is no longer waiting on platform-control safe mutation work.

## Capabilities

### New Capabilities

- `deck-go-agents-control-contract-completion`: Completes the agents/subagents module contract-chain by mapping visible product workflows to typed Gateway/Deck DTOs, real read evidence, mutation evidence metadata, and explicit deferred real mutation scenarios.

### Modified Capabilities

- None.

## Impact

- Affected contract metadata: `deck-go/contracts/source/deck-mutations.contract.json` and generated mutation evidence docs/TypeScript metadata.
- Affected frontend: `frontend-new/src/api.ts`, agents/subagents focused tests, and mutation evidence helper usage where applicable.
- Affected docs/evidence: agents handoff implementation notes, contract-chain audit matrix, and head proposal verification evidence.
- Backend changes are only in scope if exploration finds deterministic agents-scoped adapter or route drift. No new Gateway APIs are introduced.

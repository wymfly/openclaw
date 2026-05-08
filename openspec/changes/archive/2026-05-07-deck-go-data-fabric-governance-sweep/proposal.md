## Why

The Data Fabric migration has now moved the major module groups through
foundation, Agents, config/inventory, live workbench, and Chat surroundings.
The final phase needs to close governance gaps so future frontend work has a
clear rule: panel server state goes through Data Fabric, stores keep UI/stream
bridge state, and any remaining imperative server reads have an explicit reason.

The current code truth still shows a small set of residual server-state
lifecycles outside Data Fabric:

- `ApiExplorerPanel` still owns `fetchGatewayDescribe()` in a component
  `useEffect`.
- `IdentityPanel` still owns identity links and main agent identity fetches
  directly.
- `SubagentsPanel` still owns agents/config/subagent-run/lineage reads through
  component callbacks.
- `useCapabilities()` still owns a shared BFF fetch lifecycle outside Data
  Fabric.
- Chat utility surfaces still include specialized, intentionally imperative
  paths such as `useChatSSE`, command execution, transcript history recovery,
  subagent lineage, and compaction detail surfaces; these need either migration
  or an explicit exception.

This sweep is necessary because the product objective is not just fewer
requests. The control plane needs an enforceable architecture where developers
can tell which sources are authoritative, which paths are specialized, and which
future changes are out of policy.

## What Changes

- Add Data Fabric coverage for the remaining unmigrated panels/hooks:
  - API Explorer Gateway describe read.
  - Identity links and identity mutations.
  - Subagents inventory/runs/lineage/config reads.
  - Capabilities hook used by header, first-run banner, Gateway panel, and
    Settings panel.
- Migrate residual component-owned `useEffect(fetch*)` lifecycles in those
  panels to Data Fabric hooks, query options, or mutations.
- Migrate Chat secondary detail reads where practical:
  - subagent lineage card/tree uses sessions/subagents Data Fabric query
    boundaries instead of direct `fetchSubagentLineage` effects;
  - compaction summary uses existing sessions compaction query boundary instead
    of direct `fetchCompactionList`.
- Keep specialized exceptions explicit:
  - `useChatSSE` remains the transcript stream dispatcher and may use direct
    stream transport plus bounded authoritative refresh.
  - `chat-dispatchers.reloadFullContent()` remains an imperative history seam.
  - `slash-command-executor` remains command execution logic, not panel
    first-load/background-refresh server state.
  - `chat-api.ts` remains a Chat adapter/normalizer facade, not a panel fetch
    lifecycle owner.
- Add governance documentation and tests so remaining exceptions are listed with
  code references, owner, reason, and follow-up status.
- Preserve the current design decision that custom lint, DevTools, prefetch,
  IndexedDB persistence, mutation queues, and live projection patchStrategy
  contract extensions are deferred unless separately proposed.

## Capabilities

### New Capabilities

- `deck-go-data-fabric-governance-sweep`: Residual server-state migration,
  approved exception registry, and verification requirements for the Data
  Fabric program exit.

### Modified Capabilities

- `deck-go-data-fabric-foundation`: Add governance/exception registry
  expectations for Data Fabric module migrations.
- `frontend-new-workspace`: Require remaining panel server-state lifecycles to
  use Data Fabric or be listed as approved exceptions.

## Impact

- Frontend data layer:
  - `deck-go/frontend-new/src/data/README.md`
  - new or existing modules under `deck-go/frontend-new/src/data/modules/`
  - `deck-go/frontend-new/src/data/queries/`
  - possible governance tests under `deck-go/frontend-new/src/data/`
- Frontend panels/hooks:
  - `deck-go/frontend-new/src/components/panels/api-explorer/ApiExplorerPanel.tsx`
  - `deck-go/frontend-new/src/components/panels/identity/IdentityPanel.tsx`
  - `deck-go/frontend-new/src/components/panels/subagents/SubagentsPanel.tsx`
  - `deck-go/frontend-new/src/hooks/useCapabilities.ts`
  - Chat secondary detail components where direct fetch effects remain
- Contracts:
  - No source contract changes are expected. If implementation discovers a
    missing Deck-facing contract, update the OpenSpec artifacts before editing
    contract sources.
- Verification:
  - focused governance/data tests,
  - affected panel tests,
  - full frontend suite with unrelated baseline failures recorded if unchanged,
  - `make frontend-build`,
  - `make contract-gate`,
  - L4 mock-functional coverage for affected panels where specs exist,
  - L5 real Gateway smoke for affected panels where specs exist, with bounded
    circuit breaker for environment/startup failures.

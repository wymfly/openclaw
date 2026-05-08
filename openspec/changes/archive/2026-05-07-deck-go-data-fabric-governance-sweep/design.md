## Context

The first five Data Fabric changes established the foundation and migrated the
major module groups. This sweep intentionally starts from code truth rather than
assuming the earlier matrix covered every panel. The current repo scan shows:

- Panel directories: `activity`, `agents`, `alerts`, `api-explorer`,
  `approvals`, `budget`, `channels`, `chat`, `config`, `cron`, `docs`,
  `gateway`, `identity`, `logs`, `memory`, `models`, `nodes`, `plugins`,
  `routing`, `sessions`, `settings`, `skills`, `subagents`, `threads`, `usage`,
  `webhooks`.
- Data modules already exist for all of those except `api-explorer`,
  `identity`, and `subagents`; `commands` exists as a shared Chat-adjacent
  module.
- Direct server-state lifecycles remain in:
  - `hooks/useCapabilities.ts`
  - `components/panels/api-explorer/ApiExplorerPanel.tsx`
  - `components/panels/identity/IdentityPanel.tsx`
  - `components/panels/subagents/SubagentsPanel.tsx`
  - Chat secondary detail helpers such as `CompactionSummaryModal` and
    `SubagentTree`
- Specialized stream/command paths remain in Chat and should not be forced into
  query cache.

## Contract Sources Re-read Before Implementation

The implementation MUST re-read these sources before production edits and
record exact findings in the verification artifact:

- `deck-go/contracts/source/deck-api.contract.ts`
- `deck-go/contracts/source/deck-endpoints.contract.json`
- `deck-go/contracts/source/deck-list-queries.contract.json`
- `deck-go/contracts/source/deck-mutations.contract.json`
- `deck-go/contracts/source/deck-live-projections.contract.json`
- `deck-go/contracts/source/deck-route-governance.contract.json`
- `deck-go/contracts/generated/ts/deck-api.generated.ts`
- `deck-go/frontend-new/src/api.ts`
- Existing modules under `deck-go/frontend-new/src/data/modules/`

## Scope Classification

### Confirmed Code-Truth Inventory

Fresh scan before implementation confirmed the residual scope remains aligned
with this proposal:

- `deck-go/frontend-new/src/hooks/useCapabilities.ts` owns a direct
  `fetchCapabilities()` lifecycle and visibility refresh.
- `deck-go/frontend-new/src/components/runtime/ModeBadge.tsx` owns a direct
  `fetchEndpoint()` lifecycle after capabilities load.
- `deck-go/frontend-new/src/components/panels/api-explorer/ApiExplorerPanel.tsx`
  owns a direct `fetchGatewayDescribe()` component lifecycle.
- `deck-go/frontend-new/src/components/panels/identity/IdentityPanel.tsx` owns
  direct `fetchIdentityLinks()` and `fetchAgentIdentity("main")` lifecycles plus
  direct identity link/unlink mutation calls.
- `deck-go/frontend-new/src/components/panels/subagents/SubagentsPanel.tsx`
  owns direct agents/config/subagent-run/lineage read lifecycles and direct
  subagent/action mutation calls.
- `deck-go/frontend-new/src/components/panels/chat/SubagentTree.tsx` owns a
  direct session lineage read lifecycle.
- `deck-go/frontend-new/src/components/panels/chat/CompactionSummaryModal.tsx`
  owns a direct compaction checkpoint read lifecycle.
- `deck-go/frontend-new/src/stores/approvals.ts` still exposes store-owned
  `fetchPolicy` and `fetchPending` server fetch methods with no production
  consumers; production Chat only uses the store as a pending-approval stream/UI
  bridge and inline approval resolver.
- Direct facade imports inside `src/data/modules/**` and test files are expected
  Data Fabric adapter/test seams, not panel-owned server lifecycles.

### Migrate

| Surface                   | Current source                               | Target Data Fabric owner                                            | Freshness          |
| ------------------------- | -------------------------------------------- | ------------------------------------------------------------------- | ------------------ |
| Capabilities              | `fetchCapabilities()` in `useCapabilities()` | `data/queries/capabilities` or `data/modules/settings` shared query | `runtime-liveness` |
| Runtime endpoint badge    | `fetchEndpoint()` in `ModeBadge`             | existing `settings` runtime endpoint query                          | `config-authority` |
| API Explorer describe     | `fetchGatewayDescribe()` in panel effect     | existing `gateway` describe query                                   | `lazy-detail`      |
| Identity links            | `fetchIdentityLinks()` panel callback        | new `identity` module                                               | `config-authority` |
| Identity link/unlink      | `linkIdentityPeer`, `unlinkIdentityPeer`     | new `identity` mutations                                            | no retry           |
| Main agent identity       | `fetchAgentIdentity("main")` panel effect    | existing `agents` identity query                                    | `lazy-detail`      |
| Subagent runs             | `fetchSubagentRuns()` panel callback         | new `subagents` module                                              | `live-workbench`   |
| Subagent lineage          | `fetchSubagentLineage()` panel/card effect   | new `subagents` or existing `sessions` query boundary               | `lazy-detail`      |
| Subagent config           | `fetchAgentSubagentConfig()`                 | existing `agents` subagent config query                             | `config-authority` |
| Subagents config baseline | `fetchDeckConfig()`                          | existing config/settings query if available, otherwise module query | `config-authority` |
| Chat compaction detail    | `fetchCompactionList()` effect               | existing sessions compaction query                                  | `lazy-detail`      |

### Approved Exceptions

The governance registry SHALL list these as approved exceptions with code
references and reasons unless implementation migrates them:

- `useChatSSE.ts`: specialized transcript and live stream dispatcher; direct
  stream transport is intentional.
- `chat-dispatchers.ts#reloadFullContent`: imperative transcript history seam
  after stream finalization.
- `slash-command-executor.ts`: command execution path; reads used to resolve a
  command execution, not panel background server state.
- `chat-api.ts`: adapter/normalizer facade used by migrated Chat components and
  tests; not a component lifecycle owner.
- `stores/approvals.ts`: stream/UI bridge for pending approvals and inline
  approval resolution; any unused `fetch*` store methods should be removed or
  recorded with follow-up if still required.

## Implementation Decisions

### 1. Governance Should Be Code-Tested, Not Only Documented

Add a small governance test that scans known frontend source roots for
disallowed patterns and compares them against an explicit allowlist. This is not
a custom lint rule and should stay narrow enough to avoid noisy broad
enforcement.

The allowlist should include file path, pattern, reason, owner, and follow-up
status. The test should fail if new raw server-state lifecycle patterns appear
outside the allowlist.

### 2. Prefer Existing Modules Over New Ones

Only create new modules where no owner exists:

- `api-explorer` can reuse `gateway` describe query.
- `identity` needs a new module because identity links are not owned by Agents.
- `subagents` needs a module for runs and run lineage; agent subagent config can
  reuse the Agents module.
- capabilities can live under `data/queries/capabilities` because it is runtime
  bootstrap/shared shell state rather than a panel module.

### 3. Preserve Local Product State

Migrations SHALL keep local UI state in React state:

- selected method/body tab/raw response/history in API Explorer;
- selected identity, filter, dialogs, pending unlink/link drafts in Identity;
- selected run, filters, modals, permission drafts, and auto-refresh toggle in
  Subagents.

### 4. Do Not Broaden Hardening Features

This change SHALL NOT add custom lint, DevTools, persistence, offline mutation
queue, automatic mutation retry, or generated projection patch fields. It may
add a focused test because the accepted Data Fabric baseline needs enforceable
exit evidence.

## Verification Strategy

- OpenSpec:
  - validate this change strictly before and after implementation;
  - validate touched accepted specs after sync.
- Code-level:
  - focused data/governance tests for keys, freshness, mutations, cache reuse,
    and allowlist enforcement;
  - affected panel/hook tests for API Explorer, Identity, Subagents,
    capabilities, Chat compaction/lineage if changed.
- Project:
  - `cd deck-go/frontend-new && npm run test:deck-ui` with unrelated baseline
    failures recorded if unchanged;
  - `cd deck-go && make frontend-build`;
  - `cd deck-go && make contract-gate`.
- Browser:
  - L4 mock-functional specs for affected panels where they exist:
    `api-explorer-visual`, `identity-visual`, `subagents-visual` if present;
    otherwise record missing spec and cover with component tests.
  - L5 real Gateway specs for affected panels where they exist; if missing,
    record route-level or existing module real-gateway evidence and mark the gap
    as follow-up.

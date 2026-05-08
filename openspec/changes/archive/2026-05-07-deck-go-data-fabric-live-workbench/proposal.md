## Why

Phase 3 of the Data Fabric program must migrate the high-churn workbench panels
that currently own their server fetch lifecycles with local `useEffect` loads,
manual refresh functions, and panel-local stream handling. These panels are the
places where repeated navigation, background refresh errors, live projection
gaps, and real Gateway evidence matter most.

This change follows the archived `deck-go-data-fabric-foundation`,
`deck-go-data-fabric-agents-reference`, and
`deck-go-data-fabric-config-inventory` changes. It keeps the same contract-first
rules while limiting scope to live/historical workbench surfaces. Chat transcript
streaming and chat-adjacent session sidebar/query migration remain reserved for
`deck-go-data-fabric-chat-surroundings`.

## What Changes

- Add Data Fabric modules for the live/historical workbench panels:
  `sessions`, `approvals`, `activity`, `gateway`, `usage`, `logs`, `alerts`,
  `budget`, `cron`, `threads`, and `webhooks`.
- Migrate those panels and child components from component-owned server fetch
  lifecycles to module query hooks/options and mutation wrappers while
  preserving current product UI, local filters, selected item state, drafts,
  dialogs, and skipped-safe write protections.
- Respect current contract sources:
  - `deck-go/contracts/source/deck-api.contract.ts`
  - `deck-go/contracts/source/deck-endpoints.contract.json`
  - `deck-go/contracts/source/deck-streams.contract.json`
  - `deck-go/contracts/source/deck-live-projections.contract.json`
  - `deck-go/contracts/source/deck-list-queries.contract.json`
  - `deck-go/contracts/source/deck-mutations.contract.json`
  - `deck-go/contracts/source/deck-config-write-safety.contract.json`
  - `deck-go/contracts/source/deck-route-governance.contract.json`
  - `deck-go/contracts/source/deck-ui.contract.json`
- Use exact BFF and Gateway-backed sources already exposed through
  `frontend-new/src/api.ts`; browser code must continue to call only deck-go
  backend routes, never direct Gateway URLs.
- Map live projection metadata for:
  - `activity-feed` -> activity and monitor read models
  - `approval-queue` -> approvals pending/list and policy-adjacent reads
  - `session-list` -> Sessions panel session inventory reads
  - `log-tail` -> Logs panel read model and stream boundary
  - `usage-observability` -> usage read models with refresh-only behavior
- Keep log tail and chat transcript stream reducers specialized where current
  contracts require it; Data Fabric owns authoritative list/detail/status reads
  and invalidation, not every byte of streaming transcript/log rendering.
- Preserve conservative mutation semantics: no automatic mutation retry, no
  offline mutation queue, no invented optimistic update, no generated
  `patchStrategy` or `patchKeys` dependency.
- Provide focused tests plus L4 mock-functional and L5 real-gateway evidence for
  every scoped module, with a two-attempt circuit breaker for real stack
  environment/startup failures.

## Capabilities

### New Capabilities

- `deck-go-data-fabric-live-workbench`: Data Fabric module boundaries,
  freshness, live invalidation, mutation safety, and verification requirements
  for live/historical workbench panels.

### Modified Capabilities

- `deck-go-data-fabric-foundation`: Clarify that later module migrations may
  add live/historical workbench modules using the existing foundation without a
  second server-state framework.
- `deck-go-live-projection-subscription-contract`: Add live-workbench
  Data Fabric invalidation expectations for activity, approvals, session list,
  log tail, and usage refresh-only metadata without adding patch fields.
- `frontend-new-workspace`: Extend the Data Fabric panel protocol to live and
  historical workbench panels touched in this change.

## Impact

- Frontend Data Fabric:
  `deck-go/frontend-new/src/data/modules/{sessions,approvals,activity,gateway,usage,logs,alerts,budget,cron,threads,webhooks}/`
- Frontend panels and tests:
  `deck-go/frontend-new/src/components/panels/{sessions,approvals,activity,gateway,usage,logs,alerts,budget,cron,threads,webhooks}/`
- API facades:
  `deck-go/frontend-new/src/api.ts` is the allowed backend boundary; new or
  adjusted wrapper usage must stay there or inside Data Fabric modules.
- Existing E2E:
  `deck-go/test/e2e/{sessions,approvals,activity,gateway,usage,logs,alerts,budget,cron,threads,webhooks}-visual.spec.ts`
  and matching `*-real-gateway.spec.ts`.
- Contract checks:
  `cd deck-go && make contract-gate`; narrower checks may be used only when the
  design proves no source contract or generated contract surface changed.

## Why

Real E2E debugging exposed a confusing failure mode in `frontend-new`: a panel can receive valid Gateway/BFF data, but local filters, search text, selected rows, or stale list state can hide the data and make the page look like it failed to load. The Plugins panel has already hit this case: `GET /api/deck/plugins` returned real rows, while impossible capability filters for the current scope could still produce an empty-looking page.

This is not a new Data Fabric architecture problem. Data Fabric now owns server-state reads for the relevant modules. The remaining gap is that list/workbench panels do not consistently explain the difference between first-load loading, API error, true empty data, filtered empty data, degraded cached data, and refresh-in-progress with cached rows.

## What Changes

- Add a frontend data-state clarity requirement for data-backed panels in `deck-go/frontend-new`.
- Audit all data-backed list/workbench panels for static filters, local search, selection preservation, refresh behavior, and empty/error/loading/degraded states.
- Fix high-risk panels where real data can be hidden by stale or impossible local filters:
  - `plugins` as the reference/regression case
  - `skills`
  - `models`
  - `channels`
  - `subagents`
  - `approvals`
  - `budget`
  - `alerts`
  - `cron`
  - `webhooks`
- Use dynamic filter availability, per-filter counts, disabled zero-count filters, or automatic reset depending on the product semantics of each filter.
- Add clear-filter/recover affordances and explicit empty-state copy so users can distinguish "nothing exists" from "your current filters hide existing data".
- Add focused component tests and a bounded mock/real smoke checklist for the affected panels.

## Capabilities

### New Capabilities

- `deck-go-frontend-data-state-clarity`: Cross-panel acceptance rules for explainable loading/error/true-empty/filtered-empty/degraded/refreshing states in data-backed `frontend-new` panels.

### Modified Capabilities

- No Gateway, Go backend, or Deck-facing API contract capability is intentionally modified by this change.
- Existing Data Fabric capabilities remain the server-state authority; this change layers list-state UX and verification rules above them.

## Impact

- Affected production frontend surfaces:
  - `deck-go/frontend-new/src/components/panels/plugins/PluginsPanel.tsx`
  - `deck-go/frontend-new/src/components/panels/skills/SkillsPanel.tsx`
  - `deck-go/frontend-new/src/components/panels/models/ModelsPanel.tsx`
  - `deck-go/frontend-new/src/components/panels/channels/ChannelsPanel.tsx`
  - `deck-go/frontend-new/src/components/panels/subagents/SubagentsPanel.tsx`
  - `deck-go/frontend-new/src/components/panels/approvals/ApprovalsPanel.tsx`
  - `deck-go/frontend-new/src/components/panels/budget/BudgetPanel.tsx`
  - `deck-go/frontend-new/src/components/panels/alerts/AlertsPanel.tsx`
  - `deck-go/frontend-new/src/components/panels/cron/CronPanel.tsx`
  - `deck-go/frontend-new/src/components/panels/webhooks/WebhooksPanel.tsx`
- Affected tests:
  - Existing panel component tests under the same module directories.
  - Optional shared list-state/helper tests if implementation extracts a helper.
- Affected process artifacts:
  - `openspec/follow-ups/2026-05-08-frontend-filter-empty-state-audit.md` should be marked promoted to this change when implementation starts.
- No new runtime dependency is expected.
- No visual redesign, high-fidelity prototype work, backend route redesign, or Gateway protocol expansion is in scope.

# Follow-up: frontend module filter and empty-state audit

Status: promoted
Source: real E2E visual debugging on 2026-05-08
Category: verification, frontend-data, real-e2e, proposal
Needs OpenSpec: yes, if this is fixed across modules as a systematic UX/data-state pass
Promoted-To: openspec/changes/deck-go-frontend-data-state-clarity

## Facts

- Plugins had real Gateway/BFF data: `GET /api/deck/plugins` returned 200 with channel plugin rows in the real stack.
- The plugin page could still appear empty because the UI exposed impossible capability filters for the current `channel` scope. Refreshing reloaded data but did not clear the invalid local filter.
- The immediate plugin fix derives available capability filters from returned plugin data and resets invalid filters back to `all`.
- Verification performed for the immediate fix:
  - `cd deck-go/frontend-new && pnpm test:deck-ui src/components/panels/plugins/PluginsPanel.test.tsx`
  - `cd deck-go && make frontend-build`
  - Playwright real-stack smoke confirmed 25 plugin rows and no impossible `Provider` filter in the channel scope.
- Code scan shows many other modules combine server data, local filters/search, manual refresh, and empty states.

## Risk Pattern

Several modules can make users interpret a filtered empty state as "data did not load":

- Static filter controls can include values that do not exist in the current real payload.
- Refresh buttons usually refetch data but often preserve local filters/search.
- Empty state copy is not always explicit about whether the cause is no upstream data, local filters, a loading state, or an API error.
- Some modules use cached/overlay data and manual `fetchQuery/refetch`, which can preserve stale local selection while data changes.

## Candidate Modules To Audit

- `deck-go/frontend-new/src/components/panels/skills/SkillsPanel.tsx`: static status/source filters over dynamic skill source/status values.
- `deck-go/frontend-new/src/components/panels/models/ModelsPanel.tsx`: static filters such as default/fallback/reasoning/local over merged runtime/config models.
- `deck-go/frontend-new/src/components/panels/channels/ChannelsPanel.tsx`: search/status filters over dynamic channel payload and selected detail.
- `deck-go/frontend-new/src/components/panels/subagents/SubagentsPanel.tsx`: static run status/spawn filters over often-empty real run history.
- `deck-go/frontend-new/src/components/panels/approvals/ApprovalsPanel.tsx`: exec/plugin queue filters over two different approval sources.
- `deck-go/frontend-new/src/components/panels/webhooks/WebhooksPanel.tsx`, `cron/CronPanel.tsx`, `budget/BudgetPanel.tsx`, `alerts/AlertsPanel.tsx`: common static filter plus real-empty configuration modules.

## Suggested Next Step

Create a focused OpenSpec change for a "Frontend Data State Clarity" pass:

- Define a shared module acceptance rule: every data-backed list must distinguish loading, error, true-empty, and filtered-empty.
- For every filter group, either derive options from real data or show counts and disabled zero-count filters.
- Refresh should either preserve filters with an explicit filtered-empty explanation or offer a one-click clear-filters action.
- Add regression tests for at least high-risk modules where real data exists but current filters hide it.
- Add a real-stack smoke checklist that captures visible row count, API status, and empty-state reason for each module.

## Current State

Only the plugins instance has been fixed. Other modules are not yet audited or fixed.

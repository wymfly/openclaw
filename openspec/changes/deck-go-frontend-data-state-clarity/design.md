## Context

The recent Plugins debugging proved the symptom precisely:

- Real stack BFF returned rows for `GET /api/deck/plugins`.
- The frontend still had local filters that could make the list appear empty.
- The immediate Plugins fix derived capability filters from returned `capabilityKinds` and reset invalid local `kindFilter` back to `all`.
- A follow-up was recorded at `openspec/follow-ups/2026-05-08-frontend-filter-empty-state-audit.md`.

Existing architecture is mostly correct at the server-state layer:

- Data Fabric modules exist under `deck-go/frontend-new/src/data/modules/`.
- Accepted specs already require Data Fabric for config/inventory/server-state reads and cached-data preservation on background refresh failure.
- Many panels still own local UI state for tabs, filters, search input, selected rows, drafts, dialogs, and expanded sections. That is intentional and should remain local.

The gap sits between those layers:

```
Gateway/BFF/Data Fabric returns data
            │
            ▼
Panel local UI state applies filters/search/selection
            │
            ▼
User sees rows, or an empty/loading/error/degraded state
```

The bottom layer is currently inconsistent. Some panels show a generic "no matches", some expose static filter values that are impossible for the current payload, some refresh while preserving filters without explaining that filters are still active, and some detail selections can point at rows that disappeared.

## Goals / Non-Goals

**Goals:**

- Make every touched data-backed list/workbench panel explain why rows are not visible.
- Prevent impossible filter values from hiding real data after payload scope changes or refreshes.
- Keep cached rows visible during background refresh where Data Fabric already has data.
- Preserve useful local filters/search across refresh only when the UI explicitly explains filtered-empty and provides recovery.
- Add regression tests for the previous Plugins class of bug and for representative high-risk panels.
- Add bounded mock/real smoke evidence so a future agent can prove "API returned data but UI hid it" did not regress.

**Non-Goals:**

- Redesigning the visual layout or high-fidelity IA of any module.
- Replacing every panel with `components/shared/lists/useListState`.
- Rewriting Data Fabric, query keys, freshness tiers, or Gateway/BFF contracts.
- Adding new backend endpoints or OpenClaw Gateway RPCs.
- Making true-empty pages look populated with fake rows.

## Current Code Facts

| Surface                           | Current risk pattern                                                                                                               | Evidence                                                                                                   |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Plugins                           | Was already affected by impossible static capability filters; now has a local reference fix.                                       | `PluginsPanel.tsx` derives `availableCapabilityFilters()` and resets invalid `kindFilter`.                 |
| Skills                            | Static status and source filters can outlive the real payload; no shared "clear filters" recovery in the list empty state.         | `SkillsPanel.tsx` defines `SOURCE_FILTERS`; `skill-model.ts` defines `SKILL_STATUS_FILTERS`.               |
| Models                            | Static `default/fallback/reasoning/local` filters can all be zero for a real configured payload; empty state is generic.           | `ModelsPanel.tsx` defines `FILTERS` and computes `filteredModels`.                                         |
| Channels                          | Static `enabled/alerts/wecom` filters include a product-specific `wecom` filter even when no WeCom channel exists.                 | `ChannelsPanel.tsx` defines `FILTERS` and `filteredItems`.                                                 |
| Subagents                         | Static run status/spawn filters often operate on empty or sparse real run history; permissions mode uses a different list.         | `SubagentsPanel.tsx` defines `STATUS_FILTERS`, `SPAWN_FILTERS`, `filteredRuns`, and `filteredAgents`.      |
| Approvals                         | Queue combines exec and plugin sources; active surface and kind filter can point at an empty source while another source has data. | `ApprovalsPanel.tsx` builds `allQueueEntries`, `queueEntries`, and static `all/exec/plugins` filter tabs.  |
| Budget / Alerts / Cron / Webhooks | Config-backed lists can be true-empty, but search/status/action filters can also hide existing rules/jobs/hooks.                   | `BudgetPanel.tsx`, `AlertsPanel.tsx`, `CronPanel.tsx`, `WebhooksPanel.tsx` each keep local filters/search. |

## Design Principles

### 1. Data state is a product state, not just a render fallback

Each list/workbench should classify row visibility into these states:

| State            | Meaning                                                                          | Required user affordance                                            |
| ---------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `first-load`     | No cached data yet and server read is pending.                                   | Loading skeleton/spinner with stable layout.                        |
| `refreshing`     | Data exists and a refetch is in progress.                                        | Keep existing rows visible; show non-blocking refreshing indicator. |
| `error-empty`    | No usable data and server read failed.                                           | Error copy plus Retry.                                              |
| `error-stale`    | Cached data exists but latest refresh failed.                                    | Keep rows visible; show non-blocking stale/error banner plus Retry. |
| `true-empty`     | Server succeeded and the authoritative collection is empty.                      | Empty copy tied to source truth, not "failed to load".              |
| `filtered-empty` | Server succeeded and source data exists, but local filters/search hide all rows. | Show active filter/search summary and one-click Clear filters.      |
| `ready`          | Visible rows exist.                                                              | Normal list rendering with visible count/total count.               |
| `degraded`       | Data is intentionally partial or unsupported by contract.                        | Explicit degraded/unsupported copy, not silent absence.             |

Implementation does not have to introduce one shared enum if that causes churn, but every touched panel must visibly satisfy the state distinction.

### 2. Filter controls choose one of three explicit policies

For every filter group, implementation should select and document one policy:

| Policy                      | When to use                                                                                          | Behavior                                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Derived options             | Filter values are payload-derived capabilities/sources/origins and impossible values are misleading. | Only show `all` plus values present in the current payload; reset invalid current value to `all`.                     |
| Counted stable options      | Filter values are stable product states the user expects even at count 0.                            | Keep all options visible, show counts, and allow zero-count selection only if filtered-empty clearly explains it.     |
| Disabled zero-count options | Filter values are stable but selecting count 0 is rarely useful.                                     | Show count 0 disabled; reset stale selected value to `all` if data changes and the selected value becomes impossible. |

Plugins capability filter is the reference for "derived options". Budget status, alerts enabled/action, and approvals kind filters are candidates for "counted stable options". Channels `wecom` is likely "derived options" because it is source-specific.

### 3. Refresh should never make valid data look missing without explanation

Manual refresh and background refetch must follow these rules:

- If cached/current rows exist, a refresh should not replace the page with a first-load empty state.
- Refresh may preserve active filters/search, but filtered-empty must show active criteria and clear recovery.
- If refreshed payload no longer contains the selected row, selection should move to the first visible row or first source row, with no broken detail pane.
- If refreshed payload changes available filter options, invalid payload-derived filters reset to `all`.

### 4. Tests prove user-perceived state, not only API success

Tests should assert visible row counts, filter availability/counts, empty-state copy, clear-filter behavior, and selection recovery. A test that only proves the query returned data is insufficient for this change.

## Module Plan

### Reference: Plugins

- Preserve the current dynamic capability-filter fix.
- Add or keep regression coverage proving a real payload with rows does not expose impossible filters for that scope.
- Ensure filtered-empty copy includes active filter/search information and clear recovery if filters/search hide rows.

### Skills

- Derive or count source filters from actual `skills` payload.
- Count status filters from normalized skill statuses.
- Reset stale source/status filters when they become impossible, or show zero-count disabled controls if the UI keeps them visible.
- Add clear-filter recovery to `SkillList` empty state.

### Models

- Compute counts for `all/default/fallback/reasoning/local`.
- Preserve stable product filters, but show count badges and filtered-empty recovery when all rows are hidden.
- Avoid resetting raw config/draft state as part of this change unless required by refresh correctness.

### Channels

- Derive channel-type filters that depend on payload reality, especially `wecom`.
- Keep stable filters such as `enabled` and `alerts` count-aware.
- Add clear-filter recovery when channel rows exist but search/filter hides them.

### Subagents

- Count status and spawn filters from the current run payload.
- In runs mode, distinguish no run history from filtered run history.
- In permissions mode, distinguish no agents from search-hidden agents.
- Keep auto-refresh from blanking current rows during a refetch.

### Approvals

- Count exec/plugin queue sources and make empty states distinguish:
  - no pending approvals at all;
  - pending approvals exist in another kind;
  - search text hides current queue.
- Keep selected detail in sync with the visible queue and avoid showing a stale detail for a hidden row.

### Budget / Alerts / Cron / Webhooks

- Treat config-empty as valid true-empty.
- Treat search/filter hidden rows as filtered-empty with active criteria and clear recovery.
- Show status/action/filter counts where filters are stable product values.
- Preserve existing safe mutation behavior; this change only adjusts list-state explainability unless a local bug is directly blocking the state fix.

## Verification Strategy

1. Create a tracked audit baseline listing each data-backed panel, its data source, filter groups, selected policy, current empty states, and needed fix.
2. Add focused component tests for:
   - Plugins reference regression.
   - At least four high-risk modules with different policies: one derived-filter module, one counted-stable module, one mixed-source queue, and one config-empty module.
   - Any module whose production code is changed.
3. Run `cd deck-go/frontend-new && pnpm test:deck-ui <changed panel tests>`.
4. Run `cd deck-go && make frontend-build`.
5. Run a bounded mock browser smoke across the affected panels:
   - navigation reaches each panel;
   - first-load/ready state renders;
   - applying a filter/search that hides data shows filtered-empty and clear recovery;
   - console/page errors fail the smoke.
6. Run a bounded real-stack smoke where environment is available:
   - APIs for affected panels return 200 or a documented valid empty/degraded status;
   - pages do not show indefinite loading when the API has completed;
   - if real data exists, the page either shows rows or an explicit filtered-empty reason.
7. If real-stack setup fails twice without new narrowing evidence, circuit-breaker the real portion and record command output, module impact, and follow-up.

## Risks / Trade-offs

- Applying one shared abstraction everywhere could create churn and visual regressions. Implementation should prefer small local fixes and extract a helper only when it removes repetition across changed modules.
- Hiding zero-count filters can also hide discoverability. Use derived options only for payload-derived categories; stable product filters should usually remain visible with counts.
- Some modules are validly empty in a fresh isolated workspace. Real E2E must classify `empty-valid`, not fail just because no rows exist.
- Existing tests may assert old generic empty copy. Update them only where the new behavior is directly in scope.

## Rollback

Rollback is frontend-only:

- Revert changed panel list-state/filter/empty-state code and tests.
- Remove or revert any shared helper introduced for this change.
- Keep Data Fabric and backend code untouched.
- Restore the follow-up status if the change is abandoned before implementation.

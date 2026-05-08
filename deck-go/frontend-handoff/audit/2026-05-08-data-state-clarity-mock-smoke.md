# Mock Browser Smoke Checklist: Frontend Data State Clarity

Change: `deck-go-frontend-data-state-clarity`
Date: 2026-05-08

This checklist is intentionally bounded. It proves navigation, no indefinite loading, filtered-empty
copy, active criteria, and clear recovery for the affected panel set in mock mode. It does not replace
component tests or real-stack validation.

## Setup

1. Start the mock stack:

   ```bash
   cd deck-go && make mock-stack-start
   ```

2. Open the mock frontend URL from the stack output.
3. Use English locale first, then repeat one representative filtered-empty recovery path in Chinese.
4. Keep the browser console open; any unhandled error during these paths fails the smoke.

## Panel Paths

| Panel                 | Navigation                         | Filter/search action                                                              | Expected filtered-empty evidence                                                                               | Recovery                                                                           |
| --------------------- | ---------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Plugins               | Open `Plugins` from nav.           | Search for `not-a-plugin`.                                                        | Empty state names active `Search: not-a-plugin`; impossible capability filters are absent for scoped payloads. | Click `Clear filters`; plugin rows return.                                         |
| Skills                | Open `Skills` from nav.            | Search for `not-a-skill`.                                                         | `No installed skills match filters.` plus active search criteria.                                              | Click `Clear filters`; skill rows return.                                          |
| Models                | Open `Models` from nav.            | Select a zero-count stable filter or search for `not-a-model`.                    | No-match copy includes active criteria and counts remain visible.                                              | Click `Clear filters`; configured/runtime model rows return if fixture has models. |
| Channels              | Open `Channels` from nav.          | Search for `not-a-channel`; verify WeCom is absent unless fixture contains WeCom. | `No channels match this filter` plus active search criteria.                                                   | Click `Clear filters`; channel rows return.                                        |
| Subagents             | Open `Subagents` from nav.         | In Runs mode, search for `not-a-run`.                                             | No-runs vs filtered-runs copy is distinct; active criteria are shown when source runs exist.                   | Click `Clear filters`; run rows or true-empty copy returns.                        |
| Subagents permissions | Switch to permissions/config mode. | Search for `not-an-agent`.                                                        | No-agents vs filtered-agents copy is distinct.                                                                 | Click `Clear filters`; agent permission rows return if agents exist.               |
| Approvals             | Open `Approvals` from nav.         | Select a source kind with zero visible items or search for `not-an-approval`.     | Copy distinguishes no pending approvals, other source kind, and search-hidden approvals.                       | Click `Clear filters`; visible queue state returns.                                |
| Budget                | Open `Budget` from nav.            | Search for `not-a-rule`.                                                          | True-empty rules and filtered-empty rules are distinct; criteria shown only when rules exist.                  | Click `Clear filters`; rule rows or true-empty copy returns.                       |
| Alerts                | Open `Alerts` from nav.            | Search for `not-a-rule` or select a zero-count action.                            | Criteria and no-match copy are visible when rules exist.                                                       | Click `Clear filters`; rule rows return.                                           |
| Cron                  | Open `Cron` from nav.              | Search for `not-a-job`.                                                           | No jobs vs filtered jobs are distinct; criteria are shown when jobs exist.                                     | Click `Clear filters`; job rows or true-empty copy returns.                        |
| Webhooks              | Open `Webhooks` from nav.          | Search for `not-a-webhook`.                                                       | No receivers vs filtered receivers are distinct.                                                               | Click `Clear filters`; receiver rows or true-empty copy returns.                   |

## Pass Criteria

- Each panel reaches a stable first-load or ready state.
- No panel remains on a spinner after the mock API has completed.
- Every filtered-empty path shows the active criteria or equivalent context.
- Every filtered-empty path with local search/filter state has a one-click recovery action.
- True-empty fixture states are accepted when the source collection is genuinely empty.
- Console errors, missing translation keys, or generic empty copy where source rows exist fail the smoke.

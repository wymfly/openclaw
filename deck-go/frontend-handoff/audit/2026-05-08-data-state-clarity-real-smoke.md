# Real-Stack Smoke: Frontend Data State Clarity

Change: `deck-go-frontend-data-state-clarity`
Date: 2026-05-08

Environment:

- Command: `cd deck-go && make real-stack-status`
- Result: backend `19566`, real Gateway `18789`, and frontend `4174` were running.
- Browser smoke: Playwright headless Chromium loaded `http://127.0.0.1:4174/?panel=<panel>`.
- Sensitive tokens were not printed or recorded.

## Panel Results

| Panel     | API status evidence                                                                                                      | Visible state                                                                     | Result        |
| --------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ------------- |
| Plugins   | `200 /api/deck/plugins`, `200 /api/channels`                                                                             | 25 plugin rows visible in channel scope.                                          | `ready`       |
| Skills    | `200 /api/skills`, `200 /api/approvals/plugins`                                                                          | 74 skills visible; setup-required skills are a valid ready state.                 | `ready`       |
| Models    | `200 /api/models/config`, `200 /api/v1/runtimes/rt_local/gateway/rpc`, `200 /api/usage/cost`, `200 /api/usage/providers` | 30 runtime/config models visible.                                                 | `ready`       |
| Channels  | `200 /api/channels`, `200 /api/channels/openclaw-weixin/throughput`                                                      | 2 channel rows visible.                                                           | `ready`       |
| Subagents | `200 /api/deck/subagents`, `200 /api/deck/agents`, `200 /api/config`                                                     | 0 subagent runs in isolated state; empty run history is explicit and non-loading. | `empty-valid` |
| Approvals | `200 /api/approvals/pending`, `200 /api/approvals/plugins`, `200 /api/approvals/policy`                                  | No pending approvals in isolated state; policy state loaded.                      | `empty-valid` |
| Budget    | `200 /api/usage/budget`, `200 /api/usage/budget/evaluate`                                                                | 0 budget rules; rule inventory is explicitly ready/empty.                         | `empty-valid` |
| Alerts    | `200 /api/alerts`                                                                                                        | 0 alert rules; rule inventory is explicitly ready/empty.                          | `empty-valid` |
| Cron      | `200 /api/cron`, `200 /api/cron/status`                                                                                  | 0 cron jobs; scheduler state loaded and inventory is ready/empty.                 | `empty-valid` |
| Webhooks  | `200 /api/webhooks`                                                                                                      | 0 webhook receivers; receiver inventory is ready/empty.                           | `empty-valid` |

## Smoke Conclusion

- No affected panel remained indefinitely on the Gateway connection or first-load state.
- Every touched panel reached `ready` or an explicit `empty-valid` state in the isolated real stack.
- The real stack did not expose a Gateway/BFF contract mismatch for this change.
- Filtered-empty recovery remains primarily covered by component tests because the isolated real stack
  has no safe seeded rows for Budget, Alerts, Cron, or Webhooks in this run.

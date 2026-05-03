# subagents api discrepancy notes

## Deterministic drift fixed in this change

- `fetchSubagentRuns` sends `agentId`, `limit`, and `offset`.
- `DeckSubagentsListParams` and the runtime view support those fields.
- `GET /deck/subagents` in `backend/internal/server/inventory.go` currently
  forwards only `status` and `requesterAgentId`.
- This change forwards `agentId`, `limit`, and `offset` from the BFF route.

## Follow-up questions

- Whether the operator-facing history screen needs cursor metadata in addition
  to `total`, `limit`, and `offset`.
- Whether lineage should expose created/started/ended timestamps per node.
- Whether kill/steer should return a normalized `ok`/`success` union for easier
  action-result presentation.
- Whether per-agent subagent permissions should eventually be editable in this
  module or remain agent-detail scoped.

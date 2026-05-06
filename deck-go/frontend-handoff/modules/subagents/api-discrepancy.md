# subagents api discrepancy notes

## Deterministic drift already fixed

- `fetchSubagentRuns` sends `agentId`, `limit`, and `offset`.
- `DeckSubagentsListParams` and the runtime view support those fields.
- `GET /deck/subagents` in `backend/internal/server/inventory.go` forwards `status`, `agentId`,
  `requesterAgentId`, `limit`, and `offset`.
- This was verified again during `frontend-subagents-real-contract-verification`.

## Deterministic drift fixed in real-contract verification

- Prototype-only REST route claims were corrected to BFF action envelopes.
- Prototype-only status values were corrected to current Gateway schema truth.
- Production UI metadata now includes Subagents runs, lineage, steer, and kill action metadata.
- Per-agent permission editing is implemented in the Subagents module using `baseHash`.

## Follow-up questions

- Whether the operator-facing history screen needs cursor metadata in addition
  to `total`, `limit`, and `offset`.
- Whether lineage should expose created/started/ended timestamps per node.
- Whether kill/steer should return a normalized `ok`/`success` union for easier
  action-result presentation.
- Whether audit needs a dedicated BFF projection route.
- Whether kill cascade and stalled detection should become Gateway-backed product behavior.

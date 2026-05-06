## Context

The head matrix lists `logs.tail` as degraded and `usage.observability` as
verified-but-needing hardening. After re-reading code truth:

- `logs.tail` has typed params/result schemas in
  `src/gateway/protocol/schema/logs-chat.ts` and generated outer envelopes in
  `contracts/generated/ts/gateway/protocol.ts`.
- Deck Logs still intentionally keeps stream `json` payload dynamic because SSE
  log events can vary, and the stream contract documents that boundary.
- Usage cost/provider/session read models have Deck-facing DTOs and list-query
  metadata.
- `sessions.usage.logs` and `sessions.usage.timeseries` are runtime-handler
  validated against narrow usage-result schemas, but `sessions-method-defs.ts`
  still imports broad schemas from `protocol/schema/sessions.js`, causing
  generated protocol artifacts to expose `logs: unknown[]` and timeseries
  `unknown`.
- Activity/Monitor is already verified and mostly participates here as shared
  observability evidence through list-query/live-projection contracts.

## Goals / Non-Goals

**Goals:**

- Reconfirm supported Usage/Logs/Activity observability workflows and remaining
  dynamic or unsupported leaves against source truth.
- Fix the generated Gateway protocol drift for usage logs/timeseries by using
  the same narrow schemas as the runtime handlers.
- Add regression coverage for the generated protocol surface so this drift does
  not return.
- Update implementation notes, the head matrix, generated matrix Markdown, head
  evidence, and archive this child proposal after validation.

**Non-Goals:**

- Do not add new Gateway methods or server-side Logs filters.
- Do not introduce durable log export/download endpoints.
- Do not claim real billing accuracy, quota-policy semantics, tenant
  accounting, forecasts, or chart-library features beyond existing contracts.
- Do not generate real LLM telemetry in this pass; existing seed/read-path
  evidence remains the bounded L2 baseline.

## Decisions

### Decision: Fix method metadata rather than broadening Deck DTOs

The runtime handlers already validate usage logs/timeseries with narrow
usage-result schemas. The generated protocol drift comes from stale method
metadata, so the correct fix is to point `sessions-method-defs.ts` at the same
schema authority.

Alternative rejected: make Deck-facing Usage DTOs broad to match generated
Gateway output. That would preserve the wrong contract direction and lose
product-useful type information.

### Decision: Keep log stream payload dynamic but typed at the outer envelope

`logs.tail` itself has typed outer fields and string lines. The SSE log stream
still carries an event envelope plus dynamic `json` payload because event kinds
can vary.

Alternative rejected: force log stream payloads into one DTO. That would make
`log.reset`, `log.batch`, and future event frames less honest than the current
stream contract.

### Decision: Treat Activity/Monitor as shared observability evidence, not a rewrite target

Activity and Monitor already have archived real-contract evidence, list-query
metadata, and live-projection metadata. This proposal only reconciles their
status where needed.

Alternative rejected: reopen the Activity UI. That would expand scope without a
deterministic contract-chain gap.

## Risks / Trade-offs

- **Risk:** Switching method metadata can expose generated type drift in Go or
  frontend code.  
  **Mitigation:** Regenerate Gateway artifacts and run protocol/frontend
  focused checks.

- **Risk:** Narrower generated usage contracts may imply billing accuracy.  
  **Mitigation:** Keep usage notes and matrix gap language explicit: costs are
  estimates, provider policy semantics remain limited.

- **Risk:** Logs stream remains partially dynamic.  
  **Mitigation:** Keep `DeckGoLogStreamEvent.json` in dynamic-surface metadata
  and stream contract docs.

## Migration Plan

1. Create and validate this child OpenSpec scope.
2. Update sessions method metadata to use narrow usage-result schemas for
   logs/timeseries and generated usage result envelopes.
3. Regenerate Gateway protocol artifacts and add codegen regression assertions.
4. Reconcile Logs/Usage/Activity implementation notes, matrix rows, generated
   matrix Markdown, and head evidence.
5. Run focused protocol, contract, frontend, build, OpenSpec, and diff checks.
6. Sync the top-level spec, archive the child change, validate the archived
   spec, then continue the head matrix.

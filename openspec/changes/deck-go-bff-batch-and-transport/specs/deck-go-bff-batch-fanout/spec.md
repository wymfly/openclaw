## ADDED Requirements

### Requirement: BFF exposes typed batch endpoint over HTTP

deck-go BFF SHALL expose `POST /api/v1/runtimes/{rt}/gateway/batch` that accepts a batch envelope and dispatches sub-calls through the BFF's typed `gateway.batch` client. The endpoint SHALL preserve every invariant of the underlying `gateway.batch` primitive: 1..32 sub-call bound, nested-batch rejection, subscription-method rejection, byte-stable result ordering, openclaw dispatcher scope/control-plane-budget enforcement, optional `failFast`. Before dispatch, the BFF SHALL apply the same `generated.TypedMethodNames` method allowlist used by `POST /api/v1/runtimes/{rt}/gateway/rpc`; disallowed sub-calls SHALL fail per-entry and SHALL NOT be forwarded to openclaw.

#### Scenario: Read-only batch returns ordered results

- **WHEN** the client POSTs `{calls: [{id:"a", method:"agents.list"}, {id:"b", method:"config.get"}]}` to `/api/v1/runtimes/rt_local/gateway/batch`
- **THEN** the response status is 200 with body `{results: [{id:"a", ok:true, result:{...}}, {id:"b", ok:true, result:{...}}], requestId:<uuid>}` where `results` ordering exactly matches the input array

#### Scenario: Empty batch is rejected with 400

- **WHEN** the client POSTs `{calls: []}` to the batch endpoint
- **THEN** the response status is 400 with body `{error:{code:"INVALID_REQUEST", message:<text mentioning bound 1..32>}}`

#### Scenario: Oversized batch is rejected with 400

- **WHEN** the client POSTs a batch with 33 sub-calls
- **THEN** the response status is 400 with `error.code == "INVALID_REQUEST"` and no sub-call is dispatched

#### Scenario: Nested gateway.batch sub-call is rejected per-entry

- **WHEN** a batch contains a sub-call `{method:"gateway.batch", params:{calls:[]}}`
- **THEN** that single result entry has `ok:false` and `error.code == "INVALID_REQUEST"` mentioning nested batch is forbidden, AND surrounding sub-calls in the same batch still execute and return their own results

#### Scenario: Subscription sub-call is rejected per-entry

- **WHEN** a batch contains a sub-call `{method:"sessions.messages.subscribe"}`
- **THEN** that single result entry has `ok:false` and `error.code == "INVALID_REQUEST"` mentioning subscription is forbidden in batch

### Requirement: BFF batch endpoint preserves client-edge method boundary

The batch endpoint SHALL NOT expose methods beyond the current typed Deck transport boundary. deck-go's access token is a static BFF access token and does not carry operator scopes; scoped deck-token authorization is out of scope for this proposal. The BFF SHALL therefore enforce `generated.TypedMethodNames` per sub-call before dispatch, while openclaw continues to enforce its own operator scope and control-plane budget for forwarded calls.

#### Scenario: Unknown or untyped method cannot bypass `/gateway/rpc` allowlist

- **WHEN** a client POSTs `{calls:[{id:"r", method:"agents.list"}, {id:"x", method:"internal.untyped.debug", params:{}}]}` to the batch endpoint
- **THEN** the response contains `results[0].ok == true`, `results[1].ok == false`, and `results[1].error.code == "INVALID_GATEWAY_METHOD"`, AND no frame for `internal.untyped.debug` is dispatched to openclaw

### Requirement: BFF batch endpoint supports failFast option

When `options.failFast: true` is passed, the BFF SHALL stop dispatching sub-calls after the first sub-call returns an error and SHALL return all completed results (the failing one included) without dispatching subsequent sub-calls.

#### Scenario: failFast aborts after first error

- **WHEN** the client POSTs `{calls:[{id:"1", method:"health"}, {id:"2", method:"unknown.method"}, {id:"3", method:"status"}], options:{failFast:true}}`
- **THEN** the response `results` array contains exactly two entries (the first sub-call's success, the second's error) and the third sub-call is NOT dispatched

### Requirement: BFF batch endpoint produces byte-stable response for deterministic input

For the same input batch with deterministic params and identical gateway state, the BFF SHALL produce a JSON-serialised response body that is byte-identical across consecutive invocations.

#### Scenario: Identical input yields byte-equal response body

- **WHEN** the same batch request is sent twice in succession against unchanged backend state
- **THEN** the response body bytes (excluding `requestId`) are identical

### Requirement: BFF batch endpoint correlates audit log via batch id

Every sub-call's audit log entry SHALL include the top-level batch frame id, propagated through the gateway dispatcher batch context (`attachBatchId` in `src/gateway/server-methods/dispatcher.ts`).

#### Scenario: Five batched config.patch entries share one batch id in audit warning

- **WHEN** a privileged client POSTs five `config.patch` sub-calls in one batch and the budget rejects the last two
- **THEN** the gateway warning log line for each rate-limited entry contains a `batch=<frame.id>` segment matching the top-level batch frame id

### Requirement: Frontend typed client exposes a `batch` entry

The frontend `createDeckGatewayClient` SHALL expose a `batch(calls, options?)` method whose TypeScript signature compiles input and output types from `GatewayMethodMap`, producing per-slot `result | GatewayError` discriminated union.

#### Scenario: TypeScript compiler catches mismatched method/params

- **WHEN** the developer writes `client.batch([{id:"a", method:"agents.list", params:{badField:1}}])`
- **THEN** the TypeScript compiler raises an error about `badField` not assignable to `AgentsListParams`

#### Scenario: Result array preserves per-call typing

- **WHEN** the developer writes `const [r1, r2] = await client.batch([{id:"a", method:"agents.list"}, {id:"b", method:"config.get"}])`
- **THEN** the type of `r1` is `AgentsListResult | GatewayError` and `r2` is `ConfigGetResult | GatewayError`

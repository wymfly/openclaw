## ADDED Requirements

### Requirement: `gateway.batch` accepts and dispatches multiple typed sub-calls

The gateway SHALL expose a typed `gateway.batch` RPC method that accepts an array of sub-calls and dispatches each through `dispatchGatewayRequest` from `src/gateway/server-methods/dispatcher.ts`. The dispatcher is **owned by the parent proposal** `openclaw-gateway-bff-architecture-refactor` (Phase 2.C task 2.15) and is reused — NOT duplicated — by this proposal. Each sub-call MUST be validated, authorized, role-checked, and rate-limited as if it had been sent as an independent top-level RPC.

#### Scenario: A batch of three reads returns three results in order

- **WHEN** the client invokes `gateway.batch` with `calls: [{ id: "a", method: "agents.list", params: {} }, { id: "b", method: "config.get", params: {} }, { id: "c", method: "skills.status", params: { agentId: "main" } }]`
- **THEN** the response MUST contain `results` with exactly three entries in the same order, each entry's `id` matching the sub-call id, and each entry containing either `result` (when the sub-call succeeded) or `error` (when it failed)

#### Scenario: Sub-call validation runs independently per call

- **WHEN** a batch contains a sub-call with malformed `params` for its declared method
- **THEN** that single sub-call result MUST contain `ok: false` and an error envelope identifying the validation failure, and the remaining sub-calls in the batch MUST still execute and return their own results

### Requirement: Nested `gateway.batch` is forbidden

Sub-calls whose method is `gateway.batch` SHALL be rejected with `ErrorCodes.INVALID_REQUEST` at validation time without invoking the dispatcher. The dispatch depth MUST be bounded to 1.

#### Scenario: Nested batch sub-call is rejected

- **WHEN** a batch contains a sub-call `{ method: "gateway.batch", params: { calls: [...] } }`
- **THEN** that sub-call result MUST contain `ok: false` and an error envelope with `ErrorCodes.INVALID_REQUEST` and a message identifying that nested `gateway.batch` is forbidden, AND the inner sub-calls MUST NOT be dispatched

### Requirement: Acyclic dispatcher avoids initialization cycles

The `gateway.batch` handler SHALL invoke `dispatchGatewayRequest` from the parent-extracted `src/gateway/server-methods/dispatcher.ts`. The dispatcher module MUST NOT import `server-methods.ts`, `coreGatewayHandlers`, or `_modules.generated.ts`. The batch handler MUST receive the handler map via `context.handlers` (populated by the outer `handleGatewayRequest` per parent Phase 2.C task 2.16) and pass it explicitly to `dispatchGatewayRequest`. No module-level cycle exists in the chain `_modules.generated.ts → gateway-batch.module.ts → dispatcher.ts`.

#### Scenario: gateway.batch module does not import the generated manifest or server-methods.ts

- **WHEN** `src/gateway/server-methods/gateway-batch.module.ts` is examined
- **THEN** it MUST NOT contain an import of `_modules.generated.ts`, `server-methods.ts`, or `coreGatewayHandlers`. The only `server-methods/` import allowed at module scope is `./dispatcher.js`

#### Scenario: dispatcher.ts does not depend on server-methods.ts

- **WHEN** `src/gateway/server-methods/dispatcher.ts` is examined
- **THEN** it MUST NOT contain an import of `server-methods.ts`, `_modules.generated.ts`, `_method-defs.generated.ts`, or any `*.module.ts` file. Permitted imports are limited to low-level support modules: `control-plane-rate-limit`, `control-plane-audit`, `method-scopes`, `protocol/index`, `role-policy`, `plugins/runtime/gateway-request-scope`

#### Scenario: pnpm check:import-cycles reports no batch-related cycle

- **WHEN** `pnpm check:import-cycles` (or `pnpm check:madge-import-cycles`) is executed after this change
- **THEN** it MUST exit zero, with no cycle involving `gateway-batch.module.ts`, `dispatcher.ts`, or `server-methods.ts`

### Requirement: Sub-call scope and role enforcement is preserved

Every sub-call inside `gateway.batch` SHALL undergo the same scope authorization (`authorizeOperatorScopesForMethod`) and role authorization (`isRoleAuthorizedForMethod`) checks as a top-level call to the same method.

#### Scenario: Read-scoped client cannot escalate via batch

- **WHEN** a client with `READ_SCOPE` invokes `gateway.batch` containing a sub-call to `config.apply` (which requires `WRITE_SCOPE`)
- **THEN** the `config.apply` sub-call MUST return an error envelope with `ErrorCodes.INVALID_REQUEST` and a message identifying the missing scope (matching today's behavior at `server-methods.ts:67-81`, which uses `INVALID_REQUEST` for both role and scope rejections; this proposal does NOT introduce a new `UNAUTHORIZED` error code), while any read-scoped sub-calls in the same batch MUST continue to execute normally

### Requirement: Control-plane write budget is consumed per sub-call

If a batch contains sub-calls that are control-plane write methods (members of `CONTROL_PLANE_WRITE_METHODS`, derived from `methodDef.controlPlaneWrite === true` per the parent proposal `openclaw-gateway-bff-architecture-refactor`), each such sub-call SHALL consume the control-plane write budget independently.

#### Scenario: Five batched config.apply calls consume five budget tokens

- **WHEN** a client invokes `gateway.batch` with five sub-calls each targeting `config.apply`
- **THEN** `consumeControlPlaneWriteBudget` MUST be invoked exactly five times in total, and any sub-calls that exceed the budget MUST receive `ErrorCodes.UNAVAILABLE` while preceding within-budget sub-calls return their actual results

### Requirement: Batches are bounded and non-transactional

The `gateway.batch` method SHALL accept between 1 and 32 sub-calls per invocation, SHALL execute sub-calls sequentially in array order, and SHALL NOT roll back state changes performed by earlier sub-calls when a later sub-call fails.

#### Scenario: Empty batch is rejected

- **WHEN** the client invokes `gateway.batch` with `calls: []`
- **THEN** the response MUST be an `ErrorCodes.INVALID_REQUEST` error envelope and no sub-call dispatch is attempted

#### Scenario: Oversized batch is rejected

- **WHEN** the client invokes `gateway.batch` with 33 or more sub-calls
- **THEN** the response MUST be an `ErrorCodes.INVALID_REQUEST` error envelope identifying the maximum batch size

#### Scenario: Failure in a later sub-call does not roll back earlier mutations

- **WHEN** a batch contains `[{ id: "1", method: "config.apply", params: validPatchA }, { id: "2", method: "config.apply", params: invalidPatchB }]`
- **THEN** the result MUST contain `{ id: "1", ok: true, ... }` followed by `{ id: "2", ok: false, error: ... }`, and the configuration mutation from sub-call 1 MUST remain applied (no rollback)

### Requirement: Subscription methods are forbidden inside batches

Sub-calls whose method names match `*.subscribe` or `*.unsubscribe` patterns SHALL be rejected at validation time without invoking the underlying handler.

#### Scenario: Subscribe inside batch is rejected

- **WHEN** a batch contains a sub-call to `sessions.messages.subscribe`
- **THEN** that sub-call MUST return `{ ok: false, error: ErrorCodes.INVALID_REQUEST }` with a message explaining that subscription methods are not batchable, and no subscription state is created

### Requirement: `failFast` short-circuits the remaining batch

When the optional `options.failFast` flag is true, the batch SHALL stop dispatching sub-calls after the first sub-call returns an error, returning all completed results plus the failing one.

#### Scenario: failFast aborts after first error

- **WHEN** a batch with `options.failFast: true` and four sub-calls has its second sub-call return an error
- **THEN** the response `results` array MUST contain exactly two entries: the first sub-call's success and the second sub-call's error; sub-calls 3 and 4 MUST NOT be dispatched

### Requirement: Batch result ordering is byte-stable

For a deterministic input batch, the `results` array MUST be byte-stable across consecutive identical invocations to preserve prompt cache stability for any model-facing payload that incorporates the response.

#### Scenario: Identical batch inputs produce identical result bytes

- **WHEN** a batch with deterministic sub-call params is invoked twice in succession against the same gateway state
- **THEN** the JSON-serialised `results` arrays MUST be byte-identical

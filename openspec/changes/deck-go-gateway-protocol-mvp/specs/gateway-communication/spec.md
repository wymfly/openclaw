## ADDED Requirements

### Requirement: deck-go typed method set matches dashboard typed surface

deck-go 生成的 `GatewayMethodMap` (TS) 与 typed Go method 集合 SHALL 等于 dashboard `gateway-protocol.generated.ts` 的 `GatewayMethodMap` 键集合（即上游 `allMethodDefs.filter(m => m.params || m.result)`）。

#### Scenario: deck-go TS GatewayMethodMap equals dashboard's

- **WHEN** `deck-go/contracts/scripts/protocol-gen-ts.ts` 在与 dashboard `gateway-protocol.generated.ts` 同一份上游 `method-registry-data.ts` 快照下执行
- **THEN** `deck-go/contracts/generated/ts/gateway/protocol.ts` 的 `GatewayMethodMap` 键集合 SHALL 等于 dashboard `dashboard/src/types/gateway-protocol.generated.ts` 的 `GatewayMethodMap` 键集合

#### Scenario: deck-go Go typed method names equal dashboard typed set

- **WHEN** `deck-go/contracts/scripts/protocol-gen-go.ts` 在同一份上游快照下执行
- **THEN** `deck-go/backend/internal/gateway/generated/methods.go` 中生成的 typed 函数名集合（小写化后）SHALL 等于 dashboard typed methods 集合

### Requirement: deck-go allowlist matches dashboard allowlist

deck-go 生成的 `AllowlistMethodNames` (Go) 与 `GENERATED_METHOD_ALLOWLIST` (TS) SHALL 等于 dashboard `gateway-client.generated.ts` 的 `GENERATED_METHOD_ALLOWLIST`，即上游 `Object.keys(allMethodDefs).toSorted()`，**包含**纯 scoped methods（如 `plugin.approval.list`、`plugin.approval.waitDecision`）。

#### Scenario: deck-go allowlist 是 typed 集合的真超集

- **GIVEN** 上游存在至少一个 method（如 `plugin.approval.list`）注册在 `allMethodDefs` 但 `params` 与 `result` 均未设置
- **WHEN** deck-go codegen 完成
- **THEN** `AllowlistMethodNames` SHALL 包含该 method
- **AND** typed methods 集合 SHALL NOT 包含该 method

#### Scenario: deck-go allowlist equals dashboard allowlist 字符串集

- **WHEN** deck-go 与 dashboard 在同一份上游快照下重新生成
- **THEN** `AllowlistMethodNames` 键集合 SHALL 等于 dashboard `GENERATED_METHOD_ALLOWLIST` 字符串集

### Requirement: deck-go Gateway transport reuses single connection

deck-go Go-side Gateway client SHALL multiplex all RPC requests over a single shared WebSocket connection, matching dashboard's single-connection behavior, **including under concurrent first-RPC race conditions**.

#### Scenario: deck-go RPC reuses connection across calls

- **GIVEN** deck-go backend is running with a configured Gateway connection
- **WHEN** deck-go invokes any sequence of `gateway.Client.Request` calls within the lifetime of a single backend process
- **THEN** the Gateway server SHALL observe at most one persistent WebSocket session per deck-go process (excluding reconnects after a transport failure)

#### Scenario: deck-go concurrent first-RPC produces only one connection

- **GIVEN** deck-go backend has just started and no WS connection exists yet
- **WHEN** N goroutines simultaneously invoke `gateway.Client.Request`
- **THEN** the Gateway server SHALL observe exactly 1 new WebSocket session and 1 connect handshake
- **AND** all N requests SHALL succeed

### Requirement: deck-go enforces protocol drift check via in-memory comparison

deck-go SHALL block CI when its generated Gateway protocol artifacts drift from the upstream schema source. The check SHALL use the CHECK_MODE pattern from upstream `scripts/protocol-gen-ts.ts:395-415` (in-memory expected vs on-disk actual; report MISSING and DRIFT separately), **not `git diff --exit-code`**.

#### Scenario: drift in deck-go generated artifacts blocks CI

- **WHEN** a deck-go PR is opened with stale `internal/gateway/generated/` or `contracts/generated/` files relative to the upstream `allMethodDefs` it builds against
- **THEN** the deck-go CI workflow SHALL fail the run via `make protocol-check` and block merge

#### Scenario: missing generated file blocks CI

- **WHEN** a deck-go PR adds a new generated artifact source but forgets to commit the regenerated output file
- **THEN** `make protocol-check` SHALL report `MISSING: <path>` and fail
- **AND** `git diff --exit-code` would have passed (untracked) but `make protocol-check` SHALL still fail

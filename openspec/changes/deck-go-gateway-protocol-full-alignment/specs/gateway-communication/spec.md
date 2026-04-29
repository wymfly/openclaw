## MODIFIED Requirements

### Requirement: deck-go client SHALL achieve full typed coverage of upstream typed methods

deck-go 所有 Gateway typed RPC 调用 SHALL 通过 typed binding（Go: `internal/gateway/generated/methods.go`；TS: `contracts/generated/ts/gateway/client.ts`）完成，禁止 untyped 字符串调用，例外仅限 fork-divergent method 的 result schema 缺失情况（带行级豁免）。本要求升级自 MVP `gateway-communication` spec 中"deck-go typed method set matches dashboard typed surface"——MVP 仅要求 codegen 产物等价，本提案要求实际调用方 100% 走 typed binding。

#### Scenario: deck-go Go caller 100% 走 typed binding

- **scenario_id**: `gateway-communication.go-typed-binding`
- **GIVEN** deck-go Go 后端某 PR 已合并到 main
- **WHEN** 跑 `make gateway-typecheck`
- **THEN** 命令 SHALL 不报告任何 untyped call violation（除显式豁免外）

#### Scenario: deck-go FE caller 100% 走 typed client

- **scenario_id**: `gateway-communication.fe-typed-client`
- **GIVEN** deck-go FE 某 PR 已合并到 main
- **WHEN** 跑 `make gateway-typecheck`
- **THEN** 命令 SHALL 不报告任何 Category=`gateway-rpc-proxy`（按 PR-17 输出的 `fe-endpoint-classification.md`）的 FE 字符串端点调用（除显式行级豁免外）；Category=`deck-go-bff` 与 `binary-stream-upload` 不在扫描范围

### Requirement: deck-go SHALL implement Gateway error envelope as typed contract

deck-go transport 层 SHALL 把 Gateway 响应中的 `error: { code, message, details }` envelope 解析为 typed Go error（`*gateway.ErrCode` + 哨兵 `gateway.ErrScopeDenied` / `gateway.ErrConnectionLost`），caller 用 `errors.Is` / `errors.As` 判定；FE 用 typed `GatewayError` discriminated union。本要求升级自 MVP `gateway-communication` 隐含的"transport correctness"——MVP 未明确要求 typed error，本提案补上。

#### Scenario: Go caller 用 errors.Is 检查 scope 错误

- **scenario_id**: `gateway-communication.go-scope-error`
- **GIVEN** Gateway 响应 `error.code` 为 `scope_denied`
- **WHEN** caller 执行 `if errors.Is(err, gateway.ErrScopeDenied)`
- **THEN** 条件 SHALL 为 true
- **AND** caller 可读取 `errCode.Details["required"]` 获得被拒绝的 scope

#### Scenario: FE caller 用 discriminated union 窄化错误

- **scenario_id**: `gateway-communication.fe-error-union`
- **GIVEN** RPC `chat.send` 抛 `GatewayError({ code: 'validation_failed', details: { field: 'x' } })`
- **WHEN** caller 用 `if (error.code === 'validation_failed') { error.details.field; }`
- **THEN** TS 编译期 SHALL 窄化 `error.details` 为对应 schema

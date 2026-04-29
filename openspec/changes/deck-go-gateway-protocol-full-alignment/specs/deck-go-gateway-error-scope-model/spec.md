## ADDED Requirements

### Requirement: deck-go transport 层将 Gateway error envelope 解析为 typed Go error

`Realtime.Request` / `Client.Request` SHALL 在响应中检测 `error` 字段（envelope `{ id, error: { code, message, details } }`），转为 Go typed error 树后返回，caller 不再需要手动拆 `map[string]any`。

#### Scenario: error envelope 转为 ErrCode

- **scenario_id**: `deck-go-gateway-error-scope-model.errcode-envelope`
- **GIVEN** Gateway 响应含 `{ id: "1", error: { code: "validation_failed", message: "missing field x", details: { field: "x" } } }`
- **WHEN** caller 执行 `_, err := generated.NewTypedClient(requester).AgentsList(ctx, params)`
- **THEN** `err` SHALL 是 `*gateway.ErrCode{Code: "validation_failed", Message: "missing field x", Details: map[string]any{"field": "x"}}`
- **AND** `err.Error()` SHALL 输出 `"validation_failed: missing field x"`（与现有 `gateway_queries.go` wrapper 的错误格式向后兼容）
- **AND** `errors.Is(err, &gateway.ErrCode{Code: "validation_failed"})` SHALL 返回 true

#### Scenario: scope-denied 转为 ErrScopeDenied 哨兵

- **scenario_id**: `deck-go-gateway-error-scope-model.scope-denied-sentinel`
- **GIVEN** Gateway 响应 `error.code` 为 `scope_denied`
- **WHEN** caller 检查 `errors.Is(err, gateway.ErrScopeDenied)`
- **THEN** SHALL 返回 true
- **AND** `err.(*gateway.ErrCode).Details` SHALL 含被拒绝的 scope 名（如 `{required: "operator.write"}`）

#### Scenario: connection-lost 与 envelope error 区分

- **scenario_id**: `deck-go-gateway-error-scope-model.connection-lost-distinct`
- **GIVEN** WS 连接在 RPC 进行中断开
- **WHEN** caller 收到 err
- **THEN** `errors.Is(err, gateway.ErrConnectionLost)` SHALL 返回 true
- **AND** `errors.As(err, &errCode)` SHALL 返回 false（连接错误不是 envelope error）

### Requirement: scope 错误由 handler 自治处理，不在 transport 层全局拦截

deck-go HTTP/handler 层 SHALL 自行决定 scope 错误的响应（403 / 401 / silent fallback / partial result），transport 层 SHALL NOT 全局拦截 `ErrScopeDenied` 转 HTTP code。

#### Scenario: handler 决定 scope 错误的 HTTP 响应

- **scenario_id**: `deck-go-gateway-error-scope-model.handler-owned-scope-response`
- **GIVEN** caller `handlers.GetAgents` 调用 `q.AgentsList(ctx)` 收到 `ErrScopeDenied`
- **WHEN** handler 用 `errors.Is(err, gateway.ErrScopeDenied)` 判定
- **THEN** handler SHALL 自行选择返回 HTTP 403、HTTP 401（要求重新登录）、或回落到只读 fallback；transport 层不强制
- **AND** 不同 handler 对同一类 scope 错误 SHALL 可作出不同决策

### Requirement: deck-go FE 用 typed discriminated union 表示 Gateway error

deck-go FE typed client SHALL 在 RPC 失败时抛 `GatewayError` discriminated union（与 dashboard 等价），含 `code`/`message`/`details` 字段；caller 用 TypeScript 窄化判断。

#### Scenario: FE typed client 抛 GatewayError

- **scenario_id**: `deck-go-gateway-error-scope-model.fe-gateway-error`
- **GIVEN** RPC `chat.send` 响应 envelope `error.code` 为 `validation_failed`
- **WHEN** FE caller `await gw.chat.send(params)` 失败
- **THEN** thrown error SHALL 是 `GatewayError` 实例
- **AND** `error.code === "validation_failed"` SHALL 在 TS 编译期窄化为对应 `details` 类型

#### Scenario: FE 区分 scope 错误用于全局登录 redirect

- **scenario_id**: `deck-go-gateway-error-scope-model.fe-scope-redirect`
- **GIVEN** RPC 失败 `error.code` 为 `scope_denied`
- **WHEN** FE store 检查 `isGatewayScopeError(error)`
- **THEN** SHALL 返回 true
- **AND** caller SHALL 决定是否触发登录跳转（不在 transport 层全局触发）

### Requirement: 现有 wrapper error 输出格式向后兼容

`gateway_queries.go` 116 个现有 wrapper 在迁移到 typed binding 后，error 路径行为 SHALL 保持向后兼容：`err.Error()` 输出格式与原有 `map[string]any` 拆解后的格式等价（`"<code>: <message>"`），现有 UI 错误提示不丢失。

#### Scenario: 迁移后错误 message 不丢失

- **scenario_id**: `deck-go-gateway-error-scope-model.wrapper-error-message-compatible`
- **GIVEN** 旧 wrapper `AgentsList` 在某错误场景下原本返回 `errors.New("validation_failed: missing x")`
- **WHEN** 迁移到 typed 薄壳后同样错误场景
- **THEN** 返回的 `err.Error()` SHALL 仍输出 `"validation_failed: missing x"`
- **AND** 现有依赖此 message 的 UI 错误提示组件 SHALL 显示相同文本

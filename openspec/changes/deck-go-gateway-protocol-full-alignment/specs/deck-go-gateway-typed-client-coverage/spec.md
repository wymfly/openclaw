## ADDED Requirements

### Requirement: deck-go Go-side typed binding coverage equals upstream typed methods

deck-go 后端 SHALL 通过 MVP 落地的 `internal/gateway/generated/methods.go` 调用上游所有 typed methods（`allMethodDefs.filter(m => m.params || m.result)`），不得为已 typed 的方法保留 `map[string]any` 调用路径，例外仅限于 `// gateway:allow-untyped` 行级豁免。

#### Scenario: 缺失方法直接通过 generated 调用

- **scenario_id**: `deck-go-gateway-typed-client-coverage.missing-methods-generated`
- **GIVEN** 上游 `allMethodDefs` 中存在 typed method `chat.send`，但 deck-go `gateway_queries.go` 当前没有对应 wrapper
- **WHEN** 业务 handler 需要发起 chat send
- **THEN** handler SHALL 直接调用 `generated.NewTypedClient(requester).ChatSend(ctx, params)` 并接收 typed `ChatSendResult`
- **AND** SHALL NOT 通过 `requester.Request(ctx, "chat.send", ...)` 字符串调用绕过 typed binding

#### Scenario: 现有 wrapper 迁移为 typed 薄壳

- **scenario_id**: `deck-go-gateway-typed-client-coverage.wrapper-typed-thin-shell`
- **GIVEN** `gateway_queries.go` 已存在 wrapper `(q *GatewayQueries) AgentsList(ctx) (any, error)`
- **WHEN** 完成本提案 PR-7 及后续按域 wrapper 迁移后
- **THEN** 该 wrapper SHALL 返回 typed struct（如 `*generated.AgentsListResult`）而非 `any`
- **AND** wrapper 函数体 SHALL 仅含 `return generated.NewTypedClient(q.requester).AgentsList(ctx, params)` 一行（除必要的参数构造；TypedClient 实例可在 GatewayQueries 构造期一次创建并缓存）
- **AND** caller 编译期 SHALL 能直接访问 result 字段（如 `r.Agents[0].ID`）而无需类型断言

#### Scenario: 上游新增 typed method 自动可用

- **scenario_id**: `deck-go-gateway-typed-client-coverage.upstream-method-autogen`
- **GIVEN** 上游在下次 rebase 中新增 typed method `foo.bar`（含 `params` 与 `result` schema）
- **WHEN** 在 deck-go 跑 `make protocol-update`
- **THEN** `internal/gateway/generated/methods.go` SHALL 自动包含 `func (c *TypedClient) FooBar(ctx context.Context, params FooBarParams) (FooBarResult, error)`
- **AND** 业务 handler 通过共享的 `*generated.TypedClient` 实例（`generated.NewTypedClient(requester)`）可立即直接调用，无需在 `gateway_queries.go` 补 wrapper

### Requirement: deck-go untyped Gateway calls are gated by static analysis

deck-go CI SHALL 通过 `make gateway-typecheck` 静态扫描：(a) Go 端 `internal/runtime/openclaw/`、`internal/handlers/` 路径下 `requester.Request(ctx, "<method>", ...)` 字符串调用；(b) FE 端 **仅**对 `fe-endpoint-classification.md`（PR-17 输出）中 Category=`gateway-rpc-proxy` 的 endpoint 字符串调用做扫描；deck-go BFF 自身的 control-plane endpoint（Category=`deck-go-bff`）与二进制/SSE/上传（Category=`binary-stream-upload`）SHALL NOT 被 gate 阻塞。未通过即阻塞合并。

#### Scenario: 新增 untyped Go 调用被拦截

- **scenario_id**: `deck-go-gateway-typed-client-coverage.untyped-go-call-blocked`
- **WHEN** 一个 PR 在 `internal/handlers/foo.go` 新增 `q.requester.Request(ctx, "foo.bar", params)` 字符串调用且未带豁免注释
- **THEN** `make gateway-typecheck` SHALL 报告该位置为 violation 并以非零码退出
- **AND** CI SHALL 阻塞合并

#### Scenario: 行级豁免允许特殊情况

- **scenario_id**: `deck-go-gateway-typed-client-coverage.inline-exception`
- **GIVEN** 某 method 的 result schema 在上游缺失（例如一个 fork-divergent method 尚未补 schema）
- **WHEN** 调用方加 `// gateway:allow-untyped reason: fork-divergent method <name> missing result schema, tracked in <issue/file>` 与字符串调用同行
- **THEN** `make gateway-typecheck` SHALL 跳过该行
- **AND** 豁免清单 SHALL 输出到 `docs/gateway-untyped-exceptions.md` 用于 PR review

### Requirement: deck-go typed binding 不引入运行时 schema 校验默认开销

deck-go typed binding 调用 SHALL 默认不做 result schema 运行时校验（与 dashboard `createGatewayClient` 默认行为一致）。**本提案不引入 schema validator runtime**——`gateway.WithValidate()` option 与 `gateway.ErrSchemaMismatch` 哨兵推到提案 3 实施（需要 codegen 生成 schema metadata + runtime validator，工作量超出本提案）。

#### Scenario: 默认调用不做 result 校验

- **scenario_id**: `deck-go-gateway-typed-client-coverage.no-default-runtime-validation`
- **WHEN** caller 执行 `generated.NewTypedClient(requester).AgentsList(ctx, params)`
- **THEN** 该调用 SHALL 直接 unmarshal 为 typed struct 后返回
- **AND** SHALL NOT 在响应解析后执行任何 TypeBox/Ajv 等价校验
- **AND** schema drift 由 `make protocol-check` 编译期 + 上游 codegen 守护，不依赖运行时

### Requirement: deck-go 兼容性——wrapper 函数签名稳定

`gateway_queries.go` 中的 116 个现有 wrapper 函数 SHALL 保持函数名与参数列表向后兼容；返回类型由 `any` 升级为 typed struct 是允许的 churn。

#### Scenario: wrapper 名称不变

- **scenario_id**: `deck-go-gateway-typed-client-coverage.wrapper-name-stable`
- **GIVEN** 旧代码调用 `q.AgentsList(ctx)`
- **WHEN** 迁移到 typed 薄壳后
- **THEN** caller 调用语句 `q.AgentsList(ctx)` SHALL 仍能编译
- **AND** 仅 `result` 变量类型从 `any` 变为 `*generated.AgentsListResult`，需要 caller 调整字段访问路径

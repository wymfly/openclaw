## ADDED Requirements

### Requirement: `gateway.healthProbeClients` SHALL evict stale entries to prevent resource leak

`gateway.ProbeHealth` 的 `sync.Map` cached client SHALL 通过失败计数（默认 5 次连续 `ProbeHealth` 失败）自动 evict，并 SHALL 暴露 `gateway.InvalidateProbeClient(URL, token)` 与 `gateway.ShutdownProbeClients()` 公开 API 供 caller 显式清理；evict 时 SHALL 调 `Realtime.Close()` 关 conn + cancel pending + 终止重连循环。

#### Scenario: 失败计数触发自动 evict

- **scenario_id**: `deck-go-gateway-mvp-followup.probe-failure-evict`
- **GIVEN** `gateway.ProbeHealth(URL, token)` 已成功调用一次，sync.Map 中有 entry
- **WHEN** 后续连续 5 次 `ProbeHealth(URL, token)` 都返回 error（mock server 返回 error envelope）
- **THEN** sync.Map 中的 entry SHALL 被移除
- **AND** 旧 `*Client` 持有的 `*Realtime` 的 readLoop goroutine SHALL 退出（goleak 验证）
- **AND** 下次 `ProbeHealth(URL, token)` SHALL 重新构造 client

#### Scenario: token rotate 触发显式 invalidate

- **scenario_id**: `deck-go-gateway-mvp-followup.probe-token-invalidate`
- **GIVEN** `device.token.rotate` handler 成功更新 token
- **WHEN** handler 调用 `gateway.InvalidateProbeClient(URL, oldToken)`
- **THEN** sync.Map 中 `(URL, sha256(oldToken))` entry SHALL 被立即移除
- **AND** 旧 Realtime SHALL 被 Close
- **AND** 下次以 newToken 调用 `ProbeHealth(URL, newToken)` SHALL 构造全新 client（不复用 oldToken 的 Realtime）

#### Scenario: 进程退出 graceful close

- **scenario_id**: `deck-go-gateway-mvp-followup.probe-shutdown-close`
- **WHEN** main 在 shutdown handler 调用 `gateway.ShutdownProbeClients()`
- **THEN** sync.Map 中所有 entry SHALL 依次 Close + evict
- **AND** 函数返回时 SHALL 无 readLoop goroutine 残留

### Requirement: `generated.TypedClient` SHALL replace conflicting `generated.Client` name

deck-go codegen 输出 SHALL 把 typed client 的 struct 命名为 `TypedClient`、构造函数为 `NewTypedClient(requester Requester) *TypedClient`，避免与 `gateway.Client` 命名冲突；caller import `generated` 包时 SHALL 不需要 alias。

#### Scenario: caller 同时 import gateway 与 generated 包

- **scenario_id**: `deck-go-gateway-mvp-followup.typed-client-imports`
- **GIVEN** caller 文件含 `import "github.com/openclaw/openclaw/deck-go/backend/internal/gateway"` 与 `import "github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"`
- **WHEN** caller 写 `var c *gateway.Client; var t *generated.TypedClient`
- **THEN** 编译期 SHALL 无命名冲突 + 无需 alias

#### Scenario: codegen 输出的命名稳定

- **scenario_id**: `deck-go-gateway-mvp-followup.typed-client-codegen`
- **WHEN** 跑 `make protocol-update`
- **THEN** 生成的 `methods.go` SHALL 含 `type TypedClient struct{...}` 与 `func NewTypedClient(requester Requester) *TypedClient`
- **AND** SHALL 不含旧 `type Client struct` 或 `NewClient` 命名

### Requirement: `generated.Requester` SHALL use `RequestTyped` while transport keeps legacy `Request`

`generated.Requester` interface SHALL 要求 `RequestTyped(ctx, method string, params any) (any, error)`，codegen 生成的 typed call SHALL 直接传 typed struct，不做 `Marshal(struct) → Unmarshal(map) → Marshal(map)` 双跳。transport 层 `*gateway.Client` 与 `*gateway.Realtime` SHALL 同时实现：(a) 现有 `Request(ctx, method string, params map[string]any) (any, error)` 保持不变（外部 caller 兼容）；(b) 新增 `RequestTyped(ctx, method string, params any) (any, error)` 供 generated path 使用。

**Rationale**：D11 v1 决策选 A（统一 any）会破坏 `gateway.Client.Request(map)` 公开签名兼容性——实施核查发现 `generated.Requester` 改 any 后 `*gateway.Client` 不再满足该接口，编译失败。修订为二口径方案。

#### Scenario: typed call 走 RequestTyped 直接传 struct

- **scenario_id**: `deck-go-gateway-mvp-followup.requesttyped-direct-struct`
- **GIVEN** caller 调 `generated.NewTypedClient(requester).AgentsList(ctx, generated.AgentsListParams{Limit: 10})`
- **WHEN** generated 内部进入 `requester.RequestTyped(ctx, "agents.list", params any)` 路径
- **THEN** transport 层 SHALL 把 `params` 直接放入 `frame.Params any` 字段后 `WriteJSON`
- **AND** SHALL 不做 `Marshal(struct) → Unmarshal(map[string]any)` 双跳
- **AND** mock server 端收到的 JSON SHALL 与 typed struct `json.Marshal` 结果等价

#### Scenario: 现有 wrapper 走 Request(map) 保持兼容

- **scenario_id**: `deck-go-gateway-mvp-followup.request-map-compatible`
- **GIVEN** `gateway_queries.go::AgentsList` wrapper（迁移前）仍用 `q.requester.Request(ctx, "agents.list", map[string]any{...})` 调用
- **WHEN** transport 层接收
- **THEN** 行为 SHALL 与 MVP 完全一致（无回退）
- **AND** 端到端 round-trip 字段集 SHALL 与改签名前等价

#### Scenario: `*gateway.Client` 与 `*gateway.Realtime` 同时实现两接口

- **scenario_id**: `deck-go-gateway-mvp-followup.client-realtime-interfaces`
- **WHEN** 编译期检查
- **THEN** `var _ generated.Requester = (*gateway.Client)(nil)` SHALL 通过类型断言
- **AND** `var _ generated.Requester = (*gateway.Realtime)(nil)` SHALL 通过

#### Scenario: 端到端 round-trip 测试覆盖典型形态

- **scenario_id**: `deck-go-gateway-mvp-followup.requesttyped-roundtrip-shapes`
- **WHEN** 跑 5 个端到端测试，分别覆盖 `params = nil` / 含 nested struct / 含 slice / 含 map / 含 enum 通过 `RequestTyped` 发送
- **THEN** mock server 端收到的 JSON SHALL 与原 typed struct 序列化结果等价
- **AND** SHALL 无字段丢失、无类型变化
- **AND** 同样 5 个 method 通过 `Request(map)` 发送 SHALL 行为不变

### Requirement: `protocol-gen-go.ts` SHALL emit typed event payload structs

`deck-go/contracts/scripts/protocol-gen-go.ts` SHALL 扩展循环遍历已 import 的 `eventDefs`，生成 `type {PascalEventName}EventPayload struct {...}` typed event payload 类型到 `deck-go/backend/internal/gateway/generated/events.go`（命名与 TS 端 `dashboard/src/types/gateway-protocol.generated.ts:3871,4119` 对称：`SessionMessageEventPayload` / `SessionsChangedEventPayload` 等）；事件类型按字母序确定性排序；单文件 < 2000 行。

**前置**：MVP `protocol-gen-go.ts` 仅生成 typed methods 的 Params/Result，无 event payload 类型；`deck-go-gateway-subscription-api` spec 的 typed channel SHALL 依赖此 codegen 扩展。

#### Scenario: events.go 含与 TS 等价的 typed event 类型

- **scenario_id**: `deck-go-gateway-mvp-followup.events-go-ts-parity`
- **WHEN** 跑 `make protocol-update`
- **THEN** `deck-go/backend/internal/gateway/generated/events.go` SHALL 含每个 `eventDefs` 中带 `payload` schema 的事件对应的 Go struct（命名按 `{PascalEventName}EventPayload`）
- **AND** 同名事件在 TS `GatewayEventPayloadMap` 中的字段 SHALL 与 Go struct 字段一一对应（同一份上游快照下 fixture 测试断言）
- **AND** 重复运行 SHALL 输出 byte-identical（确定性排序）

#### Scenario: typed subscription 消费 generated event 类型

- **scenario_id**: `deck-go-gateway-mvp-followup.subscription-generated-events`
- **GIVEN** caller 通过 `gateway_subscriptions.SubscribeSessions(ctx, requester)` 订阅
- **WHEN** server 端推送 `sessions.changed` 事件
- **THEN** caller SHALL 通过 `<-chan generated.SessionsChangedEventPayload`（与 TS 端 `dashboard/src/types/gateway-protocol.generated.ts:4119` 命名对称）接收 typed payload
- **AND** SHALL NOT 需要手动 `json.Unmarshal` 解析

### Requirement: deck-go CI SHALL run go test/build for backend module

deck-go CI workflow SHALL 在 `make protocol-check` 之外，新增 `cd deck-go/backend && go vet ./... && go build ./... && go test -race ./internal/...` 步骤，全部退出码 0 才允许合并；环境变量（GOCACHE/GOSUMDB）与 deck-go Makefile 一致。

#### Scenario: 后端代码改动被 CI 守护

- **scenario_id**: `deck-go-gateway-mvp-followup.backend-ci-guard`
- **GIVEN** PR 修改 `deck-go/backend/internal/handlers/foo.go` 引入编译错误或测试失败
- **WHEN** CI 跑 `cd deck-go/backend && go build ./...` 或 `go test -race ./internal/...`
- **THEN** 命令 SHALL 报错退出非零
- **AND** CI 流水线 SHALL 阻塞合并

#### Scenario: GOCACHE 路径与本地一致

- **scenario_id**: `deck-go-gateway-mvp-followup.ci-go-env-parity`
- **WHEN** CI runner 执行
- **THEN** `GOCACHE` 与 `GOSUMDB` 环境变量 SHALL 与 `deck-go/Makefile::GO_ENV` 定义一致
- **AND** 测试结果 SHALL 与本地 `make backend-test` 等价（无 CI/local divergence）

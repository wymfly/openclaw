## ADDED Requirements

### Requirement: Gateway 一次性 RPC 复用单 WS 长连接

deck-go Go 端所有 Gateway RPC 调用 SHALL 复用单个 WebSocket 长连接，不得为每次 RPC 新建连接或重新执行 connect 握手。

#### Scenario: 多次 Request 共享同一 WS 连接

- **GIVEN** `gateway.Client` 已配置可用的 `ConnectionProvider`
- **WHEN** 调用方在 1 秒内连续发起 3 次 `Client.Request(ctx, method, params)`
- **THEN** 底层 SHALL 仅打开 1 个 WebSocket 连接
- **AND** SHALL 仅执行 1 次 connect 握手（含 Ed25519 签名）

#### Scenario: 现有 70 个 wrapper 行为不变

- **GIVEN** `internal/runtime/openclaw/gateway_queries.go` 中的 70 个 wrapper 通过 `Requester.Request` 接口调用 Gateway
- **WHEN** transport 切换为单连接复用后，这些 wrapper 的现有调用方调用任意一个 wrapper
- **THEN** 返回结果 SHALL 与切换前等价（payload 字段集合与值相同）
- **AND** 任何 wrapper 的源码 SHALL 不需要修改

#### Scenario: RPC 端到端延迟低于 10ms（连接已建立后）

- **GIVEN** 单连接已建立、握手已完成
- **WHEN** 在本机 loopback 环境下连续发起 100 次 `health` 方法 RPC
- **THEN** 第 2 次起的中位延迟 SHALL 低于 10ms

### Requirement: 并发首发 RPC 单飞（singleflight）连接

`Realtime.ensureConnected` SHALL 保证同一时刻最多有一个 goroutine 执行 dial + handshake，其余并发调用方等待结果共享同一连接。

#### Scenario: N 个 goroutine 并发首发 RPC 只产生 1 条 WS

- **GIVEN** `Realtime` 处于初始未连接状态
- **WHEN** 10 个 goroutine 同时调用 `Client.Request`
- **THEN** Gateway server 端 SHALL 仅观察到 1 个新 WebSocket session
- **AND** SHALL 仅观察到 1 次 connect 握手
- **AND** 10 个 RPC SHALL 全部成功并收到正确响应

#### Scenario: 第一个 dialer 失败时其余调用方收到同一错误

- **GIVEN** `Realtime` 处于初始未连接状态
- **AND** 上游 Gateway 不可达
- **WHEN** 5 个 goroutine 同时调用 `Client.Request`
- **THEN** 仅有 1 个 goroutine 实际尝试 dial
- **AND** 5 个调用方 SHALL 都收到 dial 失败错误，错误内容一致

#### Scenario: race detector 跑测无数据竞争

- **WHEN** `go test -race` 在 `internal/gateway/` 包跑全部单测
- **THEN** SHALL 无 data race 报告

### Requirement: Realtime 自动重连与 pending request 故障传播

`Realtime` SHALL 在底层 WS 断开时自动尝试重连，并对所有 in-flight request 立即返回错误。

#### Scenario: 断线时 pending request 收到 ErrConnectionLost

- **GIVEN** 一个 RPC 通过 `Client.Request` 已发出但尚未收到响应
- **WHEN** 底层 WS 由于网络中断或 Gateway 关闭而关闭
- **THEN** 该 RPC SHALL 立即返回错误，且错误 SHALL 满足 `errors.Is(err, gateway.ErrConnectionLost)`

#### Scenario: 重连后新请求成功

- **GIVEN** WS 在 t0 断开
- **WHEN** 调用方在断开后 5 秒发起新的 `Client.Request`
- **THEN** `Realtime` SHALL 自动建立新连接并重新执行 connect 握手
- **AND** 该请求 SHALL 收到正常响应

#### Scenario: 重连采用指数退避，上限 30s

- **WHEN** 重连连续失败
- **THEN** 重试间隔 SHALL 按 1s, 2s, 4s, 8s, 16s, 30s, 30s, ... 序列延长
- **AND** 重试间隔 SHALL 不超过 30 秒

#### Scenario: 已存在的 session 订阅在重连后自动恢复

- **GIVEN** `Realtime.SubscribeSession(ctx, key)` 在断线前已成功
- **WHEN** WS 断开并自动重连完成
- **THEN** `Realtime` SHALL 自动重新发送 `sessions.subscribe` 与 `sessions.messages.subscribe(key)`
- **AND** 调用方无需重新调用 `SubscribeSession`

### Requirement: ctx 在 RPC 全生命周期生效（含 handshake）

`Client.Request` SHALL 完整尊重 `context.Context` 的 deadline 与 cancellation，覆盖 dial、handshake、request、response 全阶段。

#### Scenario: ctx 在 handshake 期 cancel 立即返回

- **GIVEN** 调用方发起 `Client.Request`，进入 connect 握手阶段（`completeConnect` 在 `ReadMessage` 阻塞）
- **WHEN** 调用方在握手响应到达前取消 ctx
- **THEN** `Request` SHALL 在 100ms 内返回 `ctx.Err()`
- **AND** 底层 WS conn SHALL 被关闭，避免 ReadMessage 永久阻塞

#### Scenario: ctx 取消导致 request 立即返回

- **GIVEN** 一个 RPC 已发出且尚未收到响应
- **WHEN** 调用方取消该 RPC 的 ctx
- **THEN** `Request` SHALL 立即返回 `ctx.Err()`
- **AND** 该 RPC ID 对应的 pending entry SHALL 从 `Realtime.pending` map 中清除（无内存泄漏）

#### Scenario: 取消的 RPC 后续到达的响应不破坏其他请求

- **GIVEN** 一个 RPC 已被 ctx 取消
- **WHEN** Gateway 在取消之后才将该 RPC 的响应发回
- **THEN** `Realtime` SHALL 安全丢弃该响应而不影响其他 pending 请求

### Requirement: Client 与 Realtime 的 lifecycle 契约

`gateway.Client` 与 `gateway.Realtime` 的构造、bus 注入、关闭顺序 SHALL 显式定义。

#### Scenario: 兼容旧签名 NewClient 不需要外部 Realtime

- **GIVEN** 既有调用方使用 `gateway.NewClient(provider)`
- **WHEN** 编译升级后的 deck-go backend
- **THEN** 该签名 SHALL 仍然有效
- **AND** 内部 SHALL 自动构造一个使用 `events.NewNoopBus()` 的 `Realtime` 实例

#### Scenario: 显式注入 Realtime 共享 bus

- **WHEN** 调用方使用 `gateway.NewClientWithRealtime(rt *Realtime)` 构造 Client
- **THEN** 所有 RPC 与事件 SHALL 通过该 Realtime 实例进行
- **AND** 该 Realtime 的 `events.Bus` SHALL 接收所有 server-pushed event

#### Scenario: Realtime.Close 释放所有资源

- **WHEN** 调用 `Realtime.Close()`
- **THEN** 底层 WS conn SHALL 关闭
- **AND** 所有 pending request SHALL 收到 `ErrConnectionLost`
- **AND** 重连循环 SHALL 终止

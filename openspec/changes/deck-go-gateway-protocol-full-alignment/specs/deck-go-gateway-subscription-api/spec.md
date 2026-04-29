## ADDED Requirements

### Requirement: deck-go Go 端提供 typed subscription channel API

deck-go 后端 SHALL 在 `internal/runtime/openclaw/gateway_subscriptions.go`（或等价模块）提供 typed subscription API，把 `sessions.subscribe` / `sessions.messages.subscribe` 与 `Realtime` event loop 包装为有界 Go channel；命名与 TS 端 codegen 输出对称：`<-chan generated.SessionsChangedEventPayload`（对应上游 `sessions.changed` 事件）+ `<-chan generated.SessionMessageEventPayload`（对应 `session.message` 事件）等。

**前置依赖**：本 requirement 依赖 D14 task PR-2.5 — `protocol-gen-go.ts` 必须先扩展生成 `generated.SessionsChangedEventPayload` / `generated.SessionMessageEventPayload` 等 typed event payload struct（MVP `protocol-gen-go.ts` 只生成 method Params/Result，不含 events；命名规则 `{PascalEventName}EventPayload` 与 TS 端 `dashboard/src/types/gateway-protocol.generated.ts:3871,4119` 对称）。

**事件分发路径**（D14b 修订 — readLoop 永不阻塞）：

- typed subscription channel SHALL **不走** MVP `events.Bus.Publish` 路径（Bus 是 non-blocking drop，与"不丢事件"对原 caller 假设矛盾）
- 三层独立背压架构详见下方"Requirement: subscription channel 三层背压"——readLoop / dispatch worker / per-subscriber reader 三者**互不阻塞**：readLoop 与 dispatch worker 都用非阻塞 send + 满则 drop+metric；只有 per-subscriber reader 自身在 typed channel 上阻塞
- 关键不变量：readLoop 永不阻塞 → RPC `case "res":` 始终可投递 → ctx cancel 触发的 unsubscribe RPC 必能完成

#### Scenario: SubscribeSessions 返回 typed channel

- **scenario_id**: `deck-go-gateway-subscription-api.subscribe-sessions-typed-channel`
- **GIVEN** `Realtime` 已建立单连接（MVP 5.x 已落地）
- **WHEN** caller 执行 `events, cancel, err := gateway_subscriptions.SubscribeSessions(ctx, requester, opts)`
- **THEN** `events` SHALL 是 `<-chan generated.SessionsChangedEventPayload` typed channel
- **AND** server 端 SHALL 收到 `sessions.subscribe` 调用并开始推送事件
- **AND** caller 通过 `event := <-events; event.Key, event.Status` 直接访问 typed 字段

#### Scenario: SubscribeMessages 接收 message 事件

- **scenario_id**: `deck-go-gateway-subscription-api.subscribe-messages-typed-channel`
- **WHEN** caller 执行 `msgs, cancel, err := gateway_subscriptions.SubscribeMessages(ctx, requester, sessionKey, opts)`
- **THEN** `msgs` SHALL 是 `<-chan generated.SessionMessageEventPayload` typed channel
- **AND** server 端 SHALL 收到 `sessions.messages.subscribe(key=sessionKey)` 调用

#### Scenario: 慢 caller 不阻塞 RPC response 路径

- **scenario_id**: `deck-go-gateway-subscription-api.slow-caller-rpc-unblocked`
- **GIVEN** caller 已订阅 1 个 typed channel 但**不消费**；同 process 另一 caller 发起 RPC
- **WHEN** server 端推送 100+ events 填满 typed channel buffer
- **THEN** RPC `case "res":` 路径 SHALL 仍能投递（readLoop 与 dispatch worker 都不阻塞）
- **AND** ctx cancel 触发 unsubscribe RPC 在 1s 内完成
- **AND** caller 自身 raw chan 满时 SHALL drop 最旧 event + emit `gateway_event_subscriber_overflow_total{subscriber_id}` metric；若 dispatch queue 满则 emit `gateway_event_dispatch_overflow_total`

### Requirement: subscription channel 关闭语义支持 ctx cancel 与显式 unsubscribe

subscription API SHALL 同时支持两种关闭路径：(a) caller 取消 ctx 自动 unsubscribe + 关闭 channel；(b) caller 调用返回的 `cancel` 函数立即 unsubscribe + 关闭 channel。两者均 SHALL 通过 transport 通知 server 端释放订阅资源——发送 `sessions.messages.unsubscribe(key)`（per-key 引用计数归 0 时）+ `sessions.unsubscribe`（lifecycle 引用计数归 0 时）。

**ctx 独立性约束**：因为 caller 的 ctx 可能在 subscription 关闭时已被取消，subscription layer SHALL 使用**独立的 fresh timeout context**（`context.WithTimeout(context.Background(), 1*time.Second)`，1s 默认 + env override）发送 unsubscribe RPC，**不复用 caller 的已取消 ctx**——否则 `Realtime.UnsubscribeSession(ctx, key)` 在 `ensureConnected(ctx)` 阶段立即返回 `ctx.Err()`，unsubscribe RPC 永不发出，server 端订阅 leak。

**双层引用计数**：

1. **per-key**：`Realtime.sessionMessagesRefCount[sessionKey]` —— 每个 `SubscribeMessages(key)` +1，cancel 时 -1；归 0 时发 `sessions.messages.unsubscribe(key)`
2. **lifecycle**：`Realtime.sessionsLifecycleRefCount` —— 每个会发送或依赖 `sessions.subscribe` 的 subscription +1，cancel 时 -1；归 0 时发 `sessions.unsubscribe`。`SubscribeSessions` 必须增加 lifecycle；`SubscribeMessages(key)` 若复用当前 MVP all-in-one `Realtime.SubscribeSession(ctx, key)`（该 helper 会先发 `sessions.subscribe` 再发 `sessions.messages.subscribe(key)`），也必须增加 lifecycle + per-key 两层计数，或实现时拆出 lifecycle/message 两个低层 helper。

#### Scenario: ctx cancel 用 fresh timeout ctx 发送 unsubscribe RPC

- **scenario_id**: `deck-go-gateway-subscription-api.ctx-cancel-fresh-unsubscribe`
- **GIVEN** caller 已订阅 `events, cancel, _ := SubscribeSessions(ctx, ...)`
- **WHEN** caller 取消 ctx（`ctxCancel()`）
- **THEN** subscription layer SHALL 用独立的 `context.WithTimeout(context.Background(), 1*time.Second)` 调 Realtime unsubscribe helper，**不复用 caller 已取消的 ctx**
- **AND** Realtime unsubscribe helper 内部 `ensureConnected(unsubCtx)` SHALL 因新 ctx 未取消而正常进入连接复用路径
- **AND** server SHALL 接收适用于该订阅类型且引用计数归 0 的 unsubscribe RPC：`SubscribeSessions` 关闭发送 `sessions.unsubscribe`；`SubscribeMessages(key)` 关闭发送 `sessions.messages.unsubscribe(key)`，若该路径也持有 lifecycle ref 且归 0，则同时发送 `sessions.unsubscribe`
- **AND** typed `events` channel SHALL 在 server 响应或 1s 超时后关闭
- **AND** 后续 `<-events` SHALL 返回零值 + `ok=false`

#### Scenario: 多 subscriber 共享 lifecycle，最后一个退出才发 sessions.unsubscribe

- **scenario_id**: `deck-go-gateway-subscription-api.lifecycle-refcount-last-unsubscribe`
- **GIVEN** caller A 与 caller B 同时调用 `SubscribeSessions(...)`，lifecycle ref count = 2
- **WHEN** caller A 取消 ctx
- **THEN** lifecycle ref count -= 1 → 仍为 1，**不发** `sessions.unsubscribe`
- **AND** caller B 的 typed channel SHALL 继续接收事件
- **WHEN** caller B 也取消 ctx
- **THEN** lifecycle ref count -= 1 → 归 0
- **AND** subscription layer SHALL 用 fresh timeout ctx 发送 `sessions.unsubscribe`

#### Scenario: 显式 cancel 函数等价于 ctx cancel

- **scenario_id**: `deck-go-gateway-subscription-api.explicit-cancel-equivalent`
- **WHEN** caller 调用返回的 `cancel()` 函数（不取消 ctx）
- **THEN** SHALL 触发与 ctx cancel 相同的 unsubscribe + channel close 流程
- **AND** ctx 仍然有效，caller 可继续用同 ctx 发起其他 RPC

#### Scenario: 多个并发订阅独立关闭

- **scenario_id**: `deck-go-gateway-subscription-api.concurrent-subscriptions-independent-close`
- **GIVEN** caller 在同一 ctx 下创建 3 个订阅 (S1, S2, S3)
- **WHEN** caller 调用 S2.cancel()
- **THEN** 仅 S2 的 channel SHALL 关闭、server 端订阅取消
- **AND** S1 与 S3 SHALL 继续正常接收事件
- **AND** ctx 仍然有效

### Requirement: subscription channel 三层背压（readLoop 永不阻塞，per-subscriber 独立 backpressure）

subscription typed channel SHALL 默认 buffer = 64；caller 可通过 `WithBufferSize(n)` 调整。三层背压策略保证 (a) `readLoop` 永不阻塞 → RPC response 路径始终可投递；(b) 单个 subscriber 慢只阻塞自身路径，不影响其他 typed channel 与 RPC；(c) 队列溢出可观测（metric），不静默丢弃。

**三层架构**：

1. `readLoop` → 单一 dispatch queue（buffered，默认 256）：**非阻塞 send**；满时 drop 最旧 event + emit `gateway_event_dispatch_overflow_total` metric（避免 readLoop 死锁）
2. dispatch worker → per-subscriber raw chan（`chan json.RawMessage`，buffer = 64）：**非阻塞 send**；满时 drop 最旧 event 给该 subscriber + emit `gateway_event_subscriber_overflow_total{subscriber_id=...}` metric（**只 drop 慢 subscriber，不影响其他**）
3. per-subscriber reader goroutine → typed channel：**阻塞 reader 自己**直到 caller 消费；reader 阻塞**不影响** dispatch worker、其他 subscriber、readLoop、RPC

#### Scenario: caller 不消费 typed channel 仅影响自身（不阻塞 RPC 与其他订阅）

- **scenario_id**: `deck-go-gateway-subscription-api.per-subscriber-backpressure`
- **GIVEN** caller A 已订阅 typed channel 但**不消费**；caller B 订阅另一 typed channel 正常消费；同 process 第三方发起 RPC
- **WHEN** server 端推送 100+ events 含 A 与 B 的事件类型 + RPC response
- **THEN** caller B 的 typed channel SHALL 持续接收事件（不被 A 阻塞）
- **AND** RPC response SHALL 正常投递（readLoop 不阻塞）
- **AND** caller A 的 raw chan 满时 SHALL drop 最旧 event 给 A + emit `gateway_event_subscriber_overflow_total{subscriber_id=A}` metric
- **AND** caller A 的 reader goroutine SHALL 阻塞在 typed channel send（仅阻塞自身 reader，不影响其他路径）

#### Scenario: dispatch queue 溢出可观测

- **scenario_id**: `deck-go-gateway-subscription-api.dispatch-overflow-metric`
- **GIVEN** readLoop 推送速度持续高于 dispatch worker 消费（极罕见的负载）
- **WHEN** dispatch queue 长度达到 256 buffer 上限
- **THEN** readLoop SHALL drop 最旧 event + emit `gateway_event_dispatch_overflow_total` metric
- **AND** readLoop SHALL NOT 阻塞
- **AND** RPC response 路径 SHALL 不受影响

#### Scenario: caller 自定义 buffer 大小

- **scenario_id**: `deck-go-gateway-subscription-api.custom-buffer-size`
- **WHEN** caller 调用 `SubscribeSessions(ctx, requester, WithBufferSize(256))`
- **THEN** 返回的 typed channel buffer SHALL 为 256
- **AND** raw chan buffer SHALL 默认（64）独立于 typed channel buffer——caller 仅控制 typed channel 大小

**Trade-off 说明**：本 requirement 选择"快速 drop + observable metric"而非"无限缓存"，避免内存爆炸。caller 必须及时消费 typed channel；缺失事件时通过 metric 触发告警，不静默积压。如未来需要持久"无丢事件"语义，由提案 3 评估持久队列方案（Kafka/Redis/etc.）。

### Requirement: subscription 在 Realtime 重连后自动续订且不重发已收事件

deck-go subscription SHALL 在 `Realtime` 断线重连后自动重新发送 `sessions.subscribe` / `sessions.messages.subscribe`（MVP 5.7 已要求 transport 层做此动作；本 spec 增加 typed channel 层的兼容契约：续订对 caller 透明）。

#### Scenario: 重连后 typed channel 继续工作

- **scenario_id**: `deck-go-gateway-subscription-api.reconnect-keeps-channel`
- **GIVEN** caller 已订阅 `events := <-chan generated.SessionsChangedEventPayload`
- **WHEN** Realtime 因网络抖动断线 + 自动重连成功
- **THEN** typed channel SHALL NOT 关闭
- **AND** caller 继续从 `events` 收到新事件
- **AND** server 端 SHALL 视为 idempotent re-subscribe（不重发历史事件）

#### Scenario: 续订期间 caller 不感知中断

- **scenario_id**: `deck-go-gateway-subscription-api.resubscribe-transparent`
- **WHEN** Realtime 在重连期间（例如 3s 内）有 server-pushed 事件
- **THEN** typed channel 在重连完成前 SHALL 阻塞（不收到事件）
- **AND** 重连完成后从下一个新事件开始消费
- **AND** caller 不会在 channel 上收到重复或乱序事件

### Requirement: subscription 测试 SHALL 通过 goleak 检查无 goroutine 泄漏

订阅 API 的所有单测 SHALL 启用 `goleak.VerifyTestMain` 或 `goleak.VerifyNone(t)`，确保 ctx cancel / 显式 cancel / Realtime.Close / 重连失败 / 多订阅并发 等场景下无 goroutine 泄漏。

#### Scenario: 单测启用 goleak 验证

- **scenario_id**: `deck-go-gateway-subscription-api.goleak-tests`
- **GIVEN** `gateway_subscriptions_test.go` 含 N 个订阅相关 test case
- **WHEN** test 文件 init 调用 `goleak.VerifyTestMain(m)`
- **THEN** 任一 test 退出时若有 goroutine 残留 SHALL 报告失败
- **AND** test 必须修复泄漏路径，不得用 `goleak.IgnoreTopFunction` 绕过

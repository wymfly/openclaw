## Context

`deck-go-gateway-protocol-mvp` 已 commit-ready（Codex R2 审查通过 2026-04-28），交付：

- `internal/gateway/generated/{methods,types,types_extra_2,allowlist,doc}.go`：127 个 typed `*Client.MethodName(ctx, params) (Result, error)` Go 函数 + 129 个 allowlist（**MVP 当前命名为 `*Client`；本提案 PR-1 (D10) 将改名为 `*TypedClient` 以避免与 `gateway.Client` 冲突**）
- `contracts/generated/ts/gateway/{protocol,client}.ts`：typed `createGatewayClient`
- `Realtime` 单连接 + singleflight + 自动重连（1s→30s）+ ctx 覆盖 handshake
- `gateway.ProbeHealth` 包级 API 用 `sync.Map` 按 `(URL, sha256(token))` 缓存 client 复用单连接
- `Realtime.SubscribeSession(ctx, key)` / `UnsubscribeSession(ctx, key)`：非 typed 的简单包装，事件通过 `events.Bus.Publish` 进入 bus
- `Realtime.doRequest` 在 envelope `error` 时返回 `fmt.Errorf("%s: %s", code, message)` 普通 error
- `gateway.ErrConnectionLost` 哨兵
- `make protocol-check` 在 CI 阻塞 drift；`make protocol-update` 写入磁盘
- `docs/fork-divergent-methods.md` 含 SSRF / WeCom / Channel Event Filter 人工 Notes
- `docs/transport-benchmark.md` baseline 0.326ms vs shared 0.042ms

本提案在此基础上做能力对齐 + MVP P2 follow-up 收尾：

| 维度                                            | dashboard            | deck-go (MVP 后)                                    | deck-go (本提案目标)                             |
| ----------------------------------------------- | -------------------- | --------------------------------------------------- | ------------------------------------------------ |
| Go typed binding 已生成                         | n/a                  | ✓ 127 函数                                          | ✓（无变化）                                      |
| Go caller 走 typed binding                      | n/a                  | **0**（116 wrapper 全 `any` + 21 method 缺 caller） | 100%（116 wrapper 薄壳化 + 21 直接走 generated） |
| FE typed client                                 | ✓ `gw.*` 全采用      | **0**（仍走 REST 字符串端点）                       | 100%                                             |
| Error envelope                                  | typed `gatewayError` | `fmt.Errorf("%s: %s", code, message)`               | typed `*ErrCode` + 哨兵                          |
| Subscription API                                | typed RxJS-like      | 非 typed `Realtime.SubscribeSession(key)`           | typed channel + 自动续订 + 显式 cancel           |
| 反倒退 gate                                     | n/a                  | n/a                                                 | `make gateway-typecheck` + coverage 报告         |
| `healthProbeClients` 资源回收                   | n/a                  | **永不清理**（MVP R2 P3）                           | 失败计数/显式 invalidate evict                   |
| `generated.Client` vs `gateway.Client` 命名冲突 | n/a                  | **存在**（MVP R2 P2）                               | 改 `generated.TypedClient`                       |
| `encodeParams` marshal 双跳                     | n/a                  | **存在**（MVP R2 P2）                               | 优化                                             |
| `fork-divergence` reorder 噪音                  | n/a                  | **存在**（138 条几乎全 method）                     | 算法收紧                                         |
| CI 守护 deck-go go test                         | n/a                  | **未接入**（仅 protocol-check）                     | 接入                                             |

约束：

- 不修改上游 (`src/**`)
- 不修改 MVP 落地的 codegen 模板与 transport 实现（除非本提案明确扩展，如 D6/D9/D10/D11）
- caller 改动按域分批 PR，每个 PR 独立 green
- prompt-cache 稳定性：codegen 输出已确定性排序（MVP 保证），本提案的算法收紧（D12 fork-divergence）必须保持确定性
- 116 wrapper 函数签名保持向后兼容（返回类型升级是允许的 churn）

## Goals / Non-Goals

**Goals:**

- deck-go Go 调用 Gateway 100% 走 typed binding（21 缺失方法补全 + 116 wrapper 薄壳化）
- deck-go FE 调用 Gateway 100% 走 typed client（REST 字符串端点删除，白名单除外）
- Error envelope 升级 typed Go error 树 + FE discriminated union
- Subscription typed channel API + 自动续订 + 无 goroutine 泄漏
- CI 静态扫描禁止新增 untyped 调用 + 防倒退 coverage gate + 接入 go test/build
- 收尾 MVP R1/R2 P2 follow-up（healthProbeClients evict / generated.Client 改名 / encodeParams 优化 / fork-divergence 算法）

**Non-Goals:**

- 不动 fork 适配层物理位置（→ 提案 3）
- 不引入新业务方法或新 schema
- 不修改 deck-go FE 页面/路由结构
- 不替换 deck-go 后端 BFF 二进制下载/SSE/上传等 REST endpoint
- 不引入 GraphQL/gRPC 等替代协议
- 不重写 dashboard
- 不补 8 个 allowlist 但非 typed 方法的 result schema（推到提案 3 或上游 PR；本提案对它们走 D12 显式豁免）

## Decisions

### D1: 迁移粒度——按 method 域分批 vs 一次性大 PR

**选项**:

- A. 一次性大 PR 替换所有 116 wrapper + 21 缺失方法
- B. 按 method 域分批 PR（约 11 域）
- C. 全量 codegen 输出 + caller 用 build tag 渐进切换

**Decision**: B。

**Rationale**:

- A 爆炸半径过大；C 复杂度溢出收益
- B 每批独立可绿、可回滚；按 method 域天然聚合 caller 改动
- 批次顺序：低风险无 subscription（cron/usage/doctor/devices/skills）→ 中等（agents/config/channels/tools/deck.\*）→ 高风险（exec.approval+plugin.approval / sessions / chat / wizard+talk）→ FE 全切

### D2: 缺失方法的覆盖路径

**选项**:

- A. 在 `gateway_queries.go` 继续补 21 个手写 wrapper
- B. 调用方直接 `generated.TypedClient.MethodName(ctx, params)`，废弃 wrapper 一致性
- C. 混合

**Decision**: B（17 个普通 RPC 缺口直接调 generated；4 个 subscription protocol methods 通过 typed subscription API 内部覆盖；116 现有 wrapper 也在迁移期保留薄壳）。

**Rationale**:

- 116 个 wrapper 是 codegen 缺位时的应急产物；MVP 后 wrapper 仅"参数 marshal + 调 generated + result unmarshal"三步
- 普通 RPC 缺失方法不再补 wrapper 的目的：让 caller 习惯走 `generated.*`，为提案 3 的 wrapper 移除做准备
- 测试 mock：在 `generated.Requester` / transport requester seam 上注入 mock；wrapper 不再是必需的 mock 边界

### D3: typed binding 是否启用 result schema 运行时校验

**Decision**: B。默认 `validate: false`（与 dashboard `createGatewayClient` 行为一致）；**`gateway.WithValidate()` option 与 `gateway.ErrSchemaMismatch` 哨兵推到提案 3** —— 本提案不引入 schema validator runtime（codegen 生成 schema metadata + runtime validator 工作量超出本提案范围）。

**Rationale**:

- 编译期 typed + `make protocol-check` drift check 已覆盖 schema 一致性
- 运行时 validator 是优化项，提案 3 评估时再补 codegen 与 runtime
- 与 typed-coverage spec 同步（spec 已声明"本提案不引入 schema validator runtime"）

### D4: Subscription typed channel API（构建在 MVP `Realtime.SubscribeSession` 之上）

**Context**: MVP 已落地 `Realtime.SubscribeSession(ctx, key)` / `UnsubscribeSession(ctx, key)`：内部调 `sessions.subscribe` + `sessions.messages.subscribe(key)`，events 通过 `Realtime.readLoop` → `r.bus.Publish(fr.Event, payload)` 进入 `events.Bus`。但**没有 typed channel API**：

- caller 必须自己 `bus.Subscribe()` 拿 raw `events.Event{Type, Data []byte}`，再 `json.Unmarshal` 解析
- 没有按订阅维度过滤事件
- 没有 ctx cancel 自动 unsubscribe（必须显式调 `Realtime.UnsubscribeSession`）

**选项**（typed channel 关闭语义）:

- A. `close(ctx)` 取消订阅 + 关闭 channel
- B. 显式 `Unsubscribe(token)` 调用
- C. ctx cancel 自动 unsubscribe + channel 关闭

**Decision**: C（兜底）+ B（显式 API），二者并存。Subscription typed layer 在 `internal/runtime/openclaw/gateway_subscriptions.go`，**复用** MVP 的 `Realtime.SubscribeSession`/`UnsubscribeSession` 协议层入口（发送 `sessions.subscribe` + `sessions.messages.subscribe(key)`），但**事件分发不复用 `events.Bus.Subscribe`**——见下文及 D14b。

**事件分发架构**（v3 修订 — 三层独立背压）：

> Codex R4 指出原"单一 dispatch worker 阻塞 typed channel"设计有死锁风险（一个慢 subscriber 卡住 worker → 所有其他 subscriber 停）；且 `chan<- typedEvent` 在 Go 中无法接收 `chan generated.SessionsChangedEventPayload`（chan 不协变）。本节按以下三层架构重新设计：

1. **`Realtime` 内部 API**：`RegisterEventChannel(eventName string, sessionKey string, ch chan json.RawMessage) (unregister func())` —— 注册的是 raw `json.RawMessage` chan（消除 chan covariance 问题；typed decode 在 subscription layer 自行处理）；chan 用 bidirectional 而非 send-only：dispatch worker 在 raw chan 满时需要从 chan 弹出旧元素以 drop oldest
2. **第 1 层**：`Realtime.readLoop` 在 `case "event":` 分支：(a) 仍 `bus.Publish` 给现有非 typed subscribers（监控/审计兼容）+ (b) **非阻塞** push event 到一个独立的 `dispatchQueue chan dispatchItem`（buffered，默认 256）；dispatchQueue 满 → drop 最旧 + emit `gateway_event_dispatch_overflow_total` metric。**readLoop 永不阻塞**。
3. **第 2 层**：单一 dispatch worker goroutine 从 dispatchQueue 取 event → 查 `RegisterEventChannel` 注册表 → 对每个匹配的 subscriber，**非阻塞** push 到该 subscriber 的 `raw chan json.RawMessage`（buffer = 64）；raw chan 满 → drop 最旧 给该 subscriber + emit `gateway_event_subscriber_overflow_total{subscriber_id=...}` metric。**dispatch worker 永不阻塞**——一个慢 subscriber 不影响其他。
4. **第 3 层**：subscription typed layer 为每个 subscriber 起一个独立 reader goroutine：从该 subscriber 的 raw chan 读 → `json.Unmarshal` 为 typed `generated.SessionsChangedEventPayload` 等 → push 到 typed channel；typed channel 满 → reader goroutine 阻塞（**只阻塞自己**，不影响 dispatch worker、其他 subscriber、readLoop、RPC）。

**关键不变量**：

- readLoop 永不阻塞 → RPC `case "res":` 分支始终可投递（含 unsubscribe RPC 自身的 response）→ ctx cancel 触发的 unsubscribe RPC 必能完成
- dispatch worker 永不阻塞 → 一个 subscriber 慢只影响自己 raw chan + reader goroutine
- 单 subscriber 慢 → 仅其自己的 reader goroutine 阻塞 + raw chan drop + metric；其他 subscriber、其他 typed channel、RPC 都不受影响
- 选择 "快速 drop + observable metric" 而非"无限缓存"——避免内存爆炸；caller 必须及时消费 typed channel；缺事件由 metric 告警

**ctx cancel / 关闭语义**：

- ctx cancel 时：(a) `unregister()` 移除 raw chan 注册；(b) **用独立 fresh ctx** `context.WithTimeout(context.Background(), 1*time.Second)` 按引用计数发送 `sessions.messages.unsubscribe(key)` / `sessions.unsubscribe` RPC——**禁止复用 caller 已取消的 ctx**，否则 `ensureConnected(ctx)` 立即 return `ctx.Err()`，unsubscribe RPC 永不发出，server 端订阅 leak；(c) server 响应或 fresh ctx 超时后关 raw chan → reader goroutine 退出 → close typed channel
- 双层引用计数：(1) `sessionMessagesRefCount[sessionKey]` 控制 `sessions.messages.unsubscribe(key)` 发送时机；(2) `sessionsLifecycleRefCount` 控制 `sessions.unsubscribe` 发送时机。任何会发送或依赖 `sessions.subscribe` 的 API 都必须增加 lifecycle refcount：`SubscribeSessions` 增加 lifecycle；`SubscribeMessages(key)` 若复用当前 all-in-one `Realtime.SubscribeSession(ctx, key)`，也必须增加 lifecycle + per-key 两层计数；实现可拆出 `EnsureSessionsSubscribed` / `SubscribeSessionMessages` 低层 helper 来避免误计数。
- 显式 cancel 函数等价

**Implementation 细节**：

- 默认 typed channel buffer = 64；提供 `WithBufferSize(n)` option（仅控制 typed channel 大小）
- raw chan buffer = 64（独立于 typed buffer）
- dispatchQueue buffer = 256（readLoop → dispatch worker 之间），env `GATEWAY_EVENT_DISPATCH_QUEUE_SIZE` 可调
- 引用计数：`Realtime` 维护 `sessionMessagesRefCount map[sessionKey]int` 与 `sessionsLifecycleRefCount int`，分别控制 `sessions.messages.unsubscribe(key)` 与 `sessions.unsubscribe`；不得再使用单一 `sessionRefCount` 同时表达两种订阅生命周期
- spec 必须含场景：N 并发订阅 + ctx cancel + 显式 cancel + Realtime 重连后续订对 caller 透明 + 慢 caller 仅影响自身（其他 subscriber + RPC 正常）+ raw chan 满 drop + dispatch queue 满 drop + goleak 验证 8 个场景

### D5: FE 现有 BFF endpoint 处理策略（仅 Gateway RPC proxy 类迁 typed；本地 control-plane 保留）

**Context**: `deck-go/frontend/src/api.ts`（3660 行）中现有约 50+ 字符串 endpoint，混合了 deck-go Go 后端自己的 control-plane REST、二进制/SSE/上传路径，以及一部分可能只是 BFF 转发到上游 Gateway typed methods 的 proxy 路径：

- 本地配置：`/settings`、`/settings/test-connection`、`/settings/version`
- 设备管理：`/devices`、`/devices/self`、`/devices/approve`、`/devices/reject`、`/devices/remove`、`/devices/token/{rotate,revoke}`
- 启动/运行时：`/bootstrap/status`、`/runtime/gateway`、`/runtime/gateway/{start,stop,restart}`、`/config/schema-lookup`
- 渠道：`/channels`、`/channels/*`
- 审批：`/approvals/policy`、`/approvals/pending`、`/approvals`、`/approvals/plugins`
- 易混技能/插件：`/skills/install`、`/skills/hub`、`/deck/plugins`（PR-17 必须逐项判定是否为 Gateway RPC proxy）
- 易混模型：`/runtimes/{id}/models/{configured,auth,catalog-providers,probe}`（PR-17 必须逐项判定是否为 Gateway RPC proxy）
- 二进制/SSE/上传：`/download/*`、`/sse/*`、`/upload/*`、`/health`

因此不能按路径形态一次性删除或保留：PR-17 必须以 handler 行为为准分类，只有 Category=`gateway-rpc-proxy` 的 endpoint 迁 typed client；Category=`deck-go-bff` 与 Category=`binary-stream-upload` 继续保留 BFF REST 契约。

**选项**:

- A. 一次性删全部 `fetch('/api/...')`（**误删 control-plane endpoint，破坏功能**）
- B. 保留白名单 = 二进制/SSE/上传/健康检查（v1 提案 D5 老选项；同样会误删 control-plane）
- C. **分类白名单**：把 `api.ts` 中所有 endpoint 显式分两类：(1) Gateway RPC proxy 类（应迁 typed `createGatewayClient`）；(2) deck-go 本地 control-plane 类（保留 BFF）
- D. 暂不迁 FE，proposal 2 只做 Go 端

**Decision**: C。本提案 PR-17 输出 `deck-go/docs/fe-endpoint-classification.md` 显式列出 api.ts 全部 endpoint 的分类，仅"(1) Gateway RPC proxy 类"迁 typed client；"(2) deck-go 本地 control-plane 类"保留为 BFF REST 契约（与 deck-go Go handler 对应）。

**Rationale**:

- A/B 误删本地 endpoint，破坏 Settings/Devices/Channels/Approvals/Skills 等核心功能
- D 让 FE 永远走 REST 字符串端点，违背"deck-go 等价 dashboard"目标
- C 保持 deck-go BFF 自治权（control-plane）+ Gateway 协议对齐（数据 plane）

**Implementation**:

- PR-17 第一个 task：审计 api.ts 全部 endpoint，输出 `fe-endpoint-classification.md` 表格 `Path | Category | 迁移目标 | 说明`
- 仅 Category=`gateway-rpc-proxy` 的 endpoint 替换为 typed client 调用并删除对应 BFF 路由
- Category=`deck-go-bff` 的 endpoint 保留，无任何改动（D11/D12 等 Go 端约束不影响这部分）
- `make gateway-typecheck` 在 FE 端**仅**对 Category=`gateway-rpc-proxy` 的字符串调用做未豁免阻塞（依据 classification 文件）

**初步分类预估**（PR-17 实际执行时精确）：

- 多数 `/runtimes/{id}/models/*`、`/skills/install`、`/skills/hub`、`/deck/plugins` 可能是 gateway-rpc-proxy（属于 `models.*` / `skills.*` / `deck.plugins.list`）
- `/settings`、`/devices/*`、`/bootstrap/status`、`/runtime/gateway/*`、`/channels`、`/approvals/*` 极可能是 deck-go-bff（无对应 Gateway method）
- `/download/*`、`/sse/*`、`/upload/*`、`/health` 是天然 deck-go-bff（二进制/流/健康检查不走 RPC）

### D6: Error envelope 解析层位置

**Context**: MVP `Realtime.doRequest` 在 envelope `error` 时返回：

```go
ch <- responseResult{err: fmt.Errorf("%s: %s", fr.Error.Code, fr.Error.Message)}
```

这是普通 error，caller 拿不到 typed `code` / `details` 字段。

**Decision**: B。transport 层（`Realtime.doRequest` 与 `RequestDirect`）统一把 envelope `error` 转 `*gateway.ErrCode{Code, Message, Details}` + 哨兵 `gateway.ErrScopeDenied`（当 `Code == "scope_denied"` 时）。

**Implementation**:

- 新建 `deck-go/backend/internal/gateway/errors.go` 定义：
  ```go
  type ErrCode struct { Code, Message string; Details map[string]any }
  func (e *ErrCode) Error() string { return e.Code + ": " + e.Message }
  var ErrScopeDenied = &ErrCode{Code: "scope_denied"}
  func (e *ErrCode) Is(target error) bool { /* match by Code 字段 */ }
  ```
- `frame.Error` 扩展含 `Details map[string]any`（当前 `responseError` 只有 `Code` + `Message`）；需要协议层确认 server 端是否在 envelope 中输出 details 字段——若缺失，`Details` 为 nil 不影响 caller 用 `errors.Is`
- `Realtime.doRequest` 与 `RequestDirect` 都改用 `errors.go::FromEnvelope(fr.Error)` 构造 typed error
- 向后兼容：`ErrCode.Error()` 输出格式与 MVP `fmt.Errorf("%s: %s", code, message)` **完全一致**，现有依赖 `err.Error()` 字符串的 caller/UI 不丢

### D7: Coverage gate 失败语义

**Decision**: A，但提供 `gateway-coverage: regress allowed reason: <文字>` 行级豁免（commit message 或 PR description 任一处）。

**Implementation**:

- `make gateway-coverage-report` 输出 JSON `{upstream_typed: N, deck_go_go_migrated: M, deck_go_fe_migrated: K, fork_divergent: F}`
- CI 与 main baseline 对比，任一指标下降 → fail
- `upstream_typed` 增加（rebase 引入新 typed method）不视为 `deck_go_go_migrated` 的倒退；只比对绝对数字
- fork_divergent method 不计入分母

### D8: scope 错误处理位置

**Decision**: A。typed binding 返回 `ErrScopeDenied`，handler 自行决定 HTTP 响应（403 / 401 / silent fallback / partial）。

**Rationale**:

- handler 知业务上下文；transport 层全局拦截会粗暴跳转登录破坏 UX
- 与 dashboard 行为对齐

### D9: `healthProbeClients` evict 策略

**Context**: MVP `client.go:27` `healthProbeClients sync.Map` 永不清理。token rotate 后旧 entry 持续占用 readLoop goroutine + 周期性 dial 失败重连。MVP R2 标记为 P3 follow-up。

**选项**:

- A. 失败计数：连续 N 次（如 5 次）`ProbeHealth` 失败 → evict + `Realtime.Close()`
- B. 显式 `InvalidateProbeClient(URL, token)` API：caller 在 token rotate 时主动调用
- C. LRU + TTL：最少使用 / 超时未访问的 entry 自动 evict
- D. A + B 双轨

**Decision**: D（A 兜底防泄漏 + B 显式 API 给已知 token rotate 路径）。

**Rationale**:

- MVP 范围 `ProbeHealth` 调用方就 transport probe 一处，A 单独可解；但 token rotate 路径已知（device.token.rotate），B 让 caller 显式触发更优雅
- C 需要时间戳 + 后台清理 goroutine，复杂度过大且收益边际
- N 默认 5；`Realtime.Close()` 会 cancel pending + 关 conn + 终止重连循环（MVP 已有）

### D10: `generated.Client` 改名 `generated.TypedClient`

**Context**: MVP `generated/methods.go:216-222` 暴露 `Client` + `NewClient(requester)`，与 `gateway.Client` 命名冲突。本提案是 caller 全面接入的窗口，**改名最低成本时刻**——之后再改要触动所有 caller。

**Decision**: 改 `Client` → `TypedClient`，`NewClient(requester)` → `NewTypedClient(requester)`，作为本提案 PR-1（全部 caller 接入前唯一 PR）。

**Rationale**:

- 命名冲突会让 caller `import` 时必须用 alias（如 `import gateway_typed "...gateway/generated"`），降低可读性
- `TypedClient` 语义比 `Client` 更精确（与 `gateway.Client` 区分：前者是 typed wrapper，后者是 transport 层入口）

### D11: `encodeParams` 优化路径

**Context**: MVP `protocol-gen-go.ts:267-277` 生成的 `encodeParams` 每次 typed call 做：

```go
raw, _ := json.Marshal(params)        // typed struct → JSON
result := map[string]any{}
json.Unmarshal(raw, &result)          // JSON → map[string]any
// → c.requester.Request(ctx, method, result) → 内部再 marshal 进 wire
```

两跳 marshal，每 RPC ~10–50µs 边际开销。

**选项**:

- A. 让 `Requester.Request` 接收 `any`（不再 `map[string]any`），transport 层一次 marshal
- B. 引入 `RequestTyped(ctx, method string, params any) (any, error)` 二口径，`Requester` interface 向后兼容
- C. 用 `mapstructure` 替代 `json.Unmarshal` 做 struct → map 转换（仍两跳，但避免 JSON 解析开销）

**Decision 修订**（v1 选 A 与"保留 `gateway.Client.Request(map)` 公开签名"自相矛盾——`generated.Requester` 改 any 后 `gateway.Client` 不再满足该接口，编译失败）：**改选 B（二口径）**。

具体方案：

- `gateway.Client.Request(ctx, method, params map[string]any)` **保持不变**（外部 caller 兼容）
- 在 `gateway` 包新增 `RequestTyped(ctx context.Context, method string, params any) (any, error)` 方法到 `*Client` 与 `*Realtime`，签名独立
- `generated.Requester` interface 改为含 `RequestTyped(ctx, method string, params any) (any, error)` 而非 `Request(ctx, method, params map[string]any)`
- `gateway.Client` 与 `gateway.Realtime` 同时实现两个方法，互不冲突
- generated typed call 走 `RequestTyped`（一次 marshal）；`gateway_queries.go` 116 wrapper 走原 `Request(map)` 路径不变（迁移期一致性）
- `gateway_queries.go` wrapper 在迁移到 typed 薄壳后内部调 `generated.NewTypedClient(c).Method(ctx, params)`，间接走 `RequestTyped`

**Rationale**:

- A（统一 any）会让 `gateway.Client.Request(map)` 无法保留兼容签名（接口契约破坏）；外部已有调用方需要广泛改动
- C（mapstructure）治标不治本
- **B（二口径）**：`Request(map)` 保留外部兼容；`RequestTyped(any)` 给 generated 用；mock test 同时实现两接口
- 性能收益：generated 路径少 1 次 marshal/unmarshal；wrapper 走 map 路径与 MVP 一致（无回退）
- 长期看 wrapper 全部薄壳化后，`Request(map)` 调用路径会萎缩，可在提案 3 删除——本提案不删

**实施约束**：

- `frame.Params` 字段类型改为 `any`（兼容 map 与 typed struct，序列化无差异）
- 端到端测试必须覆盖：(1) 通过 `Request(map)` 发送、(2) 通过 `RequestTyped(typedStruct)` 发送、(3) 含 nil/嵌套/slice/enum 5 种 typed payload 形态
- mock `Requester` 需实现两方法，本提案 PR-3 提供 `gateway.MockRequester` 实现兜底（caller 自定义 mock 也按此接口）

**Risk**: `frame.Params` 字段类型 `map[string]any` → `any` 影响 readLoop 反序列化与服务端 envelope 兼容性，PR-3 必须含 transport 端到端测试。

### D12: 8 个 allowlist 但非 typed 方法的处理

**Context**: deck-go 已包了 **8** 个 method（`commands.list` / `exec.approval.list` / `logs.tail` / `node.invoke` / `node.pending.enqueue` / `plugin.approval.list` / `tools.catalog` / `tools.effective`），它们在上游 allowlist 中但**无 schema**（不在 typed 集合）。`generated.TypedClient` 不会生成对应函数。

**选项**:

- A. 推动上游补 schema（提案 3 范围）；本提案对它们走 `// gateway:allow-untyped reason: upstream missing schema, tracked` 行级豁免
- B. 在 deck-go 本地补一份 schema（与上游 drift 风险）
- C. 删除这些 wrapper（破坏现有 caller）

**Decision**: A。

**Rationale**:

- B 与"deck-go 不修改上游"原则冲突，且 drift check 会被本地 schema 干扰
- C 范围超出本提案
- A 让 wrapper 保留 + caller 显式豁免 + tracking issue 跟踪上游补 schema

**Implementation**:

- 这 8 个 wrapper 保留 `any` 返回；wrapper 内部 `requester.Request(ctx, "<method>", params)` 加 `// gateway:allow-untyped reason: upstream missing schema for <method>, tracked at <tracking-issue>` 同行注释
- coverage 报告分母 `upstream_typed` 不含这 8 个；豁免清单输出到 `docs/gateway-untyped-exceptions.md`

### D14: Go 端 event codegen 扩展（typed subscription 的前置依赖）

**Context**: Codex review 发现 D4 typed subscription channel 假设 `generated.SessionsChangedEventPayload` / `generated.SessionMessageEventPayload` 等 typed event payload 类型存在，但 MVP `protocol-gen-go.ts` **只生成 typed methods 的 Params/Result**，没有生成 event payload 类型。TS 端 `protocol-gen-ts.ts` 已有 `GatewayEventPayloadMap`，Go 端没有等价物。

**选项**:

- A. 扩展 `protocol-gen-go.ts` 生成 `type SessionsChangedEventPayload struct {...}` 等 typed event payload 结构（与 TS `GatewayEventPayloadMap` 命名对称：`{PascalEventName}EventPayload`）
- B. 弱化 spec：typed channel 改用 `<-chan json.RawMessage` 或 `<-chan map[string]any`，caller 自己解析（弱 typed）
- C. 只为 Phase 3 实际用到的 event 手写 typed struct（不走 codegen）

**Decision**: A。在 Phase 0 中新增 PR-2.5：扩展 `protocol-gen-go.ts` 生成 event types，与 TS 输出对称；该 PR 必须先于 PR-14 land。

**Rationale**:

- B 让 Go 端 typed binding 链路在订阅维度断裂，违背"等价 dashboard"目标
- C 难以维护、跟随上游 schema 演进会漏
- A 一次性建立 codegen → 后续 event 增删 0 维护成本；Phase 0 早做避免 PR-14 阻塞

**Implementation**:

- `protocol-gen-go.ts` 新增循环遍历 `eventDefs`（已 import），生成 `type {PascalEventName}EventPayload struct {...}` 与 `var GatewayEventPayloadMap = map[string]reflect.Type{...}` 注册表（命名与 TS `dashboard/src/types/gateway-protocol.generated.ts:3871,4119` 对称：`SessionMessageEventPayload` / `SessionsChangedEventPayload` 等）
- 文件命名：`generated/events.go`（与 `methods.go` 平行；保持 <2000 行约束）
- 单测：上游 fixture 含至少 1 个有 payload 的 event，断言生成的 Go 类型字段与 TS 等价
- 与 D11 `Requester.RequestTyped` 解耦：event 不走 RequestTyped，由 Realtime readLoop → dispatchQueue → per-subscriber raw chan → reader goroutine `json.Unmarshal` 为 typed payload struct（详见 D4 三层背压架构）

**子 D14b**：实施细节已被 D4 v3"事件分发架构"段统一定义（三层独立背压：readLoop 非阻塞 → dispatchQueue → dispatch worker 非阻塞 → per-subscriber raw chan → reader goroutine `json.Unmarshal` → typed channel）。本子段保留作为决策追溯：

- **决策**：typed subscription **不走** `events.Bus.Publish` 路径——Bus 是 non-blocking drop，无 metric 不可观测，与"快速 drop + observable metric"目标不符
- **架构**：见 D4 v3，`RegisterEventChannel(eventName, sessionKey, ch chan json.RawMessage)` + 三层背压
- **Bus 保留**：readLoop `case "event":` 仍 `bus.Publish` 给现有非 typed subscribers（监控/审计兼容），但 typed subscription 完全独立路径

### D13: CI 接入 deck-go go test/build 守护

**Context**: MVP 时 CI 仅接入 `make protocol-check`（`.github/workflows/ci.yml:488`）；后端代码改动不被 CI 验证。

**Decision**: 本提案 PR-2（早期）单独加一个 PR 接入：

```yaml
- cd deck-go/backend && go vet ./...
- cd deck-go/backend && go build ./...
- cd deck-go/backend && go test -race ./internal/...
```

作为新 CI step 阻塞合并。

**Rationale**:

- MVP 阶段已确认本地全绿，先接入观察现状
- 暴露任何 CI 环境差异（如 GOCACHE/GOSUMDB 设置、时区敏感测试）
- 为后续 PR 提供守护

## Risks / Trade-offs

- **[caller 字段访问大面积 break] → Mitigation**: D1 按域分批；半自动化 `gofmt -r`；CI 加 `pnpm tsgo` + `go vet` 二次保护
- **[D11 `Requester.Request` 签名破坏] → Mitigation**: 本提案 PR-1 + PR-2 优先做 D10 改名 + D13 CI 接入；D11 在 PR-3 单独 land + 1 周观察期；transport 端到端测试覆盖
- **[D6 envelope `Details` 字段缺失] → Mitigation**: server 端若不输出 details，`Details` 为 nil 不影响 `errors.Is`；后续上游 PR 补输出（不阻塞本提案）
- **[D9 evict 策略选错] → Mitigation**: 默认 N=5（保守），暴露 `gateway.ProbeHealthFailureThreshold` env override；显式 `InvalidateProbeClient` 用于已知场景
- **[subscription channel goroutine 泄漏] → Mitigation**: `goleak.VerifyTestMain` 全场景；ctx cancel + 显式 cancel + Realtime.Close + 重连失败 + 多订阅并发 5 路径
- **[Error envelope 回归（错误信息丢失）] → Mitigation**: D6 保证 `ErrCode.Error()` 输出格式与 MVP 完全一致；新增 unit test 覆盖每个 wrapper 至少 1 个 error case
- **[validate=false 漏检 schema drift] → Mitigation**: 编译期 typed + `make protocol-check` byte-equal drift 守护；运行时 `WithValidate()` 推到提案 3（D3 修订）；MVP `make protocol-check` 已在 CI 阻塞
- **[coverage gate 误报] → Mitigation**: D7 行级豁免；fork-divergent 不计入分母；D12 8 个无 schema 方法显式豁免
- **[D10 改名引入 caller break] → Mitigation**: 本提案 PR-1 优先做且 caller 还未引入，无外部影响
- **[D11 优化引入 transport 兼容性破坏] → Mitigation**: PR-3 单独 land，含 5+ 个端到端测试覆盖典型 method（含含 nil/含 nested struct/含 slice/含 map）
- **[fork-divergence 算法收紧后真增量丢失] → Mitigation**: 算法改后人工 diff 验证至少 SSRF/Channel Event Filter/WeCom 仍出现在表中；保留旧算法作为对照

## Migration Plan（18 个主 PR + 1 个 PR-2.5 前置 PR，按依赖顺序）

**Phase 0 — MVP 收尾基础设施**

1. PR-1: `generated.Client` → `generated.TypedClient` 改名（D10）；caller 还未接入，零业务影响
2. PR-2: CI 接入 `cd deck-go/backend && go vet/build/test`（D13）；先观察一周再开始批量迁移
3. PR-2.5: `protocol-gen-go.ts` 扩展生成 typed event payload struct（D14）；先于 PR-14 land
4. PR-3: D11 v2 `Requester` 二口径——`*gateway.Client` 与 `*gateway.Realtime` 同时实现 `Request(ctx, method, params map[string]any)` 与 `RequestTyped(ctx, method, params any)`；`generated.Requester` 接口要求 `RequestTyped`；含 5+ 端到端测试覆盖两路径；单独 land 观察 1 周
5. PR-4: `gateway.errors` typed `*ErrCode` + `ErrScopeDenied` 哨兵 + `Realtime.doRequest` 接入（D6）；保证 `ErrCode.Error()` 格式与 MVP 一致；含 error path unit test
6. PR-5: `healthProbeClients` evict 策略（D9 失败计数 + 显式 invalidate）；含失败计数 evict test + token rotate evict test
7. PR-6: `fork-divergence-report.ts::diffTouchedMethods` 算法收紧；人工验证 SSRF/Channel Event Filter/WeCom 仍在表中

**Phase 1 — 低风险域 wrapper 迁移** 8. PR-7: `cron.*`（7 wrapper）+ `usage.*` + `sessions.usage.*`（5 wrapper）9. PR-8: `doctor.memory.*`（7 wrapper）+ `device.*`（6 wrapper）

**Phase 2 — 中等风险域 wrapper 迁移** 10. PR-9: `agents.*`（6 wrapper）+ `agent.identity.get` + `skills.*`（6 wrapper）11. PR-10: `config.*`（5 wrapper）+ `config.set` 缺失方法 + `channels.*`（2 wrapper）+ `tools.*`（2 wrapper，D12 豁免）12. PR-11: `deck.agents.*` + `deck.commands.*` + `deck.identity.*` + `deck.routing.*` + `deck.subagents.*` + `deck.threads.*` + `deck.plugins.*`（约 20 wrapper，分上下两个 PR 也可）

**Phase 3 — 高风险域 + 21 缺失方法** 13. PR-12: Approval 域 wrapper + 缺失方法（`exec.approval.list/resolve/get/set` wrapper 薄壳 + `exec.approval.request` / `exec.approval.waitDecision` / `exec.approvals.node.{get,set}` / `plugin.approval.request` 直接走 generated；`plugin.approval.list/resolve` wrapper 薄壳 + D12 豁免说明）14. PR-13: `sessions.*` 非订阅域（约 15 wrapper 含已存在的 `SessionsSteer`/`gateway_queries.go:442` + 仅 `sessions.compaction.get` 缺失方法；**`sessions.steer` v1 误标缺失，已修——deck-go 已包装**）15. PR-14: Subscription typed channel API（D4 三层背压）：`Realtime.RegisterEventChannel(name, key, ch chan json.RawMessage)` + dispatchQueue + dispatch worker + per-subscriber reader goroutine + typed channel `WithBufferSize` + 引用计数 unsubscribe + goleak 8 场景测试（含慢 caller 仅影响自身 / dispatch queue 满 drop / raw chan 满 drop / metrics 输出）16. PR-15: `chat.history` wrapper 迁 typed + `chat.send`/`chat.abort`/`agent.wait` 缺失方法17. PR-16: `wizard.{start,next,cancel,status}` + `talk.{config,mode,speak}` 缺失方法包圆

**Phase 4 — FE + Gate** 18. PR-17: FE Gateway RPC proxy 类 endpoint 切 typed client（D5 v2）：先做 endpoint 分类审计输出 `fe-endpoint-classification.md`；仅 Category=`gateway-rpc-proxy` 改走 typed client；Category=`deck-go-bff` 与 `binary-stream-upload` **保留**；BFF middleware 通过 caller-side transport wrapper 迁移；`GatewayError` discriminated union 接入 19. PR-18: `make gateway-typecheck` + `make gateway-coverage-report` 实现；CI 接入；写入 baseline；启用防倒退 gate；`docs/gateway-coverage.md` 与 `docs/gateway-untyped-exceptions.md` 写入

**回滚**：

- 每个 PR 独立 revert
- D6/D11 涉及 transport 层签名，revert 单 PR 不会破坏其他域（PR-3/PR-4 单独 land 观察期保证）
- D10 改名 PR-1 后无 caller 引入，revert 零影响

## Open Questions

1. dashboard 现有 `gatewayClient` 在 typed call 失败时是否触发全局错误 toast？deck-go FE 复制相同 UX？建议：复制（最小惊讶）。**待 PR-17 前确认**。
2. Subscription typed channel buffer 默认 64 是否合适？（dashboard RxJS 无界，Go 必须有界）建议 64 起步，PR-14 实施时跑 stress test 调整。**待 PR-14 实施时确认**。
3. D9 evict 失败计数 N=5 是否合适？建议保守起步 5，加 env override；后续观察 production 调整。**待 PR-5 实施时确认**。
4. ~~D11 `Requester.Request(any)` 是否在 mock 实现处需要类型断言守护？~~ **已决（D11 v2 二口径方案）**：mock 同时实现 `Request(map)` 与 `RequestTyped(any)`，本提案 PR-3 提供 `gateway.MockRequester` 兜底实现，caller 自定义 mock 按此扩展。
5. `make gateway-coverage-report` baseline 存 commit (`docs/gateway-coverage-baseline.json`) 还是 CI artifact？建议 commit + CI 上传 artifact 双轨。**待 PR-18 实施时确认**。
6. 8 个 allowlist 但非 typed 方法（D12）的 schema 何时上游补？是否本提案启动 8 个上游 issue 跟踪？建议本提案启动 issue + 推到提案 3 收尾。**已决——本提案启动 issue，不阻塞**。
7. ~~PR-3 之后是否删除 `gateway.Client.Request(map)` 公开签名？~~ **已决（D11 v2 二口径方案）**：保留 `Request(map)` 公开签名；新增 `RequestTyped(any)` 给 generated 用；二者不互斥。
8. `healthProbeClients` 是否需要在进程退出时 graceful Close 所有 entry？建议加 `gateway.ShutdownProbeClients()` 由 main 在退出时调。**待 PR-5 实施时确认**。

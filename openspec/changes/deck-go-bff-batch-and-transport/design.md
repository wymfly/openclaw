## Context

deck-go 现有运行时架构（`deck-go/docs/protocol-adaptation.md`）：浏览器 → HTTP POST `/api/v1/runtimes/{rt}/gateway/rpc` → BFF → 单条 ws 到 openclaw。子提案 `openclaw-gateway-batch-rpc-primitive`（commit `b7ddda9194`）已上线 `gateway.batch` 在 openclaw 端，但 BFF 没把它暴露给客户端边界——前端 N+1 HTTP POST、原生客户端没有 ws 通道选项，两个目标（性能 + 原生客户端）都被拖住。

本提案做两件协同的事：(a) 把 batch primitive 暴露到客户端边界；(b) 把 BFF 的客户端协议从 HTTP-only 升级为 transport-agnostic，让原生客户端可以走 ws frame-level pass-through。它们共享同一个底层动作（client-edge transport 设计），分两个提案会重复决策两次。

合并后 5 个 C3 light-view handler 用 batch + 新 transport 重构到 BFF，是这两个能力的"第一个 production consumer"，也是 fork-divergent 减员（34→29）的第一步。

## Goals / Non-Goals

**Goals**:

1. BFF 暴露 `gateway.batch` 给客户端：HTTP（`POST /api/v1/runtimes/{rt}/gateway/batch`）+ ws（通过 ws upgrade endpoint 内 `gateway.batch` frame）双通道
2. BFF 加 ws upgrade endpoint `/api/v1/runtimes/{rt}/gateway/ws`，让客户端可以选 ws frame-level transport
3. 5 个 C3 light-view handler 在 deck-go BFF 重构，输出与 openclaw 原 handler byte-equal
4. openclaw 端 5 个 fork handler 标 fork-scoped deprecation metadata（不删除）
5. 引入性能 baseline：C3 view P95 减半、ws RPC vs HTTP RPC、batch fan-out 8/16/32 的实际收益

**Non-Goals**:

- Realtime multi-runtime 路由（Q2.3，当前仍接受 `runtimeId == DefaultRuntimeID` 的硬编码）
- Go 侧 error 类型化（Q2.4）
- BFF wrapper 三层折叠（Q2.1，70+ `gateway_queries.go` wrapper 不动）
- codegen public-registry stable surface（Q2.5）
- 完整 OpenTelemetry trace（Q2.6）
- 原生客户端 SDK 实际实现（本提案只打地基，让 SDK 知道有哪些 endpoint 可用）
- 5 个 deprecated handler 的删除（`deck-go-fork-handler-removal` follow-up）

## Decisions

### D1: BFF batch endpoint 协议 — typed-RPC envelope（同 `/gateway/rpc` 风格）

```
POST /api/v1/runtimes/{rt}/gateway/batch
Body: { calls: [{id, method, params}], options?: { failFast?, timeoutMs? } }
Response (200): { results: [{id, ok, result?, error?}], requestId }
Response (4xx/5xx): { error: { code, message, details? }, requestId }
```

**客户端边界约束**：BFF batch endpoint 必须先按现有 `/gateway/rpc` 的 `generated.TypedMethodNames` allowlist 校验每个 sub-call method；未在 allowlist 内的 sub-call 按 per-entry error 返回，且不得转发到 openclaw。deck-go access token 当前是静态 BFF admin token，不携带 operator scope；本提案不引入 scoped deck-token，避免把 token/role 体系重构混入 transport 提案。

**为什么不直接把 `gateway.batch` 当成 `gateway/rpc` 里的一个 method**：那样客户端会写 `client.gateway.batch({calls: ...})` 而不是 `client.batch(...)`，typed client API 表面上多一层 namespace 嵌套；且 BFF 端 batch handler 与单 RPC 反代有不同语义（fail-fast、聚合错误），独立 endpoint 让 audit/log 区分更清晰。

**为什么不开 raw passthrough（client 直接发 ws frame）**：原生客户端可以走 ws upgrade（D2），不需要 HTTP raw passthrough；普通客户端需要 typed envelope 防滥用。

### D2: ws upgrade endpoint — connect 时一次 auth + frame-level pass-through

```
GET /api/v1/runtimes/{rt}/gateway/ws (upgrade)
Connect 校验：
  - Header: Authorization: Bearer <deck-token>（同 HTTP endpoint）
  - Query 兜底: ?token=<deck-token>（浏览器无法设 ws header 时）
  - runtimeId 校验同 HTTP endpoint
建立后：
  - 客户端发 ws frame {type:"req", id, method, params}
  - BFF 校验 method 属于 generated.TypedMethodNames allowlist 后透传到 openclaw（通过 Realtime.BridgeFrame，frame.id 用 BFF 加 prefix 防冲突）
  - openclaw 响应 {type:"res", id, ok, payload|error} → BFF 拆 prefix → 转回客户端
  - 事件 frame {type:"event", ...} 由 BFF 主动转发（订阅 ref count 同 HTTP/SSE 路径）
心跳：BFF 每 30s 发 ping 并重新校验连接 token 是否仍等于当前 deck-go access token；客户端 60s 内必须 pong，否则关闭
关闭：BFF 关闭时不会主动关 openclaw 单连接（多 client 共享）；客户端关闭则 BFF 减少 client-side ref count
```

**为什么不每帧 auth**：每帧带 token 增加 ~200 bytes overhead × 频率，且不带来安全增益（连接已建立后劫持已经是不同 threat model）。

**revocation 窗口**：connect-time auth 的可接受窗口是 bounded stale connection，而不是无限存活。access token 变更/撤销后，BFF 必须在下一次 heartbeat 校验发现并关闭该客户端连接；目标上界 30s，测试允许 60s 内关闭。关闭时使用合法 close code（例如 policy violation / app-defined 4001），不得发送 WebSocket 保留码 1006。

**为什么 BFF 不让客户端直连 openclaw 的 ws**：BFF 的核心价值是 multi-runtime 路由、auth 集中、event filtering、batchId audit correlation。直连绕过这些。

**为什么要 frame.id prefix**：BFF 持有的单 ws 共享给所有 client，frame.id 必须唯一；BFF 给 client frame.id 加 `c{clientId}-` prefix，转 openclaw 后再原样转回。

**备选拒绝**：每个 client 一条独立 ws 到 openclaw —— scaling 不可控（multi-runtime + multi-client = O(N×M) 连接），且对 openclaw 端 connect 资源压力大。

### D3: 客户端 typed `batch` 入口签名

```ts
// gateway-client.ts
client.batch<R extends BatchCallSpec[]>(
  calls: R,
  options?: { failFast?: boolean; timeoutMs?: number }
): Promise<{ [K in keyof R]: R[K] extends { method: infer M } ? GatewayMethodMap[M]['result'] | GatewayError : never }>
```

输入按数组顺序，输出按数组顺序的 union（success | error per slot）。这样 TS 类型检查能在编译期捕获 method/params 不匹配。

**为什么不用 builder 模式**（`client.batch().add(...).add(...).execute()`）：增加客户端代码量，且 Go 客户端不容易镜像。

### D4: C3 view 实现 — 在 BFF 用现有 typed wrapper 拼装，不引入新协议

5 个 view 复用 `gateway_queries.go` 现有 wrapper（不再写新的 typed call）：

```
deck.routing.list (BFF view)
  ├─ typed.Batch([
  │    {id: "1", method: "config.get"},          // routing 配置在 config 里
  │    {id: "2", method: "deck.subagents.list"},  // 关联 agent 信息
  │  ])
  └─ 业务侧组装：从 result[0] 抽 routing 字段 + 从 result[1] 关联 agent 名

deck.subagents.list (BFF view)
  ├─ typed.Batch([
  │    {id: "1", method: "agents.list"},
  │    {id: "2", method: "config.get"},
  │  ])
  └─ 过滤 + 投影出 subagent

(以此类推 lineage / identity.list / threads.list)
```

每个 view 是一个 Go 函数，签名和 openclaw 原 handler 完全一致：`func (v *View) RoutingList(ctx, params) (RoutingListResult, error)`。

**byte-equality 验证策略**：用 capture-replay 测试。在父提案上线前 capture 5 个 handler 的 N 个真实 fixture（params + response）；BFF view 实现后 replay 同 params，对比 JSON.stringify byte-by-byte。差异 > 0 即 fail。

**为什么不直接生成 view 代码**：5 个 view 业务投影各不相同（不是单纯 fan-out），手写更清晰；20-50 LOC × 5。

### D5: deprecation 标记机制 — method-defs metadata 字段

```ts
// src/gateway/server-methods/deck/routing.method-defs.ts
{
  "deck.routing.list": {
    params: ...,
    result: ...,
    scope: READ_SCOPE,
    forkClass: "C3",
    forkDeprecated: true,
    forkDeprecationReplacement: "deck-go-bff/views.RoutingList",
    forkDeprecationSince: "2026-05-01",
    forkDeprecationRemovalTarget: "2026-08-01",  // 一个 release 周期后
  }
}
```

**MethodDefinition 类型扩展**（`src/gateway/method-registry.ts`）加 4 个 optional 字段。

`gateway.describe` 输出 metadata 时透传这些字段，前端 UI 可以在调用 deprecated method 时打 console warning（可选，不在本提案范围）。

**openclaw handler 行为**：deprecated handler **继续工作**，不返回特殊错误，不打 warn 日志（避免干扰 production）。Removal 在另一提案。

### D6: 灰度切换 — feature flag 控制 BFF view vs 上游 fallback

```go
// deck-go/backend/internal/runtime/openclaw/views/registry.go
type ViewRegistry struct {
  enableC3BFF bool  // default: false in v1, true after baseline验证
}
func (r *ViewRegistry) RoutingList(ctx, params) (RoutingListResult, error) {
  if r.enableC3BFF {
    return r.bffRoutingList(ctx, params)  // 新实现
  }
  return r.upstreamRoutingList(ctx, params)  // 调 deck.routing.list 反代
}
```

env：`DECK_GO_BFF_VIEW_LAYER=1` 启用 BFF view。

**自动 fallback**：BFF view 抛 error 时记一条 audit warn，自动 fallback 到上游 handler。fallback metric 以 5 分钟窗口计算 `fallback_count / view_invocation_count`；连续两个窗口 > 5% 必须触发告警/阻断 flag 默认开启。测试/CI 通过 `DECK_GO_BFF_VIEW_FALLBACK=0` 关闭自动 fallback，让 BFF view 错误直接 fail，避免灰度兜底掩盖回归。

### D7: 性能 baseline 收集 — 复用现有 `make benchmark-rpc` + 加 P50/P95/P99

`deck-go/Makefile:benchmark-rpc` 现已存在（target 已注册），扩充：

```bash
# 测试矩阵：
# 1. 单 RPC 5 种方法（agents.list, config.get, sessions.list, models.list, models.catalog.providers）
# 2. C3 view 5 个 — 上游 fallback vs BFF view
# 3. batch fan-out 1/8/16/32（calls 同质 vs 混合）
# 4. transport：HTTP vs ws upgrade
# 输出：JSON {p50, p95, p99, throughput, errorRate} per cell
```

收集脚本：`deck-go/scripts/bench-rpc.go`（新文件），用 vegeta 或自定义 N goroutines × M iterations。

baseline 写 `deck-go/docs/perf-baseline.md`，PR 必须 attach baseline 数据 diff，回归 > 10% 阻塞合并。

## Risks / Trade-offs

**R1: ws upgrade 协议复杂度** → 必须有 reconnect、heartbeat、frame.id collision 防护。Mitigation: 复用 `internal/gateway/realtime.go` 的现有 reconnect 逻辑做参考；frame.id prefix 设计强制单元测试覆盖 collision 场景。

**R2: C3 view byte-equality 验证脆弱** → JSON 字段顺序在 Go encoding/json 是按 struct field 顺序，与 TS 顺序可能不一致。Mitigation: capture-replay 用 normalized JSON（按 key sort 后比较），但保留 raw 比较作为 second pass；任何 raw diff 都需要人工 review。

**R3: 灰度 fallback 隐藏 BFF view bug** → 自动 fallback 让 view 错误悄悄变为上游 handler 调用，bug 不显眼。Mitigation: fallback rate metric 必须暴露 + 阈值告警；`DECK_GO_BFF_VIEW_FALLBACK=0` test mode 关闭 fallback 让 e2e 直接 fail。

**R4: BFF batch endpoint 与 openclaw `gateway.batch` schema 漂移** → 客户端 typed `batch` 入口和 openclaw schema 必须同源。Mitigation: BFF endpoint 的 typed contract 直接复用 `dashboard/src/types/gateway-protocol.generated.ts:GatewayBatchParams`（即父提案 codegen 产物），任何字段偏离都会被 protocol-check gate 拦下。

**R5: ws upgrade 让 Realtime 单连接 SPOF 影响放大** → 现在前端断开连接是局部影响（HTTP request 各自独立），ws 后断开 = 所有 pending sub 都 fail。Mitigation: 客户端 SDK 必须实现 reconnect + replay 机制；BFF 端 client-side ref count 在 reconnect 后能恢复 sub 状态。

**R6: 性能 baseline 收集环境噪音** → dev 机器 NO_PROXY、CPU 频率、本地 gateway 进程 GC 都影响 latency。Mitigation: `deck-go/docs/perf-baseline.md` 记录环境元数据（OS、CPU、内存、Node/Go 版本、NO_PROXY 状态）；多次跑取 trimmed mean。

**R7: deprecation metadata 字段在父提案后又扩展 MethodDefinition** → 上游若也要加 deprecated 字段且语义不同会冲撞。Mitigation: 字段名带 deck-go/fork prefix（如 `forkDeprecated` 而非 `deprecated`）以减少与上游冲突的概率。或者更好：直接和上游协商，把 `deprecated` 作为 standard field 推回上游（separate upstream PR）。本提案先用 `forkDeprecated` 避免冲突，未来再正名。

## Migration Plan

按 7 个阶段顺序：

1. **Phase 0 — Pre-flight**: 在 enhanced 分支确认子提案 `b7ddda9194` 已合并，`gateway.batch` 工作正常；capture 5 个 C3 handler 的真实 response fixture（用现有 dev stack）。
2. **Phase 1 — BFF infrastructure**:
   - 加 `MethodDefinition.forkDeprecated*` 字段到 `src/gateway/method-registry.ts`
   - 加 `Realtime.BridgeFrame` API
   - 加 `GatewayTransportProvider` interface
3. **Phase 2 — BFF batch endpoint**:
   - `runtimes.go` 加 `/runtimes/{rt}/gateway/batch` POST handler
   - `managed_runtime.go` 加 `GatewayBatch` method
   - 单测：input bound、嵌套拒绝、subscription 拒绝、failFast
4. **Phase 3 — Frontend typed batch client**:
   - `gateway-client.ts` 加 `client.batch(...)` 入口
   - 类型推导测试（compile-time + runtime）
5. **Phase 4 — BFF ws upgrade endpoint**:
   - `runtimes.go` 加 `/runtimes/{rt}/gateway/ws` upgrade handler
   - frame.id prefix routing
   - reconnect / heartbeat / close 语义
   - 集成测：client A 发 RPC + client B 收 event 不互相干扰
6. **Phase 5 — C3 view migration (灰度)**:
   - 创建 `internal/runtime/openclaw/views/` package
   - 5 个 view 实现，每个都有 capture-replay 测试
   - feature flag `DECK_GO_BFF_VIEW_LAYER` 默认关
   - `deck.routing.list` 等 5 个 method-defs 加 `forkDeprecated: true`
7. **Phase 6 — Performance baseline + flag enable**:
   - `make benchmark-rpc` 扩充
   - 收集 baseline 数据写 `deck-go/docs/perf-baseline.md`
   - 验证 C3 view P95 ≤ 上游 fallback × 0.6（减少 ≥ 40%）
   - flag default 切 true
8. **Phase 7 — Documentation + announce**:
   - 更新 `deck-go/docs/protocol-adaptation.md` 反映新 transport
   - 更新 `deck-go/docs/gateway-coverage.md` 标记 5 个 view 为 BFF-owned
   - changelog 标 forkDeprecated handler

**Rollback strategy**: 任何阶段出问题，关 `DECK_GO_BFF_VIEW_LAYER` flag 立即回退；flag 关时所有 view 走 upstream fallback；endpoint 本身保留（无害）。

## Pre-Implementation Decision Log

这些问题必须在 Phase 0 冻结；若实施前有人改变答案，必须先更新 proposal/design/spec/tasks，再进入 Phase 1。

- **OQ1**: BFF batch endpoint 是否需要支持 `failFast` 之外的 partial success 控制（如 "至少 N 个成功才返回"）？当前决定：仅 `failFast`，与 openclaw `gateway.batch` 严格对仗。
- **OQ2**: ws upgrade 是否需要 multiplexing protocol（如 SCRAM、IETF QUIC stream）？当前决定：直接复用 openclaw frame 协议，不引入新 framing。
- **OQ3**: `forkDeprecated` 字段名是 fork-prefix 还是直接 `deprecated`（与上游协调推回）？当前决定：fork-prefix（`forkDeprecated`）减少冲突，未来 upstream PR 推 `deprecated` 后再 alias。
- **OQ4**: C3 view 灰度 fallback 是否打 warn 日志（除了 metric）？当前决定：打 warn 但节流（每 1 分钟最多 1 条），便于 ops 发现 but 不淹日志；CI/test mode 必须能关闭 fallback。
- **OQ5**: 性能 baseline 是否需要 CI 自动跑（每 PR 跑一次）？当前决定：本提案不强制 CI，但提供 `make benchmark-rpc` 让 reviewer 本地跑；CI 集成留后续。

## Why

deck-go 的核心使命是性能优化 + 为未来纯系统原生客户端打地基，但当前架构有两个直接拖后腿的问题：(1) 前端到 openclaw 经 BFF 反代时每次 RPC 多一次 HTTP 解码 + JSON 重新编码，且 N+1（一个 panel 要 3 个 RPC 仍发 3 次 HTTP POST），子提案 `openclaw-gateway-batch-rpc-primitive` 已上线 `gateway.batch` primitive 但 BFF 没把它暴露给客户端边界，价值未变现；(2) BFF 与客户端之间是 HTTP-only，未来桌面/移动原生客户端要么走同样多跳 HTTP（性能不可接受），要么各自实现 ws 直连 openclaw（绕过 BFF 的 auth/audit/multi-runtime 路由）。本提案把这两件事一次性做完——它们共享同一个底层动作（暴露 batch 到客户端边界 + transport 升级），分开做会重复设计 transport 协议两次。

## What Changes

- **Add BFF batch endpoint**: 新增 `POST /api/v1/runtimes/{rt}/gateway/batch`，body `{calls:[{id,method,params}]}`，BFF 内部用 `typed.Batch(ctx, ...)` 一次 ws frame 转发到 openclaw，应用 `gateway.batch` 1..32 sub-call 边界、嵌套拒绝、subscription 拒绝、failFast、byte-stable 排序等所有不变量，并继承现有 `/gateway/rpc` 的 typed method allowlist。
- **Add BFF WebSocket upgrade endpoint**: 新增 `/api/v1/runtimes/{rt}/gateway/ws`，frame-level pass-through 给 openclaw 的 ws frame 协议，让客户端可以选 ws 通道。auth 在 connect 一次校验，后续 heartbeat 周期只做 token liveness/revocation 校验（不是每帧带 token），减少每帧 overhead。原 `/api/v1/runtimes/{rt}/gateway/rpc` HTTP 端点保留，二者共存。
- **Frontend typed batch client**: `deck-go/frontend/src/lib/gateway-client.ts` 暴露 `client.batch(calls, options?)` 入口，consumer 一次能拼多 read RPC。
- **Migrate 5 C3 light-view handlers to deck-go BFF**: 重构 `deck.routing.list` / `deck.subagents.list` / `deck.subagents.lineage` / `deck.identity.list` / `deck.threads.list` 为 BFF view（用 batch 在 deck-go 内部组合 2-3 个 read RPC），与 openclaw 端原 handler 输出 byte-equal。
- **Deprecate 5 fork handlers** (NOT removing in this proposal): openclaw 端 5 个 fork handler 标 fork-scoped deprecation（schema/method-defs metadata 加 `forkDeprecated: true` 字段族），保留一个 release 周期作为 fallback；删除留下个 follow-up proposal。
- **Performance baselines**: 扩充 `make -C deck-go benchmark-rpc` 体系（现有 `deck-go/Makefile:benchmark-rpc` target），收集 P50/P95/P99 数据：(a) C3 view migration 前后对比；(b) ws vs HTTP RPC 延迟对比；(c) batch fan-out 8/16/32 calls 实际收益。
- **BREAKING (frontend internal)**: `createDeckGatewayClient` 的 typed client 增加 `batch` 入口；现有 6 处 `createDeckGatewayClient` 调用点（`api.ts:3016/3027/3039/3052/3086`）签名兼容，但类型扩展可能触发 strict TS 检查变化。

**Out of scope**:

- Realtime multi-runtime 路由（Q2.3，单独提案）
- Go 侧 error 类型化（Q2.4，单独提案）
- BFF wrapper 三层折叠（Q2.1，单独提案）
- codegen public-registry stable surface（Q2.5，单独提案）
- 完整 OpenTelemetry trace propagation（Q2.6，跨平台跨进程，单独提案）
- 原生客户端 SDK 实现本身（本提案只打地基）
- 5 个 fork handler 删除（follow-up proposal）

## Capabilities

### New Capabilities

- `deck-go-bff-batch-fanout`: BFF 暴露 `gateway.batch` 给客户端的端点契约（HTTP + ws 双通道）、bound 复用、错误隔离继承、frame.id ↔ batchId 关联规则。
- `deck-go-bff-ws-transport`: BFF ws upgrade endpoint 协议（握手、auth、frame-level pass-through、心跳、关闭语义、与 HTTP endpoint 的语义等价保证）。
- `deck-go-c3-view-layer`: 5 个 C3 light-view 在 deck-go BFF 内的实现契约（输入参数/输出 schema/与 openclaw 原 handler 的 byte-equality 不变量、batch 组合策略、灰度切换/feature flag 行为）。

### Modified Capabilities

- `gateway-communication`: 增加 5 个 deck handler 的 `forkDeprecated: true` metadata 标记规则；明确"BFF view layer 是 deck.\* 部分 read handler 的官方 successor"政策；明确典型客户端调用 batch primitive 应通过 BFF 而非直连。

## Impact

**新增/修改源代码区**:

- `deck-go/backend/internal/api/http/runtimes.go`: 新增 `/runtimes/{rt}/gateway/batch` POST handler 和 `/runtimes/{rt}/gateway/ws` upgrade handler；`GatewayRPCProvider` interface 扩为 `GatewayTransportProvider`（新加 `GatewayBatch` + `GatewayUpgradeWS` 两个方法）。
- `deck-go/backend/internal/runtime/openclaw/managed_runtime.go`: facade 加 `GatewayBatch(ctx, params) (...)`、`GatewayUpgradeWS(http.ResponseWriter, *http.Request) error` 两个方法。
- `deck-go/backend/internal/runtime/openclaw/views/` (新包): 5 个 C3 view 实现（`routing_list.go` / `subagents_list.go` / `subagents_lineage.go` / `identity_list.go` / `threads_list.go`），每个都用 `gateway_queries.go` 的现有 wrapper + `typed.Batch(...)` 拼装。
- `deck-go/backend/internal/gateway/realtime.go`: 增加 `BridgeFrame(ctx, frame []byte) ([]byte, error)` API，把外部 frame 透传到 openclaw 单 ws 连接（用于 ws upgrade pass-through）。
- `deck-go/frontend/src/lib/gateway-client.ts`: `createDeckGatewayClient` 加 `batch` 入口；可选 `useWebSocket: true` 走 ws 通道。
- `deck-go/frontend/src/lib/deck-ws-transport.ts` (新): ws 客户端，与 `deck-client.ts` 的 HTTP fallback 共享 token/runtime 配置。
- `deck-go/contracts/source/deck-api.contract.ts`: `DeckGoGatewayBatchRequest` / `Response` typed contract；5 个 C3 view 的 deck-api 镜像 type（与 openclaw 原 handler 输出兼容）。
- `deck-go/Makefile`: 扩充 `benchmark-rpc` target，加 P50/P95/P99 收集与对比。
- `src/gateway/server-methods/deck/{routing,subagents,identity,threads}-*.method-defs.ts`: 5 个 handler 加 `forkDeprecated: true`、`forkDeprecationReplacement: 'deck-go-bff/views.<Name>'` metadata。

**性能预期**（基于 Q2 分析，待 baseline 验证）:

- C3 view P95: 现 2-3 RPC × 30ms HTTP ≈ 60-90ms → batch 1 frame ≈ 30ms（预期减半）
- ws RPC 延迟: 比 HTTP RPC 减少一次 JSON 解码 + 路由 overhead，预期 5-10% 改善
- batch fan-out 32 calls: 单 ws frame 的延迟增量 << 32 次单独 RPC 的累积，预期 5-10× 加速

**依赖关系**:

- **REQUIRES**: 子提案 `openclaw-gateway-batch-rpc-primitive`（已合并，commit `b7ddda9194`）
- **REQUIRES**: 父提案 `openclaw-gateway-bff-architecture-refactor`（已合并，commit `9df05f3d8c`）
- **不阻塞**: 任何上游 main 同步流程；本提案的所有改动都在 fork-only 区域 + 可向后兼容 metadata

**风险**:

- ws upgrade auth + reconnect 比 HTTP 复杂，需要明确 connect 时 auth 校验 vs 每帧校验的语义
- deck-go 当前 access token 是静态 BFF admin token，不携带 operator scope；本提案不引入 scoped deck-token，客户端边界安全性依赖 BFF access token + typed method allowlist + openclaw dispatcher scope，不宣称 read-scoped deck-token 隔离
- 5 个 view 的 byte-equality 验证需要 capture-replay test，覆盖 schema 边界 case
- 客户端 typed `batch` 入口若与 openclaw `gateway.batch` schema 偏离，会拉低契约清晰度——必须严格按 typed client codegen 接入
- 性能 baseline 收集环境需稳定（NO_PROXY、本地 gateway 进程、消除 dev 噪音）

**Followup proposals**（明确出本范围）:

- `deck-go-fork-handler-removal`: 一个 release 周期后删除 5 个标 deprecated 的 fork handler
- `deck-go-streaming-batch-results`: 子提案 6.2 方向（仅当 baseline 显示批量被最慢 sub-call 主导）
- `deck-go-realtime-multi-runtime`: Q2.3 方向
- `deck-go-bff-trace-correlation`: Q2.6 方向

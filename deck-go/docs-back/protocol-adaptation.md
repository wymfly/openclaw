# deck-go ↔ openclaw 协议适配架构

> **状态**: 2026-04-30 实现现状（commit `b7ddda9194` 后）
> **范围**: 父提案 `openclaw-gateway-bff-architecture-refactor`（Phases 0–5）+ 子提案 `openclaw-gateway-batch-rpc-primitive` 落地后
> **互补文档**:
>
> - 目标架构愿景: `deck-go/docs/target-architecture.md`
> - 覆盖率与 deferred 清单: `deck-go/docs/gateway-coverage.md`
> - fork 差异: `deck-go/docs/fork-divergent-methods.md`
> - BFF 中间件迁移: `deck-go/docs/bff-middleware-migration.md`

---

## 1. 背景

deck-go 是 openclaw fork 内的并行 Go BFF + Vite/React 实验，目标替换原生 dashboard（Next.js）。当前实现按"openclaw schema → codegen → typed client → BFF 薄包装 → chi HTTP → frontend"七层串联，本文用两张图 + 七节文字把这条链路完整画清楚，方便后续维护者快速建立心智模型。

核心不变量：

- openclaw 端的 TypeBox schema 是契约**唯一源**
- deck-go 通过 codegen 把 schema 拉到 Go/TS 两端，**不手编 generated 文件**
- **前端不直连 openclaw**：typed RPC 默认走 HTTP POST 到 deck-go BFF 的 `/api/v1/runtimes/{rt}/gateway/rpc`，batch 走 `/api/v1/runtimes/{rt}/gateway/batch`，原生/实验客户端可选 `/api/v1/runtimes/{rt}/gateway/ws`；三者都由 BFF 持有的**单条** WebSocket 连接转发给 openclaw
- BFF 持有的这条 WS 复用所有 RPC，pending 路由按 frame id；事件转 `events.Bus` 推 SSE 给前端
- `gateway.batch` primitive 让 BFF 一次 frame 打包多 sub-call，每个 sub-call 仍走完整 dispatcher pipeline（auth/scope/control-plane budget），子调用互相隔离
- dispatcher 派发不通过 `GatewayRequestContext` 暴露 raw handlers map（plugin runtime scope 不可见）

---

## 1.1 Client-edge endpoints

| Endpoint                              | Transport | Auth                                                                      | Shape                                                                        |
| ------------------------------------- | --------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------- |
| `/api/v1/runtimes/{rt}/gateway/rpc`   | HTTP POST | `Authorization: Bearer` or `x-deck-token` via API middleware              | `{method, params, timeoutMs?}` → `{runtimeId, requestId, result}`            |
| `/api/v1/runtimes/{rt}/gateway/batch` | HTTP POST | same API middleware                                                       | `{calls:[{id,method,params}], options?}` → `{runtimeId, requestId, results}` |
| `/api/v1/runtimes/{rt}/gateway/ws`    | WebSocket | connect-time API middleware; browser fallback `?token=` only on this path | `{type:"req", id, method, params}` → `{type:"res", id, ok, payload           | error}` |

All three endpoints enforce `generated.TypedMethodNames` at the BFF edge before
forwarding client-supplied methods. `/gateway/batch` rejects nested
`gateway.batch` and subscription sub-calls per entry. `/gateway/ws` does not use
per-frame auth; it revalidates the original connect token during heartbeat and
closes rotated/revoked tokens with legal WebSocket close codes.

The deck-go frontend wrapper exposes `createDeckGatewayClient(...).batch(...)`
as the typed batch entry. The optional `DeckGatewayWebSocketTransport` is an
experimental native-client transport surface and is not the default web UI path.

`gateway.describe` now surfaces fork migration metadata for methods being moved
behind deck-go BFF views: `forkDeprecated`,
`forkDeprecationReplacement`, `forkDeprecationSince`, and
`forkDeprecationRemovalTarget`. These fields are metadata only and do not alter
openclaw handler execution.

---

## 2. 运行时架构（数据流）

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Browser                                                                          │
│                                                                                  │
│  Vite / React (deck-go/frontend/src)                                             │
│   ├─ api.ts                ◄── 类型从 contracts/generated/ts/deck-api.generated  │
│   ├─ lib/deck-client.ts    (deckFetch / deckStream)                              │
│   ├─ lib/gateway-client.ts (createDeckGatewayClient — typed RPC over HTTP，仍经 BFF 反代) │
│   └─ stores/* hooks/*                                                            │
└──────────┬───────────────────────────────────────────────────────────────────────┘
           │  HTTP REST + SSE (/api/...)
           ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ deck-go backend  (Go, chi router, cmd/deck-go/main.go → controld.NewHandler)     │
│                                                                                  │
│  internal/server/   ───── HTTP edge：路由 + JSON I/O + SSE                       │
│   ├─ server.go     /api/*  CORS + access middleware + writeJSON                  │
│   ├─ gateway.go    /api/gateway/{describe,health,status} /api/config/*           │
│   ├─ chat.go       /api/chat/*                                                   │
│   ├─ runtime.go    /api/runtime/*                                                │
│   ├─ inventory.go onboarding.go settings.go alerts.go budget.go ...              │
│   └─ ws/           WebSocket 反向推送给前端（基于 events.Bus）                   │
│                                                                                  │
│  internal/runtime/openclaw/  ──── BFF 编排层（"协议适配核心"）                   │
│   ├─ ManagedRuntime  ── 顶层 facade：store + bus + supervisor + adapter           │
│   ├─ Adapter         ── 把 Requester 装配出 5 个 service                          │
│   │    ├─ GatewayQueries        (gateway_queries.go, 70+ wrapper)                 │
│   │    ├─ SessionQueries / SessionCommands                                        │
│   │    ├─ CapabilitySummaryLoader / GatewayStatusLoader                           │
│   │    └─ SessionSubscriptions                                                    │
│   ├─ Supervisor      ── 可选：spawn / stop / restart 本地 openclaw 进程           │
│   ├─ ConnectionProbe / Preflight / ConfigSync                                     │
│   └─ Legacy* …       ── inventory/budget/admin/onboarding 旁路                    │
│         │                                                                         │
│         │  调用 q.typed.<Method>(ctx, params)                                     │
│         ▼                                                                         │
│  internal/gateway/generated/   ─── codegen 产物（不要手编）                       │
│   ├─ methods.go     158 个 TypedClient.<PascalName>(ctx, Params) → Result         │
│   ├─ types.go       GatewayBatchParams / AgentsListResult / ... 全部 Go struct    │
│   ├─ types_extra_2.go  (大文件分片续接)                                           │
│   ├─ events.go      事件名常量                                                    │
│   ├─ allowlist.go   methods + scopes 双 set                                       │
│   └─ doc.go                                                                       │
│         │                                                                         │
│         │  TypedClient { requester Requester } where Requester.RequestTyped()     │
│         ▼                                                                         │
│  internal/gateway/   ─── 单连接 WS 客户端 to openclaw                            │
│   ├─ client.go      Client (薄壳，委托 Realtime)                                  │
│   │                  · NewClient(provider) | NewClientWithRealtime(rt)            │
│   │                  · Client.RequestTyped → realtime.RequestTyped                │
│   ├─ realtime.go    Realtime：                                                    │
│   │                  · gorilla/websocket dial （singleflight 防并发）             │
│   │                  · pending map[reqId]chan response                            │
│   │                  · 指数退避 1s→30s 重连                                       │
│   │                  · pending request 在断线时上抛 ErrConnectionLost             │
│   │                  · 事件分发 → events.Bus → SSE 给前端                         │
│   │                  · session subscriptions ref count                            │
│   ├─ device_identity.go  current device id resolver                               │
│   ├─ errors.go      ErrConnectionLost                                             │
│   └─ mock_requester.go (测试用)                                                   │
└──────────┬───────────────────────────────────────────────────────────────────────┘
           │  WebSocket frame {type:"req"|"res"|"event", id, method, params, ...}
           │  protocol version = 3
           ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ openclaw gateway  (Node/TS, port 18789, src/gateway/...)                          │
│                                                                                  │
│  src/gateway/server-methods/server-methods.ts (thin wrapper)                     │
│        │                                                                         │
│        ▼                                                                         │
│  src/gateway/server-methods/dispatcher.ts                                        │
│   dispatchGatewayRequest({req, handlers, controlPlaneWriteMethods, ...})         │
│   ├─ authorizeGatewayMethod (role + scope)                                       │
│   ├─ unavailableGatewayMethods (启动期)                                          │
│   ├─ consumeControlPlaneWriteBudget (10-method 限流)                             │
│   └─ withPluginRuntimeGatewayRequestScope(invokeHandler)                         │
│         └─ handler({req, params, ..., dispatchSubRequest})                       │
│                                                                                  │
│   dispatchSubRequest 是闭包：捕获 private handlers map，                         │
│      重入 dispatchGatewayRequest，且不通过 GatewayRequestContext 暴露 handlers    │
│      （父子双提案的核心安全不变量）                                              │
│                                                                                  │
│  src/gateway/server-methods/*.ts  (37+ module + method-defs 文件)                │
│   ├─ agents.module.ts / .method-defs.ts                                          │
│   ├─ config.module.ts                                                            │
│   ├─ sessions.module.ts                                                          │
│   ├─ deck/*.module.ts            (deck.* 命名空间 11 个)                         │
│   └─ gateway-batch.module.ts     子提案：1..32 sub-call fan-out                  │
│                                    每个 sub-call 通过 dispatchSubRequest 重入    │
│                                    完整 dispatcher pipeline (auth/scope/budget)  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 代码结构与协议适配链路

```
                          ┌──────────────────────────────────────┐
                          │  openclaw (TS, source of truth)      │
                          └──────────────────────────────────────┘
                                            │
                                            │ TypeBox schema 是契约
                                            │
        src/gateway/protocol/schema/*.ts ◄──┴──► src/gateway/method-registry-data.ts
        ├─ gateway-batch.ts (子提案)             allKnownMethods[] (sorted, byte-stable)
        ├─ agents.ts / sessions.ts / ...
        └─ protocol-schemas-extensions.ts
                  │
                  │ 统一 schema map → TS type alias 派生
                  ▼
        src/gateway/protocol/index.ts
        ├─ 导出 GatewayBatchParams / Result 等 type
        ├─ AJV validator (validateGatewayBatchParams)
        └─ ErrorCodes / errorShape

                  │
                  │ 上游 codegen (官方)
                  ▼
        scripts/protocol-gen-ts.ts ─────► dashboard/src/types/gateway-*.generated.ts

══════════════════════════════════════════════════════════════════════════════════════

                          ┌──────────────────────────────────────┐
                          │  deck-go (Go BFF + Vite/React)       │
                          └──────────────────────────────────────┘

                            （openclaw 端 schema 通过 import 跨入 deck-go）
                                            │
                                            ▼
        deck-go/contracts/scripts/protocol-common.ts
        ├─ 引用 src/gateway/method-registry-data.ts 中的 methodDefs 等
        ├─ typedMethodNames[]    : 有 params 或 result 的 method 集合
        ├─ allowlistMethodNames[]: 含纯 scoped 的全集合
        └─ formatGo / sortedEntries (确定性排序)

                  │                                  │
                  │ make protocol-gen-go             │ make protocol-gen-ts
                  ▼                                  ▼
        protocol-gen-go.ts                  protocol-gen-ts.ts
        每个 typed method 一个 Go 函数      生成 deck-go 自己的 TS protocol/client
        (含 D3b 的 "Batch" 命名映射)
                  │                                  │
                  ▼                                  ▼
   deck-go/backend/internal/gateway/        deck-go/contracts/generated/ts/
   generated/                                 gateway/{protocol.ts, client.ts}
   ├─ methods.go      (TypedClient)
   ├─ types.go        (Go struct)
   ├─ types_extra_2.go
   ├─ events.go
   ├─ allowlist.go
   └─ doc.go
                  │
                  │ 业务薄包装层
                  ▼
   deck-go/backend/internal/runtime/openclaw/
   ├─ adapter.go            ── 装配 5 个 service
   ├─ managed_runtime.go    ── store + bus + supervisor + adapter
   ├─ supervisor.go         ── 可选托管 openclaw 进程
   ├─ gateway_queries.go    ── 70+ wrapper（业务命名 → typed call）
   ├─ session_queries.go / session_commands.go / session_subscriptions.go
   ├─ capability_summary.go / gateway_status.go
   ├─ connection_probe.go / preflight.go / config_sync.go
   └─ legacy_*.go           ── inventory/budget/admin 旁路
                  │
                  │ chi 路由暴露 HTTP/SSE
                  ▼
   deck-go/backend/internal/server/
   ├─ server.go             ── NewRootHandler + middleware
   ├─ gateway.go            ── /api/gateway/{describe,health,status}, /api/config/*
   ├─ chat.go / runtime.go / sessions.go / ...
   └─ ws/                   ── 内部 WS（可选）

                  │
                  │ HTTP/SSE
                  ▼
   deck-go/frontend/src/
   ├─ api.ts                ── HTTP 客户端
   ├─ lib/deck-client.ts    ── deckFetch + deckStream
   ├─ lib/gateway-client.ts ── typed RPC 客户端，transport 走 deckFetch
   │                            到 /api/v1/runtimes/{rt}/gateway/rpc，由 BFF 反代
   └─ types  ◄──── deck-go/contracts/generated/ts/deck-api.generated.ts

══════════════════════════════════════════════════════════════════════════════════════

                          ┌──────────────────────────────────────┐
                          │  治理 / drift 检测 / 覆盖率           │
                          └──────────────────────────────────────┘

   deck-go/contracts/scripts/
   ├─ protocol-parity-check.ts     drift 检测（CI gate; make protocol-check）
   ├─ protocol-codegen.test.ts     codegen 确定性测试（防 cache 抖动）
   ├─ fork-divergence-report.ts    与 upstream/main 比较 method 集合
   ├─ gateway-coverage-report.ts   "Deck Go 覆盖率"（migrated vs deferred）
   └─ gateway-typecheck.ts         快速类型 sanity

   Makefile targets:
   ├─ protocol-gen-ts / protocol-gen-go / protocol-update
   ├─ protocol-check / protocol-check-missing-test / protocol-check-drift-test
   ├─ fork-divergence-report / gateway-coverage-report
   ├─ check-allowlist-parity
   └─ verify (全套：contracts-check + host-check + backend-test + frontend-build)
```

---

## 4. 七层适配机制

下面把数据从上游 schema 流到 frontend 的每一层都落到 file:line 上。

### 4.1 契约源头：openclaw TypeBox schema

- `src/gateway/protocol/schema/*.ts` 是唯一真源（TypeBox `Type.Object(...)` + bounds）
- 子提案的 `src/gateway/protocol/schema/gateway-batch.ts` 新增 `GatewayBatchParamsSchema` / `GatewayBatchResultSchema`
- 经 `src/gateway/protocol/schema/protocol-schemas-extensions.ts` 注册 → 派生 `GatewayBatchParams` 类型 alias 与 AJV validator

### 4.2 注册到方法清单

- `src/gateway/method-registry-data.ts:202` 把 `gateway.batch` 排序进 `allKnownMethods`
- `src/gateway/method-scopes.ts:134` 标 `READ_SCOPE`
- `*.module.ts` + `*.method-defs.ts` 通过 `scripts/gen-method-modules.ts` 自动发现，写入 `_modules.generated.ts` / `_method-defs.generated.ts`

### 4.3 dispatcher 是协议入口

- `src/gateway/server-methods/dispatcher.ts:60` `dispatchGatewayRequest({...})`
- 顺序：role/scope 鉴权 → unavailable 检查 → control-plane budget → plugin scope wrapper → 调 handler
- 注入 `dispatchSubRequest` 闭包给 handler — 这是 batch primitive 复用 dispatcher 的唯一入口（不导出 raw handlers map，不污染 `GatewayRequestContext`）

### 4.4 deck-go 拉走 schema 做 Go codegen

- `deck-go/contracts/scripts/protocol-common.ts` **直接 import** openclaw 的 `methodDefs` / `typedMethodNames` / `allowlistMethodNames`（D2 决策）
- `deck-go/contracts/scripts/protocol-gen-go.ts:38-44` 把 `gateway.batch` 映射成 `Batch` 这个客户端方法名（D3b），其余按 PascalCase
- 输出确定性排序 + 双换行 — 保证 prompt-cache prefix 稳定（`CLAUDE.md` 强约束）

### 4.5 Go TypedClient

- `deck-go/backend/internal/gateway/generated/methods.go` 158 个方法，每个长这样：

  ```go
  func (c *TypedClient) AgentsList(ctx context.Context, params AgentsListParams) (AgentsListResult, error) {
      payload, err := c.requester.RequestTyped(ctx, "agents.list", params)
      if err != nil { return result, err }
      return decodeResult[AgentsListResult](payload)
  }
  ```

- `Requester` 接口只有 `RequestTyped(ctx, method, params) (any, error)` — 解耦到底层连接

### 4.6 单连接 WS：Realtime

- `deck-go/backend/internal/gateway/realtime.go` 是真正的 gorilla/websocket 客户端
- `Client.RequestTyped` (`client.go:103`) → `Realtime.RequestTyped` (`realtime.go:270`)
- pending map 按 frame id 路由响应；事件转 `events.Bus` 推 SSE 给前端
- 指数退避 1s→30s 重连；断线时把所有 pending 都用 `ErrConnectionLost` 上抛
- `singleflight` 保护并发 dial

### 4.7 BFF 业务薄包装 → HTTP

- `deck-go/backend/internal/runtime/openclaw/gateway_queries.go` 把 typed call 包成业务命名（`Describe(ctx, true)` → `typed.GatewayDescribe(...)`）
- `deck-go/backend/internal/runtime/openclaw/managed_runtime.go` 是大 facade，提供 `BootstrapStatus` / `ListAgents` / `PatchConfig` / `...` 给 HTTP 层
- `deck-go/backend/internal/server/gateway.go` 等 chi handler 拿 `ManagedRuntimeSurface` 的方法 → `writeJSON` 给前端

---

## 5. 子提案 `gateway.batch` 在链路里的位置

```
frontend        deck-go BFF                deck-go gateway client       openclaw gateway
   │           ManagedRuntime
   │           ├─ 一个 HTTP route 需要      typed.Batch(ctx, params)         dispatcher
   │           │  agents.list +             ├─ 1 frame                       └─ gateway-batch handler
   │           │  config.get +              │  {type:"req",                      ├─ 校验 1..32 / 拒嵌套 / 拒 sub
   │           │  sessions.list             │   method:"gateway.batch",          ├─ for each call:
   │  ◄─── ✓   │  以前要 3 round-trip       │   params:{calls:[...]}}            │     dispatchSubRequest({...})
   │           │                            │  ─────────────────►                │       └─ 重入 dispatcher
   │           ├─ 现在用 typed.Batch        │                                    │           完整 auth/scope/budget
   │           │  一次 WS frame             │                                    │           handler 实际执行
   │           └─ 拿到 results 数组         │  ◄─────────────────                ├─ failFast / collect
   │              （input 顺序）            │  {type:"res", payload:{           └─ respond(true, {results})
   │                                        │   results:[{id,ok,result|error}]}}
```

下一步如果要让 deck-go 真的用上 batch，得在 `runtime/openclaw/` 加一个 `BatchedReadComposer`，或者直接在某个 chi handler 里调 `typed.Batch(...)` — 这是 子提案 proposal.md "Out of scope" 列出的"另一个提案"（C3 light-view handler 迁移到 deck-go）。

子提案保证了下面这些不变量：

- 1..32 sub-call 边界（schema enforced）
- 嵌套 `gateway.batch` 拒绝（`INVALID_REQUEST`）
- subscription 方法（`*.subscribe` / `*.unsubscribe`）拒绝
- 结果按输入顺序返回（byte-stable，prompt-cache 安全）
- `failFast` 可选；非事务（later 失败不回滚 earlier mutation）
- `options.timeoutMs` v1 reserved/no-op（schema 已标记）
- 每个 sub-call 独立通过 dispatcher 完整 pipeline：rule、scope、startup-unavailable、control-plane budget
- handler throw 隔离：sub-call handler 抛异常时单独转 `UNAVAILABLE`，不丢整个 batch 响应
- audit `batchId` correlation：同一 batch 的 N 条 audit 日志带统一 `batch=<frame.id>` 字段

---

## 6. 治理与 drift 检测

| 工具                                | 作用                                                           | 触发命令                                                       |
| ----------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| `protocol-parity-check.ts`          | 检查生成产物与 source 一致（drift gate）                       | `make -C deck-go protocol-check`                               |
| `protocol-codegen.test.ts`          | codegen 输出确定性测试（cache 稳定）                           | `pnpm test deck-go/contracts/scripts/protocol-codegen.test.ts` |
| `fork-divergence-report.ts`         | 与 `upstream/main` 比较 method 集合                            | `make -C deck-go fork-divergence-report`                       |
| `gateway-coverage-report.ts`        | deck-go 覆盖率（migrated / deferred）                          | `make -C deck-go gateway-coverage-report`                      |
| `gateway-typecheck.ts`              | Go binding 类型 sanity                                         | `make -C deck-go gateway-typecheck`                            |
| `check-deck-api-generated.mjs`      | deck 自有 contract 校验                                        | `make -C deck-go contracts-check`                              |
| `scripts/diff-describe-baseline.ts` | openclaw 端 `gateway.describe` 基线 diff（pre/post-migration） | `node scripts/diff-describe-baseline.ts`                       |

`make verify` 在一次命令里跑完 contracts-check + host-check + backend-test + frontend-build，是 PR landing 前的标准 gate。

---

## 7. 后续扩展

- **C3 light-view handler 迁移到 deck-go**：上游 `deck.routing.list` / `deck.subagents.list` / `deck.subagents.lineage` / `deck.identity.list` / `deck.threads.list` 5 个 handler 是子提案 6.1 列出的下一阶段目标，预计组合 2–3 个 read RPC 用 `typed.Batch(...)` 实现
- **streaming variant**：如果 metrics 显示 batch 延迟被最慢 sub-call 主导，考虑流式 sub-call 结果（子提案 6.2）
- **per-sub-call timeout**：当前 `options.timeoutMs` 是 wire-reserved，子提案 6.3 跟踪未来真实现
- **batch audit log 接入告警**：现在 batchId correlation 已经走通到 `control-plane-audit` 与 `restart audit`，下一步可加一条 dashboard 看板把同 batchId 的 N 条 audit 聚合展示

---

## 附：关键文件速查表

### openclaw 端

| 文件                                                         | 角色                                           |
| ------------------------------------------------------------ | ---------------------------------------------- |
| `src/gateway/protocol/schema/gateway-batch.ts`               | batch primitive TypeBox schema                 |
| `src/gateway/protocol/schema/protocol-schemas-extensions.ts` | schema 注册表（fork 扩展）                     |
| `src/gateway/protocol/index.ts`                              | type alias + AJV validator + barrel            |
| `src/gateway/method-registry-data.ts`                        | `allKnownMethods` 排序清单                     |
| `src/gateway/method-scopes.ts`                               | scope 分类（READ / WRITE / ADMIN）             |
| `src/gateway/server-methods/dispatcher.ts`                   | acyclic dispatcher + `dispatchSubRequest` 闭包 |
| `src/gateway/server-methods/gateway-batch.ts`                | batch handler                                  |
| `src/gateway/server-methods/gateway-batch.module.ts`         | 模块自动发现入口                               |
| `src/gateway/server-methods/_modules.generated.ts`           | 生成的 module manifest                         |
| `src/gateway/server-methods/runtime.ts`                      | 派生 `CONTROL_PLANE_WRITE_METHODS`             |
| `src/gateway/control-plane-audit.ts`                         | audit envelope + `batchId` 输出                |
| `src/infra/restart.ts`                                       | restart audit + `batchId` 透传                 |
| `scripts/protocol-gen-ts.ts`                                 | 上游官方 TS codegen（dashboard 用）            |
| `scripts/diff-describe-baseline.ts`                          | describe 基线 diff                             |

### deck-go 端

| 文件                                                           | 角色                                    |
| -------------------------------------------------------------- | --------------------------------------- |
| `deck-go/contracts/scripts/protocol-common.ts`                 | 桥接：import openclaw schema/methodDefs |
| `deck-go/contracts/scripts/protocol-gen-go.ts`                 | Go codegen（含 `Batch` 命名映射）       |
| `deck-go/contracts/scripts/protocol-gen-ts.ts`                 | deck-go 自用 TS codegen                 |
| `deck-go/contracts/scripts/protocol-parity-check.ts`           | drift gate                              |
| `deck-go/contracts/scripts/fork-divergence-report.ts`          | upstream 差异报告                       |
| `deck-go/contracts/scripts/gateway-coverage-report.ts`         | 覆盖率报告                              |
| `deck-go/backend/cmd/deck-go/main.go`                          | 入口                                    |
| `deck-go/backend/internal/controld/app.go`                     | NewHandler 入口包装                     |
| `deck-go/backend/internal/server/server.go`                    | chi router + middleware                 |
| `deck-go/backend/internal/server/gateway.go`                   | `/api/gateway/*` handler                |
| `deck-go/backend/internal/gateway/client.go`                   | 薄壳 `Client`                           |
| `deck-go/backend/internal/gateway/realtime.go`                 | gorilla/websocket 单连接                |
| `deck-go/backend/internal/gateway/generated/methods.go`        | TypedClient（codegen）                  |
| `deck-go/backend/internal/gateway/generated/types.go`          | Go struct（codegen）                    |
| `deck-go/backend/internal/gateway/generated/allowlist.go`      | method + scope allowlist                |
| `deck-go/backend/internal/runtime/openclaw/managed_runtime.go` | BFF facade                              |
| `deck-go/backend/internal/runtime/openclaw/adapter.go`         | service 装配                            |
| `deck-go/backend/internal/runtime/openclaw/gateway_queries.go` | 70+ typed wrapper                       |
| `deck-go/frontend/src/api.ts`                                  | 前端 HTTP 客户端                        |
| `deck-go/frontend/src/lib/deck-client.ts`                      | `deckFetch` / `deckStream`              |
| `deck-go/contracts/generated/ts/deck-api.generated.ts`         | 前端类型源                              |

### Makefile / 脚本

| 命令                                      | 作用                    |
| ----------------------------------------- | ----------------------- |
| `make -C deck-go protocol-update`         | 重生成 Go + TS 协议产物 |
| `make -C deck-go protocol-check`          | drift gate              |
| `make -C deck-go fork-divergence-report`  | upstream 差异           |
| `make -C deck-go gateway-coverage-report` | 覆盖率快照              |
| `make -C deck-go verify`                  | 全 gate                 |

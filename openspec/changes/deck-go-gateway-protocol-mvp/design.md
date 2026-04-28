## Context

deck-go 是 openclaw fork（`wymfly/openclaw`）下的并行实验，目标是用 Go BFF + Vite/React 替换 dashboard (Next.js)。当前已建立目录骨架与基础 REST 路由，但 Gateway 对接层与 dashboard 差距显著：

| 维度                                     | dashboard                                                                                                | deck-go                                                                                                                 |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Allowlist (`Object.keys(allMethodDefs)`) | ~110 method 名（自动生成）                                                                               | 0                                                                                                                       |
| Typed methods (`params \|\| result`)     | ~95 method（`GatewayMethodMap` / `GatewayClient` 实际形态）                                              | 0（全部 `map[string]any`）                                                                                              |
| Gateway 协议 codegen                     | `pnpm protocol:gen:ts` 从 `src/gateway/method-registry-data.ts` 静态 import                              | 无；`contracts/source/deck-api.contract.ts` 是 372 行手写 Deck DTO                                                      |
| Drift 检测                               | `pnpm protocol:gen:check` CHECK_MODE 逐文件 missing+content 比对（`scripts/protocol-gen-ts.ts:395-415`） | 无                                                                                                                      |
| Gateway WS 复用                          | 单连接长持有                                                                                             | 一次性 RPC 每次新建 + Ed25519 握手；订阅链路才长持有；`Realtime.ensureConnected` 释放锁后才 dial（并发首发会建多条 WS） |
| Method wrapper                           | typed `gw.*`                                                                                             | `internal/runtime/openclaw/gateway_queries.go` 70 个手写 wrapper                                                        |

后续"完全对齐"提案要补 30+ missing methods 并迁移 FE 到 typed call。如果不先建立 codegen + 单连接基础设施，每补一个 method 都要手写 + 测，且无法保证与上游 method-registry 同步。

约束：

- 不修改上游 (`src/**`)（项目根 CLAUDE.md 强制）
- 不破坏现有 `gateway_queries.go` 70 个 wrapper（向后兼容）
- codegen 输出必须确定性排序（项目根 CLAUDE.md 的 prompt-cache 稳定性约束）
- fork 与上游存在 method-registry 增量（SSRF/Channel Event Filter/WeCom 等）

## Goals / Non-Goals

**Goals:**

- 建立 deck-go Gateway 协议契约的 codegen 管线（Go + TS 双输出）
- Go 端 Gateway 一次性 RPC 与订阅链路统一走单连接，RPC 延迟从 ~50–500ms 降至 <10ms
- CI drift 检测，对齐 dashboard 的 `pnpm protocol:gen:check`
- 输出 fork-divergent method 清单，作为后续完全对齐与适配层迁移的输入

**Non-Goals:**

- 不补任何 missing typed methods（`chat.send/abort`、`exec.approval.*`、`wizard.*`、`talk.*` 等）→ 提案 2
- 不替换 deck-go FE 的字符串端点（FE 仍走 REST）→ 提案 2
- 不重写现有 `gateway_queries.go` 70 个 wrapper → 后续提案
- 不做 Error/Scope 标准化 → 提案 2
- 不动 fork-divergent 方法的实现，只标注 → "适配层迁移"提案
- 不引入 Go ORM、不引入新数据库 schema

## Decisions

### D1: codegen 实现路径——复用上游 `scripts/protocol-gen-ts.ts` 而非重写

**选项**:

- A. 复用上游 `scripts/protocol-gen-ts.ts` 作为模板，新增 deck-go 专用 `protocol-gen-go.ts` + 一个轻量 `protocol-gen-ts.ts` 输出到 `deck-go/contracts/generated/`
- B. 在 deck-go 内完全重新实现 codegen，独立于上游脚本
- C. 让 dashboard 的 codegen 直接输出到 deck-go 目录

**Decision**: A。

**Rationale**:

- 上游脚本已稳定，重写等于自找 bug
- B 会与上游 schema 演进解耦，drift 风险更高
- C 违反"deck-go 应自治"的设计目标，且 dashboard 还要继续用现有产物
- 复用方式：`deck-go/contracts/scripts/protocol-gen-ts.ts` 作为 thin wrapper，调用上游 `gateway.describe` 后写入 `deck-go/contracts/generated/ts/gateway/`；Go 输出由全新的 `protocol-gen-go.ts` 产生（上游没有 Go codegen）

### D2: codegen 数据源——直接 import 上游静态注册表

**选项**:

- A. 启动一个临时 Gateway，调用 `gateway.describe` introspection RPC 获取 schema
- B. 直接 import 上游 `src/gateway/method-registry-data.ts` 的 `allMethodDefs` / `allEventDefs` 静态导出
- C. 两者结合：CI 用 B（无网络依赖），本地开发用 A（验证真实运行时）

**Decision**: B。

**Rationale**:

- A 在 CI 中需要起 Gateway 进程，复杂且慢
- B 与上游 `scripts/protocol-gen-ts.ts:182` 同源（同一份 `allMethodDefs`），保证 deck-go 与 dashboard 不会因数据源不同而出现 set 差异
- 提案排除"基于 RPC describe"路径——`gateway.describe` 的 introspection 输出形态与静态 `methodDefs` schema 字段不完全一一对应（运行时合成、scoped methods 标识方式等），混用会引入 drift
- drift 检测的等价性建立在"同一份静态源 → 同一份产物"上

### D3: Go typed binding 形态——泛型 `Request[P, R]` vs 每个 method 一个函数

**选项**:

- A. `gateway.Call[Params, Result](ctx, client, "method.name", params) (Result, error)`（Go 1.18+ 泛型）
- B. 每个 typed method 生成独立函数：`func (c *TypedClient) ChatHistory(ctx, params ChatHistoryParams) (ChatHistoryResult, error)`
- C. 接口方法：`type GatewayClient interface { ChatHistory(...) ... }`

**Decision**: B + 一个 `GatewayMethods` interface 聚合用于 mock。

**Rationale**:

- Go 泛型在调用处需要显式类型参数，可读性差
- B 与 dashboard `GatewayClient` 形态一致，便于后续 mirror
- C（interface）用于 mock 测试与未来切换实现
- 实际规模：上游 `Object.keys(allMethodDefs)` 约 110 个 method 名，过滤 `params || result` 后的 typed methods 约 95 个（即生成 ~95 个 Go 函数 + 类型）；dashboard 等价文件 `gateway-client.generated.ts` 1012 行，Go 端预计 1500-2500 行，分文件后单文件可控
- 文件拆分：`methods.go`（typed 函数 + Result/Params struct 引用）、`types.go`（DTO struct 主体）、`allowlist.go`（method 名 set，含纯 scoped methods）

### D3b: Allowlist vs Typed Method Set——必须区分两个集合

**Context**: 经核查上游 `scripts/protocol-gen-ts.ts:333-358`，dashboard 实际生成两个互不相等的 set：

- `GENERATED_METHOD_ALLOWLIST = Object.keys(allMethodDefs).toSorted()` — 包含**所有注册 method**，含纯 scoped 但无 schema 的 methods（如 `plugin.approval.list`、`plugin.approval.waitDecision`）
- `GatewayMethodMap` / `GatewayClient` typed 集合 = `allMethodDefs.filter(m => m.params || m.result)` — 只含有 schema 的 methods；`plugin.approval.request/resolve` 在此集合中（仅 params 也算 typed），但 `plugin.approval.list/waitDecision` 不在

**Decision**:

- deck-go Go 生成 `AllowlistMethodNames map[string]struct{}` 等价于 dashboard `GENERATED_METHOD_ALLOWLIST`
- deck-go Go 生成 `TypedMethods` 函数集合等价于 dashboard `GatewayClient`
- spec `gateway-communication` 与 `deck-go-gateway-codegen` 必须用"typed method"指 `params || result` 集合，"allowlist" 指 `Object.keys`，**不得混用**

**Rationale**: dashboard route allowlist 校验需要前者（保证 method 在上游注册），typed client 调用需要后者（保证有 schema）。混淆会让 spec 自相矛盾或实施时断言失败。

### D4: 传输层单连接复用——直接改 `Client.Request` 还是引入新接口

**选项**:

- A. `Client.Request` 内部委托给 `Realtime.request`（保持现有 API 不变）
- B. 弃用 `Client`，所有调用方迁到 `Realtime.Request`
- C. 引入 `GatewayTransport` interface，`Client` 与 `Realtime` 都实现它

**Decision**: A，并在 `Client` 构造期注入 `*Realtime`（不再懒构造）。

**Rationale**:

- 70 个现有 wrapper 都通过 `Requester` 接口调用 `Request`，A 零改动
- B 涉及大量调用方迁移，超出 MVP 范围
- C 过度抽象，等到提案 2 真要替换实现时再做

**Lifecycle 契约**（响应 review 关切）：

- `Realtime.New(provider, bus)` 当前要求非 nil `*events.Bus`（见 `realtime.go:201` 无条件 `r.bus.Publish`）。`Client` 构造时也必须接收 `*Realtime`，由调用方负责确保 bus 存在
- 兼容路径：保留 `gateway.NewClient(provider)` 旧签名，内部使用 `events.NewNoopBus()`（新增的空实现，`Publish` 为空函数）；新签名 `gateway.NewClientWithRealtime(rt *Realtime)` 用于已经持有 Realtime 的调用方
- 关闭语义：`Client.Close()` 不关 `Realtime`（`Realtime` 由 owning component 负责）；`Realtime.Close()` 关闭 conn 并 cancel 所有 pending request

### D4b: 单飞（singleflight）连接保护

**Context**: 经核查 `deck-go/backend/internal/gateway/realtime.go:99-126`，`Realtime.ensureConnected` 释放 `r.mu` 后才执行 `dialer.DialContext`，并发首发 RPC 会同时进入 dial 路径，建多条 WS 连接、消耗多个 connect 握手 slot，并造成后续 readLoop 重复消费。

**Decision**: 在 `Realtime` 增加 `connecting` 状态字段 + 一个 `sync.Once`/`chan struct{}` 风格的 dial latch，保证同时只有一个 goroutine 执行 dial+handshake，其余调用方等待结果共享同一连接。

**Implementation**:

- `Realtime` 新增字段 `connectInProgress chan struct{}` 与 `connectErr error`
- `ensureConnected` 在锁内检查：
  1. `r.conn != nil && healthy` → 直接返回
  2. `r.connectInProgress != nil` → 释放锁，`<-r.connectInProgress`，再次获取锁检查 `connectErr`
  3. 否则成为唯一 dialer：创建 channel，标记自己，释放锁后 dial+handshake，无论成败回到锁内更新 `r.conn`/`r.connectErr` 并 close channel
- spec `deck-go-gateway-transport` 必须含并发 scenario：N 个 goroutine 同时调用 `Client.Request`，断言只产生 1 个 conn 与 1 次 handshake

### D5: Realtime 重连策略——指数退避 vs 固定间隔 vs 不自动重连

**选项**:

- A. 指数退避（1s → 2s → 4s → ... → 30s 上限），无限重试
- B. 固定 5s 间隔
- C. 不自动重连，由调用方决定（保持现状）

**Decision**: A，最大间隔 30s，pending request 在断线时全部以 `ErrConnectionLost` 上抛。

**Rationale**:

- C 对单连接复用是灾难——一次断线导致后续所有 RPC 永久失败
- B 在 Gateway 重启场景会反复打满日志
- A 与 dashboard 的 reconnect 行为一致（`gateway-adapter.ts` 也是指数退避）
- pending request 不静默重试，因为 Gateway 不保证 idempotency；上抛后由业务层决定（订阅可由 `Realtime.SubscribeSession` 自动恢复）

**ctx 覆盖范围扩展**：现有 `completeConnect`（`client.go:122-130`）在每次 `ReadMessage` 阻塞前只做一次 ctx 检查，握手期间 ctx cancel 无法立即中断。MVP 必须修复：handshake 期间用 `conn.SetReadDeadline(time.Now().Add(handshakeTimeout))` + 监听 `ctx.Done()` 时主动 `conn.Close()`，让 `ReadMessage` 立即返回。spec 必须含"握手期 ctx cancel"scenario。

### D6: drift 检测——CHECK_MODE 内存比对 vs git diff

**选项**:

- A. `git diff --exit-code` 检测 generated/ 是否与 commit 一致
- B. 重新生成后做语义 diff（忽略空白、注释顺序等）
- C. CHECK_MODE：codegen 在内存中产出 expected，逐文件检查 `existsSync` + byte-equal，缺失/漂移分别报告

**Decision**: C，对齐上游 `scripts/protocol-gen-ts.ts:395-415`。

**Rationale**:

- A 不能检测 untracked 新文件（首次生成或新增产物文件时 `git diff --exit-code` 通过但实际 missing），是 review 发现的 P1 漏报
- A 也无法在不写入磁盘时验证（CHECK_MODE 不应污染 working tree）
- B 复杂度高，受益有限
- C 与上游 dashboard 完全同模式：`if (!existsSync(filePath)) console.error('MISSING'); else if (actual !== expected) console.error('DRIFT')`
- 实施：`make protocol-check` 设置 `CHECK_MODE=1` 跑 `protocol-gen-ts.ts` 与 `protocol-gen-go.ts`；脚本内部读取目标文件、与内存生成内容比对，不写入磁盘
- `make protocol-update` 不带 CHECK_MODE 写入磁盘，用于本地修复

### D7: fork-divergent 清单的生成方式

**选项**:

- A. 手动维护 `docs/fork-divergent-methods.md`
- B. 脚本化：diff `upstream/main` 与当前 fork 的 `src/gateway/server-methods-list.ts` 与 `src/gateway/server-methods/`，自动生成清单
- C. 在 codegen 输出时直接打 `// FORK-DIVERGENT` tag
- D. 推到提案 3（适配层迁移）

**Decision**: B 一次性生成 + 人工补证据；CI 不强依赖（开发者本地可跑即可）；C 等到提案 3 再做。

**Rationale**:

- A 容易过时；D 等于把后续提案的 input 推后，影响提案 2 的范围切割
- B 一次跑出基线，后续 rebase 时可重跑校验
- C 在 MVP 不必要——MVP 不动 fork-divergent 方法的实现

**优雅降级**（响应 review 关切）：

- `upstream/main` 在 CI / 新 clone 中不一定存在。脚本必须按以下顺序尝试 baseline：
  1. `upstream/main`（最理想，开发机首选）
  2. `origin/main`（CI 中通常存在）
  3. 环境变量 `OPENCLAW_UPSTREAM_BASE`（手动指定 commit）
  4. 全部不可用 → 退化为列出 fork 当前所有 method + 标记 `baseline-unavailable`，命令以 0 退出但 stderr 警告
- 不接入 CI 阻塞链路，避免 baseline 缺失导致 build 失败
- 仅在 `make protocol-update`/`make fork-divergence-report` 显式调用时运行

### D8: Go 生成产物的 module 归属

**Context**: 仓库目前唯一 Go module 是 `deck-go/backend/go.mod`（仅在 `deck-go/backend/` 之下生效），不存在 `deck-go/go.mod` 或 `deck-go/go.work`。若把 Go 产物放到 `deck-go/contracts/generated/go/`，该包不在任何 module 内，`go build` / `go vet` 与 backend import 路径都未定义。

**选项**:

- A. 放在 `deck-go/contracts/generated/go/gateway/`，新建 `deck-go/go.work` 或 `deck-go/go.mod`
- B. 放在 `deck-go/backend/internal/gateway/generated/`，作为 backend module 的子包
- C. 放在 `deck-go/backend/contracts/generated/go/gateway/`，仍在 backend module 内，但 contracts 与代码物理分离

**Decision**: B。

**Rationale**:

- A 引入新 module 边界会打乱现有 backend 单元测试与 import 习惯，超出 MVP 范围
- B 利用现有 module，import path 形如 `github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated`，与 `internal/gateway` 同级且自然依赖
- C 物理分离更"干净"，但 import path 稍长且在 internal 边界外引发可见性顾虑（contracts 包能否被 backend internal 调用要二次确认）
- TS 产物保持在 `deck-go/contracts/generated/ts/gateway/`，因 TS 没有 Go module 约束，且 deck-go FE 也通过 vite 加载 contracts

## Risks / Trade-offs

- **[确定性排序失效] → Mitigation**: codegen 输出前对所有 map/set 显式排序；CI 跑两次 codegen 校验输出一致；contracts/scripts/ 加单测。
- **[长连接断线丢请求] → Mitigation**: pending request 在断线时立即以 `ErrConnectionLost` 上抛；订阅自动重新订阅；Realtime 状态机加单测覆盖断线、重连、重订阅、并发请求场景。
- **[并发首发 RPC 建多条 WS]（review P1） → Mitigation**: D4b 单飞 latch；spec 含 N 并发 goroutine 断言只产生 1 conn 的 scenario；race detector 跑测。
- **[drift check 漏报 untracked 文件]（review P1） → Mitigation**: D6 改为内存比对 + missing/drift 分别报告，对齐上游 `scripts/protocol-gen-ts.ts:401-410`。
- **[allowlist 与 typed 集合混淆]（review P1） → Mitigation**: D3b 显式拆分两个集合；spec 用词强制区分；codegen 单测断言两集合大小关系（typed ⊆ allowlist）。
- **[Go 产物孤儿包]（review P1） → Mitigation**: D8 把 Go 产物放在 `deck-go/backend/internal/gateway/generated/`，纳入现有 module。
- **[handshake 期 ctx 不响应]（review P2） → Mitigation**: D5 在 handshake 增加 `ctx.Done()` 监听 + `conn.Close()` 触发 `ReadMessage` 立即返回。
- **[Realtime 强依赖 events.Bus]（review P2） → Mitigation**: D4 lifecycle 契约：保留 `NewClient(provider)` 兼容签名，内部用 `events.NewNoopBus()`；`Realtime.Close()` 负责关 conn + cancel pending。
- **[Go 输出文件过大影响编辑器/diff] → Mitigation**: 拆分为 `methods.go`（签名）+ `types.go`（DTO）+ `allowlist.go`（method 名集合），各 <2000 行；与 dashboard 的拆分对齐。
- **[fork-divergent baseline 缺失] → Mitigation**: D7 优雅降级：upstream/main → origin/main → 环境变量 → 退化模式；不接入 CI 阻塞。
- **[复用上游 codegen 引入耦合] → Mitigation**: deck-go codegen 通过 import path 引用上游 `scripts/`（同 monorepo 内），不复制代码；上游 codegen API 变化时 deck-go CI 立即报错，便于同步。

## Migration Plan

1. 不破坏现有调用方：`gateway_queries.go` 70 个 wrapper 在 MVP 全程保留并继续工作
2. typed binding 与现有 wrapper 并存于 `internal/runtime/openclaw/`；MVP 不强制迁移
3. 单连接复用切换：`Client.Request` 内部委托给共享 `Realtime`，对调用方透明
4. CI 启用 `protocol-check` 前先在 PR 上跑一次确认 baseline 一致
5. 回滚：MVP 涉及的所有变更都可独立 revert（codegen 脚本/产物/Makefile target/Realtime 重连逻辑）；唯一不可单独 revert 的是 `Client.Request` 委托——若需回滚，恢复原 `RequestDirect` 实现

## Open Questions

1. codegen 脚本运行时（tsx vs bun）：上游用 bun，deck-go 是否统一？建议：跟随上游用 `bunx`，避免双引擎。**待确认**。
2. fork-divergent 清单是否需要包含 event names（如 `presence`、`heartbeat`）？建议：MVP 只覆盖 methods，events 留给提案 3。**待确认**。
3. `Realtime` 重连后是否需要重发 in-flight request？决策为"不重发，立即上抛"，但若用户要求 idempotent method 自动重试，需在提案 2 评估。**待确认**。

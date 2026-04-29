## Why

MVP 提案 `deck-go-gateway-protocol-mvp` 已交付（codegen + Realtime 单连接 + drift 检测 + fork-divergent 清单 + Error/连接断开哨兵），但**没有任何业务 caller 接入 typed bindings**。基于 MVP 实施事实采集（2026-04-28）：

| 维度                                                                           | 事实                                                                                                                                                                  |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 上游 typed methods（`params \|\| result`，已 codegen 出 Go 函数）              | **127**                                                                                                                                                               |
| 上游 allowlist methods（含纯 scoped 无 schema）                                | **129**                                                                                                                                                               |
| deck-go `gateway_queries.go` wrapper 函数数                                    | **116**                                                                                                                                                               |
| deck-go wrapper 覆盖的 distinct method 名（按 `Request(ctx, "...")` 精确计数） | **114**                                                                                                                                                               |
| **deck-go 当前未覆盖的上游 typed protocol methods（必须补覆盖的真实清单）**    | **21**                                                                                                                                                                |
| deck-go 包了但**非 typed**（allowlist 中无 schema）的 method                   | **8**（`commands.list` / `exec.approval.list` / `logs.tail` / `node.invoke` / `node.pending.enqueue` / `plugin.approval.list` / `tools.catalog` / `tools.effective`） |

**真实未覆盖 21 个 typed protocol methods**（事实，不是估算）。**R1.2 修订（Codex F-11 决策）**：审计后 17 个普通 RPC 中 **10 个 Deck Go 当前业务实际不消费**（chat.send/abort 走 BFF 内 sessions.send/abort、approval.request 是 producer-side 流程 Deck 仅消费 list/resolve、config.set/sessions.compaction.get/agent.wait 无 Deck UX caller），统一标记为 **deferred typed methods**：codegen 已生成 typed bindings 但本提案不补 caller，由 `DECK_GO_DEFERRED_METHODS` 列表跟踪并从 coverage 分母中豁免；未来 Deck 业务需要时再按 PR-X 补 caller。剩余 7 个普通 RPC + 4 个 subscription protocol methods 由本提案覆盖：

```
agent.wait, chat.abort, chat.send, config.set,
exec.approval.request, exec.approval.waitDecision,
exec.approvals.node.get, exec.approvals.node.set,
plugin.approval.request,
sessions.compaction.get,
sessions.subscribe, sessions.unsubscribe,
sessions.messages.subscribe, sessions.messages.unsubscribe,
talk.config, talk.mode, talk.speak,
wizard.cancel, wizard.next, wizard.start, wizard.status
```

**MVP 已落地的相邻能力**（影响本提案设计）：

- `gateway/realtime.go::SubscribeSession(ctx, key)` / `UnsubscribeSession(ctx, key)` 已存在但是**非 typed wrapper**——只是把 `sessions.subscribe` + `sessions.messages.subscribe(key)` 内部调一遍，事件通过 `events.Bus.Publish` 进入 bus；本提案要在其上加 typed channel API
- `Realtime.doRequest` 在 envelope `error` 时返回 `fmt.Errorf("%s: %s", code, message)` 普通 error；本提案升级为 typed `*ErrCode` + 哨兵
- `gateway.ProbeHealth`（包级）用 `sync.Map` 按 `(URL, sha256(token))` 缓存 `*Client` 复用单连接，但**永不清理**；本提案补 evict
- `generated/methods.go` 暴露 `generated.Client` + `generated.NewClient(requester)`，与 `gateway.Client` 命名冲突；本提案改名前 caller 不会引入歧义，但全量接入前必修
- `generated/methods.go::encodeParams` 每次 typed call 做 `Marshal(struct) → Unmarshal(map) → wire`，两跳；热路径有边际开销

FE 端：`deck-go/frontend/src/api.ts` 仍走 REST 字符串端点，**0 处用** MVP 生成的 typed `createGatewayClient`。

本提案做完全对齐：补 21 个缺失 method 的 caller、迁移 116 个 wrapper 到 typed binding、升级 error model 为 typed、增加 typed subscription channel API（三层独立背压）、**FE 仅 Gateway RPC proxy 类切 typed**（deck-go-bff 与 binary-stream-upload 类保留）、加防倒退 gate；同时收尾 MVP R1/R2 review 留下的 P2 follow-up（含 D11 v2 `RequestTyped` 二口径方案——保留 `Request(map)` 兼容签名 + 新增 `RequestTyped(any)` 给 generated 用）。

## What Changes

### 业务对齐（核心）

- **新增** 21 个未覆盖 typed protocol methods 的覆盖路径——7 个普通 RPC method 通过 MVP 生成的 `generated.NewTypedClient(requester).MethodName(ctx, params)` 调用，**不在 `gateway_queries.go` 补手写 wrapper**；10 个 method 由 R1.2 决策标记为 **deferred**（`DECK_GO_DEFERRED_METHODS`）：codegen 已生成但 Deck Go 当前业务不消费（详见 `docs/gateway-coverage.md` Deferred 表），未来需要时再补 caller；4 个 subscription protocol methods（`sessions.subscribe` / `sessions.unsubscribe` / `sessions.messages.subscribe` / `sessions.messages.unsubscribe`）由 typed subscription channel API 封装为 lifecycle/refcount 内部协议流量，不要求业务 handler 直接调用；handler 持有共享 `*generated.TypedClient` 实例（构造期一次创建）
- **修改** `gateway_queries.go` 现有 116 个 wrapper：返回类型从 `any` 升级为 typed struct（薄壳化），按 method 域分批 PR；caller 编译期暴露字段访问错误，作为修复任务的一部分
- **新增** Go 端 typed subscription channel API（`internal/runtime/openclaw/gateway_subscriptions.go` 或等价模块）：在 MVP 现有 `Realtime.SubscribeSession`/`UnsubscribeSession` 之上封装 typed `<-chan generated.SessionsChangedEventPayload` 与 `<-chan generated.SessionMessageEventPayload`（命名对称 TS `GatewayEventPayloadMap`）；ctx cancel + 显式 cancel 双关闭语义；buffer 默认 64；三层独立背压（详见 D4：readLoop / dispatch worker / per-subscriber reader 永不互相阻塞）
- **修改** Error envelope 解析层：`Realtime.doRequest` 把 envelope `error` 转为 typed `*gateway.ErrCode{Code, Message, Details}` + 哨兵 `gateway.ErrScopeDenied`（`gateway.ErrConnectionLost` MVP 已有）；caller 用 `errors.Is`/`errors.As` 判定；保持 `err.Error()` 输出 `"<code>: <message>"` 与 MVP 行为兼容

### MVP 收尾（R1/R2 P2 follow-up）

- **新增** `gateway.healthProbeClients` evict 策略：当 `(URL, token)` 失败连续 N 次（如 5 次）或 token rotate 触发显式 invalidate 时，从 sync.Map 移除并 `Realtime.Close()` 旧 client
- **修改** `generated.Client` → `generated.TypedClient`（避免与 `gateway.Client` 命名冲突）；本提案是唯一 caller 引入点，**改名成本最低窗口**
- **修改** `generated.encodeParams` 路径：D11 v2 二口径方案——`*gateway.Client` 与 `*gateway.Realtime` 同时实现 `Request(ctx, method, params map[string]any)` 保留兼容 + **新增** `RequestTyped(ctx, method, params any) (any, error)`；`generated.Requester` 接口要求 `RequestTyped`；codegen 生成的 typed call 直接走 `RequestTyped` 省去 marshal/unmarshal 双跳
- **修改** `fork-divergence-report.ts::diffTouchedMethods`：限制只统计 method registration 行（如 `methodDef:` / `as Methods`）增改，过滤纯文件 reorder；当前 138 条几乎全 method 集，噪音过大

### FE 对齐

- **修改** `deck-go/frontend/src/api.ts` 与 `frontend/src/services/**`：**仅替换"Gateway RPC proxy 类"endpoint**（即 BFF 转发到上游 Gateway typed methods 的代理路径）为 `createGatewayClient` 调用；deck-go 后端自己的 control-plane endpoint（如 `/settings`、`/devices/*`、`/bootstrap/status`、`/runtime/gateway/*`、`/channels`、`/approvals/*`，以及二进制/SSE/上传类 endpoint）**保留不动**。`/skills/*`、`/deck/plugins`、`/runtimes/{id}/models/*` 等易混路径不得在 proposal 中预判为 BFF 或 Gateway proxy，必须以 PR-17 的 `fe-endpoint-classification.md` 审计结果为准。详见 D5。
- **新增** `GatewayError` discriminated union 在 FE 错误处理层接入；`code === 'scope_denied'` 由 caller 自决处理（不在 transport 全局拦截）

### 反倒退 gate

- **新增** `make gateway-typecheck`：(a) Go 端扫描 `internal/runtime/openclaw/` / `internal/handlers/` 中 `requester.Request(ctx, "<string>", ...)` 字符串调用；(b) FE 端**仅扫描 Gateway RPC proxy 类**字符串调用（不扫 deck-go 本地 control-plane endpoint）——通过 BFF endpoint 分类清单（PR-17 输出）排除；行级豁免 `// gateway:allow-untyped reason: <文字>`；CI 阻塞
- **新增** `make gateway-coverage-report`：输出 `docs/gateway-coverage.md` + `docs/gateway-coverage-baseline.json` 四项指标 `{upstream_typed: N, deck_go_go_migrated: M, deck_go_fe_migrated: K, fork_divergent: F}`；CI 与 main baseline 对比，倒退即 fail，除非 PR 含 `gateway-coverage: regress allowed reason: <文字>`

### CI 守护补强

- **新增** CI 接入 deck-go 后端 `go test ./internal/...` + `go build ./...`（MVP 时只接入了 `make protocol-check`，后端代码改动不被 CI 守护，是预存风险）

明确**非目标**（留给后续提案）：

- 不动 fork 适配层物理位置（`src/gateway/server-methods/deck/*` 仍在上游 fork 内）→ 提案 3
- 不引入新业务 RPC 或 schema（只接入已存在但 deck-go 没用的）
- 不重写 deck-go FE 页面/路由结构
- 不动 Gateway 服务端代码（CLAUDE.md 强约束）
- 不修改 MVP 落地的 codegen 模板与 transport 实现（除非本提案明确标注必须扩展，如 D6/D9/D10/D11）
- 不引入 GraphQL 或新协议层
- 不处理 `allowlist - typed` 8 个无 schema method 的 schema 补全（推到提案 3 或上游 PR；本提案对它们走 `// gateway:allow-untyped` 显式豁免，见 D12）

## Capabilities

### New Capabilities

- `deck-go-gateway-typed-client-coverage`: deck-go Go/FE 全量 typed binding 覆盖；17 个普通 RPC 缺口直接走 `generated.TypedClient`，4 个 subscription protocol method 由 typed subscription API 覆盖；现有 116 wrapper 薄壳化为 typed 返回。**对标项**。
- `deck-go-gateway-error-scope-model`: deck-go transport 把 envelope error 解析为 typed Go error 树；FE 用 `GatewayError` discriminated union；scope 错误 handler 自治。**对标项**。
- `deck-go-gateway-subscription-api`: deck-go Go 端 typed subscription channel + 自动续订（MVP 已有 `SubscribeSession`/`UnsubscribeSession` 简单包装，本提案加 typed channel layer + buffer + ctx/显式 cancel 双语义）。**对标项**。
- `deck-go-frontend-typed-client-adoption`: FE `api.ts` 与 `services/**` 中**Gateway RPC proxy 类**调用切走 typed `createGatewayClient`；deck-go BFF 自身的 control-plane endpoint（`deck-go-bff` 类）与二进制/SSE/上传（`binary-stream-upload` 类）保留 fetch 不动（详见 D5 分类）。**对标项**。
- `deck-go-gateway-coverage-gate`: CI 静态扫描禁止新增 untyped 调用，输出覆盖率报告防倒退；fork-divergent method 不计入分母。**增值项**。
- `deck-go-gateway-mvp-followup`: MVP R1/R2 review 留下的 4 项 P2（healthProbeClients evict / generated.Client 改名 / encodeParams 优化 / fork-divergence 算法）整合处理。**收尾项**。

### Modified Capabilities

- `gateway-communication`: 把"deck-go typed coverage"从 MVP 的"产物等价"升级为"调用方 100% 走 typed"；明确 Error envelope 是 typed 契约；明确 typed subscription 是 typed 契约。

## Impact

- **Affected code**:
  - 重写：`deck-go/backend/internal/runtime/openclaw/gateway_queries.go` 116 个 wrapper 改为 typed binding 薄壳
  - 新增：`deck-go/backend/internal/runtime/openclaw/gateway_subscriptions.go`（typed subscription channel）
  - 新增：`deck-go/backend/internal/gateway/errors.go`（typed `*ErrCode` + 哨兵；`Realtime.doRequest` 调用此层）
  - 修改：`deck-go/backend/internal/gateway/client.go`（healthProbeClients evict）
  - 修改：`deck-go/backend/internal/gateway/realtime.go`（envelope error 解析层接入）
  - 修改：`deck-go/contracts/scripts/protocol-gen-go.ts`（`Client` → `TypedClient` 改名 + `encodeParams` 优化）
  - 修改：`deck-go/contracts/scripts/fork-divergence-report.ts`（`diffTouchedMethods` 算法收紧）
  - 重写：`deck-go/frontend/src/api.ts` 与 `frontend/src/services/**`（typed client 调用）
  - 修改：`deck-go/backend/internal/handlers/**`（部分 handler 直接拿 typed struct）
  - 修改：`.github/workflows/ci.yml`（加 deck-go go test/build step + gateway-typecheck + gateway-coverage-report）
  - 不动：上游 `src/**`（CLAUDE.md 禁止）
- **APIs**:
  - Go 内部：`gateway_queries.go` 116 个函数签名保持不变（返回类型升级是允许的 churn）
  - Go 新增：`generated.TypedClient`（曾是 `Client`）；`SubscribeSessionsTyped(ctx)` 风格 channel API；`gateway.ErrCode` / `gateway.ErrScopeDenied`
  - FE 内部：`api.ts` 中**仅 Gateway RPC proxy 类**调用切走 typed `createGatewayClient`；deck-go BFF 自身的 control-plane endpoint（如 `/settings`、`/devices/*`、`/bootstrap/status`、`/runtime/gateway/*`、`/channels`、`/approvals/*`，以及二进制/SSE/上传类 endpoint）保留现有 fetch 调用不动；易混 endpoint 由 PR-17 分类审计决定（D5）
- **Dependencies**:
  - **新增 1 个 test-only Go 依赖**：`go.uber.org/goleak`（仅 subscription 测试用于 goroutine 泄漏检测；通过 `go.mod` indirect / `_test.go` import；**不影响 production binary**；需要 `go mod tidy` 后 commit `go.sum`）
  - 不引入新 npm 依赖；FE 已通过 vite 加载 `contracts/generated/ts/`
  - 可选评估 `mapstructure` 用于未来 schema validator（推到提案 3）
- **CI**: 新增 4 步：`go vet`/`go build`/`go test ./internal/...` + `make gateway-typecheck` + `make gateway-coverage-report`；前 4 阻塞，后 1 倒退即阻塞（含豁免）
- **Performance**: D11 `encodeParams` 优化预计为热路径节省 ~1 次 JSON round-trip，量级 ~10–50µs/RPC（量小但累积可观）
- **Risk**:
  - **caller 字段访问大面积 break**：116 wrapper 返回类型变化触发 100+ caller 文件需修复，必须按域分批 PR，每个 PR 独立 green
  - **`RequestTyped` 二口径迁移风险**：generated 路径改走 `RequestTyped(any)` 后，mock、transport envelope、nil/nested/slice/map/enum payload 都必须有端到端测试；`Request(map)` 兼容路径不得被破坏
  - **subscription typed channel goroutine 泄漏**：本提案在 MVP `SubscribeSession` 之上加层，必须 goleak 全场景覆盖
  - **healthProbeClients evict 策略选择**：基于失败计数 vs token rotate 显式 invalidate vs LRU；选错会引入新泄漏或频繁短连接
  - **`generated.Client` 改名引入 caller 大面积修改**：本提案外仍是唯一 caller，且本提案 PR-1 优先做改名，控制爆炸半径
  - **`fork-divergence` 算法改动可能掩盖真增量**：算法收紧后必须人工验证至少 SSRF/Channel Event Filter/WeCom 仍出现在表中
  - **FE 删 BFF endpoint 后中间件丢失**：D5 要求删除前先把鉴权/tracing 迁到 typed client 拦截器
  - **typed binding 字段缺失**：少数 fork-divergent method（如 SSRF/WeCom 相关）result schema 可能缺失 → 修复路径补 schema（不回退 untyped）；具体清单见 MVP `docs/fork-divergent-methods.md`
  - **CI 接入 go test 后可能暴露已存在但未跑过的测试失败**：MVP 阶段 `go test` 在本地通过但 CI 没跑过；本提案先单独 PR 接 CI 验证现状再正式启用 gate

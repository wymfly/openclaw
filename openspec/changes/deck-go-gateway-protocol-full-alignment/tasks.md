## 1. Phase 0 — MVP 收尾基础设施（PR-1 ~ PR-6，必须先 land 且单独验证）

### PR-1：`generated.Client` 改名 `TypedClient`（D10）

- [ ] 1.1 修改 `deck-go/contracts/scripts/protocol-gen-go.ts:216-222`：`Client` → `TypedClient`，`NewClient(requester)` → `NewTypedClient(requester)`
- [ ] 1.2 跑 `make protocol-update` 重新生成；跑 `make protocol-check` 确认 byte-equal
- [ ] 1.3 跑 `cd deck-go/backend && go vet ./... && go build ./... && go test ./...` 全绿（caller 还未接入，应零影响）
- [ ] 1.4 PR 描述说明：本 PR 单独 land 锁定命名，避免 caller 接入后再改成本巨大

### PR-2：CI 接入 deck-go go test/build（D13）

- [ ] 2.1 修改 `.github/workflows/ci.yml`：在现有 `cd deck-go && make protocol-check` 之后加 `cd deck-go/backend && go vet ./... && go build ./... && go test -race ./internal/...`（含 GOCACHE/GOSUMDB 等环境变量与 deck-go Makefile 一致）
- [ ] 2.2 在 PR 描述附 CI run URL 确认全绿；如失败暴露 CI 环境差异（如 GOCACHE 路径、网络代理），先修这些差异再 land
- [ ] 2.3 land 后观察 1 周，确认 CI 路径稳定后再开始 PR-3

### PR-2.5：`protocol-gen-go.ts` 扩展 event codegen（D14，PR-14 前置依赖）

- [ ] 2.5.1 修改 `deck-go/contracts/scripts/protocol-gen-go.ts`：循环遍历已 import 的 `eventDefs`，生成 `type {PascalEventName}EventPayload struct {...}` typed event payload 类型（命名与 TS 端 `dashboard/src/types/gateway-protocol.generated.ts:3871,4119` 对称：如 `SessionMessageEventPayload` / `SessionsChangedEventPayload`）
- [ ] 2.5.2 输出 `deck-go/backend/internal/gateway/generated/events.go`（与 `methods.go` 平行；保持 <2000 行约束；事件类型按字母序，确定性排序）
- [ ] 2.5.3 同时生成 `var GatewayEventPayloadMap = map[string]reflect.Type{...}` 注册表（caller 可按 event name 查 typed struct）
- [ ] 2.5.4 单测：上游 fixture 含至少 1 个 `payload` 非空的 event，断言生成的 Go 类型字段与 TS `GatewayEventPayloadMap` 等价（同一份上游快照下）
- [ ] 2.5.5 跑 `make protocol-update` 与 `make protocol-check` 全绿
- [ ] 2.5.6 与 PR-3 串行依赖：必须先 land 才能进 PR-14（typed subscription channel）

### PR-3：`Requester` 二口径（D11 v2 修订）

- [ ] 3.1 在 `deck-go/backend/internal/gateway/{client.go,realtime.go}` 给 `*Client` 与 `*Realtime` 新增 `RequestTyped(ctx context.Context, method string, params any) (any, error)`；保留现有 `Request(ctx, method, params map[string]any)` 公开签名不变（外部 caller 兼容）
- [ ] 3.2 `frame.Params` 字段类型 `map[string]any` → `any`（兼容两种 caller 路径序列化无差异）
- [ ] 3.3 修改 `protocol-gen-go.ts`：`generated.Requester` interface 改为 `RequestTyped(ctx, method string, params any) (any, error)`；codegen 生成的 typed call 走 `requester.RequestTyped(...)` 直接传 typed struct，不再做 `encodeParams` 双跳 marshal
- [ ] 3.4 `gateway.Client` 与 `gateway.Realtime` 同时满足 generated.Requester 接口（实现 RequestTyped）；现有 116 wrapper 仍走 `Request(map)` 路径不动（PR-7+ 才迁移）
- [ ] 3.5 跑 `make protocol-update`；跑 `make protocol-check`
- [ ] 3.6 集成测试：mock Gateway server 接收 5 种典型 typed payload 形态（nil / nested struct / slice / map / enum）通过 `RequestTyped` 发送；同时验证 `Request(map)` 路径行为不变（与 MVP 一致）
- [ ] 3.7 mock helpers：在 `gateway` 包提供 `MockRequester` 同时实现 `Request(map)` 与 `RequestTyped(any)` 两接口；caller 自定义 mock 必须按此扩展
- [ ] 3.8 跑 `cd deck-go/backend && go test -race ./internal/...` 全绿
- [ ] 3.9 land 后观察 1 周，监控生产/测试环境无 envelope 解析回归

### PR-4：Error envelope typed 解析（D6）

- [ ] 4.1 新建 `deck-go/backend/internal/gateway/errors.go`：`ErrCode struct {Code, Message string; Details map[string]any}` + `ErrScopeDenied` 哨兵 + `(e *ErrCode) Error() string` 输出 `"<code>: <message>"`（与 MVP 行为兼容）+ `(e *ErrCode) Is(target error) bool` 按 Code 字段匹配
- [ ] 4.2 扩展 `client.go::responseError` 含 `Details map[string]any` 字段（envelope schema 若 server 端未输出 details，反序列化为 nil 不影响）
- [ ] 4.3 修改 `realtime.go::doRequest` 与 `client.go::RequestDirect`：`fr.Error != nil` 时 → `errors.go::FromEnvelope(fr.Error)` → 返回 `*ErrCode`（或哨兵）
- [ ] 4.4 单测：每种 error code 至少 1 case；`scope_denied` 必须解析为哨兵；`ErrCode.Error()` 格式断言；连接错误与 envelope error 不混淆；现有 116 wrapper 的 error path round-trip 测试（保证 `err.Error()` 字符串与 MVP 完全一致）
- [ ] 4.5 集成测试：mock server 返回 `{error: {code: "validation_failed", message: "missing x", details: {field: "x"}}}`，跑一次 typed call（**不**用 `WithValidate()`——schema validation 推到提案 3，本提案仅做 envelope error 解析），断言 `errors.As(err, &errCode)` 成立 + `errCode.Details["field"] == "x"`

### PR-5：`healthProbeClients` evict 策略（D9）

- [ ] 5.1 修改 `client.go::ProbeHealth`：维护 `(URL, sha256(token))` 的失败计数；连续 N 次（默认 5，env `GATEWAY_PROBE_FAILURE_THRESHOLD` 可调）失败后 evict 旧 entry + 调 `Realtime.Close()`
- [ ] 5.2 新增 `gateway.InvalidateProbeClient(URL, token string)` 公开 API：caller 在 token rotate 等已知场景显式调用 evict
- [ ] 5.3 新增 `gateway.ShutdownProbeClients()` 公开 API：进程退出时 graceful Close 所有 entry；`main` 在 shutdown handler 调用
- [ ] 5.4 caller 接入：`device.token.rotate` handler 在成功后调 `InvalidateProbeClient(URL, oldToken)`
- [ ] 5.5 单测：失败计数 evict（mock 5 次失败后 sync.Map 中无 entry）；显式 invalidate evict；进程退出 graceful close；evict 后下次 ProbeHealth 重建 client；evict 后旧 Realtime 的 readLoop goroutine 退出（goleak 验证）

### PR-6：`fork-divergence-report.ts` 算法收紧（D12 关联）

- [ ] 6.1 修改 `deck-go/contracts/scripts/fork-divergence-report.ts::diffTouchedMethods`：仅匹配 method registration 行（如包含 `methodDef:` / `as Methods` / `:GatewayMethodDef` 模式），过滤纯文件 reorder
- [ ] 6.2 跑 `make fork-divergence-report` 重新生成 `docs/fork-divergent-methods.md`
- [ ] 6.3 人工验证：SSRF (`browser.request`) / Channel Event Filter (`deck.agents.eventStreams.{get,set}`) / WeCom (`deck.plugins.list`) 必须仍出现在表中或表底说明段
- [ ] 6.4 表中条目数预期从 138 降至 < 60（仅真增量 + 真修改），人工 review 后写入新版

## 2. Phase 1 — 低风险域 wrapper 迁移（PR-7 ~ PR-8）

### PR-7：`cron.*` + `usage.*` + `sessions.usage.*`（约 12 wrapper）

- [ ] 7.1 `gateway_queries.go::CronList/CronAdd/CronUpdate/CronRemove/CronRun/CronRuns/CronStatus` 改 typed 薄壳（返回 `*generated.CronListResult` 等）
- [ ] 7.2 `UsageCost/UsageStatus/SessionsUsage/SessionsUsageLogs/SessionsUsageTimeseries` 同
- [ ] 7.3 caller handler 调整字段访问；`go test ./internal/...` 通过

### PR-8：`doctor.memory.*` + `device.*`（约 13 wrapper）

- [ ] 8.1 `DoctorMemoryStatus/DreamDiary/BackfillDreamDiary/ResetDreamDiary/ResetGroundedShortTerm/RepairDreamingArtifacts/DedupeDreamDiary` 改 typed 薄壳
- [ ] 8.2 `DevicePairList/DevicePairApprove/DevicePairReject/DevicePairRemove/DeviceTokenRotate/DeviceTokenRevoke` 改 typed 薄壳；`DeviceTokenRotate` handler 增加 `gateway.InvalidateProbeClient` 调用（PR-5 依赖）
- [ ] 8.3 caller 调整 + 测试

## 3. Phase 2 — 中等风险域 wrapper 迁移（PR-9 ~ PR-11）

### PR-9：`agents.*` + `agent.identity.get` + `skills.*`（约 13 wrapper）

- [ ] 9.1 6 个 `agents.*` wrapper + `AgentIdentityGet` 改 typed 薄壳
- [ ] 9.2 6 个 `skills.*` wrapper 改 typed 薄壳
- [ ] 9.3 caller 调整 + 测试

### PR-10：`config.*` + `channels.*` + `tools.*`（约 9 wrapper + 2 D12 豁免；R1.2 后 `config.set` 入 deferred）

- [ ] 10.1 5 个 `config.*` wrapper 改 typed 薄壳
- [ ] 10.2 [DEFERRED via R1.2] `config.set` 标记入 `DECK_GO_DEFERRED_METHODS`（无 Deck UX caller，未来补 caller 时再开新 PR）
- [ ] 10.3 `ChannelsStatus`/`ChannelsLogout` 改 typed 薄壳
- [ ] 10.4 `ToolsCatalog`/`ToolsEffective` 保留 `any` 返回 + 加 `// gateway:allow-untyped reason: upstream missing schema for tools.catalog/effective, tracked at <issue>` 注释（D12）
- [ ] 10.5 创建 2 个上游 issue 跟踪 schema 补全（D12 follow-up）

### PR-11：`deck.*` 全部子域（约 20 wrapper，可拆 PR-11a / PR-11b）

- [ ] 11.1 PR-11a：`deck.agents.*`（10 wrapper）+ `deck.commands.discover` + `deck.identity.*`（3 wrapper）改 typed 薄壳
- [ ] 11.2 PR-11b：`deck.routing.*`（5 wrapper）+ `deck.subagents.*`（4 wrapper）+ `deck.threads.list` + `deck.plugins.list` 改 typed 薄壳

## 4. Phase 3 — 高风险域 + 21 缺失方法（PR-12 ~ PR-16）

### PR-12：Approval 域（4 wrapper 薄壳 + 6 缺失方法 + 2 D12 豁免）

- [ ] 12.1 `ExecApprovalsGet/ExecApprovalsSet/ExecApprovalResolve` 改 typed 薄壳
- [ ] 12.2 `ExecApprovalList` 保留 `any` + D12 豁免注释（上游无 schema）
- [ ] 12.3 `PluginApprovalResolve` 改 typed 薄壳；`PluginApprovalList` 保留 + D12 豁免
- [ ] 12.4 [DEFERRED via R1.2] `exec.approval.request` / `exec.approval.waitDecision` 标记入 `DECK_GO_DEFERRED_METHODS`（producer-side 流程；Deck 仅消费 list/resolve）
- [ ] 12.5 [DEFERRED via R1.2] `exec.approvals.node.get` / `exec.approvals.node.set` 标记入 `DECK_GO_DEFERRED_METHODS`（producer-side 流程）
- [ ] 12.6 [DEFERRED via R1.2] `plugin.approval.request` 标记入 `DECK_GO_DEFERRED_METHODS`（producer-side 流程）；`plugin.approval.waitDecision` 在 allowlist 但**非 typed**——D12 豁免

### PR-13：`sessions.*` 非订阅域（约 15 wrapper + 1 缺失方法）

- [ ] 13.1 `SessionsDelete/SessionsGet/SessionsListRaw/SessionsPreview/SessionsReset/SessionsClear/SessionsPatch/SessionsCreate/SessionsSend/SessionsAbort/SessionsSteer/SessionsCompact/SessionsCompactionList/SessionsCompactionBranch/SessionsCompactionRestore` 改 typed 薄壳
- [ ] 13.2 [DEFERRED via R1.2] `sessions.compaction.get` 标记入 `DECK_GO_DEFERRED_METHODS`（无 Deck UX caller）
- [ ] 13.3 注意：现有 `gateway_queries.go::SessionsListRaw` 名字与 typed 函数名 `SessionsList` 不同，迁移后保持 `SessionsListRaw` wrapper 名向后兼容

### PR-14：Subscription typed channel API（D4）

- [ ] 14.1 在 `deck-go/backend/internal/gateway/realtime.go` 新增 `RegisterEventChannel(eventName, sessionKey string, ch chan json.RawMessage) (unregister func())` 内部 API（chan 用 bidirectional 而非 send-only：dispatch worker 需要在 raw chan 满时 drop 最旧 event，要从 chan 弹出旧元素；**raw chan 不是 typed**——避免 chan covariance 问题；typed decode 在 subscription layer）+ `dispatchQueue chan dispatchItem`（buffered 256）+ 独立 dispatch worker goroutine
- [ ] 14.2 readLoop `case "event":` 分支：(a) `bus.Publish` 给现有 subscribers + (b) **非阻塞** push 到 dispatchQueue；满时 drop 最旧 + emit `gateway_event_dispatch_overflow_total` metric（**readLoop 永不阻塞**）
- [ ] 14.3 dispatch worker 从 dispatchQueue 取 event → 查注册表 → 对每个匹配的 subscriber **非阻塞** push 到该 subscriber 的 raw chan（buffer = 64）；满时 drop 最旧给该 subscriber + emit `gateway_event_subscriber_overflow_total{subscriber_id}` metric（**dispatch worker 永不阻塞**——一个慢 subscriber 不影响其他）
- [ ] 14.4 新建 `deck-go/backend/internal/runtime/openclaw/gateway_subscriptions.go`：`SubscribeSessions(ctx, requester, opts) (<-chan generated.SessionsChangedEventPayload, cancel func(), err)` 与 `SubscribeMessages(ctx, requester, sessionKey, opts) (<-chan generated.SessionMessageEventPayload, cancel func(), err)`
- [ ] 14.5 subscription layer 内部：(a) 调 `Realtime.SubscribeSession` / `Realtime.RegisterEventChannel(eventName, key, rawChan)` 取得 raw chan；(b) 起独立 reader goroutine 从 raw chan 读 → `json.Unmarshal` 为 typed payload struct → push 到 typed channel；reader 阻塞**只阻塞自己**（不影响 dispatch worker / 其他 subscriber / readLoop / RPC）
- [ ] 14.6 `WithBufferSize(n int)` option（仅控制 typed channel；默认 64；raw chan buffer 固定 64；dispatchQueue 默认 256，env `GATEWAY_EVENT_DISPATCH_QUEUE_SIZE` 可调）
- [ ] 14.7 双层引用计数：`Realtime` 维护 (a) `sessionMessagesRefCount map[sessionKey]int` —— 每个 `SubscribeMessages(key)` +1 / unregister -1，归 0 时发 `sessions.messages.unsubscribe(key)`；(b) `sessionsLifecycleRefCount int` —— 每个会发送或依赖 `sessions.subscribe` 的 subscription +1 / unregister -1，归 0 时发 `sessions.unsubscribe`。注意：MVP `Realtime.SubscribeSession(ctx, key)` 会同时发送 `sessions.subscribe` 与 `sessions.messages.subscribe(key)`；若 PR-14 复用该 helper，`SubscribeMessages(key)` 也必须增加 lifecycle refcount，或先拆出 `EnsureSessionsSubscribed` / `SubscribeSessionMessages` 低层 helper 来避免 lifecycle 漏计。
- [ ] 14.8 ctx cancel + 显式 cancel 双关闭语义：unregister raw chan → 引用计数归 0 时**用独立 fresh ctx** `context.WithTimeout(context.Background(), 1*time.Second)` 发送 unsubscribe RPC（**禁止复用 caller 已取消的 ctx**——否则 `ensureConnected(ctx)` 立即返回 `ctx.Err()` 让 unsubscribe RPC 永不发出，server 端订阅 leak）→ server 响应或 fresh ctx 超时后 close raw chan → reader goroutine 退出 → close typed channel；超时阈值 env `GATEWAY_UNSUBSCRIBE_TIMEOUT_MS` 可调
- [ ] 14.9 新增 Go test 依赖：`go get -t go.uber.org/goleak`（test-only，不进 production binary）；`go mod tidy` + commit `go.sum`
- [ ] 14.10 单测覆盖（8 场景，全部 `go test -race`）：(1) 单订阅事件接收 (2) N 并发订阅独立关闭 (3) ctx cancel 自动 unsubscribe + close typed channel (4) 显式 cancel 等价 (5) Realtime 重连后续订对 caller 透明 (6) **慢 caller 仅影响自身**（其他 subscriber 与 RPC response 路径正常）(7) raw chan 满 drop 最旧 + metric (8) dispatchQueue 满 drop 最旧 + metric；`goleak.VerifyTestMain` 接入

### PR-15：Chat 域（1 wrapper 薄壳；R1.2 后 chat.send/abort/agent.wait 入 deferred）

- [ ] 15.1 `ChatHistory` 改 typed 薄壳
- [ ] 15.2 [DEFERRED via R1.2] `chat.send` / `chat.abort` / `agent.wait` 标记入 `DECK_GO_DEFERRED_METHODS`（Deck 路由 /chat/\* 走 BFF 内部 sessions.send/abort；agent.wait 无 Deck UI caller）
- [ ] 15.3 [DEFERRED] 与 15.2 联动：未来真补 caller 时再调整 handler 字段访问

### PR-16：Wizard + Talk 缺失方法包圆（7 缺失方法）

- [ ] 16.1 新增 `wizard.start` / `wizard.next` / `wizard.cancel` / `wizard.status` 直接走 `generated.TypedClient`
- [ ] 16.2 新增 `talk.config` / `talk.mode` / `talk.speak` 直接走 `generated.TypedClient`
- [ ] 16.3 caller handler 按需补；wizard 多步交互需要 ctx 传递正确

## 5. Phase 4 — FE typed client 接入 + Coverage gate（PR-17 ~ PR-18）

### PR-17：FE Gateway RPC proxy 类 endpoint 切 typed client（D5 v2 修订）

- [ ] 17.0 **endpoint 分类审计**（必须先做）：审计 `deck-go/frontend/src/api.ts` 全部 ~50+ endpoint，输出 `deck-go/docs/fe-endpoint-classification.md` 表格 `Path | Category | Migration Target | Notes`，Category ∈ {`gateway-rpc-proxy`, `deck-go-bff`, `binary-stream-upload`}；初步分类预估见 design.md D5
- [ ] 17.1 列出 deck-go BFF middleware 清单（auth header / tracing / rate-limit / ...）；写入 `deck-go/docs/bff-middleware-migration.md`；每条注明迁移目标位置（仅迁 Category=`gateway-rpc-proxy` 涉及的 middleware）
- [ ] 17.2 实现 typed gateway transport wrapper：caller 自定义高阶 `request` 函数（在 `createGatewayClient(request: GatewayRequestFn)` 外注入 `Authorization`/`X-Request-Id`/其他 header），不依赖未存在的 `createGatewayClient(options)` 签名；wrapper 形如 `function makeAuthedClient(token, requestId): GatewayClient { return createGatewayClient(buildAuthedTransport(token, requestId)) }`
- [ ] 17.3 修改 `deck-go/frontend/src/api.ts`：仅替换 Category=`gateway-rpc-proxy` 的 endpoint 为 typed client 调用；Category=`deck-go-bff` 的 endpoint **保留不动**（如 `/settings`、`/devices/*`、`/bootstrap/status`、`/runtime/gateway/*`、`/channels`、`/approvals/*` 等；易混路径以 17.0 分类表为准）
- [ ] 17.4 `frontend/src/services/**` 与 store：仅"Gateway RPC proxy 类"调用全部走 `gw.*`；本地 control-plane 调用维持现有 fetch 路径
- [ ] 17.5 删除 deck-go 后端 Go handler 中已迁移到 typed client 的 Gateway RPC proxy endpoint（仅这部分）；保留所有 deck-go-bff 与 binary-stream-upload 类 endpoint；PR 描述列出删除清单 + 保留清单
- [ ] 17.6 `GatewayError` discriminated union 接入 store 错误处理；`isGatewayScopeError` 用于全局窄化判断（不在 transport 拦截）
- [ ] 17.7 验证：FE `pnpm tsgo` 与 vitest 通过；浏览器手测金路径（agents 列表、session 创建、chat 收发、approval、subscription 实时事件 5 个）+ 手测 deck-go-bff 类功能仍可用（settings 加载、devices 列表、channels 状态、approvals 队列）

### PR-18：Coverage gate（D7 + D12）

- [ ] 18.1 实现 `make gateway-typecheck`：(a) Go 端扫描 `internal/runtime/openclaw/` / `internal/handlers/` 中 `requester.Request(ctx, "<string>", ...)` 字符串调用；(b) FE 端**仅**扫描 PR-17 输出的 `fe-endpoint-classification.md` 中 Category=`gateway-rpc-proxy` 的字符串调用（不扫 `deck-go-bff` 与 `binary-stream-upload`）；行级豁免 `// gateway:allow-untyped reason: <文字>` 与 `// fe-gateway-allow-untyped reason: <文字>`
- [ ] 18.2 实现 `make gateway-coverage-report`：输出 `docs/gateway-coverage-baseline.json` 四项指标 + `docs/gateway-coverage.md` 人类可读报告；`upstream_typed` 不含 fork-divergent；D12 8 个无 schema 方法在豁免清单
- [ ] 18.3 在 deck-go CI 加 `make gateway-typecheck`（阻塞）+ `make gateway-coverage-report`（与 main baseline 对比，倒退 fail 除非 PR 含豁免）
- [ ] 18.4 写入初版 `docs/gateway-coverage-baseline.json`（commit 前手动跑一次确认前面 PR 都已 land 且无 untyped）
- [ ] 18.5 `docs/gateway-untyped-exceptions.md` 列出现存豁免（D12 8 个 + 其他个案；每条带 reason + tracking issue）

## 6. 测试基线 + 验收

- [ ] 19.1 给每个迁移到 typed 的 wrapper 至少补 1 个 error path test（`scope_denied` / `validation_failed` / `connection_lost` 抽样；PR-4 的 typed `ErrCode` 是入口）
- [ ] 19.2 抽样跑 5 个高频 method（`agents.list` / `sessions.list` / `chat.history` / `exec.approval.list` / `usage.cost`）的 RPC 延迟基准（与 MVP `transport-benchmark.md` 对照），确认本提案 D11 优化未引入回退（容差 < 10%）；写入 `docs/transport-benchmark.md` 增量段
- [ ] 19.3 跑 `cd deck-go/backend && go test -race ./internal/...` 全绿；订阅相关测试 `goleak` 检查通过
- [ ] 19.4 跑 FE `pnpm tsgo` 全绿；FE vitest 全绿
- [ ] 19.5 浏览器 E2E 抽样：agents 列表显示、session 创建+chat 收发、approval 弹窗、subscription 实时事件 4 个金路径
- [ ] 19.6 跑 `make gateway-typecheck`（应 0 violation 0 豁免，除 D12 8 个）+ `make gateway-coverage-report`（覆盖率 = 100% upstream typed methods）

## 7. 文档与移交

- [ ] 20.1 在 `deck-go/README.md` 增加 "All Gateway calls go through typed bindings" 章节，附 `make gateway-typecheck` / `make gateway-coverage-report` 命令清单
- [ ] 20.2 在 `deck-upstream-sync` skill 文档加入 "rebase 后跑 `make gateway-coverage-report` 检查倒退" 步骤（MVP 已加入 `make protocol-update`，本提案补 coverage 检查）
- [ ] 20.3 在 `deck-go/docs/gateway-coverage.md` 写入最终覆盖率 + 已迁移 method 完整列表 + 与 dashboard 对照表
- [ ] 20.4 在 PR-18 描述附 before/after 覆盖率对照、删除的 BFF endpoint 清单、新增的 typed binding 调用统计
- [ ] 20.5 提案 3（适配层迁移）依赖项确认：`gateway_queries.go` 116 wrapper 已全部 typed 薄壳化（薄壳删除留给提案 3）；coverage gate 已就位防倒退；`docs/fork-divergent-methods.md` 经 PR-6 算法收紧后已最终化为提案 3 的输入；8 个 D12 豁免方法的上游 schema 补全推到提案 3

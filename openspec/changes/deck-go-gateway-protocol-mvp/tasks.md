## 1. Codegen 脚本骨架与共享工具

- [x] 1.1 在 `deck-go/contracts/scripts/` 新建 `package.json`（声明 `bunx tsx` 运行时；不引入项目级 devDep；与上游 `scripts/protocol-gen-ts.ts` 同栈）
- [x] 1.2 在 `deck-go/contracts/scripts/lib/` 抽取共享工具：从 `<repo>/src/gateway/method-registry-data.ts` 静态 `import { allMethodDefs, allEventDefs }`、TypeBox schema → 类型映射、字母序排序辅助
- [x] 1.3 单测覆盖共享工具的确定性排序行为（Vitest 或等价框架）；fixture 覆盖 union/recursive/record schema-shape 变更
- [x] 1.4 在 `deck-go/Makefile` 新增 `protocol-gen-ts`、`protocol-gen-go`、`protocol-update`、`protocol-check`、`fork-divergence-report` 五个 target，预留挂钩点

## 2. TS codegen（对标项，对齐 dashboard）

- [x] 2.1 实现 `deck-go/contracts/scripts/protocol-gen-ts.ts`，复用上游 `scripts/protocol-gen-ts.ts` 的解析逻辑，输出到 `deck-go/contracts/generated/ts/gateway/protocol.ts`
- [x] 2.2 实现 `deck-go/contracts/generated/ts/gateway/client.ts` 生成（typed `createGatewayClient` + `GatewayClient` interface + `GENERATED_METHOD_ALLOWLIST`），与 dashboard `gateway-client.generated.ts` 形态对齐；**显式区分 allowlist (`Object.keys(allMethodDefs)`) 与 typed methods (`params || result`) 两个集合**
- [x] 2.3 验证：典型 method 集合等于 dashboard `GatewayMethodMap` 键集合，且 `GENERATED_METHOD_ALLOWLIST` 等于 dashboard 同名常量（写一个 diff 单测，源数据来自两边的生成产物）
- [x] 2.4 连续两次跑生成命令，确认输出 byte-identical（确定性排序回归测试）
- [x] 2.5 实现 CHECK_MODE：脚本内存中产出 expected 内容，逐文件 `existsSync` + byte-equal 比对，分别报告 `MISSING:` 与 `DRIFT:`（对齐 `scripts/protocol-gen-ts.ts:395-415`）

## 3. Go codegen（对标项扩展，dashboard 没有 Go 版本）

- [x] 3.1 实现 `deck-go/contracts/scripts/protocol-gen-go.ts`，输出 `deck-go/backend/internal/gateway/generated/methods.go`（PascalCase 函数 + `Params`/`Result` typed 签名；只覆盖 `params || result` 子集）
- [x] 3.2 输出 `deck-go/backend/internal/gateway/generated/types.go`（DTO 结构体），与 `methods.go` 解耦控制单文件大小（每个文件 <2000 行）
- [x] 3.3 输出 `deck-go/backend/internal/gateway/generated/allowlist.go`（`var AllowlistMethodNames = map[string]struct{}{...}`），方法名集合等于上游 `Object.keys(allMethodDefs).toSorted()`，**包含纯 scoped methods**（如 `plugin.approval.list`、`plugin.approval.waitDecision`）
- [x] 3.4 在 `deck-go/backend/internal/gateway/generated/` 内补 `doc.go` 与 `package generated` 声明；`go vet ./...` 与 `go build ./...` 必须在 `deck-go/backend/` module 内通过（不新建 go.mod 或 go.work）
- [x] 3.5 单测覆盖：用一个最小上游样本 schema 驱动 codegen，断言生成产物的关键签名 + allowlist 内容；断言 typed methods ⊊ allowlist
- [x] 3.6 CHECK_MODE：与 task 2.5 同模式，对 Go 产物文件做 missing/drift 报告
- [x] 3.7 连续两次跑 codegen，确认输出 byte-identical（确定性排序回归测试）

## 4. Drift 检测与 CI 接入（对标项）

- [x] 4.1 实现 `make protocol-check`：设置 `CHECK_MODE=1` 跑 `protocol-gen-ts.ts` + `protocol-gen-go.ts`；脚本内部内存比对，**不写入磁盘、不依赖 `git diff --exit-code`**；缺失/漂移分别提示 `MISSING:` / `DRIFT:` + `make protocol-update` 修复指引
- [x] 4.2 实现 `make protocol-update`：依次跑 `protocol-gen-ts` 与 `protocol-gen-go`（不带 CHECK_MODE 写入磁盘），并对生成目录做最终格式化（`gofmt`、`prettier`/`oxfmt`）
- [x] 4.3 在 deck-go 的 CI workflow 中加入 `make protocol-check` 步骤；不调用 `fork-divergence-report`（该脚本不阻塞 CI）
- [x] 4.4 在 `deck-upstream-sync` skill 文档中加入 "rebase 后必须跑 `make protocol-update` 并提交 generated 变更" 的步骤

## 5. 传输层单连接复用与 lifecycle（对标项）

- [x] 5.1 在 `deck-go/backend/internal/events/` 加 `NewNoopBus()` 空实现（`Publish` 为空函数）；当 `Client` 不需要消费 event 时使用，避免 `Realtime` 强依赖造成 nil panic
- [x] 5.2 在 `deck-go/backend/internal/gateway/realtime.go` 增加 `Realtime.Request(ctx, method, params)` 公开 API；将 `request` 私有方法重命名为 `requestLocked`/`doRequest` 并通过公开 API 入口
- [x] 5.3 增加单飞（singleflight）连接保护：`Realtime` 新增 `connectInProgress chan struct{}` + `connectErr error`；`ensureConnected` 在锁内三态判定（已连接 / 正在连接 / 我来连接）；并发首发 RPC 共享同一 dial
- [x] 5.4 修改 `deck-go/backend/internal/gateway/client.go`：增加 `NewClientWithRealtime(rt *Realtime)` 构造；保留 `NewClient(provider)` 旧签名，内部用 `events.NewNoopBus()` 构造一个内部 `Realtime`；`Client.Request` 委托给 `Realtime.Request`
- [x] 5.5 标记 `RequestDirect` 为 `// Deprecated: prefer Client.Request via Realtime`，方法签名不变；删除内部对 `RequestDirect` 的使用
- [x] 5.6 增加 `gateway.ErrConnectionLost` 哨兵错误，在 `Realtime.closeConnection` 时给所有 pending request 上抛
- [x] 5.7 实现重连逻辑：指数退避 1s→2s→4s→8s→16s→30s→30s 上限，无限重试；新连接建立后自动重新发送已存在的 `sessions.subscribe` 与 `sessions.messages.subscribe(key)`
- [x] 5.8 ctx 覆盖 handshake 阶段：`completeConnect` 启动一个监听 `ctx.Done()` 的 goroutine，在 ctx cancel 时主动 `conn.Close()` 让 `ReadMessage` 立即返回；测试覆盖
- [x] 5.9 ctx 取消路径：`Realtime.request` 在 ctx 取消时清理 `pending` map 项，后续到达的迟到响应安全丢弃
- [x] 5.10 `Realtime.Close()` 实现：关 conn + cancel 所有 pending + 终止重连循环
- [x] 5.11 单测覆盖：单连接复用、并发首发只产生 1 conn、断线 pending 上抛、指数退避、订阅自动恢复、ctx 在 handshake/request 取消不泄漏 pending、迟到响应不破坏其他请求；全部跑 `go test -race`
- [x] 5.12 集成测试：用一个本地 mock Gateway（gorilla/websocket server）抽样跑 5 个代表性 wrapper（`gateway_queries.go` 的 `AgentsList`/`UsageCost`/`SessionsList`/`Health`/`ConfigGet`），对比单连接前后返回值；不需要为全 70 个 wrapper 建回归用例集合
- [x] 5.13 RPC 延迟基准测试：本机 loopback 下 100 次 `health` RPC，第 2 次起中位延迟 <10ms，记录到 `deck-go/docs/transport-benchmark.md`

## 6. Fork-divergent 方法清单（增值项，不阻塞 CI）

- [x] 6.1 实现 `deck-go/contracts/scripts/fork-divergence-report.ts`：按优先级解析 baseline `upstream/main` → `origin/main` → 环境变量 `OPENCLAW_UPSTREAM_BASE`；全部不可用时退化模式（标记 `baseline-unavailable`，0 退出码 + stderr 警告）
- [x] 6.2 数据采集：`git diff <baseline>..HEAD -- src/gateway/server-methods-list.ts src/gateway/server-methods/` 提取 method 增量
- [x] 6.3 同时调用上游 `gateway.describe`（或解析 `method-registry-data.ts`）与 baseline 上的 `method-registry-data.ts` 做集合对比，并集去重
- [x] 6.4 输出 `deck-go/docs/fork-divergent-methods.md`，markdown 表格含 `Method | Type (added/modified/baseline-unavailable) | Evidence (file:line) | Notes` 四列；条目按 method 名字母序
- [x] 6.5 输出确定性：内容无变化时不修改文件（除非 mtime 差异，避免 git noise）
- [x] 6.6 在 `deck-upstream-sync` skill 文档中加入 "rebase 后跑 `make fork-divergence-report` 并审阅 diff" 步骤
- [x] 6.7 人工补全 `Notes` 列对已知的 fork 增量（SSRF、Channel Event Filter、WeCom 等）的简短理由

## 7. 验收与文档

- [x] 7.1 在 `deck-go/contracts/README.md` 与 `deck-go/README.md` 加入 codegen / 单连接 / drift 检测 / fork-divergent 流程的简要说明与命令清单；明确 Go 产物路径在 `backend/internal/gateway/generated/` 而非 `contracts/generated/go/`
- [x] 7.2 在 `deck-go/docs/` 加入 `transport-benchmark.md`，记录基准测试结果与重跑命令
- [x] 7.3 跑 `make protocol-check` 在干净状态确认通过；跑 `go test -race ./internal/gateway/...` 通过
- [x] 7.4 在 PR 描述中附 `before/after` 的 RPC 延迟对比与 `fork-divergent-methods.md` 摘要
- [x] 7.5 提案 2（完全对齐）依赖项确认：`fork-divergent-methods.md` 已可作为提案 2 的输入；`AllowlistMethodNames` 与 typed methods 两个集合的区分已在 spec/code 中明确

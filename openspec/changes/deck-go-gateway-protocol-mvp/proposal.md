## Why

deck-go 当前与 dashboard (Next.js 客户端) 在 Gateway 协议对接层存在结构性差距：dashboard 用 `scripts/protocol-gen-ts.ts` 自动生成两类产物——`GENERATED_METHOD_ALLOWLIST`（约 110 个 method 名）与 `GatewayMethodMap`（**有 `params` 或 `result` schema 的 typed methods 子集**）；deck-go 全部走 `map[string]any` 弱类型 + 每次 RPC 重新握手。在补齐功能差距（30+ missing methods）之前，必须先把契约/传输基础设施对齐，否则后续每补一个 method 都会重复"手写包装 + 测试 + 验证"的代价，且无法保证与上游同步。本提案只做基础设施，不补业务方法。

## What Changes

- **新增** `deck-go/contracts/scripts/protocol-gen-go.ts` 和 `protocol-gen-ts.ts`，**直接 import 上游 `src/gateway/method-registry-data.ts` 的 `allMethodDefs` / `allEventDefs`**（与 `scripts/protocol-gen-ts.ts:182` 同源），生成 Go + TS typed bindings
- **新增** Go 生成产物，**位于 backend module 内** `deck-go/backend/internal/gateway/generated/`（`methods.go` + `types.go` + `allowlist.go`），使其在 `deck-go/backend/go.mod` 范围内可直接 `go build`；TS 生成产物 `deck-go/contracts/generated/ts/gateway/{protocol,client}.ts`，与 dashboard 等价
- **生成两类 set**：`AllowlistMethodNames`（来自 `Object.keys(allMethodDefs)`，含纯 scoped methods 如 `plugin.approval.list/waitDecision`）与 `TypedMethods`（来自 `params || result` 过滤，对应 dashboard `GatewayMethodMap` 与 `GatewayClient`）；二者**不等价**，spec 与代码都需明确区分
- **修改** `deck-go/backend/internal/gateway/client.go::Client.Request`，从每次新建 WS 改为复用 `realtime.go::Realtime` 长连接；`Realtime` 增加自动重连、请求超时、**单飞（singleflight）连接保护**
- **新增** `deck-go/Makefile` 的 `protocol-check` target，逻辑对齐 `scripts/protocol-gen-ts.ts:395-415` 的 CHECK_MODE：逐文件检查存在性 + byte-equal，缺失/漂移均失败；**不依赖 `git diff --exit-code`**
- **新增** `deck-go/docs/fork-divergent-methods.md`，列出 fork 相对上游基线增加的 Gateway methods，每条带 file:line 证据；**优雅降级**：`upstream/main` 不存在时退化为只列 fork 当前注册的所有 method 并标记需补对比
- **保留** 现有 `internal/runtime/openclaw/gateway_queries.go` 70 个 wrapper 不动（typed binding 与之并存，逐步迁移交给后续提案）

明确**非目标**（留给后续提案）：

- 不补任何 missing typed methods（`chat.send/abort`、`exec.approval.*`、`wizard.*`、`talk.*` 等 30+ 留给"完全对齐"提案）
- 不替换 deck-go FE `frontend/src/api.ts` 中的字符串端点（FE 仍走现有 REST）
- 不做 Error/Scope 标准化
- 不动 fork-divergent 方法的实现，只做标注

## Capabilities

### New Capabilities

- `deck-go-gateway-codegen`: 从上游 `gateway.describe` 自动生成 deck-go 的 Go + TS Gateway typed bindings，与 dashboard 现有 `pnpm protocol:gen:ts` 对齐。**对标项**。
- `deck-go-gateway-transport`: deck-go Go 端 Gateway WebSocket 单连接复用与生命周期管理，统一一次性 RPC 与订阅链路。**对标项**（dashboard 早已是单连接复用）。
- `deck-go-protocol-drift-check`: deck-go 对生成产物与上游 schema 的漂移检测，CI 阻塞。**对标项**。
- `deck-go-fork-divergence-inventory`: 标识 fork 相对上游新增的 Gateway methods，作为后续"完全对齐"与"适配层迁移"提案的输入。**增值项**（dashboard 不需要，因为它本身在 fork 内）。

### Modified Capabilities

- `gateway-communication`: 新增 deck-go 客户端的 typed client 覆盖与 transport 复用要求（现有 spec 仅约束 Deck Server / dashboard，需扩展到 deck-go 同等水平）。

## Impact

- **Affected code**:
  - 新增：`deck-go/contracts/scripts/`、`deck-go/contracts/generated/ts/`、`deck-go/backend/internal/gateway/generated/`（Go 产物在 backend module 内）、`deck-go/Makefile` 新 target、`deck-go/docs/fork-divergent-methods.md`
  - 修改：`deck-go/backend/internal/gateway/client.go`、`deck-go/backend/internal/gateway/realtime.go`
  - 不动：`deck-go/backend/internal/runtime/openclaw/gateway_queries.go`（保持向后兼容）、上游 `src/**`（项目根 CLAUDE.md 禁止）
- **APIs**: 不引入对外 API 变化；Go 端新增可调用的 typed binding（与现有 `gateway_queries.go` 并存）
- **Dependencies**: codegen 脚本通过 root **`bunx tsx`** 调用（与上游 `scripts/protocol-gen-ts.ts` 同栈，不新增项目级 devDep；脚本本身只在 `deck-go/contracts/scripts/` 维护）
- **CI**: 新增 `make protocol-check` 步骤（CHECK_MODE 逐文件 missing+content 比对），未通过阻塞合并
- **Performance**: Go 端 RPC 延迟从 ~50–500ms（每次握手）降至 <10ms（单连接复用），可衡量
- **Module/import**: Go 生成产物以独立子包 `package generated` 暴露给 `internal/gateway` 与 `internal/runtime/openclaw/`；不需要新建 `deck-go/go.mod` 或 `go.work`
- **Risk**:
  - codegen 输出的确定性排序须严格满足项目根 CLAUDE.md 的 prompt-cache 稳定性约束
  - 长连接断线重连策略须保证不丢已发未响应的 request（pending map 复用 / 失败上抛）
  - drift 检测脚本必须区分 missing/drift 两类失败，避免 untracked 文件误漏（参考 `scripts/protocol-gen-ts.ts:395-415`）
  - 单飞连接保护：并发首发 RPC 不得建多条 WS（spec 必须含并发 scenario）

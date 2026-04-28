## ADDED Requirements

### Requirement: deck-go codegen 直接 import 上游静态注册表

deck-go codegen 脚本 SHALL 通过 import `src/gateway/method-registry-data.ts` 的 `allMethodDefs` 与 `allEventDefs` 获取 Gateway 协议数据，与上游 `scripts/protocol-gen-ts.ts:182` 同源，避免与 dashboard 出现 set 差异。

#### Scenario: codegen 数据源是静态 import 而非 RPC

- **WHEN** `deck-go/contracts/scripts/protocol-gen-go.ts` 或 `protocol-gen-ts.ts` 执行
- **THEN** 脚本 SHALL 通过 `import { allMethodDefs, allEventDefs } from "<repo>/src/gateway/method-registry-data"` 解析协议数据
- **AND** SHALL NOT 启动任何 Gateway 进程或调用 `gateway.describe` RPC

### Requirement: deck-go 输出 Go typed binding（typed = params || result）

deck-go SHALL 生成 Go typed Gateway binding，覆盖上游 `allMethodDefs` 中**所有满足 `params || result` 的 method**。"typed method"定义统一为 `params || result`，与 dashboard `scripts/protocol-gen-ts.ts:182-199, 355-358` 一致。

#### Scenario: 生成 methods.go 包含全部 typed methods

- **WHEN** `deck-go/contracts/scripts/protocol-gen-go.ts` 执行
- **THEN** `deck-go/backend/internal/gateway/generated/methods.go` SHALL 存在且为非空 Go 源码
- **AND** 文件 SHALL 为上游 `allMethodDefs` 中每个满足 `def.params || def.result` 的 method 生成一个对应签名（函数名采用 PascalCase，例如 `chat.history` → `ChatHistory`、`plugin.approval.request` → `PluginApprovalRequest`）

#### Scenario: 仅有 params 无 result 的 method 也属于 typed

- **GIVEN** 上游 method `plugin.approval.request` 在 `src/gateway/server-methods/control-plane-method-defs.ts` 注册了 params schema 但没有 result schema
- **WHEN** Go codegen 执行
- **THEN** `methods.go` SHALL 生成 `PluginApprovalRequest(ctx, params PluginApprovalRequestParams) (any, error)` 形式的签名（result 类型为 `any`）

#### Scenario: 无 params 无 result 的 scoped method 不进入 typed methods

- **GIVEN** 上游 method `plugin.approval.list` 在 `methodDefs` 注册但 `def.params` 与 `def.result` 均未设置
- **WHEN** Go codegen 执行
- **THEN** `methods.go` SHALL NOT 为 `plugin.approval.list` 生成 typed 签名

#### Scenario: 生成的 Go binding 携带 typed Params/Result

- **WHEN** Go binding 中包含 typed method `M`
- **THEN** 当且仅当上游 `def.params` 存在时 SHALL 暴露 `MParams` struct
- **AND** 当且仅当上游 `def.result` 存在时 SHALL 暴露 `MResult` struct
- **AND** 字段名与上游 schema 字段一一对应

### Requirement: deck-go 输出 Go method allowlist（allowlist = Object.keys）

deck-go SHALL 生成 `AllowlistMethodNames`（method 名集合），等价于 dashboard `GENERATED_METHOD_ALLOWLIST = Object.keys(allMethodDefs).toSorted()`，包含**所有**注册 method（含纯 scoped、无 schema 的 methods）。

#### Scenario: allowlist 包含纯 scoped methods

- **WHEN** Go codegen 完成
- **THEN** `deck-go/backend/internal/gateway/generated/allowlist.go` SHALL 暴露 `var AllowlistMethodNames = map[string]struct{}{...}`，键为 method 字符串名
- **AND** allowlist SHALL 包含 `plugin.approval.list` 与 `plugin.approval.waitDecision`（即使它们不在 typed methods 集合中）
- **AND** allowlist 内容 SHALL 等于上游 `Object.keys(allMethodDefs).toSorted()`

#### Scenario: typed methods 是 allowlist 的真子集

- **WHEN** Go codegen 完成
- **THEN** typed methods 集合 SHALL 是 allowlist 的子集
- **AND** 上游存在至少一个 method（如 `plugin.approval.list`）在 allowlist 但不在 typed 集合，使两者严格不等

### Requirement: deck-go 输出 TS typed client

deck-go SHALL 生成 TS typed Gateway client，与 dashboard 现有 `gateway-client.generated.ts` / `gateway-protocol.generated.ts` 在 method 集合与签名上等价，供 deck-go FE 使用。

#### Scenario: 生成 protocol.ts 包含 GatewayMethodMap

- **WHEN** `deck-go/contracts/scripts/protocol-gen-ts.ts` 执行
- **THEN** `deck-go/contracts/generated/ts/gateway/protocol.ts` SHALL 暴露 `export type GatewayMethodMap = { ... }`
- **AND** `GatewayMethodMap` 键集合 SHALL 等于 dashboard `gateway-protocol.generated.ts` 的 `GatewayMethodMap` 键集合（即 `params || result` 子集）

#### Scenario: 生成 client.ts 包含 createGatewayClient 与 GENERATED_METHOD_ALLOWLIST

- **WHEN** codegen 完成
- **THEN** `deck-go/contracts/generated/ts/gateway/client.ts` SHALL 暴露 `export function createGatewayClient(request: GatewayRequestFn): GatewayClient`
- **AND** SHALL 暴露 `export const GENERATED_METHOD_ALLOWLIST: ReadonlySet<string>`，内容等于 `Object.keys(allMethodDefs).toSorted()`
- **AND** `GatewayClient` 接口的方法集合 SHALL 等于 dashboard `gateway-client.generated.ts` 的 `GatewayClient` 接口方法集合

### Requirement: codegen 输出确定性排序

为满足项目根 CLAUDE.md 的 prompt-cache 稳定性约束，codegen 输出 SHALL 严格按字母序排列 method、字段与 import。

#### Scenario: 连续两次 codegen 输出 byte-identical

- **GIVEN** 上游 `method-registry-data.ts` 未变更
- **WHEN** `protocol-gen-go.ts` 与 `protocol-gen-ts.ts` 各执行两次
- **THEN** 两次执行后 `deck-go/backend/internal/gateway/generated/` 与 `deck-go/contracts/generated/ts/` 下所有文件 SHALL byte-identical（`git diff` 为空）

#### Scenario: 输入字段顺序变化不影响输出

- **GIVEN** 上游 schema 字段定义顺序变化但语义集合不变
- **WHEN** codegen 重新执行
- **THEN** 生成产物 SHALL 与变更前 byte-identical

## ADDED Requirements

### Requirement: deck-go FE Gateway RPC proxy 类调用 SHALL 走 typed client（仅此一类）

deck-go FE 中**Gateway RPC proxy 类**调用（即原本通过 BFF 字符串 endpoint 转发到上游 Gateway typed methods 的路径）SHALL 通过 `contracts/generated/ts/gateway/client.ts::createGatewayClient` 完成；deck-go BFF 自身的 control-plane endpoint（如 `/settings`、`/devices/*`、`/bootstrap/status`、`/runtime/gateway/*`、`/channels`、`/approvals/*`，以及二进制/SSE/上传类 endpoint）SHALL 保持现有 `fetch` 调用不变。`/skills/*`、`/deck/plugins`、`/runtimes/{id}/models/*` 等易混路径 SHALL 以 PR-17 输出的 `deck-go/docs/fe-endpoint-classification.md` 为准，不得在实现前预判为 BFF 或 Gateway proxy。

#### Scenario: typed RPC 调用通过 typed client

- **scenario_id**: `deck-go-frontend-typed-client-adoption.typed-rpc-client`
- **GIVEN** FE 需要调用上游 Gateway typed method `agents.list`（PR-17 分类为 `gateway-rpc-proxy`）
- **WHEN** caller 写入 `const agents = await gw.agents.list(params)` 或等价 `gw['agents.list'](params)`
- **THEN** TypeScript 编译期 SHALL 强制 `params` 与 `agents` 类型与上游 schema 一致
- **AND** 任意拼写错误（如 `gw.agents.lst`）SHALL 在编译期报错

#### Scenario: deck-go BFF control-plane 调用保留 fetch

- **scenario_id**: `deck-go-frontend-typed-client-adoption.bff-control-plane-fetch`
- **GIVEN** FE 需要调用 deck-go 后端自身 endpoint（PR-17 分类为 `deck-go-bff`，如 `/settings`、`/devices/approve`、`/runtime/gateway/start`）
- **WHEN** FE 通过 `fetchDeckJson('/settings')` 或同等 `fetch('/api/devices/approve')` 调用
- **THEN** `make gateway-typecheck` SHALL 跳过这类调用（按 `fe-endpoint-classification.md` Category 匹配）
- **AND** deck-go Go 后端的对应 handler SHALL 保留响应该 endpoint

#### Scenario: 二进制/SSE/上传 endpoint 保留

- **scenario_id**: `deck-go-frontend-typed-client-adoption.binary-sse-upload-fetch`
- **GIVEN** FE 需要下载二进制日志（`/download/logs/<id>`）或消费 SSE 流（`/sse/chat/<sessionKey>`）或上传文件（`/upload/files`）
- **WHEN** FE 调用 `fetch('/download/logs/...')` 等
- **THEN** `make gateway-typecheck` SHALL 跳过该调用（PR-17 分类为 `binary-stream-upload`）

### Requirement: deck-go FE 删除仅 Gateway RPC proxy 类的 BFF endpoint

deck-go Go 后端 SHALL 删除所有已迁移到 typed client 的 Gateway RPC proxy endpoint，避免双路径维护；deck-go BFF 自身的 control-plane endpoint（`deck-go-bff` 类）与二进制/SSE/上传（`binary-stream-upload` 类）SHALL 保留。

#### Scenario: 仅 gateway-rpc-proxy 类 endpoint 在 PR 中被删除

- **scenario_id**: `deck-go-frontend-typed-client-adoption.gateway-rpc-proxy-delete-only`
- **WHEN** 完成 Phase 4 PR-17
- **THEN** `deck-go/backend/internal/handlers/**`（或等价路由注册）SHALL NOT 含 PR-17 分类为 `gateway-rpc-proxy` 的 endpoint
- **AND** SHALL 含 PR-17 分类为 `deck-go-bff` 与 `binary-stream-upload` 的 endpoint（不动）
- **AND** PR 描述 SHALL 同时列出删除清单与保留清单

### Requirement: BFF middleware 通过 caller-side transport wrapper 迁移到 typed client

原 BFF 路径上的中间件（auth header 注入、tracing、rate-limit 等）SHALL 通过 caller 自定义的高阶 transport 函数注入到 typed client；当前 codegen 输出的 `createGatewayClient(request: GatewayRequestFn)` 仅接收一个 `request` 函数参数（**不是** `createGatewayClient(options)`），caller SHALL 在外部包装该 `request` 函数加 header 等。

#### Scenario: caller 用高阶函数注入 auth header

- **scenario_id**: `deck-go-frontend-typed-client-adoption.transport-auth-header`
- **GIVEN** 原 BFF 路径上 `authMiddleware` 注入 `Authorization` header
- **WHEN** caller 创建 typed client：
  ```ts
  const transport: GatewayRequestFn = async (method, params, options) => {
    return baseTransport(method, params, { ...options, headers: { Authorization: getToken() } });
  };
  const gw = createGatewayClient(transport);
  ```
- **THEN** 每次 `gw.agents.list(...)` 调用 SHALL 通过 `transport` 注入 `Authorization` header
- **AND** 删除原 BFF endpoint 后 caller 鉴权行为 SHALL 不变

#### Scenario: tracing/correlation id 通过 transport wrapper 注入

- **scenario_id**: `deck-go-frontend-typed-client-adoption.transport-tracing`
- **GIVEN** 原 BFF 路径上 tracing middleware 注入 `X-Request-Id`
- **WHEN** caller 在 transport wrapper 中追加 `X-Request-Id: generateId()`
- **THEN** 每次 RPC 的请求 envelope（或 WS frame metadata）SHALL 含 `X-Request-Id`
- **AND** server 端日志 SHALL 能关联到 FE caller

**Non-Goal**：本 spec **不**要求扩展 codegen 让 `createGatewayClient` 接收 `options` 参数；caller-side wrapper 模式是简单 + 灵活的实现路径，避免触动 codegen 模板。

### Requirement: typed client 错误用 GatewayError discriminated union

deck-go FE typed client RPC 失败 SHALL 抛 `GatewayError` discriminated union（与 dashboard 等价），caller 用 `error.code` 窄化判断。

#### Scenario: FE caller 窄化错误处理

- **scenario_id**: `deck-go-frontend-typed-client-adoption.fe-error-narrowing`
- **GIVEN** RPC `chat.send` 抛 `GatewayError({ code: 'validation_failed', details: { field: 'x' } })`
- **WHEN** caller 用 `if (error.code === 'validation_failed') { error.details.field; }`
- **THEN** TypeScript 编译期 SHALL 窄化 `error.details` 类型为对应 schema

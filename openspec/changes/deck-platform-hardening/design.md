## Context

Deck Web Replacement Program 20/30 模块已达 replacement-ready，Phase 1-4 Gate Review 全部 PASS。但平台基础设施层有 4 项缺口阻碍后续跟随上游迭代：

1. **Typed client 缺口**：5 个 upstream 方法（sessions.usage / sessions.usage.logs / sessions.usage.timeseries / tools.effective / skills.install）缺少 result schema，只能通过已弃用的 `gatewayRequest()` 调用
2. **错误处理碎片化**：ErrorBody 类型分散定义在 3 个文件（api-helpers.ts / with-auth.ts / chat-api.ts），客户端 stores 重复编写 try-catch + res.ok + JSON 解析的三段式样板
3. **面板注册硬编码**：新增面板需同步修改 5 个文件（`stores/ui.ts` 类型 / `components/layout/NavRail.tsx` 菜单 / `app/page.tsx` 路由 / `hooks/useKeyboardShortcuts.ts` / i18n），23 个面板 + settings 全部硬编码
4. **覆盖验证人工化**：Gateway 方法族覆盖只能手工对比 matrix 和 client 文件

## Goals / Non-Goals

**Goals:**

- 补齐 5 个 upstream 方法的 result schema，使 typed client 可覆盖这些方法
- 统一错误模型：单一 ErrorCode enum + 共享 client-side fetchApi helper，消除重复样板
- PanelRegistry 动态注册：新增面板只需在 registry 中添加 entry，无需改 Shell/NavRail
- 自动化覆盖检查脚本，CI 可用

**Non-Goals:**

- 不迁移现有 11 个 Functional 方法族到 typed gwRequest（渐进推进，不在本提案范围）
- 不改变 gwRequest 的 NextResponse 返回契约（gwRequest 仍返回 NextResponse，不抛异常）
- 不引入 RJSF / TanStack 等 Schema-Driven UI 框架
- 不改变 Gateway 侧的错误响应格式
- 不实现 rollback API / optimistic update 框架（Shared Error/Mutation 的另一半缺口）
- 不重构面板组件本身（只改注册/路由机制）

## Decisions

### D1: Result Schema 补齐策略

**选择**：在 `src/gateway/protocol/schema/` 下为 5 个方法新增 result schema，在对应 handler 文件的 `methodDefs` 中注册，在 `src/gateway/method-registry-data.ts` 中接入 allMethodDefs，然后 `pnpm protocol:gen:ts` 重新生成。

Schema 推导方式：从 handler 代码中的 `respond(true, ...)` 调用点分析返回值结构，转写为 TypeBox schema（与 Protocol SDK design 一致）。

**理由**：完全遵循现有 Protocol SDK 流程（design doc `2026-03-27-gateway-protocol-sdk-design.md`），不引入新模式。

**替代方案（放弃）**：手写 TypeScript 类型不生成 — 违反 "generated files 不要手编" 规则。

### D2: 统一错误模型设计

**选择**：

1. 新增 `dashboard/src/lib/errors.ts`，导出：
   - `GatewayErrorCode` 枚举（`NOT_CONFIGURED | GATEWAY_ERROR | UNAUTHORIZED | RATE_LIMITED | VALIDATION | INTERNAL`，共 6 个值）
   - `DeckApiError` class（包含 code + message + status）
   - `ErrorBody` 类型（`{ error: string; code?: string }`，单一定义点）
   - `fetchApi<T>(url, options?)` 客户端 fetch helper：封装 res.ok 检查 + JSON 解析 + 错误类型化为 DeckApiError
   - `mapGatewayError(err: ControlPlaneGatewayError): GatewayErrorCode` 映射函数

2. **gwRequest 保持返回 NextResponse 不变**。仅将 catch 块中的 ErrorBody 字面量改为从 errors.ts 导入，error response 中补充 `code` 字段。

3. 客户端 stores 从三段式样板迁移到 `fetchApi()` 一行调用。fetchApi 在客户端侧抛 DeckApiError。

**关键**：服务端路由契约不变（gwRequest 仍返回 NextResponse），只有客户端消费层变化。

**理由**：最小侵入——不改 API route 的返回契约，不破坏现有 `return gwRequest(...)` 模式。ErrorBody 已经存在 `{ error, code? }` 结构，只需正式化。

**替代方案（放弃）**：

- gwRequest 抛异常而非返回 NextResponse — 会破坏所有现有 route 的 `return gwRequest(...)` 模式
- 全栈统一 error codes（需改 Gateway）— 超出范围
- 使用 zod / valibot 做 error schema validation — 过度设计

### D3: PanelRegistry 动态注册

**选择**：

1. 新增 `dashboard/src/lib/panel-registry.ts`，集中定义所有面板的 registry entries
2. 每个 entry：`{ id: string, group, icon, labelKey, component: lazy(() => import(...)), shortcutIndex?, eager?: boolean, position?: 'bottom' }`
3. `Panel` type 从 registry entries 的 id 字段派生：`type Panel = typeof PANELS[number]['id']`
4. NavRail / page.tsx / useKeyboardShortcuts 改为读取 registry

**特殊 UI 约束处理**：

- **Chat eager-load**：registry entry 标记 `eager: true`，page.tsx 对 eager entries 使用静态 import 而非 lazy
- **Settings 固定底部**：registry entry 标记 `position: 'bottom'`，NavRail 将 bottom entries 单独渲染
- **HeaderBar**：已使用 i18n key（`nav.{panel}`），registry 的 labelKey 与之对齐，无需额外改动

**理由**：新增面板只需在 panel-registry.ts 中添加一个 entry（含 lazy import），无需改 Shell/NavRail/page.tsx/useKeyboardShortcuts/ui.ts。集中定义比分散 registry.ts 更简单（23 个面板不需要 23 个文件）。

**替代方案（放弃）**：

- 每个面板目录下单独 registry.ts + barrel 聚合 — 23 个额外文件，过度设计
- 基于文件系统的自动发现 — 需要 webpack/turbopack 插件，过重
- 仍用硬编码但抽成单一 config 文件 — 仍需手动维护列表（但 type 不能自动派生）

### D4: Coverage Gate 自动化

**选择**：

新增 `scripts/protocol-coverage-check.ts`，做四件事：

1. 从 `src/gateway/method-registry-data.ts` 提取 `allMethodNames`（所有已注册方法）
2. 从 `dashboard/src/types/gateway-protocol.generated.ts` 提取 `GatewayMethodMap` 的 keys（真正有完整类型的方法）
3. 从 `dashboard/src/app/api/` 目录 grep `gatewayRequest\("` 提取 untyped 调用
4. 输出覆盖报告：typed（在 GatewayMethodMap 中）/ untyped（仅 gatewayRequest）/ not-covered / N/A

**关键**：typed 的判定基于 `GatewayMethodMap` keys（有完整 params + result 类型），**不是** `GENERATED_METHOD_ALLOWLIST`（后者包含所有已知方法，不区分是否有 result schema）。

注册为 `pnpm protocol:coverage:check`。

**理由**：纯读取 + 报告，不修改任何文件，可安全加入 CI。

## Risks / Trade-offs

- **[Risk] 上游 handler 缺少 TypeBox schema** → 需从 `respond()` 调用点分析返回值结构手写 TypeBox schema。Mitigation：先读 handler 源码确认返回结构，小批量（5 个方法）风险可控。
- **[Risk] PanelRegistry 迁移期间两种模式共存** → 可能有 import 循环。Mitigation：registry 只包含 lazy import 和元数据，不引用 Shell 代码。
- **[Risk] fetchApi 替换客户端 stores 影响面广** → 逐 store 迁移，每个 store 独立 commit，保持可回退。
- **[Trade-off] ErrorCode 枚举只覆盖 Deck 侧** → Gateway 侧仍然返回自由格式 error string。可接受：Gateway error 通过 ControlPlaneGatewayError.code 传递，mapGatewayError 做映射。
- **[Trade-off] Shared Error/Mutation 本提案只解决 error codes 半边** → rollback API / optimistic update 框架不在范围内，该 matrix area 不会因此升级为 replacement-ready。

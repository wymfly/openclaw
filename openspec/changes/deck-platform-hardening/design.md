## Context

Deck Web Replacement Program 20/30 模块已达 replacement-ready，Phase 1-4 Gate Review 全部 PASS。但平台基础设施层有 4 项缺口阻碍后续跟随上游迭代：

1. **Typed client 缺口**：6 个 upstream 方法（sessions.usage / sessions.usage.logs / sessions.usage.timeseries / tools.effective / skills.install / config.set）缺少 result schema，只能通过已弃用的 `gatewayRequest()` 调用
2. **错误处理碎片化**：ErrorBody 类型分散定义在 3 个文件（api-helpers.ts / with-auth.ts / chat-api.ts），客户端 stores 重复编写 try-catch + res.ok + JSON 解析的三段式样板
3. **面板注册硬编码**：新增面板需同步修改 5 个文件（ui.ts 类型 / NavRail 菜单 / page.tsx 路由 / useKeyboardShortcuts / i18n），23 个现有面板全部硬编码
4. **覆盖验证人工化**：Gateway 方法族覆盖只能手工对比 matrix 和 client 文件

## Goals / Non-Goals

**Goals:**

- 补齐 6 个 upstream 方法的 result schema，使 typed client 覆盖所有 Deck 已用方法
- 统一错误模型：单一 ErrorCode enum + 共享 client-side fetch helper，消除重复样板
- PanelRegistry 动态注册：新增面板只需在面板目录下添加 registry entry，无需改 Shell/NavRail
- 自动化覆盖检查脚本，CI 可用

**Non-Goals:**

- 不迁移现有 11 个 Functional 方法族到 typed gwRequest（渐进推进，不在本提案范围）
- 不引入 RJSF / TanStack 等 Schema-Driven UI 框架
- 不改变 Gateway 侧的错误响应格式（只在 Deck 侧统一消费）
- 不重构面板组件本身（只改注册/路由机制）

## Decisions

### D1: Result Schema 补齐策略

**选择**：在 `src/gateway/protocol/schema/` 下为 6 个方法新增 result schema，在对应 handler 文件的 `methodDefs` 中注册，然后 `pnpm protocol:gen:ts` 重新生成。

**理由**：完全遵循现有 Protocol SDK 流程（design doc `2026-03-27-gateway-protocol-sdk-design.md`），不引入新模式。

**替代方案（放弃）**：手写 TypeScript 类型不生成 — 违反 "generated files 不要手编" 规则。

### D2: 统一错误模型设计

**选择**：

1. 新增 `dashboard/src/lib/errors.ts`，导出：
   - `GatewayErrorCode` 枚举（`NOT_CONFIGURED | GATEWAY_ERROR | UNAUTHORIZED | RATE_LIMITED | INTERNAL`）
   - `DeckApiError` class（包含 code + message + status）
   - `fetchApi<T>(url, options)` 共享 fetch helper：封装 res.ok 检查 + JSON 解析 + 错误类型化

2. gwRequest / gatewayRequest 的 catch 块改为抛出 `DeckApiError`

3. 客户端 stores 从三段式样板迁移到 `fetchApi()` 一行调用

**理由**：最小侵入——不改 Gateway 侧，不改 HTTP 状态码语义，只在 Deck 内部统一消费。ErrorBody 已经存在 `{ error, code? }` 结构，只需正式化。

**替代方案（放弃）**：

- 全栈统一 error codes（需改 Gateway）— 超出范围
- 使用 zod / valibot 做 error schema validation — 过度设计

### D3: PanelRegistry 动态注册

**选择**：

1. 新增 `dashboard/src/lib/panel-registry.ts`，导出 `PanelRegistry`
2. 每个面板目录下新增 `registry.ts`，导出 `{ id, group, icon, labelKey, component (lazy) }`
3. `dashboard/src/panels/index.ts` barrel 聚合所有 registry entries
4. NavRail / page.tsx / useKeyboardShortcuts 改为读取 registry 而非硬编码

**迁移路径**：

- Phase 1：创建 registry + barrel，让 5 个 touch point 从 registry 读取（不改面板组件）
- Phase 2：逐步将 23 个面板补上 registry.ts（可批量）

**理由**：新增面板只需创建目录 + registry.ts + 在 barrel 中 import，无需改 Shell/NavRail/page.tsx。

**替代方案（放弃）**：

- 基于文件系统的自动发现（Next.js app router 风格）— 需要 webpack/turbopack 插件，过重
- 仍用硬编码但抽成单一 config 文件 — 仍需手动维护列表

### D4: Coverage Gate 自动化

**选择**：

新增 `scripts/protocol-coverage-check.ts`，做三件事：

1. 从 `src/gateway/method-registry-data.ts` 提取所有已注册方法名
2. 从 `dashboard/src/types/gateway-client.generated.ts` 提取 ALLOWLIST
3. 从 `dashboard/src/app/api/` 目录 grep `gatewayRequest\("` 提取 untyped 调用
4. 输出覆盖报告：typed / untyped / not-covered / N/A

注册为 `pnpm protocol:coverage:check`。

**理由**：纯读取 + 报告，不修改任何文件，可安全加入 CI。

## Risks / Trade-offs

- **[Risk] 上游 handler 无 TypeBox schema** → result schema 可能需要从运行时推断类型。Mitigation：先启动 Gateway，调用方法，用实际返回值推断 schema。
- **[Risk] PanelRegistry 迁移期间两种模式共存** → 可能有 import 循环。Mitigation：barrel 只 re-export lazy components，不引用 Shell 代码。
- **[Risk] fetchApi 替换客户端 stores 影响面广** → 逐 store 迁移，每个 store 独立 commit，保持可回退。
- **[Trade-off] ErrorCode 枚举只覆盖 Deck 侧** → Gateway 侧仍然返回自由格式 error string。可接受：Gateway error 通过 ControlPlaneGatewayError.code 传递，Deck 做映射。

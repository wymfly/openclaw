## Why

Deck Web Replacement Program 的 20 个模块已达 replacement-ready，但平台基础设施层仍有 4 项缺口阻碍后续跟随上游迭代开发：Gateway typed client 覆盖不完整导致新方法无法自动获得类型安全、错误处理各模块各自发明、面板注册硬编码导致新增面板需改 5 处、覆盖验证只能人工执行。这 4 项是进入 Phase 5 Replacement Gate 前必须收尾的平台债务。

## What Changes

- 为 5 个 upstream Gateway 方法补齐 result schema + methodDefs 元数据，重新生成 typed client
- 设计统一的 ErrorCode enum + typed error response model + 客户端 fetchApi helper，消除重复错误处理样板
- 将 Shell/Panel 的硬编码注册（5 个 touch point）重构为 PanelRegistry 动态注册模式
- 新增 `pnpm protocol:coverage:check` 自动化脚本，读取 method registry + GatewayMethodMap 生成覆盖率报告

## Capabilities

### New Capabilities

- `upstream-result-schemas`: 补齐 5 个缺少 result schema 的 upstream Gateway 方法（sessions.usage / sessions.usage.logs / sessions.usage.timeseries / tools.effective / skills.install），使这些已用方法可迁移到 typed gwRequest
- `unified-error-model`: 统一 ErrorCode enum + DeckApiError class + 客户端 fetchApi helper，替代各 store 重复的 try-catch 样板。不改变 gwRequest 的 NextResponse 返回契约
- `panel-registry`: PanelRegistry 动态注册机制，消除 NavRail / page.tsx / useKeyboardShortcuts / ui.ts / i18n 中 5 处硬编码面板列表
- `coverage-gate-automation`: 自动化覆盖验证脚本，从 method-registry-data 读取全量方法，从 GatewayMethodMap 读取 typed 方法，从 API routes grep untyped 调用，输出覆盖报告

### Modified Capabilities

- `gateway-communication`: Gateway typed client 覆盖范围扩展到 5 个 upstream 方法

## Impact

- `src/gateway/server-methods/` — 补充 5 个方法的 result schema + methodDefs
- `src/gateway/protocol/schema/` — 新增 result schema 定义
- `src/gateway/method-registry-data.ts` — 接入新增 methodDefs 到 allMethodDefs
- `scripts/protocol-gen-ts.ts` — 可能需适配新 schema
- `dashboard/src/types/gateway-*.generated.ts` — 重新生成
- `dashboard/src/lib/errors.ts` — 新增统一错误模型（客户端侧）
- `dashboard/src/lib/api-helpers.ts` — ErrorBody 导入改为从 errors.ts
- `dashboard/src/stores/ui.ts` — Panel type 改为从 registry 派生
- `dashboard/src/components/layout/NavRail.tsx` — 从 registry 读取菜单项
- `dashboard/src/app/page.tsx` — 从 registry 读取路由映射
- `dashboard/src/hooks/useKeyboardShortcuts.ts` — 从 registry 读取快捷键
- `scripts/` — 新增 coverage check 脚本

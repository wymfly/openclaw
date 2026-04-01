## Why

Deck dashboard 的目标是成为 OpenClaw 的统一操控界面，覆盖 Gateway 全部能力。当前 Deck 已覆盖 102/147 个 Gateway 方法（69%），但每个面板都是 ~500 行手写代码，7 个面板 copy-paste 同一个 split-pane 结构。未来要补全 CLI-only 能力（plugins/webhooks/hooks/MCP/memory/security 等 ~10 个域），如果继续逐面板手写，工作量不可接受，且面板间 UI 风格不一致。Gateway 已有 TypeBox schema + uiHints + gateway.describe introspection RPC（Protocol SDK 设计），应当让 schema 驱动 UI 生成。

## What Changes

- 引入 **RJSF (`@rjsf/shadcn`)** 作为 JSON Schema 表单渲染引擎，零转换消费 Gateway TypeBox schema
- 引入 **TanStack Table** 作为 schema-driven 数据表格引擎，从 result schema 自动生成列定义
- 新增通用布局组件：**`MasterDetailLayout`**（list + detail split-pane）、**`MethodPanel`**（声明式面板生成器）、**`MethodForm`**（RJSF 表单封装）、**`ResultView`**（自动数据展示）、**`DataTable`**（TanStack Table 封装）
- 建立三层 UI 架构：Layer 1 Schema-Driven Generic（70%）→ Layer 2 Enhanced Generic（20%）→ Layer 3 Custom（10%）
- 新面板（plugins、webhooks、hooks、MCP 等）采用 Layer 1 声明式配置生成，不再手写
- 现有面板逐步迁移到通用布局组件（不改功能，统一结构）

## Capabilities

### New Capabilities

- `schema-driven-form`: RJSF 集成 + MethodForm 封装——从 gateway.describe 的 JSON Schema 自动生成 RPC 方法的 params 输入表单
- `schema-driven-table`: TanStack Table DataTable 封装——从 result schema 自动生成数据表格列定义和渲染
- `generic-panel-layout`: MasterDetailLayout + MethodPanel——通用面板布局组件和声明式面板生成器
- `ui-hints-rjsf-bridge`: 将 Gateway 的 ConfigUiHint 系统映射到 RJSF 的 uiSchema 体系

### Modified Capabilities

<!-- 无需修改现有 spec 的需求——现有面板功能不变，只是结构迁移 -->

## Impact

- **依赖新增**: `@rjsf/core`, `@rjsf/shadcn`, `@rjsf/validator-ajv8`, `@tanstack/react-table`（均为 dashboard/package.json 的 dependencies）
- **依赖前置**: Gateway Protocol SDK（`docs/plans/2026-03-27-gateway-protocol-sdk-design.md`）必须先实施，`gateway.describe` RPC 是运行时 schema 数据源
- **现有代码影响**: Config Editor 的 `SchemaForm` 保留不动（已稳定）；新面板用 RJSF；现有面板的布局逐步迁移到 `MasterDetailLayout` 但功能不变
- **设计系统**: 所有生成的 UI 通过 `@rjsf/shadcn` 主题自动对齐项目的 Tailwind + shadcn 设计系统

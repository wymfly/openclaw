## Context

Deck dashboard 当前有 20+ 面板，每个 ~500 行手写代码。7 个面板使用相同的 list-left/detail-right 分割布局但各自 copy-paste。Config Editor 内有一套自研 schema-driven 表单系统（`schema-parser.ts` → `FormField[]` → `SchemaForm`），但被锁在单一面板未泛化。

Gateway Protocol SDK（`docs/plans/2026-03-27-gateway-protocol-sdk-design.md`）将提供：
- `gateway.describe` RPC — 返回所有方法的 JSON Schema（params + result）
- `MethodRegistry` — method → handler + schema + scope 的声明式注册
- TypeScript codegen — 生成 typed client

这些基础设施让 schema-driven UI 成为可能：schema 不仅驱动类型安全，也驱动 UI 渲染。

**现有技术栈**: Next.js + shadcn/ui + Tailwind CSS + Zustand + next-intl。无 react-hook-form/Zod/Ajv。

## Goals / Non-Goals

**Goals:**
- 新增 RPC 域面板的成本从 ~500 行手写降到 ~30 行声明式配置
- 统一面板布局和交互模式，消除 copy-paste 结构
- 从 gateway.describe 的 JSON Schema 运行时自动生成表单和数据表格
- 保留对特殊面板（Chat、Monitor）的完全自定义能力

**Non-Goals:**
- 不替换 Config Editor 的现有 `SchemaForm`（已稳定，风险不值得）
- 不做通用 low-code 平台——只解决 Gateway RPC 面板的标准化生成
- 不改变 Gateway 的 RPC 协议或连接层
- 不要求所有现有面板立刻迁移——渐进式，新面板强制用，旧面板按需迁移

## Decisions

### D1: 表单引擎选择 RJSF over AutoForm / 自研扩展

**选择**: `@rjsf/core` + `@rjsf/shadcn` + `@rjsf/validator-ajv8`

**替代方案**:
- AutoForm (shadcn): 只支持 Zod，不支持 discriminated union，需要 TypeBox→Zod 转换
- 扩展自研 SchemaForm: 已覆盖基础类型但缺 oneOf/anyOf/conditional 完整支持，补全成本高

**理由**: Gateway TypeBox schema 运行时就是 JSON Schema，RJSF 零转换直接消费。15.7k stars，完整覆盖 JSON Schema 所有特性（oneOf/anyOf/allOf/conditional/discriminated union）。2026-03 发布的 `@rjsf/shadcn` 包确保与项目设计系统一致。

### D2: 数据表格选择 TanStack Table

**选择**: `@tanstack/react-table` + shadcn DataTable recipe

**理由**: shadcn/ui 官方推荐方案，headless 架构可从 result schema 动态生成 `ColumnDef`。支持排序/过滤/分页。

### D3: 三层架构而非统一引擎

**选择**: Layer 1 (schema-driven 70%) + Layer 2 (enhanced generic 20%) + Layer 3 (custom 10%)

**替代方案**: 所有面板都用 schema-driven 引擎

**理由**: Chat 实时流、Monitor 时间线、Routing DAG 可视化等面板的 UX 复杂度无法用表单+表格表达。强行统一会导致体验降级。三层架构让简单面板零成本生成，复杂面板保持手工精调。

### D4: gateway.describe 同时服务 codegen 和 UI 渲染

**选择**: 运行时从 gateway.describe 获取 schema 渲染 UI，同时构建时 codegen 生成类型

**替代方案**: 只用构建时 codegen 的静态 schema

**理由**: 运行时 schema 让 Deck 能展示 Gateway 的完整能力，包括 untyped 方法（P2 层级没有 result schema 的方法也能生成 params 表单）。构建时 codegen 保证类型安全。两者互补。

### D5: uiHints → RJSF uiSchema 桥接

**选择**: 编写 `uiHintsToRjsfSchema()` 桥接函数

Gateway 的 `ConfigUiHint` 字段与 RJSF `uiSchema` 的映射：

| ConfigUiHint 字段 | RJSF uiSchema 字段 |
|-------------------|-------------------|
| `label` | `ui:title` |
| `help` | `ui:help` |
| `placeholder` | `ui:placeholder` |
| `sensitive` | `ui:widget: "password"` |
| `order` | `ui:order` |
| `group` | `ui:group` (custom extension) |
| `collapsed` | `ui:collapsed` (custom extension) |
| `advanced` | `ui:options.advanced` (custom extension) |

## Risks / Trade-offs

- **RJSF 包体积** → 约 +50KB gzipped（core + shadcn theme + ajv8 validator）。对 dashboard 应用可接受。Mitigation: 动态 import，只在使用 schema form 的面板加载。
- **RJSF 自定义深度** → 默认表单可能偏"生成器"风格，不够精致。Mitigation: 通过 custom templates 和 widgets 覆盖关键 UI 元素；Layer 2 的 fieldOverrides 机制允许逐字段替换 widget。
- **gateway.describe 响应体大小** → 全量 schema 返回可能 100KB+。Mitigation: `includeSchemas: false` 轻量模式用于导航发现；完整 schema 按需加载并缓存。
- **Protocol SDK 未实施** → 此设计依赖 gateway.describe RPC。Mitigation: 开发期间可 mock gateway.describe 响应或从静态 `protocol.schema.json` 读取。
- **现有面板迁移成本** → 7 个 split-pane 面板迁移到 MasterDetailLayout 需要逐个验证。Mitigation: 不强制迁移，只要求新面板使用新模式。

# Schema-Driven UI Architecture Design

> Date: 2026-03-27
> Status: Approved
> Branch: enhanced
> Dependency: Gateway Protocol SDK (`docs/plans/2026-03-27-gateway-protocol-sdk-design.md`)

## Problem Statement

Deck dashboard 当前覆盖 102/147 个 Gateway 方法（69%），但每个面板 ~500 行手写代码，20+ 面板中 7 个 copy-paste 相同的 split-pane 结构。要补全剩余 ~45 个方法（plugins/webhooks/hooks/MCP/memory/security 等 ~10 个域），逐面板手写的工作量不可接受，且面板间布局风格不一致。

纯 schema-driven（RJSF/Swagger 风格）方案此前已尝试，效果不理想——schema 能描述数据结构但无法描述交互模式，生成的表单在精心设计的 dashboard 中显得突兀。

## Design Decisions

| Decision | Choice                                | Rationale                                                                                          |
| -------- | ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 方法论   | 组合优于抽象                          | 共享组件是 building blocks，不是 framework；开发者 import 后组合，不是配置黑盒                     |
| 表单引擎 | 扩展现有 schema-parser，不引入 RJSF   | 现有 Config Editor 的 `parseSchemaSection()` 已覆盖 90%+ Gateway params schema 类型；零新依赖      |
| 数据表格 | 简易 `<table>`，不引入 TanStack Table | Explorer 场景不需要排序/过滤/虚拟化，避免增加 bundle                                               |
| 覆盖策略 | 分层：核心精调 + 长尾兜底             | 核心面板（Chat/Monitor/Routing）保持手工精调；CRUD 面板用共享组件加速；长尾用 Method Explorer 兜底 |
| 现有代码 | 零改动                                | 全部新增文件，现有面板/SchemaForm/stores 不修改                                                    |
| 新依赖   | 零                                    | 不引入 RJSF、TanStack Table 或其他新库                                                             |

## Architecture Overview

方案由三个独立层组成，每层可单独实施、单独停下：

```
┌─────────────────────────────────────────────────────┐
│  Layer 3: Method Explorer                           │
│  ─ 长尾覆盖，从 gateway.describe 动态渲染任意方法   │
│  ─ 依赖 Protocol SDK 的 gateway.describe RPC        │
│  ─ 扩展现有 schema-parser 做泛化表单渲染            │
├─────────────────────────────────────────────────────┤
│  Layer 2: Domain Panels（新建）                      │
│  ─ plugins / hooks / MCP 等待建面板                  │
│  ─ 组合 Layer 1 组件 + Protocol SDK typed client     │
│  ─ 每个 ~100-120 行，领域逻辑为主                   │
├─────────────────────────────────────────────────────┤
│  Layer 1: Shared Layout Components                   │
│  ─ PanelShell / MasterDetailLayout / EntityList      │
│  ─ 纯展示组件，零业务逻辑，零 Gateway 依赖           │
│  ─ 现有面板可选迁移，新面板强制使用                  │
└─────────────────────────────────────────────────────┘
         ↕ 已有面板保持不变，不受影响
```

**关键设计原则：**

1. **组合优于抽象** — 共享组件是 building blocks，不是 framework
2. **Protocol SDK 是类型安全层，不是 UI 层** — typed client (`gw.*`) 负责 RPC 调用的类型正确性，UI 组件负责展示和交互，两者解耦
3. **现有代码零改动** — 三层全部是新增文件，不修改任何现有面板或 SchemaForm

## Layer 1: Shared Layout Components

四个纯展示组件，提取自现有面板的共有结构。

### PanelShell — 面板外壳

抽取所有面板共有的 border + header + body 结构：

```typescript
interface PanelShellProps {
  title: string;
  /** 标题右侧内容（计数、操作按钮等） */
  headerRight?: ReactNode;
  children: ReactNode;
}
```

渲染结果等价于现有面板中反复出现的 `div.flex.flex-col.h-full.rounded-lg.overflow-hidden.border` + header + body 结构。

### MasterDetailLayout — 左右分栏

抽取 sidebar + detail 的 flex 布局，处理响应式和空状态：

```typescript
interface MasterDetailLayoutProps {
  /** 侧栏内容 */
  sidebar: ReactNode;
  /** 详情区内容 */
  detail: ReactNode;
  /** 侧栏宽度，默认 "w-56" */
  sidebarWidth?: string;
  /** 无选中项时的空状态提示 */
  emptyState?: ReactNode;
  /** 是否有选中项（控制 detail vs emptyState） */
  hasSelection: boolean;
}
```

内部处理：

- 响应式：屏幕 < 768px 时 sidebar 和 detail 切换显示（而非并排）
- 空状态：`hasSelection=false` 时 detail 区域渲染 `emptyState`
- 边框：sidebar 右边框自动处理

### EntityList — 通用列表

抽取各面板 sidebar 中列表的共有模式：

```typescript
interface EntityListProps<T> {
  items: T[];
  selectedId: string | null;
  onSelect: (item: T) => void;
  getId: (item: T) => string;
  /** 主文本（名称） */
  getLabel: (item: T) => string;
  /** 副文本（描述/状态），可选 */
  getSubLabel?: (item: T) => string;
  /** 列表顶部操作按钮 */
  actions?: ReactNode;
  /** 搜索占位符，传入则显示搜索框 */
  searchPlaceholder?: string;
  loading?: boolean;
}
```

内含：搜索过滤（可选）、选中高亮、loading skeleton、空列表提示。

### TabBar — 通用 Tab 切换

```typescript
interface TabBarProps<K extends string> {
  tabs: { key: K; label: string }[];
  activeTab: K;
  onTabChange: (tab: K) => void;
}
```

### 组合示例

用这四个组件，一个新面板的结构：

```tsx
export function PluginsPanel() {
  const t = useTranslations("plugins");
  const { plugins, selectedId, fetchPlugins, selectPlugin } = usePluginsStore();
  const [tab, setTab] = useState<"info" | "config">("info");

  useEffect(() => {
    void fetchPlugins();
  }, [fetchPlugins]);
  const selected = plugins.find((p) => p.id === selectedId);

  return (
    <PanelShell title={t("title")} headerRight={<span>{plugins.length}</span>}>
      <MasterDetailLayout
        sidebarWidth="w-56"
        sidebar={
          <EntityList
            items={plugins}
            selectedId={selectedId}
            onSelect={(p) => selectPlugin(p.id)}
            getId={(p) => p.id}
            getLabel={(p) => p.name}
            getSubLabel={(p) => p.version}
            actions={<Button onClick={handleInstall}>{t("install")}</Button>}
          />
        }
        hasSelection={!!selected}
        emptyState={<EmptyState icon={Puzzle} message={t("selectPlugin")} />}
        detail={
          <>
            <TabBar tabs={tabs} activeTab={tab} onTabChange={setTab} />
            {tab === "info" && <PluginInfo plugin={selected!} />}
            {tab === "config" && <PluginConfig plugin={selected!} />}
          </>
        }
      />
    </PanelShell>
  );
}
```

约 50-60 行面板代码 + 各 tab 内容组件，对比现有面板 ~500 行。

## Layer 3: Method Explorer

让用户通过一个统一面板访问 Gateway 全部能力，保持交互友好。

### 设计目标

- 用户**不需要知道 RPC 方法名**就能找到想要的功能
- 表单**不是 JSON 输入框**，而是带标签、分组、帮助文本的结构化表单
- 结果**不是 JSON dump**，而是根据数据结构自动选择最佳展示方式

### 布局

沿用 MasterDetailLayout，和其他面板一致的视觉语言：

```
┌──────────────────────────────────────────────────────┐
│  Method Explorer                              🔍     │
├────────────┬─────────────────────────────────────────┤
│ 🔍 搜索     │  agents.detail                          │
│            │  ─────────────────────────────────────  │
│ ▾ agents   │  查看 agent 详细信息                    │
│   · list   │  Scope: operator.read                   │
│   · detail │                                         │
│   · create │  ┌─ 参数 ──────────────────────────────┐│
│ ▾ sessions │  │ Agent ID   [main         ▾]          ││
│   · list   │  │                                      ││
│   · create │  │          [▶ 执行]                     ││
│ ▸ config   │  └──────────────────────────────────────┘│
│ ▸ models   │                                         │
│ ▸ channels │  ┌─ 结果 ──────────────────────────────┐│
│ ▸ plugins  │  │ Name       main                      ││
│ ▸ tts      │  │ Model      claude-sonnet-4-6         ││
│            │  │ Default    ✓                          ││
│            │  │ Skills     3 items [展开]              ││
│            │  └──────────────────────────────────────┘│
└────────────┴─────────────────────────────────────────┘
```

### 方法发现

左侧面板从 `gateway.describe` 获取方法列表，按 namespace 分组（`agents.*` → "agents" 折叠组）：

```typescript
interface MethodEntry {
  name: string; // "agents.detail"
  namespace: string; // "agents"
  shortName: string; // "detail"
  scope: string; // "operator.read"
  hasParams: boolean;
  hasResult: boolean;
  isTyped: boolean; // 有 result schema = true
}
```

- **搜索**：模糊匹配方法名和 namespace
- **排序**：未被专属面板覆盖的 namespace 排在前面，已有专属面板的排在后面
- **标记**：已有专属面板的方法显示 `→ 面板名` 链接，引导用户去更好的 UI

### 参数表单

选中方法后，右侧上半区渲染参数表单。扩展现有 `schema-parser.ts`，不引入 RJSF：

```
gateway.describe 返回的 JSON Schema
        ↓
generic-schema-parser.ts（新文件，复用现有 parseSchemaSection 逻辑）
        ↓
FormField[]（同 Config Editor 的数据结构）
        ↓
GenericSchemaForm.tsx（新文件，复用现有 SchemaForm 的渲染模式）
        ↓
带标签、帮助文本、分组的结构化表单
```

与现有 Config Editor 的关系：

|      | Config Editor SchemaForm                     | Explorer GenericSchemaForm                           |
| ---- | -------------------------------------------- | ---------------------------------------------------- |
| 输入 | `config.schema.lookup` 的 section schema     | `gateway.describe` 的 method params schema           |
| 解析 | `schema-parser.ts` 的 `parseSchemaSection()` | 同一个函数（已足够通用）                             |
| 渲染 | `SchemaForm` + 专属 field 组件               | `GenericSchemaForm`（复用 field 组件，新的提交逻辑） |
| 提交 | `config.set` + conflict detection            | `gw.*(params)` typed client 调用                     |
| 修改 | **不动**                                     | **新文件**                                           |

`parseSchemaSection()` 已处理 string/number/boolean/enum/array/object/union，覆盖 90%+ Gateway params schema。少数不支持的复杂 schema（如 `oneOf` 顶层 conditional），fallback 到 JSON 编辑器。

### 结果展示

右侧下半区根据 result schema 类型自动选择展示方式：

| Result Schema 类型 | 展示方式                                      | 示例方法        |
| ------------------ | --------------------------------------------- | --------------- |
| `object`           | Key-Value 卡片（字段名+值，嵌套 object 折叠） | `agents.detail` |
| `array of objects` | 简易 `<table>`（字段名做列头）                | `cron.list`     |
| `boolean`          | 成功/失败 badge                               | `cron.remove`   |
| `string`           | 文本块                                        | 少见            |
| 无 result schema   | Raw JSON（语法高亮）                          | P2 untyped 方法 |

```typescript
function ResultView({ schema, data }: { schema?: JsonSchema; data: unknown }) {
  if (!schema) return <JsonTree data={data} />;
  if (schema.type === "array" && schema.items?.type === "object")
    return <SimpleTable schema={schema.items} rows={data} />;
  if (schema.type === "object")
    return <KeyValueCard schema={schema} data={data} />;
  // ... fallback
}
```

`SimpleTable` 是简单的 `<table>` + `<thead>/<tbody>`，不引入 TanStack Table。

### 数据流

```
用户选方法 → gateway.describe 缓存读 schema
用户填表单 → FormField[] 收集值
用户点执行 → gw[method](params) typed client 调用
           → 结果展示在 ResultView
           → 错误展示在 toast（复用现有 toast 系统）
```

## New Panel Development Workflow

以待建的 Plugins 面板为例，开发者需要的文件：

| 文件                              | 行数     | 内容                     |
| --------------------------------- | -------- | ------------------------ |
| i18n keys（zh.json + en.json）    | ~15 keys | 面板文案                 |
| `app/api/plugins/route.ts`        | ~15      | API route 薄层透传       |
| `stores/plugins.ts`               | ~30      | Zustand store            |
| `panels/plugins/PluginsPanel.tsx` | ~60      | 面板主体（组合共享组件） |
| `panels/plugins/PluginInfo.tsx`   | ~60      | Detail tab（领域特有）   |
| `panels/plugins/PluginConfig.tsx` | ~60      | Detail tab（领域特有）   |
| **合计**                          | **~225** | 完整 CRUD 面板           |

对比现有模式 ~500+ 行，开发效率提升约 2 倍，且布局一致性由共享组件保证。

## Existing Panel Migration

现有面板**不强制迁移**，可按需渐进式重构。迁移是纯机械操作——用 PanelShell/MasterDetailLayout/TabBar 替换手写的布局模板代码。

| 优先级 | 面板                                   | 理由                         |
| ------ | -------------------------------------- | ---------------------------- |
| 不迁移 | Chat、Monitor、Routing                 | 布局高度定制，共享组件不适用 |
| 低优先 | Agents、Sessions、Config               | 已稳定，改动收益小           |
| 中优先 | Cron、Skills、Webhooks、Alerts、Budget | 结构标准，迁移简单           |
| 随新建 | Plugins、Hooks、MCP 等                 | 直接用共享组件新建           |

## Error Handling

复用现有 Deck 的错误处理链，不引入新模式：

| 场景                   | 处理方式                                 | 现有机制                          |
| ---------------------- | ---------------------------------------- | --------------------------------- |
| Gateway 离线           | 表单禁用 + 连接状态提示                  | GatewayAdapter `connectionStatus` |
| RPC 调用失败           | Toast 通知 + 错误详情                    | ToastContainer                    |
| Schema 加载失败        | Explorer fallback 到 JSON 编辑器         | 新增，逻辑简单                    |
| `schemaVersion` 不匹配 | Console warning + Explorer 自动 re-fetch | Protocol SDK 已设计               |

## Testing Strategy

| 组件                                                  | 测试方式                                               |
| ----------------------------------------------------- | ------------------------------------------------------ |
| PanelShell / MasterDetailLayout / EntityList / TabBar | 单元测试（props 渲染验证）                             |
| GenericSchemaForm                                     | 单元测试（各种 JSON Schema → 正确的 FormField[] 输出） |
| ResultView                                            | 单元测试（object/array/boolean → 正确的展示模式选择）  |
| ExplorerPanel                                         | 集成测试（mock gateway.describe → 完整调用流程）       |
| 新面板（Plugins 等）                                  | 与现有面板测试模式一致                                 |

## Implementation Phases

三阶段，每阶段独立可交付：

### Phase 1: Layer 1 — Shared Layout Components

- 实施 PanelShell、MasterDetailLayout、EntityList、TabBar、EmptyState
- 无外部依赖，可立即开始
- 可与 Protocol SDK 并行实施
- 验证：用一个现有面板（如 CronPanel）试迁移，确认 API 够用

### Phase 2: Layer 2 — 首个新面板试点

- 选一个待建面板（建议 Plugins 或 Webhooks 重构）
- 依赖：Layer 1 + Protocol SDK typed client
- 验证：~200 行完成完整 CRUD 面板

### Phase 3: Layer 3 — Method Explorer

- 实施 generic-schema-parser、GenericSchemaForm、ResultView、ExplorerPanel
- 依赖：Protocol SDK 的 `gateway.describe` RPC
- 验证：能调用任意 Gateway 方法并友好展示结果

## File Inventory

### New Files

| File                                                         | Layer | LOC      |
| ------------------------------------------------------------ | ----- | -------- |
| `dashboard/src/components/shared/PanelShell.tsx`             | L1    | ~40      |
| `dashboard/src/components/shared/MasterDetailLayout.tsx`     | L1    | ~80      |
| `dashboard/src/components/shared/EntityList.tsx`             | L1    | ~70      |
| `dashboard/src/components/shared/TabBar.tsx`                 | L1    | ~30      |
| `dashboard/src/components/shared/EmptyState.tsx`             | L1    | ~20      |
| `dashboard/src/lib/generic-schema-parser.ts`                 | L3    | ~100     |
| `dashboard/src/components/schema-ui/GenericSchemaForm.tsx`   | L3    | ~120     |
| `dashboard/src/components/schema-ui/ResultView.tsx`          | L3    | ~100     |
| `dashboard/src/components/schema-ui/SimpleTable.tsx`         | L3    | ~60      |
| `dashboard/src/components/schema-ui/KeyValueCard.tsx`        | L3    | ~50      |
| `dashboard/src/components/schema-ui/JsonTree.tsx`            | L3    | ~40      |
| `dashboard/src/components/panels/explorer/ExplorerPanel.tsx` | L3    | ~200     |
| `dashboard/src/stores/explorer.ts`                           | L3    | ~50      |
| **Total**                                                    |       | **~960** |

### Modified Files

| File                                          | Change                                   |
| --------------------------------------------- | ---------------------------------------- |
| `dashboard/src/i18n/zh.json`                  | 新增 `explorer` namespace keys           |
| `dashboard/src/i18n/en.json`                  | 同步                                     |
| `dashboard/src/stores/ui.ts`                  | `Panel` union type 加 `"explorer"`       |
| `dashboard/src/components/layout/NavRail.tsx` | 导航项列表加 explorer 条目               |
| `dashboard/src/app/page.tsx`                  | 面板渲染分支加 ExplorerPanel lazy import |

### Unchanged

- 现有 20+ 面板 — 全部不动
- `schema-parser.ts` / `SchemaForm.tsx` — Config Editor 不动
- Gateway 代码 — 不动（Protocol SDK 是独立变更）
- stores / API routes — 不动（Protocol SDK 迁移是独立变更）

## Risks / Trade-offs

- **现有 schema-parser 不支持 oneOf/anyOf/conditional** — Explorer 对少数复杂 params schema 会 fallback 到 JSON 编辑器。实际影响小：Gateway params 中使用 oneOf 的方法极少。如未来需要完整支持，可在 generic-schema-parser 中增量添加，不影响整体架构。
- **Explorer 的 UX 上限有限** — 通用表单+通用结果展示无法达到专属面板的交互质量。这是设计意图：Explorer 覆盖长尾，核心功能仍由专属面板提供最佳体验。
- **共享组件 API 可能需要迭代** — Phase 1 用 CronPanel 试迁移来验证组件 API 是否够用。如发现遗漏（如 resize handle、多级侧栏），在 Phase 2 之前调整。
- **Protocol SDK 是前置依赖** — Phase 2/3 依赖 Protocol SDK 的 typed client 和 gateway.describe。如 Protocol SDK 延期，Phase 1 可先独立交付。

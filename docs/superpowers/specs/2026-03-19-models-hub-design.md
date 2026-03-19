# Models Hub — 模型配置与使用观测 UI 设计

> **状态**: Approved
> **日期**: 2026-03-19
> **范围**: Dashboard Models 面板扩展 + 网关 RPC 增量

## 1. 背景与目标

### 问题

当前 OpenClaw Dashboard 的 Models 面板只提供基础的模型目录浏览和 Provider API Key 配置。认证诊断、回退链管理、使用成本监控等关键功能只能通过 CLI（`openclaw models status`）完成，GUI 用户无法获得完整的模型管理体验。

### 目标

在 Dashboard 的 Models 面板内，通过四个 Tab 提供完整的模型管理体验：

- 模型浏览与选择
- Provider 认证配置与诊断
- 回退链可视化管理
- 使用成本摘要

让开发者和用户都能在 Web UI 上完成全部模型相关操作，不再依赖 CLI。

### 非目标

- 不替代 Usage 面板的深度分析能力（Session 级拆分、自定义日期范围）
- 不实现模型微调/训练相关功能
- 不实现多租户/团队级别的模型权限管理

## 2. 架构概览

### 数据流

```
Dashboard UI (React)
  → Next.js API Routes (dashboard/src/app/api/models/*)
    → gatewayRequest()
      → OpenClaw Gateway RPC (src/gateway/server-methods/*)
        → Auth Profile Store / Config / Usage Data
```

### 网关 RPC 清单

| RPC 方法                 | 状态     | 用途                                         |
| ------------------------ | -------- | -------------------------------------------- |
| `models.list`            | 已有     | 模型目录                                     |
| `config.get`             | 已有     | 读取配置（含 fallbacks）                     |
| `config.patch`           | 已有     | 写入配置                                     |
| `usage.status`           | 已有     | Provider 用量配额                            |
| `usage.cost`             | 已有     | 成本数据                                     |
| **`deck.auth.overview`** | **新增** | L1+L2 认证状态（来源、类型、过期、cooldown） |
| **`deck.auth.probe`**    | **新增** | L3 探针诊断（手动触发）                      |

### 命名空间隔离

新增 RPC 使用 `deck.` 前缀，与上游 OpenClaw 的 RPC 命名空间隔离。即使上游后续添加类似方法，通过 API 命名变更即可解决冲突。

## 3. Tab 结构

```
Models 面板
├── Tab 1: Catalog（模型目录）
├── Tab 2: Provider Config（提供商配置）
├── Tab 3: Fallbacks（回退链）
└── Tab 4: Usage（用量摘要）
```

认证状态点（🟢🟡🔴）在 Catalog、Config、Fallbacks 三个 Tab 中分布展示：

- **Catalog**: Provider 标题旁，回答"这个能不能用"
- **Config**: 详细健康卡片，回答"什么问题、怎么修"
- **Fallbacks**: 卡片上，回答"安全网有没有漏洞"
- **Usage**: 不展示认证状态

## 4. Tab 1: Catalog（模型目录）

### 布局

左右分栏。

### 左栏：Provider + 模型列表

- 按 provider 分组，每组可折叠（shadcn Collapsible）
- Provider 标题行：认证状态点 + 名称 + 模型数量 badge
- 每个模型行：名称、`★` 默认标记、上下文窗口 badge（如 `128K`）
- 点击 provider 标题 → 右栏显示 provider 概览
- 点击模型 → 右栏显示模型详情

### 认证状态点逻辑

| 状态      | 颜色    | 条件                                  |
| --------- | ------- | ------------------------------------- |
| `ready`   | 🟢 绿色 | 有有效认证                            |
| `warning` | 🟡 黄色 | OAuth 即将过期（<24h）或处于 cooldown |
| `missing` | 🔴 红色 | 无认证                                |
| `unknown` | ⚫ 灰色 | 未检测到（非隐式 provider，无 auth）  |

### 右栏：Provider 概览视图

当点击 provider 标题时显示：

- 认证状态摘要（一行，如 `✅ API Key from env:MOONSHOT_API_KEY`）
- 该 provider 下所有模型的对比表格：

| 列         | 说明               |
| ---------- | ------------------ |
| 模型名称   | 带 ★ 默认标记      |
| 上下文窗口 | 格式化为 128K / 1M |
| 输入价格   | ¥/百万 token       |
| 输出价格   | ¥/百万 token       |
| 推理       | ✅ / —             |
| 视觉       | ✅ / —             |

- 操作按钮：[设为默认]、[配置 →]（跳转 Config Tab）

### 右栏：模型详情视图

当点击具体模型时显示：

- 模型名称、provider、ID
- 能力标签：`推理` `视觉` `文本`
- 价格明细（input / output / cache read / cache write）
- 上下文窗口、最大输出 tokens
- 快捷操作：[设为默认] / [加入回退链]

### 模型数据与定价

现有 `models.list` RPC 返回的 `ModelCatalogEntry`（来自 Pi SDK 的 `ModelRegistry` 动态发现）包含 `id, name, provider, contextWindow, reasoning, input[]`。定价数据（`cost.input/output/cacheRead/cacheWrite`）存在于 `ModelDefinitionConfig`（`src/config/types.models.ts`，来自 `models.json` 静态配置）中，但 `ModelCatalogEntry` 和 `models.list` 均不返回。

**实现路径**：在 `src/gateway/server-model-catalog.ts` 的 `loadGatewayModelCatalog()` 中，将 `ModelDefinitionConfig.cost` 和 `maxTokens` 合并到 `ModelCatalogEntry` 中返回。两个数据源通过 `provider + model.id` 关联。

**需要扩展 `models.list` 的返回字段**（在 `src/gateway/server-methods/models.ts` + `src/gateway/server-model-catalog.ts` 中）：

```typescript
// 扩展 ModelCatalogEntry
{
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  maxTokens?: number;
  reasoning: boolean;
  input: ("text" | "image")[];       // vision = input.includes("image")
  cost: {
    input: number;                    // $/1M tokens
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
}
```

Dashboard 的 `Model` 接口同步扩展，增加 `reasoning`, `input`, `cacheReadPrice`, `cacheWritePrice` 字段。

**定价单位**：API 返回美元，UI 显示时根据 locale 转换（$X.XX 或 ¥X.XX），汇率由前端配置常量控制。

### 数据源

- `models.list`（已有，需扩展返回字段）
- `deck.auth.overview`（新增，面板加载时自动调用一次）
- `config.patch`（已有，用于设默认/加回退链）

## 5. Tab 2: Provider Config（提供商配置）

### 布局

左右分栏。

### 左栏：Provider 列表

- 只显示 provider 级别，不展开模型
- 每行：状态点 + 名称 + 认证类型 badge（`API Key` / `OAuth` / `Token`）
- 分两组：
  - **已配置**：有认证的 provider，按使用频率排序
  - **未配置**：检测到但无认证的 provider，灰色显示
- 点击选中 → 右栏加载详情

### 右栏：已配置 Provider

三个区域从上到下：

**区域 1：认证健康卡片**

显示内容：

- Provider 名称 + 状态（🟢 Ready / 🟡 Warning / 🔴 Missing）
- 认证方式：API Key / OAuth / Token
- 来源：`env:MOONSHOT_API_KEY` / `profile:moonshot:default` / `models.json`
- 状态：有效 / 即将过期（剩余时间）/ cooldown（原因 + 剩余时间 + 进度条）

OAuth 类型额外显示：

- 过期倒计时（黄色 <24h，红色 <1h）
- [刷新 Token] 按钮

[🔍 探针诊断] 按钮：

- 点击 → 调用 `deck.auth.probe`
- Loading 状态 → 结果：`✅ ok · 238ms` 或 `❌ auth_error · 连接被拒绝`
- 结果保留在卡片上直到下次刷新

**区域 2：配置表单**

字段：

- API Key：密码遮罩输入，👁️ 切换可见
- Base URL：文本输入，placeholder 显示默认值，留空使用默认
- Model ID：可选覆盖

保存行为：

- [保存] 按钮 → `config.patch`
- 保存后自动刷新认证健康卡片
- 状态从 🔴→🟢 时 toast 提示 "Moonshot 已就绪"

**区域 3：高级信息（默认折叠）**

- Auth profile 列表（多 profile 场景）
- 每个 profile：ID、类型、来源、状态
- 环境变量检测结果

### 右栏：未配置 Provider

显示：

- Provider 名称 + 🔴 未配置
- 说明文字："需要 API Key 才能使用此 Provider"
- API 格式（OpenAI Completions / Anthropic Messages）
- 支持的模型列表摘要
- 设置提示：环境变量名
- 配置表单（同上，但为空状态）

### 数据源

- `deck.auth.overview`（新增，自动）
- `deck.auth.probe`（新增，手动触发）
- `config.get` / `config.patch`（已有）

## 6. Tab 3: Fallbacks（回退链）

### 布局

单栏纵向布局，两个区域。

### 区域 1：文本模型回退链

**主力模型卡片**（顶部，不可拖拽/删除）：

- 认证状态点 + `provider/model` 全名
- 上下文窗口 · 输入/输出价格 · 能力标签
- [更换 ▾] 下拉选择

**箭头连接**：`▼ 失败时`

**回退卡片列表**（可拖拽排序）：

- 每张卡片内容同主力卡片
- 右侧：`≡` 拖拽手柄 + `✕` 删除按钮
- 认证状态 🔴 的卡片：红色虚线边框 + `⚠ 此 Provider 未配置认证，回退时将跳过` + [去配置 →]

**[+ 添加回退模型]** 按钮：

- Select 下拉，按 provider 分组
- 只显示尚未在链中的模型
- 每个选项带认证状态点

**交互行为**：

- 拖拽：`@dnd-kit/core` + `@dnd-kit/sortable`，拖动时半透明 + 蓝色占位线
- 删除：`✕` → 确认 tooltip → 移除
- 更换主力：下拉选择 → 原主力不自动加入回退链
- **自动保存**：每次排序/增删操作立即 `config.patch`，底部短暂显示 `✓ 已保存`

**空状态**：

- "未配置回退链。当主力模型不可用时，请求将直接失败。" + [+ 添加回退模型]

### 区域 2：图像模型回退链

结构与区域 1 完全相同，独立管理。标题分隔符 `── 图像模型 ──`。

空状态："未配置图像模型。" + [+ 选择图像模型]

### 数据源与读写流程

**读取**：

1. `config.get` → 返回完整 `ConfigFileSnapshot`（含 `raw`, `hash`, `config`, `parsed`, `resolved`, `path`, `exists`, `valid`, `issues` 等字段），我们只需 `raw` 和 `hash`
2. 解析 `raw` 中的 `agents.defaults.model` 字段
3. 通过 `resolveAgentModelPrimaryValue()` 提取 primary
4. 通过 `resolveAgentModelFallbackValues()` 提取 fallbacks 数组
5. 图像模型同理，字段为 `agents.defaults.imageModel`

**写入**（拖拽排序/增删后）：

1. 基于最近一次 `config.get` 的 `raw` + `hash`
2. 修改 `agents.defaults.model.primary` 和 `agents.defaults.model.fallbacks`
3. 调用 `config.patch({ raw: modifiedRaw, baseHash: hash })`
4. 如果 `baseHash` 不匹配（并发编辑）→ toast 错误 "配置已被其他操作修改，正在刷新" → 自动 refetch

**自动保存策略**：

- 500ms trailing debounce：快速连续拖拽只触发一次保存
- 保存期间禁止新的拖拽操作（UI 显示 saving 状态）
- 保存失败 → toast 错误 + UI 回滚到最后已知状态 + 自动 refetch config

**其他数据源**：

- 模型信息（价格、上下文等）：`models.list`（共享 store）
- 认证状态：`deck.auth.overview`（共享）

## 7. Tab 4: Usage（用量摘要）

### 定位

"我的模型还够用吗" — 快速健康检查。深度分析留在已有 Usage 面板。

### 布局

纵向三个区域。

### 区域 1：概览卡片行

横向 3 张卡片：

| 卡片          | 内容   | 辅助信息                                    |
| ------------- | ------ | ------------------------------------------- |
| 今日成本      | ¥ 金额 | 与昨日对比百分比（↑红 ↓绿）                 |
| 本周成本      | ¥ 金额 | 与上周对比百分比                            |
| 活跃 Provider | N / M  | 有认证且非 cooldown 的数量 / 总检测到的数量 |

### 区域 2：Provider 用量卡片

网格排列（2 列），每个有配额的 provider 一张卡片：

- 进度条：已用百分比（<70% 蓝色、70-90% 黄色、>90% 红色）
- 窗口类型：每日/月度
- 重置倒计时
- 计划名称

无配额限制的 provider 不显示卡片。API 不支持用量查询的 provider 显示灰色 `用量数据不可用`。

### 区域 3：近 7 天成本趋势

Recharts 柱状图：

- X 轴：日期（近 7 天）
- Y 轴：金额（¥）
- Hover tooltip：日期 + 精确金额
- 底部链接：`查看按 Session 拆分的详细分析 →` 跳转 Usage 面板

### 与 Usage 面板分工

| 维度     | Models > Usage Tab | Usage 面板                    |
| -------- | ------------------ | ----------------------------- |
| 定位     | 快速健康检查       | 深度分析                      |
| 粒度     | Provider 级聚合    | Session / 时间段 / token 类型 |
| 时间范围 | 今日 + 7 天        | 自定义日期范围                |
| 图表     | 1 个柱状图         | 多维度图表                    |

### v2 迭代项

- 回退触发次数卡片（需网关侧新增事件计数器）

### 数据源

- `usage.cost({ days: 7 })`（已有）
- `usage.status()`（已有）
- `deck.auth.overview`（活跃 Provider 计数）

## 8. 网关 RPC 新增设计

### `deck.auth.overview`

**用途**：返回所有 provider 的 L1+L2 认证状态。

**参数**：无

**返回**：

```typescript
{
  providers: Array<{
    provider: string; // "moonshot"
    status: "ready" | "warning" | "missing" | "unknown";
    auth: {
      type: "api_key" | "oauth" | "token" | "aws-sdk" | null;
      source: string; // "env:MOONSHOT_API_KEY"
      profileId?: string; // "moonshot:default"
    } | null;
    oauth?: {
      expiresAt: number; // timestamp ms
      remainingMs: number;
      status: "ok" | "expiring" | "expired" | "missing";
    };
    cooldown?: {
      reason: "rate_limit" | "auth" | "billing";
      remainingMs: number;
      until: number; // timestamp ms
    };
    usage?: {
      windows: Array<{
        // 一个 provider 可能有多个窗口（如日限额+月配额）
        label: string; // "每日限额"
        usedPercent: number; // 0-100
        resetsInMs: number; // 由 handler 从 UsageWindow.resetAt (timestamp) 转换为相对毫秒
      }>;
      plan?: string; // "Standard"
    };
  }>;
}
```

**实现**：提取共享逻辑到 `src/agents/auth-diagnostics.ts`，合并以下三个数据源：

| 字段                         | 数据来源            | 现有函数                                                                                                                                                                                                                                         |
| ---------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth.type/source/profileId` | Auth profile store  | `resolveProviderAuthOverview()` in `src/commands/models/list.auth-overview.ts`（注意：该函数返回 `effective.kind` 为 `"profiles"\|"env"\|"models.json"\|"missing"`，需额外从 profile store 提取具体 auth type `"api_key"\|"oauth"\|"token"` 等） |
| `oauth.expiresAt/status`     | Auth health         | `buildAuthHealthSummary()` in `src/agents/auth-health.ts`                                                                                                                                                                                        |
| `cooldown.*`                 | Profile usage stats | `resolveProfileUnusableUntilForDisplay()` in `src/agents/auth-profiles.ts`                                                                                                                                                                       |
| `usage.*`                    | Provider usage      | `loadProviderUsageSummary()` in `src/infra/provider-usage.ts`                                                                                                                                                                                    |

**状态点映射规则**（从现有 `AuthProviderHealthStatus` 到 UI `status`）：

| 现有状态       | UI status | 条件                       |
| -------------- | --------- | -------------------------- |
| `ok`           | `ready`   | 认证有效                   |
| `static`       | `ready`   | API Key 类型，无过期概念   |
| `expiring`     | `warning` | OAuth <24h 过期            |
| `expired`      | `missing` | OAuth 已过期，等同于无认证 |
| `missing`      | `missing` | 无认证凭证                 |
| （无 profile） | `unknown` | 非隐式 provider，未检测到  |

当 provider 同时有过期 OAuth 和有效 API Key fallback 时：以最佳可用凭证的状态为准（`ready`）。

### `deck.auth.probe`

**用途**：对指定 provider 执行 L3 探针诊断。

**参数**：

```typescript
{
  provider: string;                  // "moonshot"
  profileId?: string;                // 可选，指定 profile
  timeoutMs?: number;                // 默认 8000
  maxTokens?: number;                // 默认 8
}
```

**返回**：

```typescript
{
  provider: string;
  profileId?: string;
  status: "ok" | "rate_limit" | "auth" | "timeout" | "billing" | "format" | "no_model" | "unknown";
  latencyMs: number;
  error?: string;
  model?: string;                    // 实际使用的测试模型
}
```

**实现**：复用 `src/commands/models/list.probe.ts` 中的 `runAuthProbes` 逻辑。

**注意事项**：

- 探针会通过 `runEmbeddedPiAgent` 发送一个 `maxTokens=8` 的真实请求，消耗少量 token
- 每次探针创建临时 session 文件，handler 负责清理
- UI 上探针按钮旁显示提示文字 "将发送测试请求，消耗少量 token"
- 同一 provider 的并发探针请求由 handler 端去重（同时只允许一个）

### 文件位置

```
src/gateway/server-methods/deck-auth.ts      ← 新增，两个 RPC handler
src/agents/auth-diagnostics.ts               ← 新增，从 CLI 提取的共享逻辑
dashboard/src/app/api/models/auth/route.ts   ← 新增，代理层
dashboard/src/app/api/models/probe/route.ts  ← 新增，代理层
```

## 9. 前端文件结构

```
dashboard/src/components/panels/models/
├── ModelsPanel.tsx              ← 入口，四 Tab 布局（改造）
├── tabs/
│   ├── CatalogTab.tsx           ← Tab 1 容器
│   ├── ProviderConfigTab.tsx    ← Tab 2 容器
│   ├── FallbacksTab.tsx         ← Tab 3 容器
│   └── UsageTab.tsx             ← Tab 4 容器
├── catalog/
│   ├── ProviderList.tsx         ← 左栏 provider + 模型列表
│   ├── ProviderOverview.tsx     ← 右栏 provider 概览
│   └── ModelDetail.tsx          ← 右栏模型详情
├── config/
│   ├── ProviderSidebar.tsx      ← 左栏 provider 列表（已配置/未配置）
│   ├── AuthHealthCard.tsx       ← 认证健康卡片
│   ├── ConfigForm.tsx           ← API Key / Base URL 表单
│   └── ProbeButton.tsx          ← 探针诊断按钮
├── fallbacks/
│   ├── FallbackChain.tsx        ← 回退链容器（含拖拽逻辑）
│   ├── ModelCard.tsx            ← 可拖拽模型卡片
│   ├── PrimaryModelCard.tsx     ← 主力模型卡片
│   └── AddModelSelect.tsx       ← 添加模型下拉选择
├── usage/
│   ├── SummaryCards.tsx          ← 概览卡片行
│   ├── ProviderQuotaGrid.tsx    ← Provider 用量卡片网格
│   └── CostTrendChart.tsx       ← 7 天趋势图
├── shared/
│   ├── AuthStatusDot.tsx         ← 认证状态点组件（🟢🟡🔴⚫）
│   └── ModelBadges.tsx           ← 能力标签（推理、视觉等）
├── ModelCatalog.tsx              ← 废弃，由 catalog/ 下的组件替代，实施时删除
└── ProviderConfig.tsx            ← 废弃，由 config/ 下的组件替代，实施时删除
```

迁移策略：先创建新组件并在 `ModelsPanel.tsx` 中切换 import，确认新组件工作后再删除旧文件。不做渐进式迁移——旧组件代码量小，直接替换。

dashboard/src/stores/models.ts ← 扩展（增加 auth/fallback/usage 状态）

````

## 10. Store 扩展

```typescript
// dashboard/src/stores/models.ts 扩展
interface ModelsState {
  // 现有
  models: Model[];
  providers: ProviderConfig[];
  selectedProvider: string | null;
  loading: boolean;

  // 新增 — Auth
  authOverview: AuthProviderStatus[];
  authLoading: boolean;
  probeResults: Record<string, ProbeResult>;  // Record 而非 Map，确保 Zustand 响应式更新

  // 新增 — Fallbacks
  primaryModel: string | null; // "moonshot/kimi-k2.5"
  fallbacks: string[]; // ["minimax/MiniMax-M2.5", ...]
  imagePrimaryModel: string | null;
  imageFallbacks: string[];

  // 新增 — Usage
  usageCost: DailyCost[];
  usageProviders: UsageProviderStatus[];

  // 新增 — Actions
  fetchAuthOverview: () => Promise<void>;
  runProbe: (provider: string) => Promise<ProbeResult>;
  updateFallbacks: (primary: string, fallbacks: string[]) => Promise<void>;
  updateImageFallbacks: (primary: string, fallbacks: string[]) => Promise<void>;
  fetchUsageSummary: () => Promise<void>;
}
````

## 11. 依赖新增

```json
{
  "@dnd-kit/core": "^6.x",
  "@dnd-kit/sortable": "^8.x",
  "@dnd-kit/utilities": "^3.x"
}
```

仅用于 Fallbacks Tab 的拖拽排序。其余功能使用已有依赖（shadcn/ui、Recharts、Zustand）。

## 12. i18n

新增翻译 key 在 `models` 命名空间下：

```json
{
  "models": {
    "tabs": { "catalog": "...", "config": "...", "fallbacks": "...", "usage": "..." },
    "auth": { "ready": "...", "warning": "...", "missing": "...", "probe": "...", ... },
    "fallbacks": { "primary": "...", "failover": "...", "empty": "...", "add": "...", ... },
    "usage": { "todayCost": "...", "weekCost": "...", "activeProviders": "...", ... }
  }
}
```

中英文同步维护。

## 13. 设计约束

- 遵循已定的 Deep Space / Mission Control 设计系统（`globals.css`）
- 使用 shadcn/ui 组件（Tabs、Card、Collapsible、Select、Badge、Button、Input、Tooltip）
- 认证状态点是共享组件（`AuthStatusDot.tsx`），三个 Tab 复用
- 自动保存操作（Fallbacks 拖拽/增删）不弹确认 dialog，用 toast 反馈
- L3 探针按钮有 loading 状态防止重复点击
- 所有新 RPC 通过 `gatewayRequest()` 代理层调用，不直接访问网关

## 14. Loading / Error 状态

每个 Tab 的加载和错误处理：

| Tab       | 加载态                                | 错误态                        | 空态                         |
| --------- | ------------------------------------- | ----------------------------- | ---------------------------- |
| Catalog   | 左栏 skeleton 列表（5 行）            | "模型目录加载失败" + 重试按钮 | "未发现可用模型"             |
| Config    | 右栏 skeleton 卡片                    | "认证信息加载失败" + 重试按钮 | 左栏显示"未检测到 Provider"  |
| Fallbacks | 卡片 skeleton（2 张）                 | "配置加载失败" + 重试按钮     | "未配置回退链..." + 添加按钮 |
| Usage     | 卡片 skeleton（3 张） + 图表 skeleton | "用量数据加载失败" + 重试按钮 | "暂无用量数据"               |

探针按钮独立 loading 状态（spinner 替换按钮文字），失败时内联显示错误信息。

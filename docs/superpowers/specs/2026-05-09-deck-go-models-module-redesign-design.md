# Deck-go Models 模块重构设计

- **日期**: 2026-05-09
- **主线**: deck-go（不是 legacy `dashboard/`）
- **影响面**: `deck-go/contracts/`、`deck-go/backend/internal/`、`deck-go/frontend-new/src/components/panels/models/`、`deck-go/frontend-handoff/modules/models/`
- **状态**: brainstorming 已完成（用户已确认 Section A/B/C），待 user review；尚未创建 OpenSpec 提案

## 1. Context

deck-go models 模块此前按 `frontend-handoff/modules/models/prototype.html` 收敛了视觉，但用户在审视后指出 prototype 本身**不真正契合** OpenClaw 的模型可配置维度。事实核查结果：

- 当前 `ModelsPanel.tsx`（≈ 2200 行）实际只读取 `displayName / family / contextWindow / fallback / local / reasoning / provider` 七个字段（`ModelsPanel.tsx:68-88`）。
- OpenClaw `models?: ModelsConfig` 的真实 schema（`src/config/types.models.ts`）有 30+ 字段：`mode`、`providers.{baseUrl, apiKey, auth, api, headers, authHeader, injectNumCtxForOpenAICompat, request}`、`models[].{cost(4 维), contextWindow, contextTokens, maxTokens, headers, compat}` 等。
- prototype 的 5 KPI（已用 / 待迁移 / 风险 / 利用率 / 月度）在 schema 里**完全没有对应字段**，是装饰性 placeholder。
- "默认文本/图片/PDF 模型" 不在 `models.*` 节下，而是在 `agents.defaults.{textModel, imageModel, pdfModel, summaryModel, subagentModel, memorySearch.remote}.{primary, fallbacks}`（`types.agent-defaults.ts:158/173`）。
- "限用量" 在 OpenClaw schema 里**不存在**——没有 `rateLimit / quota / usageCap` 字段。
- OpenClaw 上游 Gateway **没有** `deck.models.*` server method（`src/gateway/server-methods/deck/` 不含 models.ts）。所有写入由 deck-go BFF 翻译成对 `openclaw.json` 的 patch，走现有 `config.write` / `config.patch` 通道。

字段覆盖率 ≈ 30%。要让 deck-go models 模块真正反映 OpenClaw 的可配置维度，必须做契约 + BFF + 前端 + handoff 全链路重构。

## 2. Goals & Non-goals

### Goals

- 把 OpenClaw `models.{mode, providers}` schema 的字段在 deck-go 前端覆盖到 ≥ 95%（除 `compat` 和 `request` 两块走 raw editor 之外）。
- 支持 provider lifecycle：add（preset wizard）/ edit / delete（强护栏）。
- 支持 model lifecycle：add / edit / delete，含 contextWindow / contextTokens / maxTokens / cost 4 维 / headers 编辑。
- 支持 catalog mode 切换（merge/replace），切到 replace 走 dry-run impact preview。
- per-provider headers / per-model headers 编辑（前者 `Record<str, SecretRef>`，后者 plain string）。
- apiKey 使用 SecretRef-only 输入（永不显示明文，提供 legacy literal 一键 migrate 入口）。
- list 上对每个被 default 槽引用的 model 显示 default badge，点击跨模块跳转到 agents panel 对应槽位。

### Non-goals

- **L4 默认槽位编辑**（`agents.defaults.*` 编辑） → follow-up `deck-go-models-default-slot-editing`，归属 agents 模块边界。
- **限用量** → follow-up `openclaw-models-rate-limit-schema`，需要先到 OpenClaw 主仓库提案 schema 加 `rateLimit` 字段。
- **OAuth 流** → follow-up `deck-go-models-oauth-flow`，schema 支持 `auth: "oauth"` 但 OpenClaw 主仓库没 OAuth 实现。
- **`compat` 30+ flags 的 form 化编辑** → 默认隐藏 + raw editor 跳转。
- **`request`（proxy/TLS 覆写）的 form 化编辑** → 默认隐藏 + raw editor 跳转。
- **deprecated discovery toggles**（`bedrockDiscovery / copilotDiscovery / huggingfaceDiscovery / ollamaDiscovery`）的 UI 展示 → BFF 写入时保留这些字段，UI 只在 raw editor 暴露。

## 3. Source of Truth

```
src/config/types.models.ts              # ModelsConfig / ModelProviderConfig / ModelDefinitionConfig / MODEL_APIS
src/config/zod-schema.core.ts           # ModelsConfigSchema / ModelProviderSchema / ModelDefinitionSchema
src/config/types.openclaw.ts            # OpenClawConfig.models?: ModelsConfig
src/config/types.agent-defaults.ts      # agents.defaults.{imageModel, pdfModel, ...} = AgentModelConfig
src/config/schema.help.ts:740           # mode merge/replace 详细语义
deck-go/contracts/source/deck-api.contract.ts:1070-1130   # 已有 read DTOs
deck-go/contracts/source/deck-mutations.contract.json:837-1240  # 已有 mutations 声明
deck-go/frontend-new/src/components/panels/models/ModelsPanel.tsx  # 当前 panel（待替换）
```

## 4. Brainstorming 决策固化

| 维度              | 决策                                                                                                   | 理由                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| 范围              | L3：provider + model CRUD + 深度参数编辑                                                               | L4 跨模块、限用量 schema 缺、OAuth 上游缺                  |
| IA                | catalog header + provider-grouped hairline list + 双层 drawer + Add Provider wizard                    | 跟现形态最近、信息密度可控、design system 已有 drawer 模式 |
| apiKey UX         | SecretRef-only                                                                                         | 企业场景安全边界；UI 永不显示明文                          |
| catalog mode 切换 | 可切，merge → replace 二段式 dry-run impact preview                                                    | replace 危险，需要影响面预览                               |
| 删除护栏          | 强：BFF 引用扫描 + UI ImpactPreview + TypeToConfirm                                                    | 多源引用容易隐藏破坏                                       |
| Advanced 字段暴露 | `compat` / `request` 默认隐藏 + raw editor 跳转                                                        | 30+ flags 平铺无价值                                       |
| Add Provider      | preset-driven wizard 三步（preset → secret → starter models）                                          | 用户原话"备选默认供应商"                                   |
| Probe 集成        | list（provider header + HealthPill）+ drawer Overview（recent probes 历史）                            | 问题发现性                                                 |
| 保存策略          | drawer explicit submit + base-hash 校验                                                                | 防多源冲突、明确意图                                       |
| 后端 contract     | hybrid：5 条 typed mutations + 保留 `models.config.save` raw patch fallback + 保留 `models.auth.probe` | 强类型护栏 + raw editor 出口                               |

## 5. Architecture & Contract Chain

### 5.1 数据流

```
openclaw.json (file)
   ↑↓  config.write / config.patch
OpenClaw Gateway
   ↑↓  deck.* RPC (BFF-only typed mutations; no upstream deck.models.*)
deck-go BFF (Go, internal/deckapi)
   ↑↓  deck contracts (source → generated TS/Go)
deck-go frontend (React + DataFabric + TanStack Query)
```

### 5.2 BFF 新增 typed mutations

| Method                                                                | Payload                                                                                                                                  | 行为                                                                                                                                          |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `models.providers.upsert`                                             | `{id, baseUrl, apiKey?: SecretRef, auth?, api?, headers?, authHeader?, injectNumCtxForOpenAICompat?, expectedBaseHash}`                  | upsert provider；若 mode=replace 时 id 与 built-in 冲突要明确 override 标记                                                                   |
| `models.providers.delete`                                             | `{id, impactToken, expectedReferences[], confirmId, expectedBaseHash}`                                                                   | 二段式：UI 先调独立 read RPC 拿 ImpactPreview，再带 `impactToken` + `expectedReferences[]` commit；BFF 在 commit 时再扫一次比对，不一致则 409 |
| `models.providers.{providerId}.models.upsert`                         | `{providerId, modelId, name, api?, reasoning, input[], cost{4维}, contextWindow, contextTokens?, maxTokens, headers?, expectedBaseHash}` | upsert model；校验 `contextTokens ≤ contextWindow`、`maxTokens > 0`、cost 非负                                                                |
| `models.providers.{providerId}.models.delete`                         | `{providerId, modelId, impactToken, expectedReferences[], confirmId, expectedBaseHash}`                                                  | 二段式同 provider delete                                                                                                                      |
| `models.providers.{id}.deletePreview` (read)                          | `{id}`                                                                                                                                   | 扫描 5 类引用源，返 `DeckGoModelsImpactPreview` + `impactToken`（5 min TTL）                                                                  |
| `models.providers.{providerId}.models.{modelId}.deletePreview` (read) | `{providerId, modelId}`                                                                                                                  | 同上                                                                                                                                          |
| `models.mode.set`                                                     | 二段式：`{phase: "dry-run"}` 返 `DeckGoModelsImpactPreview` + `impactToken`；`{phase: "commit", impactToken, expectedBaseHash}` 真正写入 | UI 必须先 dry-run 再 commit；`impactToken` 防止 preview 与 commit 之间状态漂移；TTL 5 min 超时返 410                                          |

**保留**：

- `models.config.save`（raw patch fallback，给 raw editor 写 `compat` / `request`）
- `models.auth.probe`（已有）

### 5.3 引用扫描源矩阵（delete 强护栏依赖）

`models.providers.delete` 与 `models.{provider}.models.delete` 必须扫描以下 5 类引用源。BFF 内部实现一个 `modelReferenceIndex(config) -> ReferenceMap` 函数，单元测试逐条覆盖：

1. `agents.defaults.{textModel, imageModel, pdfModel, summaryModel, subagentModel, memorySearch.remote}.{primary, fallbacks}`
2. `agents.bindings[].model`（`AgentBinding.model` 字段）
3. `sessions.*.model`（持久会话覆写）
4. `hooks.*` 中所有引用模型的字段
5. `routing.*`（agent routing 规则中的模型引用）

输出 `DeckGoModelsImpactPreview`：

```typescript
{
  affectedAgents: Array<{agentId, slot, modelRef, severity}>,
  affectedSessions: Array<{sessionId, modelRef}>,
  affectedDefaultSlots: Array<{slot, isPrimary, modelRef}>,
  affectedBuiltinProviders: Array<{providerId, willBeUnavailable: boolean}>,  // 仅 mode.set replace 时
  severity: "low" | "medium" | "high",
  impactToken: string,  // BFF 生成的 token，commit 时验证
}
```

UI 提交 delete 时必须携带 `expectedReferences[]` + `impactToken`（从 deletePreview 拷贝）。BFF 在 commit 时再扫一次：若结果与 `expectedReferences` 不一致 → 409 + 要求 UI 重新调 deletePreview。type-to-confirm（要求输入 provider/model id）是**额外**护栏，不替代 BFF 扫描。

**Delete UI flow**：用户点 row 上的 Delete → UI 调 `models.providers.{id}.deletePreview` → 渲染 `<ImpactPreviewDialog>` 列受影响项 → 用户 confirm → UI 渲染 `<TypeToConfirmDialog>` 要求输入 id → 用户输入正确 id → UI 调 `models.providers.delete` 携带 `impactToken + expectedReferences + expectedBaseHash` → BFF 重扫比对 → 真删。整个流程 UI 不离开 list 页。

### 5.4 mode.set dry-run 计算

切到 `replace` 时：

1. 列出 OpenClaw built-in provider catalog（hardcoded in OpenClaw 主仓库）。
2. 与 user `models.providers` map 比对：built-in 中**未被** user 配置的 provider 视为"将不可用"。
3. 引用这些 built-in 中 model 的 `agents.defaults.*` / sessions / hooks / routing 全部进 `affectedAgents` / `affectedSessions`。
4. 输出 `DeckGoModelsImpactPreview` + `impactToken`。

UI 收到 preview 后弹 `<ImpactPreviewDialog>`，列出受影响项，要求 confirm 后才发 `mode.set` commit。

### 5.5 新增 read DTOs

- `DeckGoModelsConfigDetail`：每 provider/model 完整字段 + SecretRef refs（不含明文 apiKey）+ `compat` 摘要（`{flagCount: 3, summary: "thinkingFormat=anthropic, toolSchemaProfile=strict, requiresMistralToolIds=true"}`）+ `request` 摘要（`{hasProxy: bool, hasTLSOverride: bool}`）
- `DeckGoModelsImpactPreview`：见 5.3
- `DeckGoBuiltinProviderCatalog`：built-in provider seeds + 每个 seed 的推荐 starter models（用于 Add Provider wizard）

### 5.6 Frontend data layer

复用 `useDataFabricTransports + scoped-query-provider`。新增：

- `useModelsCatalog()` → `{mode, providers[], counts}`
- `useProviderDetail(id)` → `DeckGoModelsConfigDetail` for provider
- `useProviderProbe(id)` → 最近 N 次 probe + 当前 health 状态
- `useBuiltinProviderCatalog()` → wizard preset seeds
- mutation hooks：`useUpsertProvider() / useDeleteProvider() / useUpsertModel() / useDeleteModel() / useSetMode()`，submit 时携带 `expectedBaseHash`，409 时 drawer 顶部 banner 提示重载

## 6. IA + Component Tree

### 6.1 顶层 IA

```
<ModelsPanel>
├── <CatalogHeader>
│     · mode badge (merge|replace)        · counts (4 providers / 17 models)
│     · "Open raw editor" link              · [+ Add Provider]
│
├── <ProviderSection> × N            (按 provider id 字典序)
│     ├── header: glyph + id + count pill + <HealthPill> + ⋯ menu
│     │   click → <ProviderDrawer>
│     └── <ModelRow> × M
│           click → <ModelDrawer>
│
├── <ProviderDrawer>   (level-1, right side)
│     tabs: Overview · Identity · Networking · Models(lite) · Advanced
│
├── <ModelDrawer>      (level-2, stacked above provider drawer)
│     tabs: Overview · Identity · Capacity · Cost · Networking · Advanced
│
├── <AddProviderWizard>  (modal, 三步)
├── <ImpactPreviewDialog>
└── <TypeToConfirmDialog>
```

`<CatalogHeader>` 替代当前 `hero + 5-KPI strip`。装饰性 5 KPI 完全去掉。

### 6.2 List 列结构

替代当前 6 列（name / context / output / probe / spend / status）：

| 列       | 宽度   | 字段映射                              | 说明                                                             |
| -------- | ------ | ------------------------------------- | ---------------------------------------------------------------- |
| Name     | 1.6fr  | `name` + `<small>id · family</small>` | 左侧微 dot 簇标 reasoning / multimodal / local                   |
| Capacity | 0.7fr  | `contextWindow / maxTokens`           | "200k / 16k"                                                     |
| Cost     | 0.7fr  | `cost.input → cost.output`            | "$5 / $15 /M"，cacheRead/cacheWrite 进 hover tooltip             |
| Defaults | 0.55fr | agents.defaults 反查                  | pills: `text` / `image` / `pdf` / `summary`；点击跳 agents panel |
| Health   | 0.4fr  | probe（继承 provider）                | `<HealthPill>`                                                   |
| ⋯        | 32px   | actions menu                          | Edit / Test / Delete                                             |

### 6.3 Drawer tab 字段聚类

**ProviderDrawer**：

- **Overview** — health + recent probes(5) + provider counts + raw editor link
- **Identity** — `id`(创建后只读) · `baseUrl` · `api`(dropdown 9 选 1) · `auth`(radio: api-key / aws-sdk / oauth-disabled / token) · `apiKey` (`<SecretRefPicker>`) · `authHeader`
- **Networking** — `headers`(`Record<str, SecretRef>` 键值编辑器) · `injectNumCtxForOpenAICompat`
- **Models** — provider 下 model 的 lite list + `[+ Add Model]`，单击跳 ModelDrawer
- **Advanced** — `request`(proxy/TLS) 摘要 + "Open raw editor → /models/providers/{id}/request"

**ModelDrawer**：

- **Overview** — 父 provider health 镜像 + 被 default 槽引用情况(只读，跨模块跳转 agents panel)
- **Identity** — `id`(创建后只读) · `name` · `api`(dropdown 含 "Inherit from provider") · `reasoning` · `input[]`(text/image checkbox)
- **Capacity** — `contextWindow` · `contextTokens`(helper: "≤ contextWindow，用于 compaction") · `maxTokens`
- **Cost** — 4 number input: `input / output / cacheRead / cacheWrite`（per-million tokens, USD 固定）
- **Networking** — `headers`(per-model 覆写, `Record<str, str>` plain string)
- **Advanced** — `compat` 摘要("3 flags: thinkingFormat=anthropic, toolSchemaProfile=strict, requiresMistralToolIds=true") + raw editor 跳转

### 6.4 Add Provider Wizard 三步

1. **Preset** — built-in seeds（OpenAI / Anthropic / Google / Azure OpenAI / Bedrock / Ollama / GitHub Copilot / OpenAI-compatible / Custom）。每行 glyph + name + 缩略 baseUrl + api default + auth default + 一句用途。已 configured 的 built-in 显示 "Configured (override?)" 标记，支持 merge 模式下覆写 built-in 的 baseUrl/apiKey/headers。
2. **Secret** — `<SecretRefPicker>` 选择已有 SecretRef 或 inline create new secret entry。`auth=aws-sdk` 跳过这步（IAM 走 SDK auth）。`auth=oauth` **disabled** + 提示 "OAuth 流暂不支持，请用 token 模式"——OAuth 单独走 follow-up OpenSpec change。
3. **Starter models** — preset 内置 3-5 个 seed model（预填 contextWindow / maxTokens / cost 4 维 / api / reasoning），多选写入 `provider.models[]`。OpenAI-compatible / Custom 这步空白，"Add later"。

### 6.5 Field-to-UI 完整决策矩阵

#### ProviderConfig 字段

| Field                         | List 显示               | 编辑位置                                    | 编辑形态                                           | 守卫                                                                      |
| ----------------------------- | ----------------------- | ------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------- |
| `id`                          | provider header         | wizard step 1 输入；upsert 后 Identity 只读 | string input                                       | wizard 时校验唯一性；override built-in 时复用 built-in id 而不是创建新 id |
| `baseUrl`                     | –                       | Identity                                    | url input                                          | required                                                                  |
| `apiKey`                      | –                       | Identity                                    | `<SecretRefPicker>`                                | SecretRef-only；UI 永不渲染明文                                           |
| `auth`                        | –                       | Identity                                    | radio (api-key / aws-sdk / oauth-disabled / token) | enum；oauth disabled                                                      |
| `api`                         | –                       | Identity                                    | dropdown 9 选 1                                    | enum                                                                      |
| `headers`                     | –                       | Networking                                  | KV editor (`Record<str, SecretRef>`)               | header value 必走 SecretRefPicker                                         |
| `authHeader`                  | –                       | Networking                                  | toggle                                             | –                                                                         |
| `injectNumCtxForOpenAICompat` | –                       | Networking                                  | toggle                                             | –                                                                         |
| `request`                     | –                       | Advanced 摘要                               | raw editor 跳转                                    | hidden by default                                                         |
| `models[]`                    | model rows + Models tab | upsert/delete mutations                     | –                                                  | 强护栏                                                                    |

#### ModelDefinitionConfig 字段

| Field             | List 显示                      | 编辑位置               | 编辑形态                            | 守卫                      |
| ----------------- | ------------------------------ | ---------------------- | ----------------------------------- | ------------------------- |
| `id`              | row meta                       | Identity（创建后只读） | string input                        | required                  |
| `name`            | row name 主体                  | Identity               | string input                        | required                  |
| `api`             | row pill (when ≠ provider api) | Identity               | dropdown w/ "Inherit from provider" | enum                      |
| `reasoning`       | row dot                        | Identity               | toggle                              | –                         |
| `input[]`         | row dot (text/image)           | Identity               | checkbox group                      | required ≥ 1              |
| `cost.input`      | row "$X /M"                    | Cost                   | number input (per-M USD)            | non-neg                   |
| `cost.output`     | row "$X /M"                    | Cost                   | number input                        | non-neg                   |
| `cost.cacheRead`  | row tooltip                    | Cost                   | number input                        | non-neg                   |
| `cost.cacheWrite` | row tooltip                    | Cost                   | number input                        | non-neg                   |
| `contextWindow`   | row "Xk"                       | Capacity               | number input                        | required > 0              |
| `contextTokens`   | –                              | Capacity               | number input + helper               | optional, ≤ contextWindow |
| `maxTokens`       | row "Xk"                       | Capacity               | number input                        | required > 0              |
| `headers`         | –                              | Networking             | KV editor (`Record<str, str>`)      | plain string              |
| `compat`          | –                              | Advanced 摘要          | raw editor 跳转                     | hidden by default         |

### 6.6 Default badge 跨模块跳转

list row 上的 default pills（text / image / pdf / summary 等）来自 `agents.defaults.*` 反查。点击 → 切到 agents panel 并定位到 `agents.defaults.{slot}` 编辑控件。复用现有 router params + 锚点定位（例如 `/panels/agents#defaults.imageModel`）。drawer Overview 显示同样信息但只读，不提供编辑——L4 不在本次范围。

### 6.7 视觉延续

- 沿用 `models-panel.css` 上次收敛的 hairline / 紧凑 row / OpenType 设置
- 沿用 `tokens/index.css` 现有 design tokens（`--ds-*`），不引入新 token
- drawer 复用 design system 已有 sheet/drawer 形态（Sessions / Agents 已用）
- `<HealthPill>` / `<SecretRefPicker>` / `<ImpactPreviewDialog>` / `<TypeToConfirmDialog>` 是新增组件，但都按现有 Pill / Picker / Dialog 模式实现

## 7. Edge States & Error Handling

| 状态                  | 触发                                 | UI                                                                                                                                          |
| --------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading               | 首次加载 / drawer 打开               | hairline skeleton（list 用 SkeletonRow，drawer 用 tab-shaped skeleton）                                                                     |
| true-empty            | mode=replace 且 `providers={}`       | catalog body "No providers configured. [Add Provider]"                                                                                      |
| filtered-empty        | filter 无命中                        | "No providers / models match filter — Clear filter"                                                                                         |
| Probe 失败：401       | apiKey 错或过期                      | HealthPill 红；drawer Overview reason "Check apiKey SecretRef" + 跳到 Identity tab                                                          |
| Probe 失败：timeout   | 网络 / baseUrl 错                    | HealthPill 黄；reason "Check baseUrl/network"                                                                                               |
| Probe 失败：5xx       | 上游服务问题                         | HealthPill 黄；reason "Upstream returned 5xx"，retry 按钮                                                                                   |
| base-hash 冲突        | submit 收 409                        | drawer 顶部 banner "配置已被其他来源修改"，按钮 "Reload changes"（刷新后 dirty fields 用 3-way merge UI 提示哪些字段冲突）                  |
| SecretRef 缺失        | UI 渲染时引用的 secret id 不在 store | Identity tab 该字段红 "Missing secret: …"；HealthPill warn；drawer 顶部 "Provider not usable until secret restored"                         |
| 删除引用拦截          | BFF 扫到引用                         | `<ImpactPreviewDialog>` 列 affected agents / sessions / default slots；`<TypeToConfirmDialog>` 要求输入 provider/model id                   |
| mode→replace          | dry-run 显 impact                    | dialog 列 "N built-in providers 将不可用 / M agents 的 fallback 链将断"，二段式 confirm + commit                                            |
| legacy literal apiKey | 旧配置读到字面值                     | drawer Identity 顶 banner "Legacy literal detected" + 一键 Migrate（写 secrets store → 替换为 ref → 删 literal，事务失败回滚 secret entry） |
| 覆写 built-in baseUrl | wizard 选 "Configured (override?)"   | 提示 "Override built-in baseUrl/apiKey；apiKey 必须用 SecretRef"                                                                            |
| OAuth 选项            | wizard auth=oauth                    | 字段 disabled + 提示 "OAuth 流暂不支持，请用 token 模式"                                                                                    |
| Probe 历史空          | 从未 probe                           | drawer Overview "Never tested. Click Test now."                                                                                             |

## 8. Testing Strategy

### 8.1 BFF 单测（Go）

- 5 条 typed mutations 各自 happy path + negative paths（invalid SecretRef / base-hash 冲突 / SecretRef 不存在 / contextTokens > contextWindow / cost 负值 / mode=replace 时 id 与 built-in 冲突）
- `modelReferenceIndex(config)` 引用扫描覆盖 5 类源（agents.defaults 6 槽 + bindings + sessions + hooks + routing），每类 ≥ 1 条 fixture
- `mode.set` dry-run impact 计算：built-in 失效列表正确、agents.defaults 引用断列表正确、impactToken 唯一性
- legacy literal apiKey migrate 事务：secret create 失败 → 回滚；patch 失败 → 回滚 secret store 已创建的 entry

### 8.2 Frontend 组件测试（vitest）

- `<CatalogHeader>` mode/counts/CTA
- `<ProviderSection>` + `<ModelRow>` 字段映射、default pill 跨模块 URL
- `<HealthPill>` 4 状态（ok / warn / fail / never）
- `<SecretRefPicker>` 选择 / inline create / missing
- `<ProviderDrawer>` / `<ModelDrawer>` tab 切换、dirty state、discard confirm、base-hash 冲突 banner
- `<AddProviderWizard>` 3 步流（preset → secret → starter models）+ override built-in 路径 + OAuth disabled 提示
- `<ImpactPreviewDialog>` / `<TypeToConfirmDialog>` 输入校验、receive impactToken

### 8.3 Mock E2E (Playwright)

- 完整 happy path：list 渲染 → 切 mode (preview + commit) → Add Provider wizard 创建 OpenAI-compatible → 编辑 provider drawer (headers) → 添加 model → 编辑 model drawer (capacity / cost) → probe → delete model (强护栏) → delete provider (强护栏)
- 异常路径：base-hash 冲突 banner、SecretRef 缺失警告、legacy literal migrate 入口

### 8.4 Real Gateway smoke

- isolation fixture（`deck-go/scripts/dev/run-stack-real.sh` + 隔离 workspace）
- happy path：创建 OpenAI-compatible provider（baseUrl 指向 mock OpenAI server）→ SecretRef 真实写入 secrets store → upsert model → real probe（mock OpenAI 返 200）→ delete model → delete provider
- **不在 real 验证**：`mode.set` replace（影响面太大、跨 agents/sessions 污染面广，留给单测 + mock E2E 覆盖）

### 8.5 Contract gate

- 5 条新 typed mutations 在 `deck-go/contracts/source/deck-mutations.contract.json` 列 ownerModule / route / mockEvidence / realEvidence
- `make contract-gate` + `make protocol-check` 通过

## 9. Migration & Compatibility

### 9.1 现 ModelsPanel.tsx 完全替换

2200 行 monolith 完全删除。新 `panels/models/` 目录拆分多文件，每文件 ≤ 300 行：

```
panels/models/
├── ModelsPanel.tsx               # 容器
├── CatalogHeader.tsx
├── ProviderSection.tsx
├── ModelRow.tsx
├── ProviderDrawer.tsx
├── ModelDrawer.tsx
├── AddProviderWizard.tsx
├── dialogs/
│   ├── ImpactPreviewDialog.tsx
│   ├── TypeToConfirmDialog.tsx
│   └── MigrateLegacyApiKeyDialog.tsx
├── widgets/
│   ├── HealthPill.tsx
│   └── SecretRefPicker.tsx
├── models-panel.css              # 沿用上次收敛
└── models-panel.test.tsx + 各组件 *.test.tsx
```

**不要 feature flag 并存**——schema 覆盖率从 30% → 95% 是非渐进改动，没有合理的局部 refactor 路径。

### 9.2 deprecated discovery toggles

`bedrockDiscovery / copilotDiscovery / huggingfaceDiscovery / ollamaDiscovery` 在 UI 上不展示。BFF 写入 patch 时**保留**这 4 个字段（patch 只动 `models.providers / models.mode`，不动 discovery toggles），仅 raw editor 可见可编。

### 9.3 legacy literal apiKey

UI 永不渲染明文（即使读到也用 `***`）。一键 Migrate 走事务：

1. 在 secrets store 创建新 secret entry，value = 当前 literal apiKey
2. patch `models.providers.{id}.apiKey` 替换为 `{ref: "/providers/{id}/apiKey"}`
3. 旧 literal 在 patch 中被覆盖

任一步失败 → 回滚已创建的 secret entry，drawer 提示 "Migration failed: …"。

### 9.4 frontend-handoff 反向同步

按 Section 6 IA 重写 `deck-go/frontend-handoff/modules/models/` 下文件：

**主要文档（必须重写）**：

- `README.md`：status: needs-revision → revised；reverse sign-off 标"based on schema-真相重新对齐"
- `prototype.html`：catalog header + provider sections + drawer mock + wizard mock 全套
- `styles.css`：沿用 hairline 风格 + 新 IA 结构
- `states.md`：所有 edge states（SecretRef 缺失、legacy migrate、base-hash 冲突、impact preview、type-to-confirm、OAuth disabled 等）
- `interactions.md`：drawer dirty state、二级 stack、wizard 三步流、跨模块跳转、二段式 delete 流
- `components.md`：组件树（Section 6.1 + 6.4）
- `api-usage.md`：5 条新 typed mutations + 2 条新 read RPCs（deletePreview）+ `models.config.save` raw fallback + `models.auth.probe`
- `implementation-notes.md`：跨链路要点（contract 链、引用扫描源、SecretRef 边界、handoff 与 raw editor 边界）

**Prototype 实现拷贝（同步重写）**：

- `app.jsx` / `list-view.jsx` / `detail-view.jsx` / `dialogs.jsx` / `tweaks-panel.jsx` / `icons.jsx` / `data.js`：按新组件树重写为 IA 一致的 prototype 实现
- `tokens.css`：与 deck-go `tokens/index.css` 同步（不引入新 token）
- `prototype-v1-codex.html`：保留为历史 v1 codex 版本归档参考，不再迭代

## 10. Risks

1. **BFF 引用扫描覆盖不全** → 强护栏被绕过 → tasks 列完整源清单 + 单测每条
2. **mode.set dry-run 计算复杂** → 新逻辑无现成 helper → 单测重点；built-in catalog 取自 OpenClaw 主仓库 hardcoded 列表，需要 BFF 内嵌或读取
3. **legacy literal apiKey 事务原子性** → 失败回滚必须实现 + 失败 case 测试
4. **drawer 二级 stack 状态机** → 同时编辑 provider 和 model 时 dirty state 跨 drawer 容易混乱 → 设计 stack frame state，明确 close model drawer 时 provider drawer 是否保留 dirty
5. **2200 行 monolith 完全替换覆盖断层** → 重写期间组件测试要 1:1 覆盖现有功能 + i18n keys 不丢
6. **SecretRefPicker 与 secrets 模块的边界** → 复用现有 secrets 模块的列表 query / inline create mutation；不要在 models 模块里复刻 secrets CRUD

## 11. Open Questions

- **drawer 二级 stack 行为**：close model drawer 时 provider drawer 是保留 dirty state 还是同步 reset？倾向保留（用户可能在编辑 provider 的同时打开 model 看一眼），但需要 component 测试确认 UX。
- **starter models 的 preset seed 列表来源**：是 hardcoded 在 frontend，还是 BFF 从 `useBuiltinProviderCatalog()` 提供？倾向 BFF 提供（OpenClaw 主仓库可能升级 built-in catalog，前端跟得上），需要确认 OpenClaw 是否暴露 built-in 的 model meta；若不暴露，先 hardcode 在 BFF Go 层（与 OpenClaw 主仓库版本对齐时同步更新）。
- **compat 摘要的展示策略**：列出 "3 flags configured" 还是列出具体 flag 名？倾向具体 flag 名（power user 一眼就知道触发了什么 flag）。
- **dry-run impactToken 的 TTL**：BFF 生成的 impactToken 在 commit 时验证。如果用户 dry-run 后等 5 分钟才 commit，TTL 应该多长？倾向 5 分钟，超时返 410 + 提示重新 dry-run。

## 12. Follow-ups（不在本次实施）

记录为 follow-up 候选，**待本设计创建为 OpenSpec 提案时**同步落到 `openspec/follow-ups/`：

1. **deck-go-models-default-slot-editing** (L4)：`agents.defaults.{textModel, imageModel, pdfModel, summaryModel, subagentModel, memorySearch.remote}` 编辑——实际归属 agents 模块边界，需要单独 brainstorming
2. **openclaw-models-rate-limit-schema**：到 OpenClaw 主仓库提案 schema 加 `models.providers.*.rateLimit` / `models.providers.*.models[].rateLimit`，再到 deck-go 暴露
3. **deck-go-models-oauth-flow**：依赖主仓库 OAuth 实现；schema 已有 `auth: "oauth"` 但没 OAuth runner

## 13. Implementation Task Skeleton

详细 plan 由 writing-plans skill 生成。依赖顺序骨架：

1. Contracts 层（contracts source + generated TS/Go + mutation registry 5 条新增）
2. BFF：5 typed mutations handlers
3. BFF：modelReferenceIndex 引用扫描 + dry-run impact 计算
4. Frontend data layer（query / mutation hooks）
5. Frontend 容器组件（CatalogHeader / ProviderSection / ModelRow）
6. Frontend drawers（ProviderDrawer / ModelDrawer + 二级 stack 状态机）
7. Frontend Add Provider Wizard
8. Frontend dialogs（Impact / TypeToConfirm / MigrateLegacy）+ widgets（HealthPill / SecretRefPicker）
9. 删旧 ModelsPanel.tsx + 替换 import + i18n key 同步
10. 组件测试 + mock fixture
11. Mock E2E（happy + 异常）
12. Real gateway smoke（happy only）
13. Handoff 反向同步 7 文件 + reverse sign-off
14. follow-ups 文件创建（3 条）

## 14. Codex Cross Review 代码真相补全与修正方案

本节是 2026-05-09 Codex 基于代码真相的交叉审查结论。结论不是推翻 Section 1-13，而是把方案校准到用户确认的目标：**模型模块的最高真相是 OpenClaw `openclaw.json` 里与模型相关的可更改配置；deck-go 的目标是让用户不再手写配置，而是通过 OpenClaw Gateway RPC 写入这些配置；可写字段、校验和说明来自 OpenClaw schema/type/help，而不是前端原型。**

契约层的定位也需要明确：deck-go contracts 是面向前端和 Go BFF 的产品级适配契约，不是绝对真相源。如果当前 deck-go 契约、DTO、mutation registry、Data Fabric hook 或旧前端实现与 OpenClaw 端的配置真相不一致，本次重构应先修契约链，再基于修正后的契约实现前后端。不能为了兼容旧 deck-go 契约而牺牲 OpenClaw 配置语义。

### 14.1 代码真相基线

| 主题                         | 代码真相                                                                                                                                                                                                                                       | 对设计的影响                                                                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 配置权威源                   | `src/config/types.models.ts` 定义 `ModelsConfig`、`ModelProviderConfig`、`ModelDefinitionConfig`、`MODEL_APIS`；`src/config/zod-schema.core.ts` 定义实际校验 schema；`src/config/schema.help.ts` 提供字段说明。                                | 产品字段矩阵必须从这三处推导。TS 类型和 zod 不是完全同构，实施时应以 zod 校验加 help 文案作为写入边界。                                                     |
| Gateway 写入 RPC             | 当前上游写入 RPC 是 `config.patch` / `config.apply`，参数是 `{raw, baseHash, note?, restartDelayMs?}`；没有上游 `models.providers.upsert`、`models.mode.set` 等模型专用 RPC。                                                                  | Section 5.2 的 typed mutations 不能描述成 Gateway 方法。它们应是 deck-go BFF 产品级 action/route，底层统一调用 Gateway `config.get` + `config.patch`。      |
| `config.patch` 语义          | `src/gateway/server-methods/config.ts` 会读取当前 config、校验 `baseHash`、把 `raw` 作为 merge patch 合入当前配置、`mergeObjectArraysById: true`、恢复 redacted values、运行 zod/plugin 校验、检查 SecretRef 可解析，然后写文件并触发重启。    | BFF typed mutation 应生成最小 merge patch，而不是让前端拼完整 raw config。base-hash conflict 是一等产品状态。                                               |
| 当前 deck-go BFF             | `deck-go/backend/internal/server/inventory.go` 和 `deck-go/backend/internal/api/http/admin.go` 只有 `GET /models/config` 与 `PATCH /models/config`，它们直接转发 `ConfigGet` / `ConfigPatch`。                                                 | 现状能写，但不是产品级 typed 写入。重构应新增 typed BFF routes，同时保留 raw fallback 给 raw editor。                                                       |
| 当前 frontend data layer     | `frontend-new/src/data/modules/models/*` 已走 Data Fabric：`GET /models/config`、Gateway `models.configured`、`deck.auth.overview`、`models.catalog.providers`、usage、schema lookup、`models.config.save`、`models.auth.probe`。              | 不需要重建 data layer 基础设施；重点是增加 typed projection/query/mutation，减少 `ModelsPanel.tsx` 自己 parse raw config。                                  |
| 当前 ModelsPanel             | `ModelsPanel.tsx` 约 2221 行，另有 `ProviderModelsEditor.tsx` 约 670 行。它不只是读七个字段，已经读写 runtime/config model、provider auth、catalog、usage、default text/image、cost、headers、部分 compat、raw config 等。                     | 原方案“字段覆盖率约 30%，只读七字段”的事实需要修正。问题是 raw-heavy、monolith、契约层薄弱、产品写入没有 typed BFF 护栏，而不是完全没覆盖字段。             |
| SecretInput                  | `src/config/types.secrets.ts` 表明 `SecretInput = string                                                                                                                                                                                       | SecretRef`，SecretRef 支持 `env`/`file`/`exec`。当前 deck-go 没有模型模块可复用的通用 secrets store CRUD。                                                  | “SecretRef-only”可以作为新写入的产品策略，但不是上游 schema 强制。`inline create secret entry` 和“写 secrets store 后回滚”没有代码真相，必须降级为 follow-up 或改成“选择/构造 SecretRef，不保存 secret value”。 |
| provider catalog             | Gateway `models.catalog.providers` 来自 `loadGatewayModelCatalog()` 加 `KNOWN_PROVIDER_DEFAULTS`。当前 `KNOWN_PROVIDER_DEFAULTS` 只有 anthropic、openai、deepseek、google、moonshot、mistral、groq 等默认信息。                                | Add Provider wizard 不应在前端硬编码大名单。preset 来源应是 BFF/Gateway catalog projection；没有默认 baseUrl/auth 的 provider 显示为 custom/catalog entry。 |
| model field optionality      | TS `ModelDefinitionConfig` 把若干字段写成 required，但 zod `ModelDefinitionSchema` 对 `reasoning`、`input`、`cost`、`contextWindow`、`contextTokens`、`maxTokens` 多数是 optional。                                                            | UI 新建 model 可以要求完整字段，但编辑已有 partial config 时必须保留缺失字段，不要静默填默认值导致配置膨胀或语义改变。                                      |
| deprecated discovery toggles | `types.models.ts` 保留 `bedrockDiscovery` 等 legacy 字段，但 `ModelsConfigSchema` 当前 strict schema 只含 `mode` / `providers`。                                                                                                               | 不应把这些字段作为本次 raw editor 可编辑能力来承诺。BFF 最小 patch 自然不触碰它们；若旧配置含 legacy 字段，需要单独验证 Gateway legacy 兼容路径。           |
| accepted specs               | `openspec/specs/deck-go-models-providers-contract-completion/spec.md` 和 `openspec/specs/deck-go-config-write-safety-contracts/spec.md` 已要求 models claims 映射契约真相、config-like writes 记录 base-hash/conflict/idempotency/audit 语义。 | 新提案必须继承这两个 accepted spec，不能只写 UI 重构。                                                                                                      |

### 14.1.1 真相优先级

本模块的设计与实施应按以下优先级决策：

1. **OpenClaw 配置与 Gateway 写入语义**：`openclaw.json` 可配置字段、`src/config/types.models.ts`、`src/config/zod-schema.core.ts`、`src/config/schema.help.ts`、Gateway `config.get` / `config.patch` / `config.apply` 是最高真相。
2. **OpenClaw 运行时读能力**：`models.configured`、`models.catalog.providers`、`deck.auth.overview`、`deck.auth.probe` 等 Gateway read/probe 能力决定 UI 能展示和验证哪些 runtime 状态。
3. **deck-go 产品级契约**：`deck-go/contracts/source/*` 应把 OpenClaw 真相适配成前端友好的 DTO、BFF route、mutation metadata、UI metadata；发现不一致时应修改契约，而不是让前端绕过契约。
4. **deck-go 前后端实现**：Go BFF、Data Fabric、React 页面只消费修正后的产品契约。旧 `ModelsPanel.tsx`、旧 mock、旧 prototype 只能作为迁移参考。
5. **设计原型与视觉稿**：原型服务于产品体验，但不能创造 OpenClaw 不支持的字段、状态或写入能力。

### 14.2 对原方案的保留结论

以下方向是合理的，应保留：

- 从原型导向改成 schema/config 导向，优先覆盖 `models.mode` 与 `models.providers.*`。
- 去掉装饰性 KPI，把列表改成 provider grouped model inventory，并展示 capacity、cost、default usage、health。
- 把 default slot 编辑排除在本次模型模块写入之外，models 模块只展示和跳转到 owning module。
- `compat` 与 `request` 不做全量表单，先摘要加 raw/editor escape hatch。
- 删除 provider/model 必须有引用影响预览、强确认和服务端重扫。
- 全链路必须覆盖 contracts、BFF、Data Fabric、frontend UI、mock E2E、real safe smoke、handoff。

### 14.3 必须修正的设计点

1. **typed mutations 的定位要改**

   原文的 `models.providers.upsert`、`models.providers.delete`、`models.mode.set` 不应写成上游 Gateway RPC。修正为 deck-go BFF 产品 action，例如：
   - `GET /models/config/detail`
   - `POST /models/providers/{providerId}:upsert`
   - `POST /models/providers/{providerId}:delete-preview`
   - `DELETE /models/providers/{providerId}`
   - `POST /models/providers/{providerId}/models/{modelId}:upsert`
   - `POST /models/providers/{providerId}/models/{modelId}:delete-preview`
   - `DELETE /models/providers/{providerId}/models/{modelId}`
   - `POST /models/mode:set`

   这些 route 的实现必须走 Gateway `config.get` 读取当前 hash/source config，再构造最小 `models` merge patch 调 `config.patch`，并返回 `DeckGoConfigApplyResponse` 或产品级 projection。合同里 mutation id 可继续命名为 `models.providers.upsert`，但 sourceClassification 应明确是 `deck-go-bff-over-gateway-config-patch`，不是新的上游方法。

2. **SecretRef-only 需要降级为产品策略，不是 schema 真相**

   上游 `apiKey` / provider headers 支持 `string | SecretRef`。本次可以规定：新建和编辑 UI 默认只写 SecretRef，永不显示 literal 明文；读取到 legacy literal 时只显示“legacy literal present”。但“inline create new secret entry”和“事务写 secrets store”当前没有 deck-go 模型模块代码真相，不应进入本次 L3 实施。建议改为：
   - 支持选择/输入 SecretRef 三元组 `{source, provider, id}`。
   - 支持 env template helper，例如引导用户填 `OPENAI_API_KEY` 并写成 env SecretRef，而不是写 secret value。
   - legacy literal migrate 仅做 `string -> SecretRef` 替换；真正把 secret value 写入某个安全 store 作为 follow-up `deck-go-secrets-control-plane`。

3. **当前 UI 事实要修正**

   当前 panel 已经有 `ProviderModelsEditor` 和 raw editor；不是“没有模型配置编辑”。但它把 product logic 放在前端 raw JSON 拼接里，且没有 typed BFF delete/upsert/impact 护栏。OpenSpec 的 problem statement 应改成：
   - models UI 已具备初步 runtime/config/catalog/auth/usage 拼接能力；
   - 但 monolith 过大，字段归属和写入策略不清；
   - 前端直接拼 raw config 使产品契约、baseHash 冲突、SecretRef、引用影响预览无法集中治理。

4. **默认槽位字段名要按 OpenClaw 真相修正**

   当前实际默认主文本字段是 `agents.defaults.model`，不是 `textModel`。相关可展示引用包括 `model`、`imageModel`、`imageGenerationModel`、`videoGenerationModel`、`musicGenerationModel`、`pdfModel`、`subagents.model`、`heartbeat.model`、`compaction.model`、`memorySearch.remote` 相关模型字段等。哪些 default badge 进入 models 模块需要和 agents 模块边界再确认，不能只写 text/image/pdf/summary。

5. **引用扫描源要重新按 config types 枚举**

   原方案的 5 类扫描源方向对，但字段名不够准确。至少应从这些代码真相出发：
   - `agents.defaults.*` 中所有 `AgentModelConfig` 或 model string 字段；
   - `agents.list[].model`、`agents.list[].subagents.model`、`agents.list[].heartbeat.model`、`agents.list[].memorySearch` 相关模型字段；
   - `bindings[]` 本身是 routing binding，主要引用 agentId，不是 model；不要写成 `agents.bindings[].model`；
   - `hooks.internal.entries.*.model`、`hooks.gmail.model`、hook mapping model；
   - `channels.modelByChannel`；
   - `tools.media.*.models`、`tools.links.models`、`tools.search.embedding.model` 等工具侧模型字段；
   - session store 里的 model override 属于 workspace runtime data，不一定在 `openclaw.json`，应作为 real impact read-only source 单独验证。

   OpenSpec 里应先实现 `modelReferenceIndex(config, runtimeStores?)` 的字段清单测试，再让 delete/mode impact 依赖它。

6. **mode replace dry-run 不能假设 hardcoded built-in list 完整**

   `models.catalog.providers` 已经提供 catalog provider projection；`KNOWN_PROVIDER_DEFAULTS` 只补一部分 provider 默认信息。dry-run 应优先使用 Gateway catalog/config 事实，BFF 只做 projection，不在前端硬编码“OpenAI / Anthropic / Google / Azure / Bedrock / Ollama / Copilot”等完整商业列表。缺默认 metadata 的 provider 仍可显示，但不能生成未经验证的 baseUrl/auth 默认值。

7. **raw editor fallback 要收窄**

   用户目标是不再手写 `openclaw.json`。因此 raw editor 应是高级 escape hatch，不应继续承担主要保存路径。建议本次把 `models.config.save` 保留但降级：
   - typed UI 的 create/edit/delete/mode 走新 BFF typed routes；
   - raw editor 仅用于 `compat` / `request` / 未产品化字段；
   - raw editor 打开前提示会直接进入 Gateway `config.patch`，且不提供产品级 impact preview。

### 14.4 修正后的实施路线

建议把原“L3 全量重写”拆成一个 OpenSpec change，但内部按四个 vertical slice 实施，避免大爆炸：

1. **Contract and projection slice**
   - 新增 Deck-facing DTO：`DeckGoModelsConfigDetail`、`DeckGoModelProviderDetail`、`DeckGoModelDefinitionDetail`、`DeckGoModelsImpactPreview`、`DeckGoModelReferenceIndex`。
   - 新增 mutation registry：typed BFF action ids，明确底层 Gateway `config.patch`、baseHash、conflict、idempotency unsupported、audit deferred。
   - `make contracts-sync` / `make contract-gate`。

2. **BFF write adapter slice**
   - 实现 `GET /models/config/detail`，从 `config.get` 投影，不暴露 literal secret value。
   - 实现 provider/model upsert 和 mode set，所有写入生成最小 merge patch 后调用 `config.patch`。
   - 实现 `modelReferenceIndex` 与 delete/mode preview；commit 时重扫并比较 preview token 或 reference hash。
   - Go tests 覆盖 zod optional 字段保留、SecretRef 解析失败透传、baseHash conflict、delete impact drift。

3. **Frontend product UI slice**
   - 替换 monolith 为 provider grouped list + drawer/wizard/dialog。
   - Data Fabric 只消费 `GET /models/config/detail` 和 typed mutations；不再由 panel 拼 raw config 完成普通写入。
   - Raw editor 只在 Advanced 路径出现。

4. **Evidence and handoff slice**
   - mock E2E 覆盖 typed UI happy path 与 baseHash/SecretRef/delete preview 错误态。
   - real smoke 使用隔离配置，通过 typed BFF route 新增 run-scoped provider/model，然后确认 `config.get` 与 `models.configured` 可读，再删除清理。
   - 重写 `frontend-handoff/modules/models`，但必须注明原 prototype 是 v1 参考，新 prototype 以 OpenClaw config truth 为准。

### 14.5 OpenSpec 提案写作要求

后续创建 OpenSpec 时，proposal/design/spec/tasks 需要显式包含这些验收线：

- 所有可写字段必须能追溯到 `src/config/types.models.ts`、`src/config/zod-schema.core.ts` 或 `src/config/schema.help.ts`。
- 若现有 deck-go contract 与 OpenClaw 模型配置真相不一致，OpenSpec tasks 必须先包含 contract repair：修 `contracts/source/*`、生成 TS/Go、更新 mutation/UI metadata，再实现 BFF 和前端。
- 所有普通 UI 写入不得让前端提交 raw full config；只能调用 typed BFF mutation。
- typed BFF mutation 必须证明底层使用 Gateway `config.get` + `config.patch`，并保留 baseHash/conflict 语义。
- 新写入不得伪造 SecretRef store 能力；若没有 secret store 代码真相，只能写 SecretRef reference 或记录 follow-up。
- delete/mode impact 的引用扫描字段清单必须先由测试锁定。
- `models.config.save` raw fallback 必须保留但降级，不得作为普通 provider/model CRUD 的实现路径。
- `make contract-gate`、BFF Go tests、frontend component tests、mock E2E、real safe smoke 都必须是 tasks 的完成证据。

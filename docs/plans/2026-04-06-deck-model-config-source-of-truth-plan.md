# Deck Model Configuration Source-of-Truth Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Deck 的模型/供应商 UI 明确区分主配置层、agent-local 层和运行时聚合层，避免再出现“provider 实际可用但在 UI 中像丢失了”的错觉。

**Architecture:** 采用渐进式改造：先在 Gateway 现有 RPC 上补 provenance / scope / editability 信息，不急于新增全新 inventory RPC；再在 Deck 中拆分 “Global Provider Config” 与 “Runtime Provider Inventory” 两类视图，最后补 UI 文案、只读提示和回归测试。

**Tech Stack:** Next.js App Router, React, Zustand, Gateway TypeBox schemas, generated protocol/client, Vitest

---

## References

- Design baseline: `docs/plans/2026-04-06-deck-model-config-source-of-truth-design.md`
- Existing protocol-driven baseline: `docs/plans/2026-04-06-deck-protocol-driven-design.md`
- Existing protocol-driven implementation plan: `docs/plans/2026-04-06-deck-protocol-driven-plan.md`

---

## File Structure

| File                                                                  | Responsibility                     | Action                                                      |
| --------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| `docs/plans/2026-04-06-deck-model-config-source-of-truth-design.md`   | 模型配置来源设计基线               | REFERENCE                                                   |
| `docs/plans/2026-04-06-deck-model-config-source-of-truth-plan.md`     | 本实施计划                         | CREATE                                                      |
| `src/gateway/server-methods/models.ts`                                | 运行时 configured models 聚合逻辑  | MODIFY                                                      |
| `src/gateway/server-methods/deck-auth.ts`                             | provider auth overview 聚合逻辑    | MODIFY                                                      |
| `src/gateway/protocol/schema/agents-models-skills.ts`                 | models/configured 返回 schema      | MODIFY                                                      |
| `src/gateway/protocol/schema/deck.ts`                                 | `deck.auth.overview` result schema | MODIFY                                                      |
| `src/gateway/protocol/schema/protocol-schemas.ts`                     | schema registry 汇总               | MODIFY                                                      |
| `src/gateway/protocol/index.ts`                                       | validators/types export            | MODIFY                                                      |
| `src/gateway/method-registry-data.ts`                                 | codegen source of truth            | MODIFY                                                      |
| `dashboard/src/types/gateway-protocol.generated.ts`                   | generated protocol types           | GENERATED                                                   |
| `dashboard/src/types/gateway-client.generated.ts`                     | generated client types             | GENERATED                                                   |
| `scripts/protocol-gen-ts.ts`                                          | codegen script                     | REFERENCE/MODIFY only if schema shape needs codegen support |
| `dashboard/src/stores/models.ts`                                      | models page data orchestration     | MODIFY                                                      |
| `dashboard/src/components/panels/models/tabs/ProviderConfigTab.tsx`   | 主配置 provider 编辑视图           | MODIFY                                                      |
| `dashboard/src/components/panels/models/tabs/CatalogTab.tsx`          | 可用模型/catalog 展示              | MODIFY                                                      |
| `dashboard/src/components/panels/models/config/ProviderSidebar.tsx`   | provider 列表                      | MODIFY                                                      |
| `dashboard/src/components/panels/models/config/AuthHealthCard.tsx`    | provider auth 健康卡片             | MODIFY                                                      |
| `dashboard/src/components/panels/models/config/ConfigForm.tsx`        | Global Provider Config 表单        | MODIFY                                                      |
| `dashboard/src/components/panels/models/config/AddProviderWizard.tsx` | 主配置 provider 新增向导           | MODIFY                                                      |
| `dashboard/src/app/api/models/configured/route.ts`                    | configured models route            | MODIFY                                                      |
| `dashboard/src/app/api/models/auth/route.ts`                          | auth overview route                | MODIFY                                                      |
| `dashboard/src/app/api/models/config/route.ts`                        | global config provider route       | MODIFY                                                      |
| `dashboard/src/stores/__tests__/models.test.ts`                       | models store 回归测试              | MODIFY                                                      |
| `src/gateway/server-methods/models.test.ts`                           | configured models Gateway tests    | MODIFY                                                      |
| `src/gateway/server-methods/deck-auth.test.ts`                        | auth overview Gateway tests        | MODIFY                                                      |

---

## Chunk 1: Freeze provider provenance in Gateway responses

### Task 1: 给 `models.configured` 增加 provenance / scope / editability

**Files:**

- Modify: `src/gateway/server-methods/models.ts`
- Modify: `src/gateway/protocol/schema/agents-models-skills.ts`
- Modify: `src/gateway/protocol/schema/protocol-schemas.ts`
- Modify: `src/gateway/protocol/index.ts`
- Modify: `src/gateway/server-methods/models.test.ts`
- Generated: `dashboard/src/types/gateway-protocol.generated.ts`
- Generated: `dashboard/src/types/gateway-client.generated.ts`

- [ ] **Step 1.1: 写失败测试，锁定 `models.configured` 需要返回来源字段**

Run:

```bash
pnpm test -- src/gateway/server-methods/models.test.ts
```

新增断言目标：每个 configured model 至少应包含：

- `source`
- `scope`
- `editable`

推荐最小语义：

- `source`: `config` | `agent-models` | `mixed`
- `scope`: `global` | `agent:main` | `agent:<id>`
- `editable`: boolean

- [ ] **Step 1.2: 在 `models.ts` 中定义 provenance 归并规则**

要求：

- 当 provider/model 仅来自主配置时：`source = "config"`
- 当仅来自 agent-local `models.json` 时：`source = "agent-models"`
- 当两者都有时：`source = "mixed"`
- `scope` 至少能区分：
  - `global`
  - `agent:main`
- `editable` 规则：
  - 仅主配置来源：true
  - 仅 agent-local：false
  - mixed：可以先定义为 true，但必须由 UI 进一步说明“仅 global 部分可编辑”

- [ ] **Step 1.3: 更新 schema，确保 codegen 正式覆盖**

在 `agents-models-skills.ts` 的 configured models result 中加入：

- `source`
- `scope`
- `editable`

然后更新 protocol schema 汇总与导出。

- [ ] **Step 1.4: 重新生成协议类型并验证**

Run:

```bash
pnpm protocol:gen:ts
pnpm protocol:gen:check
```

Expected: generated files更新且 `protocol:gen:check` 通过。

- [ ] **Step 1.5: 跑 Gateway 定向测试**

Run:

```bash
pnpm test -- src/gateway/server-methods/models.test.ts
```

Expected: `models.configured` provenance 断言通过。

- [ ] **Step 1.6: Commit**

```bash
scripts/committer "Expose configured model provenance from gateway" \
  src/gateway/server-methods/models.ts \
  src/gateway/protocol/schema/agents-models-skills.ts \
  src/gateway/protocol/schema/protocol-schemas.ts \
  src/gateway/protocol/index.ts \
  src/gateway/server-methods/models.test.ts \
  dashboard/src/types/gateway-protocol.generated.ts \
  dashboard/src/types/gateway-client.generated.ts
```

### Task 2: 给 `deck.auth.overview` 增加 provider 层 provenance

**Files:**

- Modify: `src/gateway/server-methods/deck-auth.ts`
- Modify: `src/gateway/protocol/schema/deck.ts`
- Modify: `src/gateway/protocol/schema/protocol-schemas.ts`
- Modify: `src/gateway/protocol/index.ts`
- Modify: `src/gateway/server-methods/deck-auth.test.ts`
- Generated: `dashboard/src/types/gateway-protocol.generated.ts`
- Generated: `dashboard/src/types/gateway-client.generated.ts`

- [ ] **Step 2.1: 写失败测试，要求 auth overview 暴露来源边界**

新增断言目标：每个 provider entry 至少增加：

- `source`
- `scope`
- `configPresent`
- `authPresent`
- `editable`

- [ ] **Step 2.2: 实现 auth overview provenance 规则**

推荐规则：

- `configPresent`: provider 是否存在于 `openclaw.json > models.providers`
- `authPresent`: provider 是否存在于 auth profile / env / synthetic auth
- `source`:
  - `config`
  - `auth-profile`
  - `env`
  - `mixed`
- `scope`: 先至少支持 `global` / `agent:main`

- [ ] **Step 2.3: 更新 schema + codegen**

Run:

```bash
pnpm protocol:gen:ts
pnpm protocol:gen:check
```

- [ ] **Step 2.4: 跑 Gateway 定向测试**

Run:

```bash
pnpm test -- src/gateway/server-methods/deck-auth.test.ts
```

- [ ] **Step 2.5: Commit**

```bash
scripts/committer "Annotate auth overview with provider provenance" \
  src/gateway/server-methods/deck-auth.ts \
  src/gateway/protocol/schema/deck.ts \
  src/gateway/protocol/schema/protocol-schemas.ts \
  src/gateway/protocol/index.ts \
  src/gateway/server-methods/deck-auth.test.ts \
  dashboard/src/types/gateway-protocol.generated.ts \
  dashboard/src/types/gateway-client.generated.ts
```

---

## Chunk 2: Reshape Deck models UI around two truths

### Task 3: 把 Provider Config 明确成 “Global Provider Config”

**Files:**

- Modify: `dashboard/src/components/panels/models/tabs/ProviderConfigTab.tsx`
- Modify: `dashboard/src/components/panels/models/config/ConfigForm.tsx`
- Modify: `dashboard/src/components/panels/models/config/AddProviderWizard.tsx`
- Modify: `dashboard/src/i18n/en.json`
- Modify: `dashboard/src/i18n/zh.json`

- [ ] **Step 3.1: 先写/补 UI 文案期望测试或至少明确文案变更点**

如果已有相关 tests，补断言；若没有，至少在计划实施时新增最小 UI render test。

目标文案：

- Provider Config 页面标题、副标题、空状态、wizard 说明里明确写：
  - 这里编辑的是 **global config**
  - 对应 `openclaw.json > models.providers`
  - 不等于全部运行时 provider 来源

- [ ] **Step 3.2: 修改页面标题与说明文案**

要求：

- `ProviderConfigTab` 顶部必须明确这是全局配置视图
- `ConfigForm` 必须在 provider 表单附近显示“global config only”一类的说明
- `AddProviderWizard` 要明确新增的是主配置 provider，而不是任意运行时 provider

- [ ] **Step 3.3: 跑前端定向测试 / 类型检查**

Run:

```bash
pnpm tsgo
```

如果该区域已有 jsdom 测试，则再补跑对应测试。

- [ ] **Step 3.4: Commit**

```bash
scripts/committer "Clarify that provider config edits global config only" \
  dashboard/src/components/panels/models/tabs/ProviderConfigTab.tsx \
  dashboard/src/components/panels/models/config/ConfigForm.tsx \
  dashboard/src/components/panels/models/config/AddProviderWizard.tsx \
  dashboard/src/i18n/en.json \
  dashboard/src/i18n/zh.json
```

### Task 4: 在 Runtime Inventory 相关视图里显示 provenance

**Files:**

- Modify: `dashboard/src/stores/models.ts`
- Modify: `dashboard/src/components/panels/models/tabs/CatalogTab.tsx`
- Modify: `dashboard/src/components/panels/models/config/ProviderSidebar.tsx`
- Modify: `dashboard/src/components/panels/models/config/AuthHealthCard.tsx`
- Modify: `dashboard/src/stores/__tests__/models.test.ts`

- [ ] **Step 4.1: 更新 store 类型映射，接住新的 RPC 字段**

要求：

- `fetchUsableModels()` / `fetchAuthOverview()` 不能丢掉 `source` / `scope` / `editable`
- store 层应该把 provenance 暴露给组件，而不是在组件里直接猜测

- [ ] **Step 4.2: ProviderSidebar 增加 source/scope badge**

最小要求：

- 在 provider 列表中看得出这是：
  - `Config`
  - `Agent-local`
  - `Mixed`
- 若是非主配置来源，视觉上应暗示只读或非全局

- [ ] **Step 4.3: AuthHealthCard 增加 config/auth presence 说明**

例如：

- Config present / Auth present
- Source / Scope
- Editable / Read-only

- [ ] **Step 4.4: Catalog / configured models 区域显示 model provenance**

对每个 configured model 至少能看到：

- source
- scope
- authStatus

不要求第一版就做到复杂交互，但至少要有 badge / caption。

- [ ] **Step 4.5: 跑 store / component tests**

Run:

```bash
pnpm test -- dashboard/src/stores/__tests__/models.test.ts
```

如果新增了组件测试，再补跑对应 tests。

- [ ] **Step 4.6: Commit**

```bash
scripts/committer "Surface provider provenance in deck model views" \
  dashboard/src/stores/models.ts \
  dashboard/src/components/panels/models/tabs/CatalogTab.tsx \
  dashboard/src/components/panels/models/config/ProviderSidebar.tsx \
  dashboard/src/components/panels/models/config/AuthHealthCard.tsx \
  dashboard/src/stores/__tests__/models.test.ts
```

---

## Chunk 3: Make the source model self-consistent

### Task 5: 防止 UI 继续把单层来源误当成全部真相

**Files:**

- Modify: `dashboard/src/app/api/models/configured/route.ts`
- Modify: `dashboard/src/app/api/models/auth/route.ts`
- Modify: `dashboard/src/app/api/models/config/route.ts`
- Modify: `dashboard/src/stores/models.ts`
- Modify: `dashboard/src/components/panels/models/tabs/ProviderConfigTab.tsx`
- Modify: `dashboard/src/components/panels/models/config/AuthHealthCard.tsx`
- Test: `dashboard/src/app/api/models/configured/route.test.ts`
- Test: `dashboard/src/app/api/models/config/route.test.ts`

- [ ] **Step 5.1: 审核 route 注释与前端文案，去掉“只来自主配置”的误导表述**

特别是：

- `models.configured` 不应继续写成“只来自 config.models.providers”
- auth overview 不应让用户误以为它只代表 global config auth

- [ ] **Step 5.2: 为 `models.configured` 与 `models/config` 建立明确的双视图文案**

要求：

- `models/config`：Global Provider Config
- `models/configured`：Runtime Provider Inventory / Configured Models

- [ ] **Step 5.3: 跑 route tests / targeted UI tests**

Run:

```bash
pnpm test -- dashboard/src/app/api/models/configured/route.test.ts
pnpm test -- dashboard/src/app/api/models/config/route.test.ts
```

- [ ] **Step 5.4: Commit**

```bash
scripts/committer "Separate global provider config from runtime model inventory" \
  dashboard/src/app/api/models/configured/route.ts \
  dashboard/src/app/api/models/auth/route.ts \
  dashboard/src/app/api/models/config/route.ts \
  dashboard/src/stores/models.ts \
  dashboard/src/components/panels/models/tabs/ProviderConfigTab.tsx \
  dashboard/src/components/panels/models/config/AuthHealthCard.tsx \
  dashboard/src/app/api/models/configured/route.test.ts \
  dashboard/src/app/api/models/config/route.test.ts
```

### Task 6: 最终验证与文档更新

**Files:**

- Modify: `docs/plans/2026-04-06-deck-model-config-source-of-truth-design.md` (如实施中有细小调整)
- Modify: `docs/plans/2026-04-06-deck-model-config-source-of-truth-plan.md`

- [ ] **Step 6.1: 跑最终验证集**

Run:

```bash
pnpm test -- dashboard/src/stores/__tests__/models.test.ts
pnpm test -- dashboard/src/app/api/models/configured/route.test.ts
pnpm test -- dashboard/src/app/api/models/config/route.test.ts
pnpm tsgo
pnpm build
```

如果模型页面相关 UI tests 存在，也一并补跑。

- [ ] **Step 6.2: 手工检查关键场景**

至少验证：

- provider 只在 global config 中存在
- provider 只在 agent-local 中存在
- provider 在两边都存在
- UI 是否能正确显示 source / scope / editable

- [ ] **Step 6.3: 回填文档状态**

把实施结果回写到 design / plan 文档，记录：

- 采用了方案 A 还是 B
- 还有哪些高级字段暂未纳入 UI

- [ ] **Step 6.4: Commit**

```bash
scripts/committer "Close deck model source-of-truth migration loop" \
  docs/plans/2026-04-06-deck-model-config-source-of-truth-design.md \
  docs/plans/2026-04-06-deck-model-config-source-of-truth-plan.md
```

---

## Review Loop Guidance

本计划分成 3 个 chunk：

- `## Chunk 1`：Gateway provenance contract
- `## Chunk 2`：Deck UI 重构为双真相视图
- `## Chunk 3`：一致性收口与最终验证

每完成一个 chunk：

1. 做最小验证
2. dispatch reviewer 审 plan / 或执行后做 code review
3. 通过后再进入下一个 chunk

---

## Definition of Done

满足以下条件才算完成：

1. 用户能在 Deck 中分清：
   - global config provider
   - runtime visible provider
2. provider/model 至少能显示：
   - source
   - scope
   - editable / read-only
3. `cpa` 这类“agent-local 存在、global config 不存在”的 provider 不会再被 UI 误导成“配置丢失”
4. Gateway 与 Deck 的 models/auth 相关 RPC 都已通过 provenance 扩展并有测试覆盖
5. `pnpm tsgo` 与相关 targeted tests 通过

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-04-06-deck-model-config-source-of-truth-plan.md`. Ready to execute.

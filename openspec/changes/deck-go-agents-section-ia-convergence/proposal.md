## Why

deck-go `agents` 模块详情页当前 10 子标签是按字段集机械拆分（runtime / event-streams / system-prompt 等），不是按用户任务组织；fields 与 `AgentConfig` / `AgentDefaultsConfig` schema 真相在 inheritance、写权、风险等级上多处错位（per-agent 显示 defaults-only 字段、defaults editor 暗示一个不存在的写位、危险写入与轻量编辑视觉一致），且没有顶层 defaults editor。本 change 是一次性 IA 收敛：把详情页对齐到任务驱动 11 section、把 defaults editor 落到与详情页同构的 7 section、把写权 / 风险 / inheritance / impact / unresolved refs 在 Deck-facing 契约上一次性收口，让"配置审查 + 配置变更 + 影响审查"三件事在 agents 模块成为可审阅的产品控制面。

## What Changes

- Detail 信息架构：将 10 旧 section 收敛为任务驱动 11 section（`overview / model / workspace / skills / subagents / tools / conversation / delivery / files / routing / danger`），URL hash legacy alias 兼容（`runtime → workspace`、`tool-policy → tools`、`event-streams → delivery`、`system-prompt → conversation`）。
- Defaults editor：新增 agents 模块顶层 defaults editor 入口（列表页 toolbar 按钮，URL `?panel=agents&view=defaults`），与详情页共享 section 语言但只渲染 7 个 section（剔除 `tools / files / routing / danger`，overview 降级为只读 summary）；defaults editor 内字段严格按 `AgentDefaultsConfig` schema 真相渲染，schema 不存在的字段（`agentDir` / `runtime` / 顶层 `tools` / `groupChat`）不渲染。
- 风险等级：5 级风险定义 L0–L4 一次性落到所有可编辑字段；L3 强制 impact preview + 复选框；L4 destructive 强制手输 agent id；main agent 保护贯穿所有 section。
- Inheritance 模型：三层链（OpenClaw built-in default → `agents.defaults.*` → `agents.list[].*`）；source badge 三态（A inherit-builtin / B inherit-defaults / C overridden）+ reset-to-default；新增对象 DTO `DeckGoAgentEffectiveField<T>` 复用既有 `DeckGoAgentEffectiveSource` string union；新增 `DeckGoAgentInheritanceMap` 挂在 detail response 上；既有 `DeckGoAgentEffectiveSources` 5-字段 map 保留不破坏。
- Impact 分层：detail 内 `DeckGoAgentImpactSummary` 扩 nested `bindings/sessions/files` snapshot（缓存友好）；新增 Gateway `deck.agents.impactPreview.get` 提供 L3/L4 操作前 fresh impact + per-operation `riskSpecifics` + `canProceedWithoutImpact`；既有 legacy flat 字段与新 nested 字段共存，consumer 读取规则在契约中显式声明。
- Unresolved references：detail 内聚合 4 类 unknown（skills / subagents / eventStreams / models），新增 `DeckGoAgentUnresolvedReferences` DTO + overview hero chip + 集中入口 modal（Install / Remove / Keep / 跨模块跳转）。
- Deck-facing 写入契约：写入策略矩阵显式分离 "产品动作 vs Gateway 写入原语"；新增 BFF product actions（`cognition/workspace/conversation/delivery/toolsOverride/defaults.*`）走 `config.patch/apply`；**每个 action 必须声明可写 path allowlist，BFF 在发起 patch/apply 前 guard 越界写**，越界（写 `models.providers` / `bindings` / 根级 `tools`）必须有单测 reject；路径写权矩阵由 `deck-config-write-safety.contract.json` contract gate 强制。
- Gateway 协议层 additive 扩展（限 deck namespace）：
  - 扩 `DeckAgentsDetailResultSchema` 加 §7.2.C 列出的 raw + 解释字段（含 `params` / `runtime` / `inherited` / `unresolvedReferences` 等）；
  - 扩 `deck.agents.subagents.set` schema 加 `requireAgentId`；
  - 新增 `deck.agents.impactPreview.get` 全套协议（params/result schema + validator + method-def + scope/discovery 注册）。
- 跨模块边界：每个 OpenClaw 概念恰好一个写权主（W）；其他模块 R-only；R-only 字段 hover/tooltip "Managed in `<module>`"；agents 不代位编辑其他模块字段。

## Capabilities

### New Capabilities

- `deck-go-agents-section-ia-convergence`: deck-go agents 模块"per-agent 详情页 11 section + 顶层 defaults editor 7 section + 写权/风险/inheritance/impact/unresolved-refs 契约收口"的可验证产品契约，含 BFF path allowlist guard 与 Gateway deck namespace additive 扩展。

### Modified Capabilities

- `deck-go-agents-control-contract-completion` — 本 change 是其 agents 控制面契约的产品级深化；归档时必须同步 accepted spec，避免与既有 agents 控制面契约形成平行真相。
- `deck-go-agents-model-policy-convergence` — 本 change 复用既有 `deck.agents.modelPolicy.*`，并把 role-based target shape 纳入 11-section/defaults editor 验收；归档时必须同步 accepted spec 中的 target-shape 场景或引用。
- `deck-go-config-write-safety-contracts` — 本 change 新增 agents product actions 的 path allowlist guard；归档时必须同步 accepted spec 的 write-safety metadata requirement。
- `deck-go-real-e2e-seed-and-evidence` / `deck-go-real-e2e-reporting-and-circuit-breakers` — 本 change 的 real Gateway 验证沿用隔离 real-stack、run-id fixture 与熔断规则；归档时必须同步或引用 accepted specs 中的 evidence/circuit-breaker 规则。

## Impact

- **Deck-facing 契约**（`deck-go/contracts/source/`）：
  - `deck-api.contract.ts`：扩 `DeckGoAgentImpactSummary` / `DeckGoAgentDetailResponse`；新增 `DeckGoAgentEffectiveField<T>` / `DeckGoAgentInheritanceMap` / `DeckGoAgentUnresolvedReferences` / `AgentRuntimeConfigDTO` / 各 BFF product action request/response DTO / `DeckGoAgentImpactPreviewRequest+Response`
  - `deck-ui.contract.json`：注册 11 section id + defaults 7 section id + 新 DTO 引用
  - `deck-mutations.contract.json`：注册所有 BFF product set actions + `impactPreview.get` + 扩展后的 `subagents.set`
  - `deck-config-write-safety.contract.json`：标注每个 product action 的 backing Gateway method、baseHash 模式、可写 path allowlist、越界 patch/apply guard 场景
  - `deck-route-governance.contract.json`：标注 `/api/deck/agents` 与 `/api/deck/agents/defaults` owner = `agents`
  - `deck-endpoints.contract.json`：注册新 action 集合
- **OpenClaw Gateway deck namespace**（`src/gateway/`）：
  - `protocol/schema/deck.ts`：扩 `DeckAgentsDetailResultSchema` + `deck.agents.subagents.set`；新增 `DeckAgentsImpactPreviewParamsSchema` / `DeckAgentsImpactPreviewResultSchema`
  - `protocol/index.ts`：导出新 validator
  - `server-methods/deck/agents-detail.ts`：扩 handler 返回字段
  - `server-methods/deck/agents-subagents-config.ts`：handler 写 `requireAgentId`
  - `server-methods/deck/agents-impact-preview.ts`：新建 handler + method-defs + module 注册
  - `method-registry-data.ts` / `method-scopes.ts` / generated inventory：新 method id discovery / scope
- **deck-go BFF**（`deck-go/backend/internal/server/`）：
  - `inventory.go` 扩 action multiplexer；新建 `agents_product_actions.go` / `agents_defaults.go`
  - 引入 path allowlist guard 共用层（per-agent action → `agents.list[<id>]`；defaults action → `agents.defaults.*` §2.4 允许字段）
- **deck-go frontend**（`deck-go/frontend-new/src/`）：
  - `data/modules/agents/`：扩 typed hooks（cognition/workspace/conversation/delivery/toolsOverride/defaults buckets/impactPreview）
  - `components/panels/agents/`：`AgentsPanel.tsx` section switch / `agents-panel-state.ts` `AGENT_SECTIONS` enum / `agents-panel.css` 按 section 划分 / i18n key 重组
  - 新组件（复用既有 atoms）：Source Badge / Impact Dialog / Reset Confirm Chip / Unresolved Refs Modal / defaults editor panel / Role-based Model Picker / Risk-Specifics List
- **数据迁移**：`openclaw.json` schema 不变；用户已有数据无需迁移；URL hash 加 legacy alias auto-redirect。
- **Out of scope**（显式 not changing）：
  - OpenClaw 通用 protocol（`src/gateway/protocol/schema/` 中非 `deck.ts` 文件）
  - 非 `deck/` namespace handler（`agents.ts` / `models.ts` / `config.ts` 等）
  - `src/config/types.agents*.ts` 类型真相
  - UI 风格（保持原型 section nav + scroll 骨架，不引入 drawer / dashboard hero / tabs）
  - design system tokens / atoms
- **Accepted spec sync rule**：本 change 可以新增 umbrella capability，但不能让 accepted specs 分叉。归档前必须把触达的 accepted specs 更新为指向本 capability，或把新增 requirements/scenarios 同步到既有 accepted specs；`openspec validate` 通过不等于 accepted truth 已收敛。
- **Authoritative design**：`docs/superpowers/specs/2026-05-11-deck-go-agents-section-ia-convergence-design.md`（含 §1–§10、字段决策矩阵、契约 delta、验收策略、迁移路径、决策摘要 D1–D14）。

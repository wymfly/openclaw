## Context

deck-go agents 模块详情页当前为 10-section 字段集机械拆分，与 `AgentConfig` / `AgentDefaultsConfig` schema 在 inheritance、写权、风险等级上多处错位，且没有顶层 defaults editor。已实施的 `deck.agents.modelPolicy.*` / `.skills.*` / `.subagents.*` / `.eventStreams.*` / `.systemPrompt.preview` / `.toolPolicy.preview` 形成了 deck namespace 适配模式，但产品控制面层（字段决策矩阵、风险等级、inheritance 视觉、impact 分层、unresolved refs、跨模块边界、defaults editor）尚未一次性收口。本次设计在不动 OpenClaw core truth、不动通用 protocol、不动 UI 风格的前提下，把 agents 模块完整收敛成"per-agent control plane + 顶层 defaults editor"两大产品入口。

**Authoritative design document**: `docs/superpowers/specs/2026-05-11-deck-go-agents-section-ia-convergence-design.md`（包含 §1 IA / §2 字段决策矩阵 + defaults editor 字段支持矩阵 / §3 风险等级 / §4 inheritance 模型 / §5 跨模块边界 / §6 impact 与 unresolved refs / §7 契约 delta / §8 验收策略 / §9 迁移路径 / §10 决策摘要 D1–D14）。本 `design.md` 不重复其全部内容，只提炼 OpenSpec 实施所需关键决策、风险与迁移路径；遇到细节冲突以 authoritative design 为准。

**Current state（代码真相，已 grep 校验）**：

- `AgentConfig` (`src/config/types.agents.ts:65`) 25+ 字段，含 `model / thinkingDefault / verboseDefault / reasoningDefault / fastModeDefault / skills / memorySearch / humanDelay / heartbeat / identity / groupChat / subagents / runtime / sandbox / embeddedHarness / embeddedPi / params / systemPromptOverride / channels.eventStreams / tools`。
- `AgentDefaultsConfig` (`src/config/types.agent-defaults.ts:150`) **不含** 顶层 `tools` / `groupChat` / `runtime` / `agentDir` / `identity`；含 `workspace` 作为 fallback path（`agent-scope-config.ts:139` 验证）。
- 上游 `agents.update` schema (`src/gateway/protocol/schema/agents-models-skills.ts:80-90`) 只接 6 字段（`agentId/name/workspace/model/emoji/avatar`），且 handler (`src/gateway/server-methods/agents.ts:525-539`) 在 workspace 变更时执行 `ensureAgentWorkspace` + `buildIdentityMarkdownOrRespondUnsafe` + `writeWorkspaceFileOrRespond` 副作用——workspace path 不能用 raw `config.patch` 替代。
- `config.patch` (`src/gateway/server-methods/config.ts:471` → `applyMergePatch(..., { mergeObjectArraysById: true })`) 支持 `agents.list[]` 按 `id` 合并（`src/config/merge-patch.ts:25-56`、`merge-patch.test.ts:36-37` 已覆盖）。
- `DeckGoAgentEffectiveSource` (`deck-go/contracts/source/deck-api.contract.ts:1555`) 是 `"agent" | "default" | "derived" | "gateway" | "unknown"` **string union**；既有 `DeckGoAgentEffectiveSources` 是 5-字段 fixed map。
- `DeckAgentsDetailResultSchema` (`src/gateway/protocol/schema/deck.ts`) 当前只返回少量 per-agent 字段（`reasoningDefault` / `fastModeDefault` / `skillMode` / `effectiveSkills` / `subagents.{allowAgents,model,effectiveMaxSpawnDepth,effectiveMaxChildrenPerAgent}` / `sandbox` 等），**未返回** `thinkingDefault` / `verboseDefault` / `memorySearch` / `humanDelay` / `heartbeat` / `groupChat` / `embeddedHarness` / `embeddedPi` / `systemPromptOverride` / `params` / `runtime` / `tools`。
- `deck.agents.modelPolicy.set` (`src/gateway/server-methods/deck/agents-model-policy.ts:74-153`) 实际 target 结构 = `{ kind: "global-default" | "agent-model" | "agent-subagents", key, agentId? }`；9 个 global key（`text/image/imageGeneration/videoGeneration/musicGeneration/pdf/compaction/memorySearch/subagents`）+ 2 个 per-agent kind（key 在 handler 中不被读取，仅 schema 接受任意 NonEmptyString）。
- `deck.agents.subagents.set` schema (`src/gateway/protocol/schema/deck.ts:108-122`) 当前只接 `agentId/allowAgents/model/baseHash`，不接 `requireAgentId`。

## Goals / Non-Goals

**Goals:**

- 把 10 旧 section 收敛为任务驱动 11 section（`overview / model / workspace / skills / subagents / tools / conversation / delivery / files / routing / danger`），URL hash legacy alias 兼容。
- 新建顶层 defaults editor（列表页 toolbar 按钮，URL `?panel=agents&view=defaults`），与详情页同构但只渲染 7 section；字段严格基于 `AgentDefaultsConfig` schema 真相，不存在的字段不渲染（不是 disabled）。
- 在 Deck-facing 契约层一次性收口 inheritance / impact / unresolved refs / 风险等级 / 写权矩阵 / 跨模块边界。
- BFF product action 写入路径必须经过 **path allowlist guard**，越界（写 `models.providers` / `bindings` / 根级 `tools`）必须 reject 并有单测覆盖；guard 在 `deck-config-write-safety.contract.json` 中编码为 contract gate 可校验项。
- Gateway 协议层 additive 扩展：扩 `DeckAgentsDetailResultSchema` 加全量 detail 字段；扩 `deck.agents.subagents.set` 加 `requireAgentId`；新增 `deck.agents.impactPreview.get` 完整协议（params/result schema + validator + method-def + scope/discovery）。
- 验收分层：mock 证明 UI/视觉/交互/i18n/dark-light/a11y；real Gateway 证明契约链与隔离 openclaw.json 落盘；两层不可互相替代。

**Non-Goals:**

- 不改 OpenClaw core truth（`src/config/types.agents*.ts`、`src/agents/*` 解析合并语义、runtime / execution 逻辑）。
- 不改 OpenClaw 通用 protocol（`src/gateway/protocol/schema/` 中非 `deck.ts` 文件）。
- 不改非 `deck/` namespace handler（`agents.ts` / `models.ts` / `config.ts` 等）；workspace path 写仍走上游 `agents.update`。
- 不改 UI 风格（保持原型 section nav + scroll content 骨架，不引入 drawer / dashboard hero / tabs）。
- 不改 design system tokens / atoms（11-section 视觉差异仅通过既有 atom 组合实现）。
- 不引入运行时实时监控（agents 详情页非 SSE / polling 面板）。
- 不实现 main 切换默认 / 删除 main / 删除 workspace files / 删除 sessions / 任意新建 workspace file（本轮 out of scope）。
- 不向 `dashboard/` legacy 迁移；本设计仅适用于 `deck-go/frontend-new/`。

## Decisions

### D1 — IA 颗粒度：任务驱动 11 section（替代字段集 10 section）

**问题**：现 10 section 是字段集机械拆分（runtime / system-prompt / event-streams / tool-policy 等），用户无法按"配置审查 + 配置变更 + 影响审查"任务路径找到所属字段。

**决策**：以用户问题驱动重命名 + 重组：`runtime → workspace`（吸收 sandbox / embeddedHarness / embeddedPi / params）；拆 `model` 独立 section（model + cognition）；`event-streams → delivery`（吸收 heartbeat）；`tool-policy → tools`（per-agent only）；新增 `conversation`（吸收 systemPromptOverride / humanDelay / groupChat）。最终 11 section。

**Alternatives 拒绝**：

- 保持 10 section，仅做字段对齐：用户任务路径仍不清；defaults editor 难以同构。
- 拆 13+ section：信息密度过高，section nav 在窄屏 / 中文 label 溢出。

**Cross-ref**：authoritative design §1.1 / §2.1 / §9.2。

### D2 — Defaults editor 独立顶层入口，section 语言同构 + 字段渲染严格 schema-truth

**问题**：agents 的 `defaults` 是全局回退源，但当前 UI 无统一编辑入口；如果 mock 一个 defaults panel 但渲染 schema 不存在字段（`runtime` / `agentDir` / `tools` / `groupChat`），会暗示一个不存在的写位。

**决策**：列表页 toolbar 加 "Defaults" 按钮（URL `?panel=agents&view=defaults`），不新建顶层 panel、不用 modal、不用 drawer；defaults editor 与详情页**共享 section 语言**但只渲染 7 section（剔除 `tools / files / routing / danger`，overview 降级为只读 summary），workspace / conversation 内裁掉 schema 不存在字段。字段渲染严格基于 `AgentDefaultsConfig` schema 真相（详 authoritative design §2.4 支持矩阵）；不存在的字段**不渲染**（不是 disabled）。

**Alternatives 拒绝**：

- defaults 写到详情页 overview "Edit defaults →" 抽屉：写权与读权混在一起，main 保护逻辑复杂化。
- defaults editor 独立 panel `?panel=agents-defaults`：与 list 跳转 + breadcrumb 重复。

### D3 — Inheritance DTO 边界：新对象 DTO `DeckGoAgentEffectiveField<T>` 复用既有 string union

**问题**：既有 `DeckGoAgentEffectiveSource` 是 string union（5 值），既有 `DeckGoAgentEffectiveSources` 是 5-字段 fixed map。本设计需要 per-field `{ effective, source, hasOverride, fallback, canReset, fallbackReason }` 对象 DTO + 覆盖 14+ 字段的 inheritance map。

**决策**：**不复用**既有 union 做对象引用，而是新建对象 DTO 并把 union 作为其 `source` 字段类型；既有 `DeckGoAgentEffectiveSources` 5-字段 map 保留不破坏（继续服务旧 UI），新增 `DeckGoAgentInheritanceMap` 作为 detail 上的新 opt-in 字段。

**Alternatives 拒绝**：

- 直接扩 `DeckGoAgentEffectiveSources` 加字段：会破坏既有消费者的固定 shape 假设。
- 全前端反推：OpenClaw built-in default 不在前端可知；inherit 链复杂（特别是 `subagents` / `memorySearch` 等嵌套对象）。

### D4 — Impact 分层：detail snapshot（缓存）+ fresh impactPreview RPC（不缓存）

**问题**：detail 走 Data Fabric 缓存策略；L3/L4 操作前必须 fresh impact（不能拿 cached）；两者直接合并会冲突。

**决策**：两层分离：

- **A. detail 内 `DeckGoAgentImpactSummary` snapshot**：additive 扩 nested `bindings/sessions/files` 字段，缓存友好，服务 overview hero metric chip + routing section samples。既有 flat 字段（`bindingCount` / `sessionCount` / `activeSubagentCount` / `workspaceFileCount` / `deleteRemovesFiles`）保留不破坏；**消费规则**：detail handler 必须同时填 legacy flat 与新 nested，数值不一致视为 bug；11-section UI 唯一权威读取面是 nested 字段。
- **B. 新建 `deck.agents.impactPreview.get`**：fresh fetch，独立 query 路径，**不参与 detail 的 invalidate**；返回 `DeckGoAgentImpactSummary` + per-operation `riskSpecifics` + `canProceedWithoutImpact`；L3/L4 dialog 打开瞬间强制调用。

**Alternatives 拒绝**：

- 只用 detail snapshot + 用户显式 refresh：危险操作护栏依赖用户自觉，不安全。
- 只用 fresh RPC + 取消 detail snapshot：每次切 section 都额外网络往返，浪费。

### D5 — 写入策略矩阵：BFF product action + Gateway 写入原语分层，path allowlist guard 强制

**问题**：deck 不应暴露 raw `config.patch` 给前端（产品语义会丢失、写权矩阵会被绕过）；但每个字段都新建 Gateway deck RPC 会让 deck namespace 膨胀且与 OpenClaw 解释权重复。

**决策**：分层选择：

1. **复用上游专用 RPC**：当包含必要副作用时强制（`agents.create/update/delete`；workspace path 走 `agents.update`）。
2. **BFF product action + `config.patch`/`config.apply`**：当动作是安全的纯配置子树写入（cognition / workspace advanced / conversation / delivery / toolsOverride / defaults buckets）。
3. **Gateway `deck.*` 专用 RPC**：当需要 Gateway-side 解释、运行态真相、影响预览（仅 `impactPreview.get` 新增）。

**强约束 — Path allowlist guard**：每个 BFF product action **必须**声明可写 config path allowlist；BFF 在发起 `config.patch/apply` 前 guard 生成 patch / apply diff 不越界；越界（写 `models.providers` / `bindings` / 根级 `tools`）必须 reject 并有单测覆盖；allowlist 在 `deck-config-write-safety.contract.json` 中编码，进入 `contract-gate`。

**Alternatives 拒绝**：

- 全部新建 Gateway deck RPC：deck namespace 膨胀、与上游配置解释权重复、维护成本高。
- 前端直接调 `config.patch`：写权矩阵失守，跨模块边界无法强制。
- BFF "程序员自律"：靠 action 命名约束写权，bug 风险高，无契约 gate。

### D6 — Model policy target 形状对齐代码真相

**问题**：handler `deck.agents.modelPolicy.set` target 形状是 `{ kind, key, agentId? }`，不是扁平 `target=text` / `target=memorySearch.model`；前一轮设计文档误把 `configPath` 当成 `key`，会导致客户端 payload 非法。

**决策**：所有 modelPolicy 写路径文档明确写为 `{ kind: "global-default", key: <9 个 global key 之一> }` 或 `{ kind: "agent-model" | "agent-subagents", agentId, key: <client 约定 string> }`；9 个 global key 对应 9 个 configPath 在 authoritative design §2.B 映射表中给出；per-agent kind 下 handler 不读 key 值（仅 schema 校验非空 string）。

### D9 — Detail 真相边界：mock 不得伪造 Gateway detail schema 尚未返回的字段

**问题**：11-section UI 依赖大量 raw/effective/detail 字段；如果 mock fixture 先伪造这些字段，而 protocol schema、handler、contract DTO 或 real E2E 没闭环，mock 视觉会掩盖真实契约缺口。

**决策**：新增 detail 字段必须同时落在 `DeckAgentsDetailResultSchema`、Gateway detail handler、Deck-facing DTO、frontend facade/mock fixture 与 real Gateway 验证。mock fixture 只能使用真实 schema 已声明并由 handler 返回的字段；缺字段时应显示 degraded/unsupported 状态，而不是静默造假。

### D7 — Routing section 颗粒度：复用 `impact.bindings.samples`，truncated 跳 Routing 模块

**问题**：routing section UI 需要"看全部依赖"，但 impact snapshot 承诺的是 samples + truncated；如果引入新 RPC 拉完整 list，会与 impact 分层冲突。

**决策**：routing section 只消费 `impact.bindings.samples`（filtered by agentId）+ truncated 提示 "View all in Routing →"；不在 agents 模块内补完整列表；超量场景由 Routing owning module 处理。

### D8 — main 保护贯穿所有 section + danger section 强制 id 二次确认

**问题**：main agent 是 fallback，删除 / 改 workspace / 关 subagents 会让系统陷入无解状态。

**决策**：所有 main 的 L2/L3 编辑器顶部加保护提示条；delete 按钮整体不渲染；L3 编辑器要求先勾"I understand main is fallback"；非 main agent 的 delete 走 L4 destructive（confirmation modal 手输 agent id + BFF 端 id 校验兜底 + 强制 deleteFiles=false）。

## Risks / Trade-offs

- **风险**：`DeckGoAgentEffectiveSource` 当前 5 值 union 不够覆盖 14+ 字段的 inherit 来源细分（例如 `embeddedPi` vs 嵌套子字段的来源差异）。
  **Mitigation**：实施第一步 grep 验证字段足够性；若不够则在本 change 内 additive 扩 union 值（向后兼容）。

- **风险**：`AgentDefaultsConfig` 中嵌套对象（`subagents` / `memorySearch` / `heartbeat` / `sandbox` / `embeddedHarness` / `embeddedPi` / `groupChat` / `humanDelay`）的 inherit 行为是 replace-as-a-whole 还是 merge by sub-keys，OpenClaw 解析合并语义未在本设计 grep 全。
  **Mitigation**：实施 §4.8 第一步 grep `src/agents/agent-scope-config.ts` 与相关合并代码；按真相对每个对象单独标注；`DeckGoAgentInheritanceMap` 当前以"对象级"列出，若发现某对象必须子字段粒度再 additive 扩展。

- **风险**：Path allowlist guard 是新引入的 BFF 共享层，跨 7+ action 共用；如果实现不严密，越界写仍可能 leak。
  **Mitigation**：guard 实现为独立 helper + 全 action 共用 + 单测矩阵覆盖（per-agent path / defaults path / 越界 path），并通过 `deck-config-write-safety.contract.json` contract gate 校验。

- **风险**：`config.patch` 通过 `mergeObjectArraysById: true` 支持 `agents.list[]` by-id 合并，但某些 reset 语义（删除嵌套 key）无法表达。
  **Mitigation**：fallback 走 `config.apply`（BFF 构造完整 next config）+ 同一 allowlist diff guard 拦截越界；fallback 路径在 `deck-config-write-safety.contract.json` 明确登记。

- **风险**：detail handler 扩展字段量大（10+ 新 raw 字段 + 3 新解释字段），可能影响响应时延。
  **Mitigation**：所有新字段 optional / additive；impact 字段允许 detail handler 异步填充（detail 先返回，impact 独立 query）；前端 UI 接受 `impact == null` 初始态。

- **风险**：URL legacy alias 重定向破坏深链。
  **Mitigation**：`readSectionFromHash` 在收到旧 hash 时自动 redirect + `replaceState`（不破链）；测试覆盖 4 个 legacy hash。

- **风险**：mock prototype parity 放弃（IA 增到 11 section 与原型 10 section 不对齐）。
  **Trade-off**：本设计**明确不追求 mock prototype parity**；设计 agent 那边产出新一轮 11 section 原型作为 follow-up；本 change 内 mock fixture 自洽即可。

- **风险**：enhanced 分支可能有未提交 agents 或 frontend 改动。
  **Mitigation**：实施前记录 `git status`，只检查本 change 触达路径是否存在重叠语义冲突；dirty worktree 本身不阻塞实施。若触达同一文件且无法安全合并，先记录 blocker 并与用户对齐。

## Migration Plan

### Phase 0：实施前 grep 验证（first task in tasks.md）

- grep `agents.update` handler 的 workspace handling、`ensureAgentWorkspace`、`buildIdentityMarkdownOrRespondUnsafe` / `writeWorkspaceFileOrRespond` 落点。
- grep `config.patch` 的 `applyMergePatch` + `mergeObjectArraysById` 真相。
- grep `agents.list[]` 嵌套对象（subagents / memorySearch / heartbeat / sandbox / embeddedHarness / embeddedPi / groupChat / humanDelay）的合并语义。
- 把 grep evidence 记入 `tasks.md` 完成证据 + `verification.yaml`。

### Phase 1：Deck-facing 契约 + Gateway protocol additive 扩展

- 扩 `deck-api.contract.ts` 加新 DTO 与 detail / impact 扩字段。
- 扩 `src/gateway/protocol/schema/deck.ts` 加全量 detail result 字段 + `subagents.set` 加 `requireAgentId` + 新 `impactPreview` params/result schema + validator 导出。
- 注册 `deck.agents.impactPreview.get` method-def / scope / discovery。
- 运行 `make contracts-sync` + `make protocol-update` 生成产物同 commit。

### Phase 2：OpenClaw Gateway deck namespace handler 扩展

- 扩 `agents-detail.ts` 返回字段。
- 扩 `agents-subagents-config.ts` 写 `requireAgentId`。
- 新建 `agents-impact-preview.ts` 处理 fresh impact + riskSpecifics + canProceedWithoutImpact。

### Phase 3：deck-go BFF product actions 与 path allowlist guard

- 新建 `agents_product_actions.go`（cognition / workspace advanced / conversation / delivery / toolsOverride）。
- 新建 `agents_defaults.go`（defaults buckets：workspace / cognition / skills / subagents / conversation / eventStreams / delivery）。
- 共享 path allowlist guard helper + 单测矩阵（per-agent path / defaults path / 越界 path）。
- 在 `deck-config-write-safety.contract.json` 注册每个 action 的 allowlist 与越界场景。

### Phase 4：deck-go frontend IA 重组

- `AgentsPanel.tsx` section switch 改 11 section + URL hash legacy alias。
- 新建 typed hooks（cognition/workspace/conversation/delivery/toolsOverride/defaults buckets/impactPreview）。
- 新建组件（Source Badge / Impact Dialog / Reset Confirm Chip / Unresolved Refs Modal / defaults editor panel / Role-based Model Picker / Risk-Specifics List）。
- 复用既有 atoms，不新建 design system 元素。

### Phase 5：验收 — mock E2E

- 11 section × A/B/C 三态 × L1/L2/L3/L4 风险 + main 保护 + defaults editor + unresolved refs modal + 跨模块跳转。
- dark/light × zh/en 完整组合。

### Phase 6：验收 — real Gateway E2E

- 在 `deck-go/.local/deck-go-real-stack/isolated/data/managed-gateway-state/openclaw.json` 隔离环境验证；run-scoped fixture cleanup 严格匹配。
- 失败时熔断规则（CLAUDE.md OpenSpec 完成闭环规则）：两次有 evidence 的尝试失败后记录熔断 handoff；代码级 + mock 仍必须 pass。

### Rollback

- 回滚单位 = 本 change 全部 commit 一起 revert；每个 commit 必须 self-contained（contract + 生成产物同 commit、BFF 与前端 import 同 commit）。
- 数据迁移层 = 0（`openclaw.json` schema 不变；URL legacy alias 自动 redirect）。

## Open Questions

1. **嵌套对象 inherit 粒度（design.md §4.8）**：`subagents` / `memorySearch` / `heartbeat` / `sandbox` / `embeddedHarness` / `embeddedPi` / `groupChat` / `humanDelay` 在 OpenClaw 合并语义中是否一致 replace-as-a-whole？还是部分 merge by sub-keys？实施第一步 grep 后给出答案；当前 `DeckGoAgentInheritanceMap` 以"对象级"列出，若发现某对象必须子字段粒度再 additive 扩展。
2. **per-agent model policy target 中 `key` 字面值约定**：handler 当前只看 `kind`，schema 接受任意 NonEmptyString。建议在 BFF / frontend client 内统一约定 `"agent"` 与 `"agentSubagents"`，但是否在 protocol schema 中收紧为 enum？本 change 默认**保持 schema 兼容**（NonEmptyString），约定写到 BFF 共享层。
3. **`canProceedWithoutImpact` 的权限模型**：在 impact `reason = permission` 时是否允许 proceed 取决于 BFF 是否能确认操作主体有 fallback 权限。本设计默认 `false`（不允许 proceed），实施阶段若发现部分操作（例如 read-only 切换 default）应允许，再 additive 扩展。
4. **enhanced 分支 git 状态**：实施前必须确认本 change 触达路径无无法合并的语义冲突。 unrelated dirty worktree 不阻塞实施，也不能要求用户 stash/abandon。

# deck-go Agents Section IA Convergence — Implementation Review

- **Date**: 2026-05-12
- **Change**: `openspec/changes/deck-go-agents-section-ia-convergence/`
- **Reviewer role**: Cross-model 代码级审查（Claude），在 codex 实施 + 自检之后进行
- **Authoritative design**: `docs/superpowers/specs/2026-05-11-deck-go-agents-section-ia-convergence-design.md`
- **Implementation report**: `openspec/changes/deck-go-agents-section-ia-convergence/implementation-report.md`
- **Scope**: 对 codex 自报"全部 9 phase / 60+ task 完成 + verification.yaml archiveReady=true / gapCount=0"的实施结果做独立代码级抽样审查与合规审查

## 0. 审查方法

- 不依赖 codex 的 evidence 字面值；对每条关键 evidence 抽样 grep / 读源代码 / 跑 `openspec validate` 验证
- 抽样维度：契约 DTO 真相、Gateway 协议 schema 扩展、handler 实际行为、BFF allowlist guard 实现、frontend 调用真相、测试覆盖、accepted spec 同步、follow-up 与 verification.yaml
- 工具：`grep` / `Read` / `openspec validate ... --strict` / 文件存在性检查
- 范围限制：未自跑 frontend / backend / e2e 测试套件复验，依赖 codex 报告的 pass/fail 结论；本审查重点是结构、契约、与设计对齐度

## 1. 整体结论

**实施质量**：良好。`openspec validate --strict` change 与 accepted spec 双通过；全部新文件就位；契约 DTO 全量落地；allowlist guard 与对应 contract gate 真实有效；Phase 0 §1.3 "嵌套对象 inherit 粒度"真正落到 `DeckGoAgentInheritanceMap` 的 sub-key 字段。

**主要风险**：3 条 MEDIUM 级"半实现 / 简化"问题（riskSpecifics 丢失 i18n 结构、sessionCount 硬编码 0、accepted spec 信息损失），均不阻塞归档但在产品语义或可审计性上削弱了 stated capability。

**归档建议**：归档前补齐 F-Rev2 与 F-Rev3 的处置（落 follow-up + 补 accepted spec scenario），其余可作为 additive follow-up 不阻塞 closure。

## 2. 通过项摘要

### 2.1 OpenSpec 闭环

| 维度                               | 状态 | 证据                                                                                                                                                                          |
| ---------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strict validation（change）        | ✓    | `openspec validate deck-go-agents-section-ia-convergence --type change --strict` 通过                                                                                         |
| Strict validation（accepted spec） | ✓    | `openspec validate deck-go-agents-section-ia-convergence` 通过                                                                                                                |
| `verification.yaml`                | ✓    | `archiveReady: true` / `gapCount: 0` / 6 个 scenario 全部 `status: passed` 并附 verification command                                                                          |
| Linked accepted specs 同步         | ✓    | `deck-go-agents-control-contract-completion` / `deck-go-agents-model-policy-convergence` / `deck-go-config-write-safety-contracts` / 两个 real-E2E spec 都已被 codex 同步更新 |
| Follow-up inbox                    | ✓    | `openspec/follow-ups/2026-05-12-agents-section-ia-prototype-refresh.md` 已建（prototype refresh，非阻塞）                                                                     |
| Implementation report              | ✓    | `openspec/changes/.../implementation-report.md` 列 changed files / decisions resolved / verification / follow-up                                                              |

### 2.2 契约真相对齐

| 项                                                       | 落点                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DeckGoAgentEffectiveField` 对象 DTO                     | `deck-go/contracts/source/deck-api.contract.ts:1565`                                                                                                                                                                                                                                                         |
| `DeckGoAgentInheritanceMap`                              | 同上 `:1574` —— 含 27 字段，**子键粒度（sandboxScope/sandboxDocker/embeddedHarnessRuntime/embeddedHarnessFallback/embeddedPiExecutionContract/memorySearchSync/heartbeatPrompt/humanDelayMode/subagentsAllowAgents/subagentsModel/subagentsRequireAgentId/subagentsLimits）**真实反映 Phase 0 §1.3 grep 结论 |
| `DeckGoAgentUnresolvedReferences` 四类                   | 同上 `:1670`                                                                                                                                                                                                                                                                                                 |
| `DeckGoAgentImpactPreview*` 与 `AgentRuntimeConfigDTO`   | 同上文件                                                                                                                                                                                                                                                                                                     |
| 既有 `DeckGoAgentEffectiveSources` 5-字段 map 保留不破坏 | `:1557` 未变更                                                                                                                                                                                                                                                                                               |

### 2.3 Gateway 协议层

| 项                                                                                        | 落点                                                                                                                         |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `DeckAgentsDetailResultSchema` 扩字段                                                     | `src/gateway/protocol/schema/deck.ts:622-623` 加 `inherited` / `unresolvedReferences`                                        |
| `deck.agents.subagents.set` 加 `requireAgentId`                                           | `:121` 端到端（params / get-result / set-result 三处都有）                                                                   |
| `deck.agents.impactPreview.get` 全套                                                      | `:182-208` schema；handler `src/gateway/server-methods/deck/agents-impact-preview.ts` 实现；method-def + module + scope 注册 |
| Validator 导出                                                                            | `src/gateway/protocol/index-extensions.ts` 导出 `validateDeckAgentsImpactPreviewParams`                                      |
| OpenClaw core / 通用 protocol / 非 deck namespace handler / `src/config/types.agents*.ts` | 未触达 ✓                                                                                                                     |

### 2.4 BFF Path Allowlist Guard（HIGH-impact 设计约束）

| 项                 | 落点                                                                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guard 实现         | `deck-go/backend/internal/server/agents_config_write_guard.go`                                                                                                         |
| 路径规范化         | `agents.list[].id=X` → `agents.list[id]` 用于 allowlist 前缀匹配，避免 `id` 字段被当成 patch path                                                                      |
| 前缀匹配边界       | 严格 `.` 或 `[` boundary，不允许 `agents.list[id].thinkingDefault.x` 被 `agents.list[id].thinkingDef` 误匹配                                                           |
| 错误码             | 确定性 `agents_config_path_out_of_scope`，写入 `deck-config-write-safety.contract.json:4` 与 12+ 个 action 的 `pathAllowlist`                                          |
| 单测               | `agents_config_write_guard_test.go` 覆盖 valid per-agent / valid defaults / 3 个 reject case（`models.providers` / `bindings` / 根级 `tools`）+ 错误码与 path 字段断言 |
| Contract gate 集成 | `deck-go/contracts/source/deck-config-write-safety.contract.json` 12+ pathAllowlist 条目；`config-write-safety-sync` 在 Phase 5 后变 clean                             |

### 2.5 Frontend 对齐

| 项                                              | 落点                                                                                                     |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| modelPolicy target shape `{kind, agentId, ...}` | `AgentsPanel.tsx:2068-2104, 2231` 全部用 `policy.kind === "global-default"` 判断；不传 configPath 字符串 |
| Fresh impactPreview 不缓存                      | `data/modules/agents/queries.ts:297-302` `staleTime: 0, gcTime: 0, refetchOnMount: "always"`             |
| 11 section 信息架构                             | `agents-panel-state.ts` `AGENT_SECTIONS` 11 项；`AgentsPanel.tsx` section switch 渲染                    |
| Legacy hash alias redirect                      | `readSectionFromHash` 4 个 mapping + `replaceState`                                                      |
| Defaults editor 7 section                       | `?panel=agents&view=defaults` toolbar 按钮；`AgentDefaultsEditor` 渲染 7 section subset                  |
| Main 保护 + L3 双复选框                         | `DangerZoneSection` 不渲染 delete；`WorkspaceSection` / `SubagentsSection` 双复选框                      |

### 2.6 测试覆盖

| 项                                                                       | 落点                                                                                                                                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Legacy flat vs nested impact 一致性                                      | `src/gateway/server-methods/deck/agents.test.ts:191-197, 526-537`                                                                                                        |
| `requireAgentId` 写盘                                                    | `agents.test.ts` 覆盖 set/get round-trip                                                                                                                                 |
| impactPreview schema / method 注册 / risk 文案 / canProceedWithoutImpact | `agents.test.ts`（claimed 34 tests pass）                                                                                                                                |
| BFF allowlist 拦截                                                       | `agents_config_write_guard_test.go` + `agents_product_actions_test.go`                                                                                                   |
| Real Gateway E2E                                                         | `agents-real-gateway.spec.ts`（claimed 3/3 pass）含 isolated config 写入、defaults set/reset、allowlist 拒绝、requireAgentId 真盘、UI dark/light × zh/en、11 section nav |
| 隔离环境断言                                                             | E2E 显式 assert config path 在 `managed-gateway-state` 下且非 `~/.openclaw/openclaw.json`                                                                                |

## 3. Findings（共 7 条）

### 3.1 F-Rev1 [MEDIUM-HIGH] `riskSpecifics` 丢失 i18n key+vars 结构

**设计原文** (`docs/superpowers/specs/2026-05-11-...design.md:613-619`):

```ts
type DeckGoAgentImpactPreviewResponse = DeckGoAgentImpactSummary & {
  /** 针对该 operation 的具体风险摘要文案；i18n key + 上下文变量 */
  riskSpecifics: Array<{ key: string; vars?: Record<string, unknown> }>;
  ...
};
```

**实施现状**:

- `src/gateway/protocol/schema/deck.ts:647`：`riskSpecifics: Type.Array(Type.String())`
- `deck-go/contracts/source/deck-api.contract.ts:1886`：`riskSpecifics: string[]`
- `src/gateway/server-methods/deck/agents-impact-preview.ts:32-65` 返回 9 段硬编码英文字符串
- 前端 `AgentsPanel.tsx:2020/2801/3443` 用 `<RiskSpecificsList items={...} />` 直接渲染

**影响**：中文 / 未来其他语言用户在 L3/L4 dialog 看到的风险摘要恒为英文。i18n 分离的设计意图被绕过。若后续要本地化必须发后端版本而非前端 i18n 文件。

**根因猜测**：codex 选了"先把通路打通"的最小实现；没有在 implementation-report 或 follow-up 中标记此偏差。

**严重度**：MEDIUM-HIGH —— 不阻塞 closure（测试可过），但是用户可见的 stated feature 退化。

**建议处置**：

- **必须**落 follow-up：`openspec/follow-ups/2026-05-12-agents-risk-specifics-i18n-restore.md`，分类 `contract-evolution`，记录"protocol 当前是 string[]，设计要求 {key, vars?} 以支持 i18n；下次 additive 引入新字段或换 typed shape"
- 可选本轮 additive：加 `riskSpecificsI18n?: Array<{ key, vars? }>`，旧 `riskSpecifics: string[]` 保留服务旧客户端，前端 prefer 新字段 + fallback 旧字段

### 3.2 F-Rev2 [MEDIUM] `sessionCount` 与 `activeSubagentCount` 全场硬编码 0

**Code 真相**:

- `src/gateway/server-methods/deck/agents-detail.ts:189-190`：
  ```ts
  const sessionCount = 0;
  const activeSubagentCount = 0;
  ```
- `src/gateway/server-methods/deck/agents-impact-preview.ts:120-121`：同
- 两层都填 0 导致 legacy flat vs nested 一致性测试通过，但都不反映真实状态

**设计原文** (`design.md §1.1 + §6.1`):

> agents 模块承担"影响审查：让运维在改动 / 删除前看出该 agent 被哪些 bindings 引用、**有多少 sessions 依赖**"

**Spec 真相**：accepted spec 与 in-change spec 都没显式 scenario 验证"sessionCount 必须反映真实状态"，因此数值一致性测试 0=0 也成立。

**影响**：

- overview hero metric chip `[💬 N sessions (M active)]` 永远显示 0/0
- L3/L4 impact dialog `"N sessions"` 永远 0，不会警告"删除有 12 个活跃 session 的 agent"
- 这是设计文档明确列出的 D2 核心用户问题之一（"影响审查"），实施层悄悄阉割

**根因猜测**：Gateway 当前可能没有 sessions 真相的廉价读取面（OpenClaw runtime 没暴露 session-by-agent 索引）；codex 选 stub 0 而非落 follow-up surface。

**严重度**：MEDIUM —— 不阻塞 closure 但削弱设计中明示的 stated capability，且**未在 implementation-report / follow-up 中暴露此偏差**。

**建议处置**：

- **必须**落 follow-up：`openspec/follow-ups/2026-05-12-agents-impact-session-truth.md`，分类 `feature-gap`，记录"sessionCount / activeSubagentCount 目前 stub 0；Gateway 需要 sessions-by-agent 真相读取面"
- accepted spec 加 scenario："`sessionCount` MUST reflect Gateway session truth when sessions truth is available; otherwise return `available: false` with `unavailableReason: 'gateway-incompatible'`"
- 当前实施改为：如果 sessions truth 不可读，返回 `impact.available: false, impact.unavailableReason: 'gateway-incompatible'`，UI 灰显 chip + tooltip——这是设计文档 §6.5 已经定义的降级路径，比硬编码 0 更诚实

### 3.3 F-Rev3 [MEDIUM] Accepted spec（95 行）丢失 in-change spec（~290 行）的多个 Scenario 锚点

**对比**:

| Spec 版本                             | Requirements | Scenarios | 行数 |
| ------------------------------------- | ------------ | --------- | ---- |
| In-change `spec.md`                   | 12           | 30+       | ~290 |
| Accepted `openspec/specs/.../spec.md` | 9            | 9         | 95   |

**丢失的关键 Scenario**（in-change spec 有，accepted spec 没有锚点）:

- L3 复选框严格性（unchecked → Save disabled / checked → enabled / unchecked again → disabled）
- L4 大小写敏感的 id 精确匹配
- L2 base-hash 冲突不静默 retry，保留 dirty draft
- 9 个 modelPolicy global key 字面值列举 + per-agent target form `{ kind, key: "agent" | "agentSubagents", agentId }`
- Detail 既有 consumer 不破坏（schema additive 验证）
- impactPreview 的 method 发现可达性 + 无效 params 返回确定性 validation error
- main delete 按钮不在 DOM 中渲染（不是 disabled）
- L3 main 双复选框（"I understand main is fallback" + "I understand…"）
- Models picker 跨模块跳转 URL 协议 `?panel=models&from=agents&fromAgent=<id>`
- 占位 module 不解锁 in-place 编辑
- Mock 不能替代 contract chain 验证
- Real-Gateway 隔离 openclaw.json 断言（虽然 accepted spec 提到了，但 scenario 数比 in-change spec 少）

**影响**：归档后未来 deltas / 第三方审查者只看 accepted spec 时，会发现"L3 双复选框 / L4 大小写敏感 / per-agent target form 字面值"等关键行为没有 testable scenario 锚点，可能导致回归。

**OpenSpec 规则**：accepted spec 是"真相凝固层"，归档时应保留所有可验证的 scenario，不应压缩成 summary。

**严重度**：MEDIUM —— 归档后真相精度下降，未来 deltas 缺锚点。

**建议处置**：归档前把上述 12+ 个 scenario 从 in-change spec 同步到 accepted spec；保证每条 SHALL 至少有 1 个 testable scenario。

### 3.4 F-Rev4 [LOW] `summarizeWorkspaceFiles` 错误路径返回 `truncated: true` 语义漂移

**Code** (`src/gateway/server-methods/deck/agents-impact-preview.ts:88-95`):

```ts
async function summarizeWorkspaceFiles(workspaceDir: string) {
  try {
    const entries = await readdir(workspaceDir, { withFileTypes: true });
    return {
      total: entries.filter((entry) => entry.isFile()).length,
      bootstrapPresent: entries.some((entry) => entry.isFile() && entry.name === "BOOTSTRAP.md"),
    };
  } catch {
    return { total: 0, bootstrapPresent: false, truncated: true };
  }
}
```

**设计语义**：`truncated` = "实际数量超过 sample 上限，UI 应显示 'View all in Routing →' 类 CTA"
**实施语义**：错误（readdir 失败）路径用 `truncated: true` 表达"目录不可读"

**影响**：UI 据 `truncated: true` 渲染"还有更多文件"CTA，但实际是目录不可读 → 用户被误导。

**严重度**：LOW —— 边缘错误路径，且 readdir 失败本身在 isolated real-stack 中罕见。

**建议处置**：错误路径改用 `available: false` 字段，或新增 `error?: 'unreadable' | 'permission'` 显式表达，不要复用 `truncated` 语义。1-2 行修复。

### 3.5 F-Rev5 [LOW] `sessions.truncated` / `files.truncated` 正常路径缺省

**Code**: `agents-impact-preview.ts:101-114` 正常路径 `sessions: { total: 0, active: 0 }` 与 `files: { total, bootstrapPresent }`，都不填 `truncated`。

**Spec**: 两字段都是 optional，consumer 可接受缺省。

**严重度**：LOW —— additive optional 字段合规缺省

**建议处置**：可不修；若日后扩 sample 数量门槛，再补 `truncated` 字段。

### 3.6 F-Rev6 [INFO] `canProceedWithoutImpact` 硬编码 false

**Code** (`agents-impact-preview.ts:131`): 9 个 operation 全部返回 `false`

**Spec / tasks.md 4.4 原文**:

> defaulted to false except for read-only operations explicitly enumerated

**实施验证**：当前 `ImpactOperation` 枚举（`edit-model / edit-workspace / edit-skills / edit-subagents / edit-tools / edit-delivery / edit-conversation / reset-field / delete-agent`）都是 mutation 操作，无只读 operation；硬编码 false 当前语义正确。

**严重度**：INFO —— 当前 OK，未来扩 read-only operation（如 `view-impact`）时需切换到 conditional。

**建议处置**：handler 加注释"`canProceedWithoutImpact` is intentionally hardcoded false for all current mutation operations; revisit when adding read-only operations to ImpactOperation enum"。

### 3.7 F-Rev7 [INFO] `DeckGoAgentEffectiveField` 放弃 generic `<T>`

**设计** (`design.md §7.2.B`): `type DeckGoAgentEffectiveField<T = unknown> = { effective?: T, ... }`
**实施** (`deck-api.contract.ts:1565`): 非泛型，`effective?: unknown`

**理由（推断）**：TypeScript 泛型不能无损 round-trip 到 Go codegen（`deck-go/contracts/generated/` 含 Go DTO）；codex 选 type-erase 到 `unknown`。

**影响**：前端 consumer 用 `effective` 需要 type-cast，类型安全较弱但功能等价。

**严重度**：INFO —— 务实的契约选择

**建议处置**：接受现状；若要恢复类型安全，可在前端层加 `effectiveAs<T>(field)` helper 或 typed-view 函数。

## 4. 处置矩阵

| Finding                         | 严重度      | 是否阻塞归档         | 必须修复                                                   | 处置                                                                          |
| ------------------------------- | ----------- | -------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| F-Rev1 riskSpecifics i18n 丢失  | MEDIUM-HIGH | ✗                    | 落 follow-up；可选本轮 additive 修补                       | follow-up `agents-risk-specifics-i18n-restore.md`                             |
| F-Rev2 sessionCount 硬编码 0    | MEDIUM      | ✗                    | **强烈建议**：落 follow-up + 改 stub 为 `available: false` | follow-up `agents-impact-session-truth.md`；改 handler 返回 degraded snapshot |
| F-Rev3 accepted spec 信息损失   | MEDIUM      | ⚠ 影响归档后真相精度 | **建议归档前补**：同步 12+ 个 scenario                     | 编辑 `openspec/specs/.../spec.md`                                             |
| F-Rev4 files truncated 语义漂移 | LOW         | ✗                    | 可选小修                                                   | 错误路径改 `available: false` 或加 `error?:` 字段                             |
| F-Rev5 truncated 正常路径缺省   | LOW         | ✗                    | 不修                                                       | OK                                                                            |
| F-Rev6 canProceedWithoutImpact  | INFO        | ✗                    | 加注释                                                     | handler 加 1 行 comment                                                       |
| F-Rev7 EffectiveField 非泛型    | INFO        | ✗                    | 不修                                                       | 务实接受                                                                      |

## 5. 归档前推荐清单

按优先级排序：

1. **必做（高 ROI）**：补 accepted spec scenario（F-Rev3）—— 否则归档后真相精度丢失，未来 deltas 无锚点
2. **必做（feature 诚实度）**：落 F-Rev1 + F-Rev2 两条 follow-up；F-Rev2 顺手把 stub 改为 degraded snapshot
3. **可选（半小时小修）**：F-Rev4 错误路径语义修复 + F-Rev6 注释
4. **不修**：F-Rev5 / F-Rev7

完成上述 1+2 后，建议执行 `openspec archive deck-go-agents-section-ia-convergence`。

## 6. 审查覆盖度说明

- **已抽样代码级验证**：契约 DTO 真相 / Gateway schema 真相 / handler 行为 / BFF guard 实现 / frontend 调用 / accepted spec 内容 / config-write-safety contract gate 条目 / verification.yaml 完整度
- **未独立复跑**：`pnpm test` / `make backend-test` / `make frontend-build` / `make e2e-mock-module` / `make e2e-real-module` —— 依赖 codex 报告的 pass 结论
- **建议追加复跑**：在归档前主动跑 `cd deck-go && make contract-gate && make backend-test && make frontend-build` 取最后一道 fresh evidence

---

## 附录 A — 关键代码位点速查

| 项                            | 路径                                                                              |
| ----------------------------- | --------------------------------------------------------------------------------- |
| Allowlist guard 实现          | `deck-go/backend/internal/server/agents_config_write_guard.go`                    |
| Allowlist guard 测试          | `deck-go/backend/internal/server/agents_config_write_guard_test.go`               |
| BFF per-agent product actions | `deck-go/backend/internal/server/agents_product_actions.go`                       |
| BFF defaults bucket actions   | `deck-go/backend/internal/server/agents_defaults.go`                              |
| Gateway impactPreview handler | `src/gateway/server-methods/deck/agents-impact-preview.ts`                        |
| Gateway detail 扩字段         | `src/gateway/server-methods/deck/agents-detail.ts`                                |
| 协议 schema                   | `src/gateway/protocol/schema/deck.ts:182-208 / 622-623 / 643-650 / 685 / 699`     |
| Contract DTOs                 | `deck-go/contracts/source/deck-api.contract.ts:1565-1605 / 1670-1690 / 1880-1900` |
| Write-safety contract         | `deck-go/contracts/source/deck-config-write-safety.contract.json`                 |
| Frontend modelPolicy 调用     | `deck-go/frontend-new/src/components/panels/agents/AgentsPanel.tsx:2068-2104`     |
| Frontend impactPreview 查询   | `deck-go/frontend-new/src/data/modules/agents/queries.ts:297-302 / :492`          |
| Accepted spec                 | `openspec/specs/deck-go-agents-section-ia-convergence/spec.md`                    |
| Implementation report         | `openspec/changes/deck-go-agents-section-ia-convergence/implementation-report.md` |
| Verification yaml             | `openspec/changes/deck-go-agents-section-ia-convergence/verification.yaml`        |
| Prototype refresh follow-up   | `openspec/follow-ups/2026-05-12-agents-section-ia-prototype-refresh.md`           |

## 附录 B — Phase 0 §1.3 真相落地验证

设计 Open Question 1 "嵌套对象 inherit 粒度" 在 Phase 0 §1.3 evidence 中已 grep 确认为 **sub-key fallback**（非 replace-as-a-whole）。

`DeckGoAgentInheritanceMap` 实施落地（`deck-api.contract.ts:1574-1605`）：

| 嵌套对象          | sub-key 字段                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `sandbox`         | `sandboxScope` / `sandboxDocker`                                                          |
| `embeddedHarness` | `embeddedHarnessRuntime` / `embeddedHarnessFallback`                                      |
| `embeddedPi`      | `embeddedPiExecutionContract`                                                             |
| `memorySearch`    | `memorySearchSync`（非 model 子字段）                                                     |
| `heartbeat`       | `heartbeatPrompt`                                                                         |
| `humanDelay`      | `humanDelayMode`                                                                          |
| `subagents`       | `subagentsAllowAgents` / `subagentsModel` / `subagentsRequireAgentId` / `subagentsLimits` |

`groupChat` 仅 per-agent，无 inherit，所以保持对象级。✓ 设计 Open Question 1 已被 Phase 0 evidence + 契约结构联合解析。

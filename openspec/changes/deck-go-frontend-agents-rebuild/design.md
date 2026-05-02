## Context

`frontend-new/` 当前是 active frontend workspace，已经迁入 chat，但 `main.tsx` 仍直接渲染 `<ChatPanel />`，没有第二个业务 panel 的入口。现有 `frontend-new/src/stores/agents.ts` 只是占位 store；真正可参考的 agents 前端代码在 frozen `frontend/src/components/panels/agents/`，其中 `AgentsPanel.tsx` 是 3500+ 行单体，混合 list、detail、config、routing、skills、tools、sessions、subagents 等职责。

外部 agents handoff 包是 forward-flow 设计输入，但其中若干假设超过当前 Gateway/Deck-Go 契约真相：

- `gw.agents.list` 源头 schema 目前是空参数，不能直接支持 search/sort/filter/cursor。
- Deck-facing `DeckGoAgentSummary` 仍是 open shape，只有 id/name/avatar/emoji/workspace/model 等薄字段。
- SSE 当前契约是 `activity.event` + `agent.status.changed`，不是 handoff 设想的 `eventType` union。
- Skills 当前 mode 是 `"all" | "whitelist"`，不是 `"inherit" | "explicit" | "none"`。
- `/deck/agents` 当前是 action multiplexer，已经有 typed Gateway binding，但不是 handoff 设想的 per-kind endpoint。

本 change 的目标不是一次性实现所有理想协议，而是在 Gateway 支持边界内把 agents 作为第二个 `frontend-new` 模块重写，并把后续 routing/subagents 所需的共享 agents 契约先打稳。

## Goals / Non-Goals

**Goals:**

- 在 `frontend-new` 建立可扩展的最小 panel shell，使 chat 与 agents 都可访问。
- 重写 agents 模块，形成清晰的 list/detail/create/edit/delete、配置分区、realtime 状态和错误/加载/空态体验。
- 将 agents 前端依赖的 DTO 从“open/dynamic”推进为可测试的 Deck-facing 契约；所有新增字段必须来自 Gateway 真数据、Go BFF 可解释 adapter，或明确标为 unavailable。
- 建立共享 `agents` store 作为 routing/subagents 的前置基础，避免后续模块重复解析 agent identity。
- 复用现有 design-system atoms/tokens/hooks，不引入新依赖，不新增 canonical atom。
- 对 handoff 与 backend/contract 真相不一致的部分留下可追踪 discrepancy/follow-up，而不是在 UI 中伪造。

**Non-Goals:**

- 不实现 routing/subagents 面板。
- 不引入 React Router、dnd-kit、form library、table library 或图标库。
- 不把旧 `frontend` agents 单体整文件搬进 `frontend-new`。
- 不重写 OpenClaw Gateway 的 agents 协议为理想 v2；只做本页面需要且 Gateway/BFF 可支持的增量。
- 不把 `/deck/agents` action multiplexer 拆成 per-kind endpoint；这可以作为后续 BFF cleanup。
- 不在本 change 内解决所有 `deck-ui.contract.json` domain 的最终信息架构，只补 agents 设计/实现必要元数据。

## Decisions

### D1: 先做 agents，而不是 routing/subagents

选择：本 change 以 agents 为第一个 post-chat rewrite 模块。

原因：routing 和 subagents 都读取 AgentSummary/agent identity；agents 先落地后，后续模块可以消费共享 store 和闭合契约。routing 还涉及拖拽排序和新依赖决策，subagents handoff 包缺少 api-usage/components/states/interactions，不满足 ready-for-implementation 的协议要求。

替代：先做 routing 或 subagents。拒绝原因是它们都会反向依赖 agents v2，并会把共享契约问题延后到更难收敛的阶段。

### D2: 契约以代码真相为准，理想设计分阶段进入

选择：实现前先更新 Deck-facing contract source，并让 Go BFF adapter 只合成可解释字段。

可直接支持的方向包括：

- `isDefault` 可由 agents list defaultId/detail isDefault 推导。
- `status` 可由 `agent.status.changed` 和 health snapshot 投影为 UI 状态。
- `bindingCount`、`sessionCount` 可由现有 Gateway deck detail 或相关 BFF surface 提供；如果 list 聚合成本过高，list 先显示 detail-on-demand 或 optional unavailable。
- `allowedAgents` 与 `allAgents` 冗余可以在前端 adapter 内归一为 `allAgents[].allowed`，但源 DTO 要保留 Gateway 真相直到 backend 契约正式改变。

暂不直接承诺的方向包括：

- server-side search/sort/filter/cursor；
- `activity.event.eventType` union；
- composite `AgentConfigHashes`；
- `skillMode: inherit|explicit|none`；
- per-kind `/deck/agents/*` endpoints。

替代：先按 handoff 理想 shape 写 UI mock/adapter。拒绝原因是这会破坏 contract-chain 目标，让前端无法区分真实能力和设计愿望。

### D3: `frontend-new` 采用最小 panel shell，不引入 router

选择：新增一个轻量 panel shell/registry，支持 chat 与 agents 切换，并保持 `?dsGallery=1` 入口优先级最高。默认仍进入 chat；agents 可通过 UI 切换和稳定 URL query/hash 直接进入。

替代：引入 React Router 或复制旧 deck-ui shell。拒绝原因是 stack-decisions 尚未锁定 routing 库，而旧 shell 属于 legacy frontend host，不应为第二个模块整体搬迁。

### D4: 状态分桶沿用本地 store 机制

选择：共享 `agents` store 负责 lean summary、selected agent 和 realtime status；module-private store/hook 负责 detail sections、dirty edits、create wizard 和 per-section save state。底层使用当前 `createLocalStore`/React hooks，不新增 Zustand/SWR 等依赖。

替代：一次性引入 server-state/query library。拒绝原因是当前栈没有锁定，agents 可以用窄 fetch + explicit invalidation 先完成；后续如果多个模块出现缓存复杂度，再单独决策。

### D5: 设计系统差异本地适配

选择：handoff 中不存在于 canonical atoms 的 `Avatar`、`EmptyState`、`KeyHint`、`Switch` 不新增为 canonical atom：

- `Switch` 映射到现有 `Toggle`。
- `Avatar`、`EmptyState`、`KeyHint` 先做 agents module-private molecule。
- status dot、ConfigSectionHeader、AgentRowCard 留在 module-private。
- `--ds-space-*` 映射为现有 `--ds-sp-*`；danger tokens 优先用 `--ds-error`/`--ds-error-bg`，只有跨模块确实需要时才提 token proposal。

替代：按 handoff 声明新增 atom/token。拒绝原因是 canonical atoms/barrel 已给出真实清单，新增 atom 必须经过 reuse gate，本 change 没有足够跨模块证据。

### D6: 旧 agents 只迁移行为知识，不迁移结构

选择：旧 `AgentsPanel.tsx` 用于识别现有 endpoint、edge case 和可复用纯函数；实现时按新模块拆分组件、hooks、stores 和 CSS。`useAgentMetricsSSE` reducer 可以迁移/重写为 typed helper 并保留测试。

替代：复制旧单体后逐步重构。拒绝原因是旧单体与 `frontend-new` design-system/contract-chain 目标冲突，且 review 成本过高。

### D7: 外部 handoff 先规范化进 repo，再实施

选择：实施前将用户提供的 agents handoff 包规范化到 `deck-go/frontend-handoff/modules/agents/` 或在 repo 内写等价 implementation handoff notes；并明确标出 code-truth divergences。

替代：直接从外部下载目录读原型实施。拒绝原因是实现闭环和 reverse sign-off 需要 repo 内可追踪的 handoff 状态。

## Risks / Trade-offs

- **AgentSummary v2 聚合成本过高** → 先让字段 optional 或 detail-on-demand；不得为 list UI 伪造计数。
- **Gateway list schema 不支持查询参数** → 第一版做 client-side filter/sort；server-side query 作为后续 Gateway/BFF change。
- **SSE payload 仍有 dynamic 扩展** → 只消费已声明的 `activity.event`/`agent.status.changed` 字段；unknown payload 保持忽略/日志友好。
- **第二个 panel shell 可能成为未来路由包袱** → 保持 API 小且数据驱动，后续 router 可以替换 URL 状态层。
- **handoff token/atom 名称与 canonical DS 不一致** → 实施前建立映射表，生产代码只引用真实 token/atom。
- **create wizard 设计超过 backend create 能力** → 第一版只提交 `POST /agents` 支持的 name/workspace/emoji/avatar；model/skills/subagents/default 设置作为创建后的可选配置步骤。

## Migration Plan

1. Normalize the agents handoff input into repo-tracked context and record divergences from current contracts.
2. Extend contract source and Go/TS generated DTOs for the minimum stable agents UI surface.
3. Update backend adapter tests for any synthesized summary/detail fields.
4. Add minimal `frontend-new` panel shell and keep chat behavior unchanged.
5. Implement shared agents store and API adapters.
6. Build the agents panel in vertical slices: list → detail overview → skills/subagents/event streams → files/previews → create/edit/delete.
7. Add focused unit/a11y tests and run contract/frontend/backend verification.

Rollback: revert the change commit. Contract additions must be additive where possible; if a field must be removed, generated artifacts and frontend consumers revert together.

## Open Questions

- Should `AgentSummary.sessionCount` and `lastActiveAtMs` be produced by backend list aggregation in this change, or remain optional until a sessions aggregation endpoint exists?
- Should the first create wizard submit only identity/workspace and then configure skills/subagents after creation, or should the backend add an orchestrated create-and-configure BFF action?
- Should repo-tracked `frontend-handoff/modules/agents/` copy the external handoff verbatim plus discrepancy notes, or should it be rewritten as a Codex-owned v2 handoff before implementation?

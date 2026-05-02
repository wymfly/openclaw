## Why

`frontend-new/` 已经完成 chat 迁移，但第二个业务模块进入时仍缺少可复用的 panel 入口、共享 agents 状态和与 Gateway 真相对齐的 agents 契约。`agents` 是 routing、subagents 等后续模块的上游基础面，先重写它可以把 AgentSummary、配置详情、SSE 状态和 create/edit/delete 流程收敛成前端设计可直接消费的契约链。

## What Changes

- 在 `frontend-new` 建立最小多 panel shell，使 chat 与 agents 可在同一工程内切换；不引入 React Router，先使用当前栈允许的轻量 URL/query 状态。
- 新建 `frontend-new/src/components/panels/agents/`，按 handoff 协议实现 agents list、detail workbench、create wizard、save/error/empty/loading 状态和必要 a11y/keyboard 行为。
- 扩展/收紧 Deck-facing agents 契约：将前端需要的稳定 summary/detail 字段从 open shape 推到 `contracts/source/deck-api.contract.ts`，并在 Go BFF/Gateway adapter 中用真实可解释的数据产出。
- 明确当前 Gateway 不支持的理想设计项的分阶段策略：搜索/排序/分页、`activity.event.eventType` union、composite hashes、skillMode 语义升级等不得由 UI 静默伪造；能由 BFF adapter 合理合成的字段先 adapter 化，不能合成的写入 discrepancy/follow-up。
- 复用现有 design-system atoms/tokens/hooks；不新增运行时依赖，不新增 canonical atom，必要的 Avatar/EmptyState/KeyHint/ConfigSectionHeader 等先作为 module-private molecule/pattern。
- 旧 `frontend/src/components/panels/agents/AgentsPanel.tsx` 仅作为行为参考，不整文件搬迁；可迁移经过测试的纯函数/SSE reducer。

## Capabilities

### New Capabilities

- `deck-go-agents-contract`: Deck-facing agents 契约链，包括 AgentSummary/AgentDetail/skills/subagents/event-streams/files/tool-policy/system-prompt DTO、SSE 状态投影、BFF adapter 与 Gateway 支持边界。
- `deck-go-agents-panel`: `frontend-new` agents 模块的用户体验、状态机、设计系统使用、keyboard/a11y、错误/空/加载状态和测试要求。

### Modified Capabilities

- `frontend-new-workspace`: `frontend-new` 从单 chat panel 进入最小多 panel workspace，必须提供 chat/agents 切换入口并保持 `?dsGallery=1` 设计系统入口可用。

## Impact

- **Contracts**: `deck-go/contracts/source/deck-api.contract.ts`, `deck-go/contracts/source/deck-streams.contract.json`, `deck-go/contracts/source/deck-ui.contract.json`, generated TS/Go DTOs, contract inventory/docs as required by generators.
- **Backend**: `deck-go/backend/internal/server/inventory.go`, `deck-go/backend/internal/runtime/openclaw/*`, generated Gateway clients/types only through source regeneration.
- **Frontend**: `deck-go/frontend-new/src/main.tsx`, new panel shell/patterns if needed, `src/api.ts`, `src/api-types.ts`, `src/stores/agents.ts`, new `src/components/panels/agents/**`, tests.
- **Reference only**: `deck-go/frontend/src/components/panels/agents/**` for behavior and regression seeds; no new feature work goes into frozen `frontend/`.
- **Handoff**: the external agents handoff package is treated as design input, not code truth. Divergences caused by contract/backend reality must be captured in the repo handoff notes or OpenSpec artifacts before implementation claims completion.
- **Dependencies**: no new npm/go dependency unless a later OpenSpec decision explicitly locks it in `docs/project/stack-decisions.md`.

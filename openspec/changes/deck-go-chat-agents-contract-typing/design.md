## Context

Audit 已确认 5 个 P0 契约 gap（详见 proposal.md）。本设计聚焦在如何在不与 `deck-go-gateway-protocol-full-alignment`（typed binding 层，已实施大部分代码但 task checkbox 未勾）冲突的前提下，把这 5 个 gap 在 contract source 层一次性补完。

当前现状：

- 2 个真实工程区共存：`deck-go/frontend/`（已 frozen，`CLAUDE.md` 顶部有冻结提示）+ `deck-go/frontend-new/`（protocol-v1 真实工程区，chat 已迁入）
- chat 模块的 `api.ts` 在两边 byte-identical（diff -q 无差异，2728 行），任何契约改动需在两边同时落
- backend `chat.go` 11 个 chat write handler 中 9 个已用 typed `var body struct {...}` 解析，2 个动态（`patchSession` 业务上必须 / `projection` 是 noop bug）
- agents 模块的两个 BFF endpoint：`POST /agents` 后端只读 4 字段（其余丢弃），`PATCH /agents/{id}` 完全透传上游 `agents.update` RPC
- 前端 `useAgentMetricsSSE.ts` 订阅 `activity.event` + `agent.status.changed` 两个未声明事件 — deck-go middleware 是 SSE pipe（`stream.go:50-77`），不会过滤未声明事件，前端在消费 contract 看不见的事件

关键不变量：

- `make contracts-sync` 是单向流：source → generated；generated 不允许手编
- `frontend-handoff/CLAUDE.md` protocol-v1 已规定 forward flow（design → engineering），contract 是 design 启动的 prerequisite

## Goals / Non-Goals

**Goals:**

- 4 个 P0 gap 全部在 `deck-go/contracts/source/` 一次性收齐（block typing / SSE event / write DTO / activeApproval；a2uiState 推迟）
- chat 模块从"看似 typed 实际 dynamic"改为"实际 typed"——所有 block-type 渲染走 discriminated union narrowing
- agents 模块达到"create/patch 表单类型推断有依据"的最小 design 启动 gate
- 反推得到的 SSE 事件形态在 deck-go middleware 加 narrowing test，防止上游漂移
- frontend / frontend-new chat 代码保持 byte-identical（chat-protocol-pilot 立下的不变量）

**Non-Goals:**

- 不切换 `/deck/agents` action multiplexer 到 typed gateway client（属 PR-17 后续）
- 不修复 `chat/projection` 后端 noop bug（单独决策；本 change 只为它建一个 typed request DTO，handler 行为不动）
- 不补 deck-ui contract action metadata（forward flow 中是 design 后回填的工作）
- 不动 frontend-handoff/modules/chat/\* 的 6 件套（设计 agent 维护）
- **不收紧 `a2uiState`**——backend `chat_snapshot.go:43` 直接 pass-through `detail.A2uiState`（`any`），wire 形态在上游 timeline RPC 内层（不在 deck-go 控制范围）；frontend `A2UIState` 是 view-shape，跟 wire 不等价。tighten 它需先 dig 上游 timeline schema，列入 follow-up change `deck-go-chat-a2ui-state-typing`。
- 不重新审视 `DeckGoTranscriptBlock` 的字段集——按现有 frontend `ContentBlock` 的 8 variant 分组，不新增/删除字段（仅 `unknown` variant 补 `rawType` 字段以匹配 frontend chat-types.ts:32 真相）

## Decisions

### D1: `DeckGoTranscriptBlock` 改 discriminated union（按 `type` 判别）而不是新增一个 union

**选择**：直接把现有 wide-shape 改成 union，**判别字段是 `type`（已存在且已 required）**，8 个 variant 镜像 frontend `ContentBlock` (`chat-types.ts:15-32`) Anthropic-compatible 形态——`text` / `image` / `file` / `tool_use` / `tool_result` / `thinking` / `canvas` / `unknown`。`kind?: string` 不消失，但仅作为 canvas variant 内部 sub-tag 保留（`kind: "canvas"`）。BREAKING frontend internal。

**替代**：

- 新增 `DeckGoTranscriptBlockTyped` union 与现有 wide-shape 共存，渐进迁移
- 用 `kind: string` 作判别字段（如 spec 早期版本所写）

**原因**：

- 现有 wide-shape 没有任何"还没准备好走 typed"的消费方——chat 全部模块都需要 narrowing
- 共存方案的迁移成本（新旧双轨 + 渐进切换）大于一次性改写
- BREAKING 是 frontend internal，不影响 BFF endpoint 契约
- 全量 grep + 单 PR land 可控
- **判别字段 `type` 是基于代码真相**：现有 wide-shape `type: string` 已 required；frontend `ContentBlock` 全部 `block.type === "..."` 分发；backend normalizer (`projection/sessions.go:269`) 从 `block["type"]` 写出。改成 `kind` 会引发跨前后端的全面重命名，无收益。

### D2: `patchSession` request body 用 narrow 已知字段 + `extension: Record<string, unknown>` 双字段

**选择**：

```ts
interface DeckGoChatSessionPatchRequest {
  sessionKey: string;
  // 已知 patch 字段（按需扩展）
  title?: string;
  archived?: boolean;
  pinned?: boolean;
  // 业务上必须动态——透传上游 sessions.patch RPC 的剩余字段
  extension?: Record<string, unknown>;
}
```

**替代**：纯 `Record<string, unknown>` / 把所有可能字段拼成大 union。

**原因**：

- `chat.go:171` 的 `var body map[string]any` + 透传 = 业务上承认部分字段必须动态
- Narrow 已知字段提供编辑表单类型推断；extension 字段保留扩展性
- 所有字段都是 optional 的纯 wide-shape 跟当前 `Record<string, unknown>` 没本质区别

### D3: SSE 事件 payload 形态从 `useAgentMetricsSSE.ts` 反推 + 加后端 narrowing test

**选择**：

- `DeckGoActivityStreamEvent`：`{ agentId: string; type: string; ...rest: unknown }`（前端只看 `type === "chat"`）
- `DeckGoAgentStatusChangedStreamEvent`：`{ agentId: string; status: "busy" | "idle" | (string & {}) }`（前端只看 busy/idle，其他 status 兼容）
- 在 `deck-go/backend/internal/server/` 加 SSE narrowing test：mock 上游发送形态典型样例，断言 deck-go pipe 透传后仍符合 contract

**替代**：等上游 OpenClaw Gateway 给出 typed schema → 重生成。

**原因**：

- 上游 schema 不在 deck-go 控制范围；当前 streams.contract 已有 `temporary-frontend-dto` 标记的先例（`runtime.gateway.*` 三个事件），同样的模式适用
- 反推形态被 narrowing test 兜住即可——上游漂移会让 test 失败，前端不会在用户面前坏

### D4: frontend / frontend-new 同步改写

**选择**：本 change 同时改 `deck-go/frontend/src/**` 和 `deck-go/frontend-new/src/**`，保持两边 chat 模块 byte-identical（chat-protocol-pilot 立下的不变量）。

**替代**：只改 frontend-new，frontend 落后。

**原因**：

- 两边的 `api.ts`、chat 目录目前 byte-identical（验证：diff -q）
- 让 frontend 落后会触发 chat-protocol-pilot 的反向签收闭环失败（设计 agent 视觉对照原型 vs 真实运行的依据）
- frontend frozen 不等于"代码不再变"，等于"不接受新模块"——契约修复属于既有模块的 hygiene

## Risks / Trade-offs

| Risk                                                                                       | Mitigation                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DeckGoTranscriptBlock` union 改写是 BREAKING——全量 grep narrowing 调用点漏改即编译失败    | 风险**已下调**（D6）：dig 显示代码早就 switch on kind，改 union 后 narrowing 自动启用，主要工作是简化防御性访问；TypeScript strict mode 兜住；rollback 简单（git revert）                                                          |
| `agent.status.changed` / `activity.event` payload 形态反推可能与上游真实形态不一致         | deck-go middleware 加 narrowing test，mock 上游典型样例；前端 narrowing 用 `(string & {})` 兼容未知 status；任何漂移在 test 阶段暴露                                                                                               |
| frontend / frontend-new chat 同步改写时漂移                                                | 在 tasks.md 中要求 `diff -q frontend/src/api.ts frontend-new/src/api.ts` 必须无输出；CI 加 byte-equality 检查                                                                                                                      |
| `patchSession` 已知字段联合不能凑齐                                                        | `extension: Record<string, unknown>` 显式收纳；contract 注释说明业务上动态的原因 + 引用 backend `chat.go:171`                                                                                                                      |
| `DeckGoApprovalRequest` 形态最初打算从 chat 6 件套 `states.md` 反推                        | dig 1.2 已修正：真相源是上游 `src/infra/exec-approvals.ts::ExecApprovalRequest`（D5）；`ExecApprovalRequestPayload` 字段集（command/argv/env/cwd/...）代替 6 件套反推的 `toolName/toolInput`；加 backend narrowing test 兜上游漂移 |
| 11 个新 DTO 引入 contract source 大量增量——make contracts-sync 重生成可能影响 prompt-cache | 新增 DTO 排在文件末尾（不打断现有 byte-stable prefix）；按字母序在生成产物里追加                                                                                                                                                   |

## Migration Plan

1. **Phase A — Source 与 generated**: 改 `contracts/source/deck-api.contract.ts` + `streams.contract.json` → 跑 `make contracts-sync` 重生成。CI 应通过 `make contract-gate`。
2. **Phase B — Backend narrowing test**: 在 `deck-go/backend/internal/server/` 加 2 个 SSE event narrowing test（activity.event / agent.status.changed），覆盖典型 payload 样例。
3. **Phase C — Frontend 消费侧改写**: 同时改 `frontend/src/**` 和 `frontend-new/src/**`：
   - `stream-contract.ts` parser 加 2 个 case
   - chat 模块 block-kind narrowing 全量改写
   - `fetchChatSnapshot` consumer 取消 cast
   - 验证 `frontend-new && pnpm test` 全绿
   - 验证 `diff -q frontend/src/api.ts frontend-new/src/api.ts` 无输出
4. **Phase D — Validation**: `cd deck-go && make contract-gate` + `cd frontend-new && pnpm test` + 浏览器 chat 模块手动 smoke（streaming / approval / canvas）

**Rollback**: git revert 单 PR；contract 治理 gate 退化为 pre-change 基线。

## Open Questions

> 实施前 dig（task 1.x）已决议如下；保留为历史记录：

- **Q1（仍开放）**: `chat/projection` 后端是 noop（`chat.go:396` 解码 sessionKey 后直接返回 `{ok:true}`）——本 change 给它建 typed request DTO 是为了 forward 兼容；handler 行为修复属 followup change 单独决策
- **Q2（已决议）**: `DeckGoApprovalRequest` 形态采用上游 `src/infra/exec-approvals.ts:108-113` 的 `ExecApprovalRequest` shape：`{ id: string; request: ExecApprovalRequestPayload; createdAtMs: number; expiresAtMs: number }`，其中 `ExecApprovalRequestPayload` 含 `command / commandPreview / commandArgv / envKeys / cwd / nodeId / host / security / ask / agentId / sessionKey / systemRunBinding / systemRunPlan / 等 shell 执行参数`。**注意**：chat 6 件套 `states.md` 反推的字段集（`approvalId / msgId / toolName / toolInput`）跟真相不符——上游 approval 是面向 shell command 执行的 approval，不是 chat tool_use 的 approval；本 change 实施时按真相形态修正。
- **Q3（已决议）**: 上游 `AgentsUpdateParamsSchema`（`src/gateway/protocol/schema/agents-models-skills.ts:80-91`）已存在 typed schema，字段集 `{ agentId; name?; workspace?; model?; emoji?; avatar? }`。`DeckGoAgentPatchRequest` 在 deck-go contract source 中 mirror 这 6 字段（不引上游 generated 依赖；contract gate 兜上游漂移）。`agentId` 来自 URL path，body 仅含剩余 5 字段。

## Resolved decisions（dig 后追加）

- **D5: `DeckGoApprovalRequest` 真相源是 message-bus payload，不是 typed RPC**：`/api/chat/snapshot` 的 `activeApproval` 字段由 `GetTimelineWithParams` 组装（`backend/internal/runtime/openclaw/legacy_inventory.go:256`），返回类型 `deckapi.DeckGoSessionDetailResponse` 已 typed 但 `activeApproval` 仍是 `Record<string, unknown>`——这就是 P0-4 的 gap 根源。真相形态只能从上游 `src/infra/exec-approvals.ts::ExecApprovalRequest` mirror。
- **D6: `DeckGoTranscriptBlock` 改 union 的 BREAKING 风险下调到低**：dig 1.4 显示 chat 代码 `transcript-render-registry.tsx` / `TranscriptSearch.tsx` / `TranscriptBlocks.tsx` / `ChatPanel.tsx` / `ToolResultCard.tsx` / `MessageList.tsx` **早就在用 `switch (block.type)` 模式**，且无 `as any` / `as DeckGoTranscriptBlock` 强制 cast。改 union 后 narrowing 自动启用，代码层主要是简化 `block.text!` / `block.toolUseId ?? ""` 这种防御性访问，**不是结构改写**。Phase C 工作量评估下调。
- **D7: SSE 未声明事件清单确认完整 = 仅 2 个**：`activity.event` + `agent.status.changed`（都来自 `frontend/src/components/panels/agents/useAgentMetricsSSE.ts:77,85`）。grep 全 frontend / frontend-new 后无第 3 个。
- **D8: 判别字段是 `type` 不是 `kind`**：早期 spec/design 文本里写的 "by `kind`" 与 D2 决定都基于反推。dig 后真相明确：现有 wide-shape `type: string` 已 required；frontend `ContentBlock` 全用 `block.type` 分发；backend normalizer 从 `block["type"]` 写出。判别字段定为 `type`。
- **D9: Block kinds = 8 不是 9**：早期 proposal 列出的 9 variant 把 `bash_result`（其实是 ToolResultCard 内部 view mode）和 `subagent`（SubagentLineageNode 视图形态，不是 transcript block）误算入。dig frontend `ContentBlock` 真相 = 8 variant：`text` / `image` / `file` / `tool_use` / `tool_result` / `thinking` / `canvas` / `unknown`。`unknown` variant 在 frontend 有 `rawType + summary` 两字段（chat-types.ts:32）；现有 wide-shape 缺 `rawType`，需补。
- **D10: a2uiState 不在本 change scope**：dig `chat_snapshot.go:43` 显示 backend `"a2uiState": detail.A2uiState` 是 pass-through（`any`），wire 形态在上游 timeline RPC 内层，deck-go 当前控制不到。frontend `A2UIState` 是 view-shape，与 wire 不等价。本 change `a2uiState` 保持 `Record<string, unknown> \| null`，tighten 列入 follow-up change `deck-go-chat-a2ui-state-typing`。

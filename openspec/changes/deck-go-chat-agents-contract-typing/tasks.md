## 1. 前置 dig（已完成 — 结论作为实施期 anchor）

- [x] 1.1 上游 `AgentsUpdateParamsSchema` 存在（`src/gateway/protocol/schema/agents-models-skills.ts:80-91`）：字段 `{ agentId; name?; workspace?; model?; emoji?; avatar? }` — 决议：deck-side mirror 这 6 字段，不引上游 generated 依赖
- [x] 1.2a 上游 `exec.approval.*` RPC：`ExecApprovalRequestParamsSchema`（`exec-approvals.ts:96`）+ `ExecApprovalRequestResultSchema`（`exec-approvals-extensions.ts:4`）有 typed schema，但极简（`{ id; status?; decision?; createdAtMs?; expiresAtMs? }`）
- [x] 1.2b 真相源 dig：`/api/chat/snapshot` 的 `activeApproval` 由 `GetTimelineWithParams` 组装（`backend/internal/runtime/openclaw/legacy_inventory.go:256`），真实形态在上游 `src/infra/exec-approvals.ts:108-113::ExecApprovalRequest = { id; request: ExecApprovalRequestPayload; createdAtMs; expiresAtMs }`，其中 `ExecApprovalRequestPayload`（`exec-approvals.ts:85-106`）含 `command / commandPreview / commandArgv / envKeys / cwd / nodeId / host / security / ask / agentId / sessionKey / systemRunBinding / systemRunPlan / 等` — 决议：`DeckGoApprovalRequest` mirror `ExecApprovalRequest`；6 件套 `states.md` 反推的 `toolName/toolInput/msgId` 是错的（上游 approval 面向 shell command 执行，不是 chat tool_use）
- [x] 1.3 全 frontend / frontend-new grep `event\.event ===` 模式确认未声明事件 = 仅 `activity.event` + `agent.status.changed`，无第 3 个
- [x] 1.4 chat 代码 `transcript-render-registry.tsx:46-60` + `TranscriptSearch.tsx:11-` + `TranscriptBlocks.tsx` + `ChatPanel.tsx` + `ToolResultCard.tsx` + `MessageList.tsx` 全用 `switch (block.type)` 模式分发；无 `as DeckGoTranscriptBlock` / `(block as any).text` 强制 cast — Phase C 主要工作是简化防御性访问（`block.text!` / `block.toolUseId ?? ""`），不是结构改写
- [x] 1.5 判别字段名修正：dig 显示判别字段是 `type`（不是 `kind`）— 现有 wide-shape `type: string` 已 required；frontend `ContentBlock` (`chat-types.ts:15-32`) 是 `{ type: "<kind>"; ... }` Anthropic-compatible 形态；backend normalizer (`projection/sessions.go:269`) 从 `block["type"]` 写出。`kind?: string` 不消失，仅作为 canvas variant 内部 sub-tag 保留
- [x] 1.6 Block kinds = 8（不是 9）：dig frontend `ContentBlock` exhaustive list = `text` / `image` / `file` / `tool_use` / `tool_result` / `thinking` / `canvas` / `unknown`。proposal 提的 `bash_result` 是 ToolResultCard 内部 view mode（不是 block.type）；`subagent` 是 SubagentLineageNode 视图形态（不是 transcript block）。`unknown` variant 必须暴露 `rawType: string + summary: Record<string, unknown>`（chat-types.ts:32）——现有 wide-shape 缺 `rawType` 字段，需补
- [x] 1.7 a2uiState dig：backend `chat_snapshot.go:43` 是 pass-through（`detail.A2uiState` 类型 `any`），wire 形态在上游 timeline RPC 内层，deck-go 控制不到。frontend `A2UIState` (`chat-types.ts:104-113`) 是 view-shape，与 wire 不等价。**决议**：本 change `a2uiState` 保持 `Record<string, unknown> \| null`；tighten 列入 follow-up `deck-go-chat-a2ui-state-typing`

## 2. Phase A — Contract source + generated DTO

- [x] 2.1 修改 `deck-go/contracts/source/deck-api.contract.ts`：把 `DeckGoTranscriptBlock` 改 discriminated union（按 D1+D8+D9 设计），**判别字段 `type`**（required），8 个 variant：`text` / `image` / `file` / `tool_use` / `tool_result` / `thinking` / `canvas` / `unknown`，每个 variant 字段集与 frontend `ContentBlock` (`chat-types.ts:15-32`) 等价；`unknown` variant 暴露 `rawType: string + summary: Record<string, unknown>`；`canvas` variant 内部 `kind: "canvas"` 作 sub-tag 保留
- [x] 2.2 修改同文件：新增 `DeckGoApprovalRequest` typed shape — mirror 上游 `src/infra/exec-approvals.ts:108-113::ExecApprovalRequest` 形态：`{ id: string; request: DeckGoApprovalRequestPayload; createdAtMs: number; expiresAtMs: number }`；同时新增 `DeckGoApprovalRequestPayload` mirror 上游 `ExecApprovalRequestPayload`（`exec-approvals.ts:85-106`），含 `command / commandPreview / commandArgv / envKeys / cwd / nodeId / host / security / ask / agentId / sessionKey / systemRunBinding / systemRunPlan` 等；`SystemRunApprovalBinding` (`exec-approvals.ts:61-67`) 与 `SystemRunApprovalPlan` (`exec-approvals.ts:75-83`) 在嵌套位置分别 mirror
- [ ] ~~2.3 (deferred to follow-up `deck-go-chat-a2ui-state-typing`)：a2uiState DTO 需先 dig 上游 timeline RPC schema，本 change scope 不动~~
- [x] 2.4 修改 `DeckGoChatSnapshotResponse`：`activeApproval: DeckGoApprovalRequest | null`（收紧）；`a2uiState` 保持 `Record<string, unknown> \| null`（按 D10 决议；标 TODO 注释指向 follow-up `deck-go-chat-a2ui-state-typing`）
- [x] 2.5 修改同文件：新增 `DeckGoActivityStreamEvent` 和 `DeckGoAgentStatusChangedStreamEvent` 两个 SSE payload DTO
- [x] 2.6 修改同文件：新增 chat write 8 个 DTO（`DeckGoChatSessionResetRequest` / `ClearRequest` / `DeleteRequest` / `PatchRequest` 含 `extension` 字段 / `DeckGoChatProjectionRequest` / `DeckGoChatCompactionRequest` discriminated by action / `DeckGoCanvasBridgeReadyRequest` / `DeckGoCanvasBridgeEvalRequest`）
- [x] 2.7 修改同文件：新增 agents 2 个 DTO — `DeckGoAgentCreateRequest = { name: string; workspace?: string; emoji?: string; avatar?: string }`（4 字段，name 必填，对齐 `inventory.go:23` 实读字段）；`DeckGoAgentPatchRequest = { name?; workspace?; model?; emoji?; avatar? }`（5 字段，mirror 上游 `AgentsUpdateParams` 减去 agentId（来自 URL path））
- [x] 2.8 新增 DTO 全部排在文件末尾（保持 prompt-cache prefix byte-stability）；每个 DTO 加 `// 来自 deck-go/backend/internal/server/<file>:<line>` 引用注释
- [x] 2.9 修改 `deck-go/contracts/source/deck-streams.contract.json`：在 `GET /api/stream` 的 `events` 数组追加 `activity.event` 和 `agent.status.changed` 两条，引用 `DeckGoActivityStreamEvent` / `DeckGoAgentStatusChangedStreamEvent`，status 标 `generated-dto`
- [x] 2.10 跑 `cd deck-go && make contracts-sync` 重生成 `contracts/generated/ts/*.generated.ts` + `backend/internal/deckapi/types.generated.go`
- [x] 2.11 跑 `cd deck-go && make contract-gate`：`contract-inventory` / `endpoint-classification` / `ui-metadata-sync` 全绿；`docs/contract-inventory.md` 的 dynamic surface 计数应下降

## 3. Phase B — Backend SSE narrowing test

- [x] 3.1 在 `deck-go/backend/internal/server/` 新建 `stream_event_typing_test.go`：mock 上游 `activity.event` 典型 payload（`type=chat` + `agentId`），断言透传给前端的 SSE 帧 payload 反序列化为 `DeckGoActivityStreamEvent` 成功
- [x] 3.2 同 test：mock 上游 `agent.status.changed` 典型 payload（`status=busy/idle/<unknown>` + `agentId`），断言反序列化为 `DeckGoAgentStatusChangedStreamEvent` 成功，包括 unknown status 兼容路径
- [x] 3.3 跑 `cd deck-go/backend && go test -race ./internal/server/...` 全绿

## 4. Phase C — Frontend 消费侧改写（同步改 frontend + frontend-new）

- [x] 4.1 改 `deck-go/frontend-new/src/stream-contract.ts`：`parseServerEvent` switch 加 `activity.event` 和 `agent.status.changed` 两个 case；`DeckGoParsedServerEvent` union 扩展两个 kind variant；`summarizeServerEvent` 加对应 case
- [x] 4.2 同步改 `deck-go/frontend/src/stream-contract.ts`（保持 byte-identical mirror）
- [x] 4.3 chat 模块 block.type narrowing 维持现有 `switch (block.type)`（dig 1.4 显示已普遍如此）；session-export.ts `transcriptBlockToPlainText` 默认 case 拆分为 canvas / unknown 显式 variant 处理；`unknown` variant 暴露 `rawType + summary` 接入
- [x] 4.4 同步改 `frontend/src/lib/session-export.ts`（保持 byte-identical），加 `frontend/src/components/shared/ShellComponents.tsx` 的 8-variant 显式分发
- [x] 4.5 改 `frontend-new/src/api.ts`：chat write 函数全部改成 `body: DeckApi.DeckGoChat*Request`；canvas/compaction 内部构造 body 时显式 typed 给 `DeckGoCanvasBridgeReadyRequest` / `DeckGoCanvasBridgeEvalRequest` / `DeckGoChatCompactionRequest`；`createAgent` / `updateAgent` 签名改成 `DeckApi.DeckGoAgentCreateRequest` / `DeckApi.DeckGoAgentPatchRequest`
- [x] 4.6 同步改 `frontend/src/api.ts`（byte-identical via cp）
- [x] 4.7 `fetchChatSnapshot` 消费侧：`activeApproval` 直接走 generated `DeckGoApprovalRequest | null`，无需 cast；`a2uiState` 保持 `Record<string, unknown> \| null` cast（D10 决议）。`chat-host-adapter.test.ts` fixture 用 wire 真相形态 `{ id, request, createdAtMs, expiresAtMs }`
- [x] 4.8 同步检查：`diff -q frontend/src/api.ts frontend-new/src/api.ts` 无输出；`diff -q frontend/src/stream-contract.ts frontend-new/src/stream-contract.ts` 无输出

## 5. Phase D — 验证

- [x] 5.1 `cd deck-go/frontend-new && npx tsc --noEmit` exit 0
- [x] 5.2 `cd deck-go/frontend-new && pnpm test:deck-ui` 全绿（641/641）；frontend mirror `pnpm test:deck-ui` 全绿（884/884）
- [x] 5.3 `cd deck-go && make contract-gate` 全绿（codegen tests / generated up-to-date / ui metadata / endpoint classification / contract exceptions / stream contract / protocol gen / gateway-typecheck "8 go exception(s), 0 fe violation(s)" / contract-inventory）
- [x] 5.4 `cd deck-go/backend && go vet ./... && go build ./... && go test -race ./internal/...` 全绿
- [ ] 5.5 启动 `deck-go/scripts/dev/run-stack-real.sh start`，浏览器访问 chat 模块：streaming 消息正常 + tool_use/tool_result block 正确渲染 + approval dialog 弹起 + canvas drawer 打开（**待用户手动验证**）
- [ ] 5.6 浏览器对照：在 frontend (5174) 和 frontend-new (5175) 同时打开 chat 视觉对比一致（chat-protocol-pilot 的视觉 parity 不变）（**待用户手动验证**）
- [x] 5.7 `bash deck-go/scripts/check-tokens-drift.sh` exit 0

## 6. 文档与移交

- [x] 6.1 更新 `deck-go/docs/project/current-state.md`：在 OpenSpec change 列表加 `deck-go-chat-agents-contract-typing` 行，标"实施完，浏览器烟测待用户"
- [x] 6.2 ~~更新 `frontend-new/CLAUDE.md` Status 段~~（**撤销** — CLAUDE.md 是稳态快照不是 changelog；change 状态由 OpenSpec + `current-state.md` + git log 记录）
- [x] 6.3 在 `deck-go/contracts/source/deck-api.contract.ts` 顶部加本 change 的注释引用
- [x] 6.4 验证 `openspec status --change deck-go-chat-agents-contract-typing` 4/4 artifacts complete
- [ ] 6.5 用 `scripts/committer` 单 commit（**待用户确认后执行**）："chat-agents-contract-typing — discriminated TranscriptBlock + 2 SSE events + 11 write DTOs + snapshot typed approval"

## 7. Open question 收尾

- [x] 7.2 design.md Q2 决议：`DeckGoApprovalRequest` mirror 上游 `ExecApprovalRequest`（task 1.2b）
- [x] 7.3 design.md Q3 决议：`DeckGoAgentPatchRequest` mirror 上游 `AgentsUpdateParams` 减去 agentId（task 1.1）
- [x] 7.1 design.md Q1 决议（用户选 A，2026-05-02）：保留 endpoint + 建 typed DTO；handler noop bug 列入 follow-up `deck-go-chat-projection-handler-fix`（与 design.md Non-Goals 第二条一致）
- [x] 7.4 a2uiState dig 决议（用户选 a，2026-05-02）：本 change 不 tighten；保持 `Record<string, unknown> \| null`；tighten 列入 follow-up `deck-go-chat-a2ui-state-typing`
- [x] 7.5 判别字段名 + block kinds 数量决议（2026-05-02）：判别字段 `type`（不是 `kind`）；block kinds 共 8 个；`unknown` variant 补 `rawType` 字段

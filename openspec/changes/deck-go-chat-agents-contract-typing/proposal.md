## Why

Deck Go 的契约链已经经 `deck-go-end-to-end-contract-chain`（53/53 任务完成）建立 source-to-UI 权威链与 4 个治理 capability，并在 chat 模块按 `deck-go-chat-protocol-pilot` 迁移到 `frontend-new/` 之后，跑了一轮 chat / agents 双模块 audit，发现 5 个 P0 契约 gap 阻塞 design agent 启动 agents 模块的 forward flow：

1. **`DeckGoTranscriptBlock`**（`deck-go/contracts/source/deck-api.contract.ts:333-355`）是 wide-shape interface（所有字段 optional + `kind?: string`），不是 discriminated union——chat 内部所有 block-kind 渲染靠 ad-hoc narrowing 解析，把"看似 typed 实则 dynamic"的脆弱面带进了协议化前端
2. **`streams.contract.json` 不完整**：当前只声明 7 个事件类型（projection.gap / runtime.gateway.{status,health,exit} / session.message / session.tool / sessions.changed），但 agents 模块（`deck-go/frontend/src/components/panels/agents/useAgentMetricsSSE.ts:77,85`）实际订阅 `activity.event` + `agent.status.changed` 两个**未声明的**事件类型——这是契约层"不知道存在"的盲区，且 deck-go middleware 是 SSE pipe（`deck-go/backend/internal/server/stream.go:50-77` 完全透传），不会过滤未声明事件
3. **chat 5 个写操作 + 2 个 canvas-bridge request body 未 typed export**：reset / clear / delete / patch / projection / canvas-bridge-ready / canvas-bridge-eval 在 frontend 是 inline 类型或 `Record<string, unknown>`，但后端绝大多数已 typed struct 解析（`deck-go/backend/internal/server/chat.go`）——契约 source 没把后端真相 surface 给前端
4. **agents BFF create/patch request body 未 typed export**：`POST /agents`（`deck-go/backend/internal/server/inventory.go:23` 只读 `name` / `workspace` / `emoji` / `avatar` 4 字段）和 `PATCH /agents/{id}`（`inventory.go:117` 透传任意字段给上游 `agents.update`）的 request DTO 在 contract source 缺失，design agent 设计 agents 创建/编辑表单时类型推断断裂
5. **`DeckGoChatSnapshotResponse.activeApproval` 是 `Record<string, unknown> | null`、`a2uiState` 是 `unknown`**（`deck-api.contract.ts:419-424`）——进入会话首屏的 approval 与 canvas 状态前端要 ad-hoc 解析。本 change **只收紧 `activeApproval`**（mirror 上游 `ExecApprovalRequest`）；`a2uiState` 拆出 follow-up（dig 显示 backend `chat_snapshot.go:43` 直接 pass-through，wire 形态在上游 timeline RPC 内层，不在 deck-go 控制范围）

这 5 个 gap 全部在 contract source 层（`deck-go/contracts/source/`），不与 `deck-go-gateway-protocol-full-alignment`（Go middleware → Gateway 的 typed binding 层；按代码现状已大部分实施：116 typed binding / 8 weak Request 调用，但 tasks.md 复选框未勾完）冲突——后者是 deck-go middleware 内部的 typed-ness，本 change 是 deck-go BFF endpoint → frontend 之间的契约 surface。

补完这 5 个 gap 是 design agent 启动 agents 页面 forward flow 的最后 prerequisite。

## What Changes

### 新增 contract source

- **`DeckGoTranscriptBlock` discriminated union** 替换现有 wide-shape：按 **`type`** 字段判别 **8 个 variant**（`text` / `image` / `file` / `tool_use` / `tool_result` / `thinking` / `canvas` / `unknown`），镜像 frontend `ContentBlock` (`deck-go/frontend-new/src/stores/chat-types.ts:15-32`) Anthropic-compatible 形态。`unknown` variant 暴露 `rawType: string + summary: Record<string, unknown>`；`canvas` variant 内部 `kind: "canvas"` 作 sub-tag 保留。同时把 `DeckGoChatSnapshotResponse.activeApproval` 收紧为 `DeckGoApprovalRequest | null`（新 typed shape，mirror 上游 `ExecApprovalRequest`）。**BREAKING (frontend internal)**：所有现有 block-type ad-hoc narrowing 调用点需改写为 `switch (block.type)`（dig 显示已普遍如此，主要是简化防御性访问）。
  - **不在 scope**：`a2uiState` 保持 `Record<string, unknown> | null`——backend 是 pass-through（`chat_snapshot.go:43`），wire 形态在上游 timeline RPC 内层（不在 deck-go 控制范围）；tighten 列入 follow-up change `deck-go-chat-a2ui-state-typing`
- **`streams.contract.json` 补声明 2 个事件类型**：
  - `activity.event`（payload 含 `agentId` + `type` + 其他 deck-go 已知 envelope 字段）
  - `agent.status.changed`（payload 含 `agentId` + `status: "busy" | "idle"`）
  - 同步在 `deck-api.contract.ts` 加 `DeckGoActivityStreamEvent` / `DeckGoAgentStatusChangedStreamEvent`
  - `stream-contract.ts` 的 parser 和 `DeckGoParsedServerEvent` union 扩展
- **chat write request DTO export**（新增 8 个 DTO）：`DeckGoChatSessionResetRequest` / `ClearRequest` / `DeleteRequest` / `PatchRequest`（含动态扩展字段）/ `DeckGoChatProjectionRequest` / `DeckGoChatCompactionRequest`（discriminated by `action: "list" | "branch" | "restore"`）/ `DeckGoCanvasBridgeReadyRequest` / `DeckGoCanvasBridgeEvalRequest`，全部镜像 `chat.go` 内 typed struct
- **agents BFF write request DTO export**（新增 2 个 DTO）：`DeckGoAgentCreateRequest`（4 字段 narrow，name 必填）/ `DeckGoAgentPatchRequest`（partial fields；保留 `extension: Record<string, unknown>` 因为后端透传上游 `agents.update`）

### 修改 frontend 消费侧

- `stream-contract.ts::parseServerEvent` 增加 `activity.event` 和 `agent.status.changed` 两个 case
- chat 模块所有 block-kind narrowing 调用点（`MessageList` / `TranscriptBlocks` 等）从 wide-shape ad-hoc cast 改写为 discriminated union narrowing
- `fetchChatSnapshot` consumer 不再 cast `activeApproval` / `a2uiState`

### 不做

- 不切换 `/deck/agents` action multiplexer 到 typed gateway client（属 `deck-go-gateway-protocol-full-alignment` PR-17 后续，独立推进）
- 不修复 `chat/projection` 后端 noop bug（`chat.go:396` 解码 sessionKey 后直接返回 `{ok:true}`）——单独决策
- 不补 deck-ui contract action metadata（按 forward flow 顺序，那是 design agent 出原型后回填的工作）

## Capabilities

### New Capabilities

- `deck-go-chat-block-typing`：`DeckGoTranscriptBlock` discriminated union 形态（按 kind narrow）+ `DeckGoApprovalRequest` / `DeckGoA2UIState` typed shape + `DeckGoChatSnapshotResponse` 内嵌字段收紧规则；建立"chat 内部状态机依赖的所有 block 形态在契约层完整 typed"的不变量
- `deck-go-stream-event-typing`：`streams.contract.json` 必须声明 deck-go SSE pipe 实际透传给前端的所有事件类型——补 `activity.event` + `agent.status.changed`，建立"contract 声明的事件 = 前端订阅的事件"等价不变量；任何前端订阅未声明事件 = contract gap
- `deck-go-bff-write-contract`：chat 7 个写操作 + agents 2 个 create/patch 这 9 个 BFF endpoint 的 request body 在 `contracts/source/deck-api.contract.ts` 必须有 typed DTO export，前端不允许 inline body type 或裸 `Record<string, unknown>`（patchSession 等业务上必须动态的字段必须用 `extension` 显式收纳）

### Modified Capabilities

- `deck-go-api-contract-surface`：扩展现有契约面，从"已覆盖 chat 核心 RPC（send/abort/steer）"扩展到"覆盖 chat / agents 两个模块的全部 BFF endpoint write surface"——本 capability 由 `deck-go-end-to-end-contract-chain` 引入

## Impact

- **修改源代码**:
  - `deck-go/contracts/source/deck-api.contract.ts`（11 个新 DTO + 1 个 union 改写 + 2 个 snapshot 内嵌字段收紧）
  - `deck-go/contracts/source/deck-streams.contract.json`（2 个新事件声明）
  - `deck-go/contracts/generated/ts/*.generated.ts`（重生成产物）
  - `deck-go/backend/internal/deckapi/types.generated.go`（重生成 Go 侧 DTO）
  - `deck-go/frontend-new/src/stream-contract.ts`（parser + union 扩展）
  - `deck-go/frontend-new/src/components/panels/chat/**`（block-kind narrowing 调用点改写）
  - `deck-go/frontend-new/src/api.ts`（snapshot consumer 取消 cast）
  - `deck-go/frontend/src/**`（同上；frontend 已 frozen 但 chat byte-identical 镜像，需保持一致以避免 chat-protocol-pilot diff drift）
- **CI gates**: `make contracts-sync` / `make contract-gate` / `make contract-inventory` 必须通过；`docs/contract-inventory.md` 的 dynamic surface 计数应下降
- **依赖**: 不引入新 npm/go 依赖；不与 `deck-go-gateway-protocol-full-alignment` 冲突（不同层）
- **Risk**:
  - `DeckGoTranscriptBlock` union 改写是 frontend internal BREAKING——需要全量 grep narrowing 调用点统一改写，分阶段 land
  - `agent.status.changed` / `activity.event` payload 形态从 frontend `useAgentMetricsSSE.ts` 反推，需在 deck-go middleware 加 narrowing test 防止上游漂移
  - `patchSession` 请求体的"已知字段联合"不能凑齐——保留 `extension: Record<string, unknown>` 字段，业务上必须动态

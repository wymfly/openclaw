# Chat Gateway Capability Map

**Scope:** P0 deliverable of OpenSpec change `frontend-design-system-via-chat`.
**Date:** 2026-04-29.
**Source streams:** S1 OpenSpec corpus / S2 Gateway RPC method-registry / S3 SSE event union & emission ordering / S4 ContentBlock + a2ui-bridge + ApprovalRequest + RunMetadata schemas.
**Purpose:** Establish the Gateway truth that the deck-go chat panel will refactor against, ahead of the parallel go-service forwarding work in another branch.

---

## Summary

- **17 active OpenSpec capabilities + 5 proposed deltas** describe chat-adjacent UX requirements; 4 deltas belong to this very change (`frontend-design-system`, transcript / tool-result / run-status-indicator / chat-message-contract).
- **~70 Gateway RPC methods** touch chat-adjacent flows (sessions, agents, subagents, approvals, deck.\*, skills, tools), all schema'd via TypeBox under `src/gateway/protocol/schema/`.
- **16 SSE event types across 10 streams** drive transcript rendering: `assistant`, `thinking`, `tool`, `item`, `approval`, `command_output`, `patch`, `plan`, `lifecycle`, `compaction`. Lifecycle is canonical: `lifecycle:start → ...deltas... → lifecycle:end | error`.
- **6 ContentBlock variants only** (text / thinking / tool_use / tool_result / image / file) — no `canvas` or `unknown` variant in current schema; `tool_use.input` is untyped `Record<string, unknown>`.
- **5 pilot fields verified**: `cost`, subagent flat-then-recursive `children`, `tool_use.input.cwd`, `cacheRead/cacheWrite` (NOT `cacheHit`), `forTool` (NOT in Gateway).

**Three discrepancies between OpenSpec deltas and Gateway truth** (see §10) require fixing or accepting before P2:

1. Spec wire-name `cache_hit_ratio` does not exist in Gateway — must be **derived view-shape** from `cacheRead/cacheWrite`.
2. Spec wire-name `cost_usd` does not exist — Gateway uses camelCase `totalCost`.
3. Pilot field `forTool` has **no Gateway truth** — pure Claude Design pilot mock invention.

---

## §1 — OpenSpec Corpus (S1)

### Active capabilities (17)

| Capability ID                   | Purpose                                                 | Key wire fields                                                              |
| ------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `chat-message-contract`         | Canonical message block contract                        | `type` discriminator, `tool_use`/`tool_result` aliases                       |
| `chat-session-sync`             | Shared transcript adapter (history+SSE+snapshot+reload) | `chat.history`, `session.message`                                            |
| `chat-compaction-viz`           | Compaction notification card                            | `compacted`, token before/after                                              |
| `chat-input-history`            | ArrowUp/Down history (max 50, sessionStorage)           | `deck-chat-input-history`                                                    |
| `chat-slash-commands`           | `/`-triggered palette (15 commands)                     | `/new`, `/stop`, `/model`, `/export`                                         |
| `chat-state-recovery`           | Per-session UI persist + reconnect catch-up             | `approval`, `a2ui`, canvas, `sessionKey`                                     |
| `chat-token-display`            | Per-message + session token+cost                        | `usage.input/output/cacheRead`, cost USD                                     |
| `transcript-rendering-contract` | Renderer registry per block type                        | block `type` registry                                                        |
| `approval-security`             | Approvals routed to chat + Approvals panel              | `approval-requested`, `sessionKey`                                           |
| `subagent-inline-cards`         | Inline SubagentCard + lifecycle tracking                | `subagent.spawn/complete/error`, `parentRunId`                               |
| `run-status-indicator`          | Metadata bar per assistant message                      | `model`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `duration_ms` |
| `tool-result-views`             | Bash split / diff / syntax-highlight + Show Raw         | tool name detect, exit code, file ext                                        |
| `session-lifecycle`             | Active/idle status, LRU eviction                        | `status: active\|idle`, `MAX_CACHED_SESSIONS=20`                             |
| `session-state-isolation`       | Map<sessionKey, SessionState> + single SSE              | `sessionKey`, `runId`, message id format                                     |
| `gateway-communication`         | SSE bridge auth + catch-up + typed methods              | `Last-Event-ID`, `GatewayMethodMap`                                          |
| `upstream-result-schemas`       | TypeBox result schemas for 5 upstream methods           | `SessionsUsageResult`, `SkillsInstallResult`                                 |
| `panel-registry`                | Central PANELS array drives NavRail+routing             | `id`, `group`, `icon`, `labelKey`, `position`                                |

### Proposed deltas (this change — `frontend-design-system-via-chat`)

| Delta                                   | Purpose                                                       | Key field/decision                                                                            |
| --------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `chat-message-contract (delta)`         | Forward-compat optional metadata + tool input context         | `cache_hit_ratio?`, `cost_usd?`, `parentRunId` wire vs `children` view, `tool_use.input.cwd?` |
| `transcript-rendering-contract (delta)` | Right-aligned IM bubble + paired tool unit + ds-\* primitives | bubble alignment config, `paired` vs `split`, `@/design-system` imports                       |
| `run-status-indicator (delta)`          | cacheHit + cost chips + hide-on-undefined                     | `Chip`, `Badge`, `Spinner` atoms                                                              |
| `tool-result-views (delta)`             | Segmented control raw/bash/read/diff                          | tab order, disabled state, default = best-detected                                            |
| `frontend-design-system` (NEW)          | Tokens / atoms / hooks / ds- prefix / a11y / i18n             | 30+ atoms, 5 hooks, theme + density                                                           |

### Capability dependency graph (chat-relevant)

```
SSE → session-state-isolation → chat-session-sync → transcript-rendering-contract
                                                          ↓
                                                     tool-result-views
                                                          ↓
                                  ← run-status-indicator ←┤
                                                          ↓
                                               frontend-design-system (atoms)
                                                          ↓
                                            (chat panel consumes ds-*)

approval event → approval-security → chat-state-recovery (persist)
subagent event → subagent-inline-cards → session-state-isolation.subagentRuns
compaction → chat-compaction-viz
```

---

## §2 — Gateway RPC Method Registry (S2)

**Registry:** `buildMethodRegistry()` in `src/gateway/method-registry.ts`. Metadata in `src/gateway/method-registry-data.ts` (used by codegen + `gateway.describe`). Schema ToT: TypeBox in `src/gateway/protocol/schema/`.

### By category (count)

| Category                  | Methods | Notable members                                                                                                                                                                                                          |
| ------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Sessions**              | 20      | `sessions.list/get/preview/create/send/steer/abort/patch/reset/clear/delete/compact`, `sessions.subscribe`, `sessions.messages.subscribe`, `sessions.compaction.{list,get,branch,restore}`                               |
| **Chat**                  | 3       | `chat.history`, `chat.send`, `chat.abort`                                                                                                                                                                                |
| **Agents**                | 10      | `agent.identity.get`, `agent.wait`, `agents.{list,create,update,delete}`, `agents.files.{list,get,set}`                                                                                                                  |
| **Subagents (deck.\*)**   | 4       | `deck.subagents.{list,lineage,kill,steer}`                                                                                                                                                                               |
| **Approvals**             | 11      | `exec.approvals.{get,set,node.get,node.set}`, `exec.approval.{request,resolve,waitDecision}`, `plugin.approval.{list,request,resolve,waitDecision}`                                                                      |
| **Deck (config/routing)** | 17      | `deck.agents.{detail,skills.*,subagents.*,systemPrompt.preview,toolPolicy.preview,eventStreams.*}`, `deck.routing.{list,add,remove,validate,simulate}`, `deck.commands.discover`, `deck.identity.*`, `deck.threads.list` |
| **Tools/Skills**          | 8       | `commands.list`, `tools.catalog`, `skills.{status,search,detail,install,update,bins}`                                                                                                                                    |

### Entry points relevant to chat panel refactor

| Method                         | Params (key fields)                                                   | Result (key fields)            | Use in chat panel                           |
| ------------------------------ | --------------------------------------------------------------------- | ------------------------------ | ------------------------------------------- |
| `sessions.send`                | `sessionKey`, `content`, options                                      | `sessionKey`, `runId`          | Composer submit                             |
| `sessions.steer`               | `sessionKey`, `content`                                               | `sessionKey`, `runId`          | Steer dialog                                |
| `sessions.abort`               | `sessionKey`                                                          | ack                            | Abort button                                |
| `sessions.messages.subscribe`  | `sessionKey`, cursor                                                  | snapshot + stream id           | History + live merge                        |
| `chat.history`                 | `sessionKey`, `limit`, `before`                                       | message array                  | Initial transcript load                     |
| `deck.subagents.lineage`       | `runId?` or `sessionKey?`                                             | `{root, nodes: LineageNode[]}` | Subagent tree (flat → recursive view-shape) |
| `deck.subagents.kill`          | `runId`                                                               | ack                            | Kill button on running subagent             |
| `deck.subagents.steer`         | `runId`, `instruction`                                                | ack (dedup)                    | Steer running subagent                      |
| `exec.approval.request`        | `id`, `command`, `cwd?`, `systemRunPlan`, `sessionKey?`, `timeoutMs?` | request id, status             | Approval dialog (read-only consumer)        |
| `exec.approval.resolve`        | `id`, `decision`                                                      | status                         | Approve/deny button                         |
| `sessions.compact`             | `sessionKey`, options                                                 | snapshot                       | Compaction trigger                          |
| `sessions.compaction.list/get` | `sessionKey`                                                          | snapshots                      | Compaction history                          |

### Notable gaps (S2 findings)

1. **No `chat.stream` RPC** — streaming is SSE-only.
2. **No recursive `subagent.lineage.children`** — wire is flat, depth ≤ 50 nodes; consumer joins via `parentRunId`.
3. **`deck.agents.*` largely untyped in registry** — TypeBox schemas exist but no exported `MethodMetadata` entries; codegen may skip these.
4. **No `a2ui.bridge.message` RPC** — canvas bridging is implementation-side (not RPC); see §4.
5. **No async compaction-diff method** — only full snapshot retrieval.

---

## §3 — SSE Event Union & Emission Ordering (S3)

### Stream catalog (16 events × 10 streams)

| Stream (discriminator `stream`)                            | Phases / states                                                                         | Key data fields                                                          |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `assistant` (chat events: state delta/final/error/aborted) | `state`: `delta` / `final` / `error` / `aborted`                                        | `runId`, `sessionKey`, `seq`, `message`, on final: `usage`, `stopReason` |
| `thinking`                                                 | mid-run                                                                                 | `text`, `verboseLevel` control                                           |
| `tool`                                                     | `phase`: `start` / `input_delta` / `complete` (also side-channel `chat.side_result`)    | `toolCallId`, `name`, `args`, `result`, `cwd?` (best-effort)             |
| `item`                                                     | `phase`: `start` / `update` / `end`; `kind`: tool / command / patch / search / analysis | structured progress payloads                                             |
| `approval`                                                 | `phase`: `requested` / `resolved`                                                       | `id`, `command`, `cwd`, `decision`                                       |
| `command_output`                                           | `phase`: `delta` / `end`                                                                | `cwd`, `exitCode`, output text                                           |
| `patch`                                                    | `phase`: `end`                                                                          | file change summary                                                      |
| `plan`                                                     | `phase`: `update`                                                                       | step list                                                                |
| `lifecycle`                                                | `phase`: `start` / `end` / `error` / `fallback` / `compaction`                          | `model`, `activeProvider`, `usage`, `stopReason`, `error`                |
| `compaction`                                               | mid-run checkpoint                                                                      | message counts, token totals                                             |

### Side-channel (non-stream)

| Event                                                      | Purpose                                             | Payload                                                         |
| ---------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| `session.message`                                          | broadcast per assistant output                      | `sessionKey`, `message`, `messageId`, `messageSeq`, snapshot    |
| `session.tool`                                             | broadcast per tool invocation                       | `runId`, `seq`, `data: {phase, name, toolCallId, args, result}` |
| `sessions.changed`                                         | lifecycle phase broadcast                           | `sessionKey`, `phase`, `runId`, snapshot                        |
| `exec.approval.{requested,resolved}`                       | approval scope broadcast (gated to APPROVALS_SCOPE) | dynamic                                                         |
| `health` / `heartbeat` / `talk.mode` / `tick` / `shutdown` | infra                                               | dynamic                                                         |

### Lifecycle invariants

1. **Canonical run sequence** (per runId):
   ```
   lifecycle:start (seq 1, model, sessionKey)
   → (assistant delta | thinking | tool start → tool input_delta* → tool complete | item | approval | command_output | patch | plan)*
   → lifecycle:end | lifecycle:error  (terminal)
   ```
2. **Approval interrupt:** `approval phase=requested` pauses agent loop; resumption requires `approval phase=resolved` (carries decision). Tool execution only proceeds on approve.
3. **Subagent nesting:**
   - Parent `tool:start` (toolCallId, name=`subagent-trigger`)
   - Child `lifecycle:start` (separate runId, parent context via `parentRunId`)
   - Child emits its own full lifecycle: assistant/thinking/tool/item/...
   - Child `lifecycle:end | error`
   - Parent receives result, emits `tool:complete`
4. **Compaction:** `compaction` stream phase mid-lifecycle (not terminal). Snapshot fields atomically updated. Clients replay from checkpoint on reconnect.
5. **Reconnect / catch-up:** Last-Event-ID cursor stored in `agentRunSeq` map (per runId). Live-forwarded via listener subscriptions, not from persistent log per event. **Slow consumers may be dropped** (`dropIfSlow: true` on delta events).
6. **Steer / abort:** `chat.abort()` sets `abortedRuns` flag. On next lifecycle terminal, chat-final event suppressed; session snapshot marks `abortedLastRun: true`.

### Notable gaps (S3 findings)

1. **No `usage_update` mid-run event** — usage emitted only on lifecycle:end.
2. **No `subagent_lineage_update` event** — subagent hierarchy is implicit via `parentRunId` in lifecycle context.
3. **No `cache_hit` event** — cache metadata only in final usage payload.
4. **No discriminated TypeScript event union** — `AgentEventStream` exists in `agent-events.ts` but Gateway dispatch uses string event names; consumers must build their own union.

---

## §4 — Data-Contract Schemas (S4)

### ContentBlock discriminated union — `src/gateway/protocol/schema/transcript.ts`

| Variant (`type` discriminator) | Fields                                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| `text`                         | `text: string`                                                                                |
| `thinking`                     | `text: string`                                                                                |
| `tool_use`                     | `id: string`, `name: string`, `input: Record<string, unknown>` (UNTYPED)                      |
| `tool_result`                  | `toolUseId: string`, `content: string \| TranscriptBlock[]` (recursive!), `isError?: boolean` |
| `image`                        | `data: string` (base64), `mimeType: string`, `fileName?: string`                              |
| `file`                         | `data: string` (base64), `mimeType: string`, `fileName: string`, `size?: number`              |

**Critical observations:**

- `tool_use.input` is **untyped** `Record<string, unknown>` — no schema-level enforcement of `cwd` / `reason` / `description`. They may or may not be present at runtime.
- `tool_result.content` supports **recursive blocks** — i.e., nested rendering.
- **No `canvas` variant** in the current schema (referenced via separate manifest, see Canvas section).
- **No `unknown` variant** in the current schema. (renderer-side fallback is a frontend concern, not wire shape.)

### ApprovalRequest schemas

**Exec (`src/gateway/protocol/schema/exec-approvals.ts`):**

- `ExecApprovalRequestParams`: `id?`, `command?`, `cwd?: string | null`, `systemRunPlan{argv, cwd, commandText}`, `nodeId?`, `sessionKey?`, `timeoutMs?`, `twoPhase?`
- `ExecApprovalRequestResult`: `id`, `status?`, `decision?: string | null`, `createdAtMs?`, `expiresAtMs?`
- **Expiry:** `expiresAtMs` (unix ms) — request expires when `Date.now() > expiresAtMs`.

**Plugin (`plugin-approvals.ts`):**

- `PluginApprovalRequestParams`: `pluginId?`, `title` (≤200), `description` (≤5000), `severity?: info|warning|critical`, `toolName?`, `sessionKey?`, `timeoutMs?` (1..3600000)

### Canvas / a2ui-bridge — `src/gateway/canvas-documents.ts` + `src/canvas-host/a2ui.ts`

**CanvasDocumentManifest:**

```
{
  id: string                          // cv_<uuid>
  kind: html_bundle | url_embed | document | image | video_asset
  title?, preferredHeight?
  createdAt: ISO8601
  entryUrl: string                    // HTTP entry point
  localEntrypoint?: string            // relative path
  externalUrl?: string                // for url_embed
  surface?: assistant_message | tool_card | sidebar
  assets: Array<{ logicalPath, contentType? }>
}
```

**postMessage protocol (no formal schema — implementation-side):**

- Host → iframe: `{ userAction: { id: string; [k: string]: unknown } }`
- Iframe → Host: detect iOS (`webkit.messageHandlers`) or Android (`window.openclawCanvasA2UIAction`), dispatch via the available channel
- **No formal state machine** in schema; implicit via `entryUrl` availability + manifest changes

**Critical gap:** No structured `Artifact` / `ArtifactRef` schema. Canvas referenced by manifest ID; artifact-list UX must be built on top.

### Subagent — `src/gateway/protocol/schema/deck.ts`

**LineageNode (flat list):**

```
{
  runId: string
  sessionKey: string
  agentId: string
  agentName?: string
  task?: string
  depth: integer                      // 0 = root
  parentRunId: string | null          // null for root
  status: string                      // active | completed | failed | timeout
  durationMs?: number
}
```

**DeckSubagentsLineageResult:**

```
{
  root: { sessionKey, agentId, agentName? }
  nodes: LineageNode[]                // FLAT
}
```

**No recursive `children` field.** View-shape (recursive tree) is reconstructed by deck-go frontend via `parentRunId` join.

### Run metadata / Usage — `src/gateway/protocol/schema/usage-result-schemas.ts`

**CostUsageTotals (camelCase, no `_usd` suffix):**
| Field | Type |
|---|---|
| `input` | number (tokens) |
| `output` | number (tokens) |
| `cacheRead` | number (tokens) |
| `cacheWrite` | number (tokens) |
| `totalTokens` | number |
| `totalCost` | number (USD float) |
| `inputCost` | number (USD) |
| `outputCost` | number (USD) |
| `cacheReadCost` | number (USD) |
| `cacheWriteCost` | number (USD) |
| `missingCostEntries` | number |

**SessionUsageTimePoint (run-end snapshot):**

- `timestamp` (unix ms), per-run `input/output/cacheRead/cacheWrite`, `totalTokens`, `cost`, `cumulativeTokens`, `cumulativeCost`

**Gaps:**

- **No `cache_hit_ratio` field** — only raw token counts.
- **No `duration_ms` in usage schema** — duration tracked separately (LineageNode.durationMs).
- **No `_usd` suffix** — Gateway uses camelCase totalCost.
- Usage emitted **run-end only**; no mid-run sampling.

---

## §5 — Cross-Reference Index (capability ↔ method ↔ event ↔ schema)

| Capability                    | RPC method (S2)                                 | SSE event (S3)                                                            | Schema (S4)                        |
| ----------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------- |
| chat-message-contract         | `chat.history`, `chat.send`                     | `chat` (delta/final), `session.message`                                   | `transcript.ts` (TranscriptBlock)  |
| chat-session-sync             | `sessions.messages.subscribe`, `chat.history`   | `session.message`, `sessions.changed`                                     | (consumes TranscriptBlock)         |
| chat-compaction-viz           | `sessions.compact`, `sessions.compaction.*`     | `lifecycle phase=compaction`, `compaction` stream                         | session snapshot fields            |
| chat-state-recovery           | `sessions.subscribe`, `chat.history` (catch-up) | reconnect via Last-Event-ID                                               | session/agent state                |
| chat-token-display            | (consumes lifecycle:end usage)                  | `lifecycle phase=end` (usage)                                             | CostUsageTotals                    |
| transcript-rendering-contract | (consumes chat blocks)                          | `session.message`, `chat:delta`                                           | TranscriptBlock variants           |
| approval-security             | `exec.approval.{request,resolve,waitDecision}`  | `approval phase=requested\|resolved`, `exec.approval.requested\|resolved` | ExecApprovalRequest{Params,Result} |
| subagent-inline-cards         | `deck.subagents.{list,lineage,kill,steer}`      | `lifecycle:start` (with parentRunId), `tool:start` (subagent-trigger)     | LineageNode (flat)                 |
| run-status-indicator          | (consumes lifecycle:end + chat:final)           | `lifecycle phase=end`, `chat state=final`                                 | CostUsageTotals (camelCase)        |
| tool-result-views             | (consumes tool result blocks)                   | `tool phase=complete`, `session.tool`                                     | tool_result variant                |
| session-lifecycle             | `sessions.list`, `sessions.subscribe`           | `sessions.changed phase=*`                                                | session snapshot                   |
| session-state-isolation       | (architecture; not direct RPC)                  | all SSE events routed by `sessionKey`                                     | session map                        |
| gateway-communication         | (transport layer)                               | Last-Event-ID, dropIfSlow                                                 | (transport)                        |
| panel-registry                | (frontend-only)                                 | n/a                                                                       | n/a                                |

---

## §6 — Pilot Field Coverage & Wire-vs-View-Shape Mapping

The Claude Design pilot mock data (`/tmp/design-bundle/openclaw-deck/project/data.js`) used 5 fields whose Gateway truth needs verification.

| Pilot field (view-shape)                    | Gateway truth (wire-shape)                                                                               | Coverage                                 | Bridging strategy                                                                                                                                                                                                                              |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`cacheHit`** (number, 0..1, ratio)        | `cacheRead` + `cacheWrite` (token counts) — **no ratio field**                                           | Partial: raw inputs exist, ratio derived | Frontend computes: `cacheRead / (input + output + cacheRead + cacheWrite)` (or denominator per business rule); chat-types declares `cacheHit?: number` view-only                                                                               |
| **`cost`** (number, USD float)              | `totalCost` (camelCase, USD float)                                                                       | Full with rename                         | Frontend declares `cost?: number` mapping to `usage.totalCost`; OpenSpec delta text mentions `cost_usd` — **does not exist on wire**, must rewrite as `totalCost`                                                                              |
| **`forTool`** (string, name of paired tool) | **NOT IN GATEWAY**                                                                                       | None                                     | Pure pilot invention. Bridging: when a tool_use+tool_result pair renders, the renderer joins by `tool_use_id` → reads paired `tool_use.name` → assigns view-shape `forTool` field. If pair is broken (orphan tool_result), `forTool` undefined |
| **subagent recursive `children`**           | LineageNode flat with `parentRunId` (depth ≤ 50)                                                         | Full with reshape                        | Frontend selector reduces flat nodes to tree by joining on `parentRunId`                                                                                                                                                                       |
| **`tool_use.input.cwd`**                    | `tool_use.input: Record<string, unknown>` (untyped); also `command_output.data.cwd`, `approval.data.cwd` | Best-effort                              | Frontend reads `block.input?.cwd` defensively; show only when present                                                                                                                                                                          |

**Result of task 1.5 verification:** All 5 pilot fields have a defined bridging path. Two require explicit "this does not exist on the wire today" handling (`cacheHit` derivation; `forTool` invention). Three are 1:1 or simple-reshape.

---

## §7 — Subsection: Fields Used by Chat UI but Missing in deck-go chat-types (input to P2 type extension — task 1.3)

The deck-go frontend `chat-types.ts` (in `deck-go/frontend/src/components/panels/chat/`) currently declares the wire-aligned baseline. The chat panel refactor will extend it with the following **view-shape** fields, all optional, all non-breaking. Names match the Claude Design pilot's data.js for visual parity.

```typescript
// === RunMetadata (consumed by run-status-indicator) ===
interface RunMetadata {
  // existing baseline
  model?: string;
  inputTokens?: number; // = wire CostUsageTotals.input
  outputTokens?: number; // = wire CostUsageTotals.output
  durationMs?: number; // = wire (run end - run start) timestamp diff (lifecycle.start.ts → lifecycle.end.ts)

  // NEW (P2 extension — view-shape derived)
  cacheReadTokens?: number; // = wire CostUsageTotals.cacheRead
  cacheWriteTokens?: number; // = wire CostUsageTotals.cacheWrite (also useful)
  cacheHit?: number; // = derived: cacheRead / (input + output + cacheRead + cacheWrite); 0..1
  cost?: number; // = wire CostUsageTotals.totalCost (USD float)
}

// === SubagentLineageNode (consumed by subagent tree view) ===
interface SubagentLineageNode {
  // wire baseline (already present)
  runId: string;
  sessionKey: string;
  agentId: string;
  agentName?: string;
  task?: string;
  depth: number;
  parentRunId: string | null;
  status: string;
  durationMs?: number;

  // NEW (P2 extension — view-shape, derived from join)
  children?: SubagentLineageNode[]; // built by selector: groupBy(nodes, parentRunId)
}

// === ToolUseBlock.input typing relaxation ===
interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>; // wire: untyped
}
// Best-effort accessors (NOT a schema enforcement):
type ToolUseInputContext = {
  cwd?: string;
  reason?: string;
  description?: string;
  // ...arbitrary keys
};
// Renderer reads: const ctx = block.input as ToolUseInputContext; ctx.cwd && <chip>...</chip>;

// === ToolResultBlock.forTool (paired-card view-shape) ===
interface ToolResultBlock {
  // wire baseline (already present)
  type: "tool_result";
  toolUseId: string;
  content: string | TranscriptBlock[];
  isError?: boolean;

  // NEW (P2 extension — view-shape, populated by pair-resolver)
  forTool?: string; // = tool_use.name from the paired tool_use block; undefined if pair broken
}
```

**Selector helper sketch (subagent tree):**

```typescript
function buildLineageTree(nodes: SubagentLineageNode[]): SubagentLineageNode {
  const byParent = groupBy(nodes, (n) => n.parentRunId);
  const root = nodes.find((n) => n.parentRunId === null);
  const attach = (node: SubagentLineageNode): SubagentLineageNode => ({
    ...node,
    children: (byParent.get(node.runId) ?? []).map(attach),
  });
  return root ? attach(root) : null;
}
```

---

## §8 — Subsection: Gateway Fields Not Yet Forwarded by Go Service (output for go-branch alignment — task 1.4)

The parallel `runtime-mode-decoupling` go branch handles deck-go's controld layer between Gateway and frontend. This subsection lists fields the chat panel will consume but which may not currently be forwarded. **This is the input for go-branch work, not for this proposal.**

| Field path                                                                                              | Wire location                                                        | Forwarded today?                                                 | Action for go branch                           |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------- |
| `usage.cacheRead`, `usage.cacheWrite`                                                                   | `lifecycle:end.data.usage`, `chat:final.usage`                       | ⚠️ verify in `deckapi.generated.go` + `controld` flow            | Pass-through forwarding; preserve numeric type |
| `usage.totalCost`, `usage.inputCost`, `usage.outputCost`, `usage.cacheReadCost`, `usage.cacheWriteCost` | same                                                                 | ⚠️ verify                                                        | Pass-through; float64                          |
| `usage.totalTokens`, `usage.cumulativeTokens`, `usage.cumulativeCost`                                   | `session.message` snapshot, `lifecycle:end`                          | ⚠️ verify                                                        | Pass-through                                   |
| `lifecycle.activeProvider` (model fallback)                                                             | `lifecycle:end.data.activeProvider`                                  | ⚠️ verify                                                        | Pass-through string                            |
| `tool_use.input.cwd`, `tool_use.input.reason`, `tool_use.input.description`                             | `session.tool.data.args.*`, `tool stream:start.args`                 | wire-side untyped → forward as `Record<string, unknown>` is safe | Ensure go service does NOT strip unknown keys  |
| `command_output.data.cwd`, `command_output.data.exitCode`                                               | `command_output:delta\|end.data.*`                                   | ⚠️ verify                                                        | Pass-through                                   |
| `LineageNode.durationMs`, `LineageNode.depth`, `LineageNode.parentRunId`                                | `deck.subagents.lineage` result                                      | ⚠️ verify                                                        | Pass-through                                   |
| `ApprovalRequest.cwd`, `.systemRunPlan.argv`, `.systemRunPlan.cwd`, `.systemRunPlan.commandText`        | `exec.approval.requested` event + `exec.approval.request` RPC result | ⚠️ verify                                                        | Pass-through                                   |
| Approval `expiresAtMs`, `createdAtMs`                                                                   | same                                                                 | ⚠️ verify                                                        | Pass-through int64                             |
| `compaction` stream events                                                                              | `lifecycle phase=compaction`, `compaction` stream                    | ⚠️ verify                                                        | Forward stream events                          |
| Last-Event-ID catch-up cursor                                                                           | SSE transport                                                        | ⚠️ verify go service preserves it on reconnect                   | Critical for reload UX                         |

**Naming convention for go branch:** Adopt the wire-shape camelCase names exactly (`totalCost` not `total_cost_usd`, `cacheRead` not `cache_read_tokens`). The frontend chat-types extension uses view-shape names (`cost`, `cacheReadTokens`, `cacheHit`) and maps in the consumer layer; go service forwards wire-shape unchanged.

---

## §9 — Verification: Pilot Field Coverage Audit (task 1.5)

| Pilot field                   | Found in S1 (OpenSpec)                                                      | Found in S2 (RPC)                        | Found in S3 (events)                                                 | Found in S4 (schemas)                    | Bridging path?                                |
| ----------------------------- | --------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------- |
| `cacheHit` (ratio)            | proposed delta as `cache_hit_ratio` (snake_case wire — does not exist)      | ❌ no method exposes ratio               | ❌ no event carries ratio                                            | ❌ raw counts only                       | ✅ derived from `cacheRead`/`cacheWrite`      |
| `cost`                        | proposed delta as `cost_usd` (does not exist) + `chat-token-display` active | ✅ `usage-result-schemas.ts` `totalCost` | ✅ `lifecycle:end.usage.cost` (per timepoint), `chat:final.usage`    | ✅ `CostUsageTotals.totalCost`           | ✅ rename: view `cost` → wire `totalCost`     |
| `forTool`                     | ❌ not in any spec                                                          | ❌ no schema                             | ❌ implicit (parent-message role)                                    | ❌ no field                              | ✅ pair-resolver: from paired `tool_use.name` |
| subagent recursive `children` | proposed delta as view-shape enrichment                                     | ✅ `deck.subagents.lineage` returns flat | ❌ no recursive event payload                                        | ✅ `LineageNode` flat with `parentRunId` | ✅ selector: groupBy + attach                 |
| `tool_use.input.cwd`          | proposed delta as optional input context                                    | ❌ no schema-level enforcement           | ✅ `command_output.data.cwd`, `approval.data.cwd` (separate streams) | ⚠️ `tool_use.input` is untyped Record    | ✅ defensive accessor on `block.input?.cwd`   |

**Conclusion:** All 5 pilot fields verified with explicit bridging paths. No undecidable gap.

---

## §10 — Discrepancies & Open Questions for Human Review

Before P2 type extension, three discrepancies must be acknowledged:

### Discrepancy 1: spec `cache_hit_ratio` vs Gateway truth

- **OpenSpec text** (chat-message-contract delta): `cache_hit_ratio` listed as optional wire field
- **Gateway reality:** no such field; only raw `cacheRead`/`cacheWrite` token counts
- **Resolution options:**
  - **(a)** Update spec delta text to drop `cache_hit_ratio`, instead say "Deck SHALL derive cache-hit display from `cacheRead`/`cacheWrite`" — clean, accurate
  - **(b)** Leave spec text as forward-statement of an aspirational wire field; accept that it's not in Gateway today
  - **My recommendation:** **(a)** — the spec should reflect Gateway truth, derivation is a frontend responsibility

### Discrepancy 2: spec `cost_usd` vs Gateway camelCase `totalCost`

- **OpenSpec text:** `cost_usd` (snake_case with `_usd` suffix)
- **Gateway reality:** `totalCost` (camelCase, no suffix)
- **Resolution options:**
  - **(a)** Update spec delta text to use `totalCost`
  - **(b)** Leave snake_case as wire-shape name aspiration; accept rename
  - **My recommendation:** **(a)** — match Gateway

### Discrepancy 3: pilot `forTool` is pure invention

- **No Gateway truth** for `forTool`. Pilot mock invented this for paired-card display.
- **Resolution options:**
  - **(a)** Drop `forTool` from chat-types; `ToolPair` component receives both blocks directly via props (no field on `ToolResultBlock`)
  - **(b)** Keep `forTool` as a view-only optional field, populated by pair-resolver
  - **My recommendation:** **(a)** — fewer view-only fields; pair-resolver passes the tool name as a prop instead. Avoids polluting block contract.

### Other open questions for the user

1. **`unknown` ContentBlock variant**: Spec mentions it; schema doesn't have it. Should the renderer fallback path use a synthetic frontend-only shape, OR should we propose adding `unknown` to wire schema (not in scope of this change)? **Recommendation:** synthetic frontend shape only.

2. **`canvas` ContentBlock variant**: Spec mentions canvas embed in transcript; schema doesn't have a `canvas` block — instead canvas is referenced via `CanvasDocumentManifest` separately. How does the chat panel render an inline canvas? **Recommendation:** use existing `CanvasEmbed.tsx` mechanism (out of ContentBlock union); render manifest via `a2ui-bridge`.

3. **Slow-consumer drop (S3 finding)**: Gateway drops delta events to slow consumers (`dropIfSlow: true`). Should the chat UI surface this somehow (e.g., "events dropped, refresh to catch up" banner), or is it transparent? **Recommendation:** transparent for now; rely on reconnect catch-up (Last-Event-ID); revisit if observed in practice.

4. **Approval timeout (`expiresAtMs`)**: schema-encoded but not currently surfaced in chat UI. Should the inline approval card show a countdown? **Recommendation:** yes, in `ApprovalDialog.tsx` (P2c task 6.3) — already in spec backlog.

5. **`deck.agents.eventStreams.*` methods (S2 finding)**: per-agent event-stream config. Is this relevant to chat panel? **Recommendation:** orthogonal — used by Agents panel, not chat. Note for completeness.

---

## §11 — Next Steps

1. **User reviews this capability map** (per "P0 only, then review" gate from `/openspec-apply-change` workflow).
2. **Apply discrepancy resolutions to OpenSpec deltas** if user approves recommendation (a)/(a)/(a) — small text-only edits to spec deltas, then re-run `openspec validate --strict`.
3. **Proceed to P1a (tokens + low-deps atoms)** with confirmed view-shape names.
4. The **§8 go-branch alignment subsection** is published for the parallel runtime-mode-decoupling branch to consume; not blocking for this change.

---

## Appendix A — File Pointers for Implementers

**Gateway truth (read-only references):**

- RPC registry: `src/gateway/method-registry.ts`, `src/gateway/method-registry-data.ts`
- Method handlers: `src/gateway/server-methods/`
- Schemas: `src/gateway/protocol/schema/{transcript.ts, exec-approvals.ts, plugin-approvals.ts, deck.ts, usage-result-schemas.ts, sessions.ts, config.ts}`
- SSE event schemas: `src/gateway/protocol/events/`, `src/gateway/server-chat.ts`, `src/gateway/server-session-events.ts`, `src/gateway/agent-events.ts`
- Canvas: `src/gateway/canvas-documents.ts`, `src/canvas-host/a2ui.ts`

**deck-go frontend (refactor target):**

- chat-types: `deck-go/frontend/src/components/panels/chat/chat-types.ts`
- panels: `deck-go/frontend/src/components/panels/chat/**/*.tsx`
- (future) design system: `deck-go/frontend/src/design-system/`

**Claude Design pilot reference (visual baseline):**

- bundle: `/tmp/design-bundle/openclaw-deck/project/{tokens.css, styles.css, *.jsx, data.js}`
- evaluation: `docs/superpowers/specs/2026-04-29-claude-design-evaluation.md`

**OpenSpec proposal:**

- `openspec/changes/frontend-design-system-via-chat/{proposal.md, design.md, tasks.md, specs/**}`

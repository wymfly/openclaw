# WeCom Channel Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fork @yanhaidao/wecom into extensions/wecom/, integrate enterprise-grade enhancements (quota tracking, dedup, reasoning visibility, reliable delivery), and add MCP Skill for WeCom document/smart-table operations.

**Architecture:** Fork-and-enhance approach — @yanhaidao/wecom as base (TypeScript, Zod, 4-layer architecture), new `src/enhanced/` directory for ported modules, `skills/wecom-doc/` for MCP Skill. Minimal modifications to base files (1-2 line insertion points).

**Tech Stack:** TypeScript, @wecom/aibot-node-sdk, Zod, Vitest, mcporter (MCP bridge)

**OpenSpec Change:** `openspec/changes/wecom-channel/`
**Design Doc:** `docs/plans/2026-03-17-wecom-integration-design.md`

---

## File Structure

### New files (created by this plan)

```
extensions/wecom/                          ← Fork from vendor/yanhaidao-wecom
├── src/enhanced/                          ← All new enhanced modules
│   ├── config-compat.ts                   ← Flat-key → nested schema adapter
│   ├── config-compat.test.ts
│   ├── quota-tracker.ts                   ← Passive/active send quota engine
│   ├── quota-tracker.test.ts
│   ├── reqid-store.ts                     ← Persistent message dedup
│   ├── reqid-store.test.ts
│   ├── reasoning-visibility.ts            ← Think tag display modes
│   ├── reasoning-visibility.test.ts
│   ├── pending-reply.ts                   ← Reliable delivery retry queue
│   ├── pending-reply.test.ts
│   ├── mcp-config.ts                      ← MCP config fetch + persist
│   ├── mcp-config.test.ts
│   └── integration.test.ts               ← End-to-end enhanced pipeline test
├── skills/wecom-doc/                      ← MCP Skill (copied from official)
│   ├── SKILL.md
│   └── references/doc-api.md
├── openclaw.plugin.json                   ← Modified: add "skills" field
└── package.json                           ← Modified: name, peer deps
```

### Modified files (from @yanhaidao base)

```
extensions/wecom/
├── src/transport/bot-ws/sdk-adapter.ts    ← +maxReconnectAttempts:100, +MCP fetch call, +reqid dedup
├── src/capability/bot/stream-delivery.ts  ← +reasoning-visibility integration
├── src/outbound.ts                        ← +quota-tracker count, +pending-reply enqueue
├── src/config/schema.ts                   ← +enhanced config sub-schema
├── src/config/accounts.ts                 ← +enhanced config inheritance
├── package.json                           ← name, version, peerDeps
├── tsconfig.json                          ← target alignment
└── openclaw.plugin.json                   ← +skills field
```

### Repo-level modified files

```
.github/labeler.yml                        ← +extensions/wecom label rule
```

---

## Dependency Graph & Parallel Groups

```
Task 1 (基座搭建)         ← 串行前置，所有任务依赖此
    ↓
┌── Task 2 (配置兼容)     ← 串行，Task 3-6 依赖
│   ↓
├── Task 3 (配额+去重)    ─┐
├── Task 4 (推理+投递)    ─┤ 可并行（文件独立）
├── Task 6 (MCP 配置)     ─┘
│   ↓
├── Task 5 (配置扩展)     ← 串行，依赖 3/4 的类型定义
│   ↓
├── Task 7 (Skill 集成)   ← 依赖 Task 6 的 MCP 路径
│   ↓
└── Task 8 (集成验证)     ← 串行末尾，全部完成后
```

### 文件交叉矩阵

| Task         | sdk-adapter.ts | stream-delivery.ts | outbound.ts | config/schema.ts | config/accounts.ts | openclaw.plugin.json |
| ------------ | :------------: | :----------------: | :---------: | :--------------: | :----------------: | :------------------: |
| T1 基座      |       ✏️       |                    |             |                  |                    |          ✏️          |
| T2 兼容      |                |                    |             |                  |                    |                      |
| T3 配额+去重 |       ✏️       |                    |     ✏️      |                  |                    |                      |
| T4 推理+投递 |                |         ✏️         |     ✏️      |                  |                    |                      |
| T5 配置扩展  |                |                    |             |        ✏️        |         ✏️         |                      |
| T6 MCP       |       ✏️       |                    |             |                  |                    |                      |
| T7 Skill     |                |                    |             |                  |                    |          ✏️          |

**冲突点：**

- `sdk-adapter.ts`: T1 + T3 + T6 都修改 → T1 串行先行，T3 和 T6 修改不同函数（T3 改 inbound handler，T6 改 onAuthenticated），可并行
- `outbound.ts`: T3 + T4 都修改 → T3 改计数调用，T4 改失败入队，不同位置，可并行
- `openclaw.plugin.json`: T1 + T7 → T1 先行，T7 后续追加

---

## Task 0: 无（共享接口已存在于 @yanhaidao 的 types/ 目录）

---

## Task 1: 基座搭建 [backend]

**Skill:** superpowers:test-driven-development
**covers:**

- `wecom-messaging > ADDED > WebSocket long connection messaging > "Successful authentication and message reception"`
- `wecom-messaging > ADDED > WebSocket long connection messaging > "Automatic reconnection on disconnect"`
- `wecom-messaging > ADDED > WebSocket long connection messaging > "Heartbeat keepalive"`

**Files:**

- Create: `extensions/wecom/` (copy from `vendor/yanhaidao-wecom/`)
- Modify: `extensions/wecom/package.json`
- Modify: `extensions/wecom/tsconfig.json`
- Modify: `extensions/wecom/src/transport/bot-ws/sdk-adapter.ts` (maxReconnectAttempts)

- [ ] 1.1 Copy `vendor/yanhaidao-wecom/` to `extensions/wecom/`, remove `.git/`, `node_modules/`, `dist/`

```bash
cp -R vendor/yanhaidao-wecom extensions/wecom
rm -rf extensions/wecom/.git extensions/wecom/node_modules extensions/wecom/dist
```

- [ ] 1.2 Update `extensions/wecom/package.json`: change name to `@openclaw-enhanced/wecom`, set version to `2026.3.17`, align peerDependencies to `"openclaw": ">=2026.3.0"`

- [ ] 1.3 Update `extensions/wecom/tsconfig.json`: set `"target": "es2023"` to match main repo

- [ ] 1.4 In `extensions/wecom/src/transport/bot-ws/sdk-adapter.ts`, find where `AiBot.WSClient` is instantiated (around line 31) and add `maxReconnectAttempts: 100` to the options object. SDK default is 10, spec requires 100.

- [ ] 1.5 Run build verification

```bash
cd extensions/wecom && pnpm install && pnpm build
```

Expected: zero compile errors

- [ ] 1.6 Run existing tests

```bash
cd extensions/wecom && pnpm test
```

Expected: all 23 test files pass

- [ ] 1.7 Commit

```bash
scripts/committer "[enhanced] feat(wecom): fork @yanhaidao/wecom as extensions/wecom base" extensions/wecom
```

---

## Task 2: 配置兼容适配器 [enhanced]

**Skill:** superpowers:test-driven-development
**covers:**

- `wecom-messaging > ADDED > Direct message and group chat support > "DM with open policy"`
- `wecom-messaging > ADDED > Direct message and group chat support > "DM with allowlist policy"`

**Files:**

- Create: `extensions/wecom/src/enhanced/config-compat.ts`
- Create: `extensions/wecom/src/enhanced/config-compat.test.ts`

- [ ] 2.1 Write failing test `src/enhanced/config-compat.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { applyFlatKeyCompat } from "./config-compat.js";

describe("applyFlatKeyCompat", () => {
  it("maps flat botId to nested bot.ws.botId", () => {
    const input = { botId: "abc", secret: "xyz" };
    const result = applyFlatKeyCompat(input);
    expect(result.bot?.ws?.botId).toBe("abc");
    expect(result.bot?.ws?.secret).toBe("xyz");
  });

  it("maps flat dmPolicy to nested bot.dm.policy", () => {
    const input = { dmPolicy: "open" };
    const result = applyFlatKeyCompat(input);
    expect(result.bot?.dm?.policy).toBe("open");
  });

  it("preserves nested config unchanged", () => {
    const input = { bot: { ws: { botId: "abc", secret: "xyz" } } };
    const result = applyFlatKeyCompat(input);
    expect(result.bot?.ws?.botId).toBe("abc");
  });

  it("nested takes precedence over flat", () => {
    const input = { botId: "flat", bot: { ws: { botId: "nested", secret: "s" } } };
    const result = applyFlatKeyCompat(input);
    expect(result.bot?.ws?.botId).toBe("nested");
  });
});
```

- [ ] 2.2 Run test to verify it fails

```bash
cd extensions/wecom && pnpm vitest run src/enhanced/config-compat.test.ts
```

Expected: FAIL (module not found)

- [ ] 2.3 Implement `src/enhanced/config-compat.ts`

Map flat keys: `botId`→`bot.ws.botId`, `secret`→`bot.ws.secret`, `dmPolicy`→`bot.dm.policy`, `allowFrom`→`bot.dm.allowFrom`, `groupPolicy`→`dynamicAgents.groupEnabled` (open→true, disabled→false), `groupAllowFrom`→(log warning, not supported in @yanhaidao schema). Nested keys take precedence when both present.

- [ ] 2.4 Run test to verify it passes

- [ ] 2.5 Commit

```bash
scripts/committer "[enhanced] feat(wecom): add flat-key config compatibility adapter" extensions/wecom/src/enhanced/config-compat.ts extensions/wecom/src/enhanced/config-compat.test.ts
```

---

## Task 3: 配额追踪与消息去重 [enhanced] ← 可与 T4, T6 并行

**Skill:** superpowers:test-driven-development
**covers:**

- `wecom-enhanced > ADDED > Passive reply quota tracking > "Quota near limit warning"`
- `wecom-enhanced > ADDED > Passive reply quota tracking > "Quota exhausted blocking"`
- `wecom-enhanced > ADDED > Active send quota tracking > "Daily quota reset"`
- `wecom-enhanced > ADDED > Active send quota tracking > "Active send quota forecast"`
- `wecom-enhanced > ADDED > Persistent message deduplication > "Duplicate rejection after reconnect"`
- `wecom-enhanced > ADDED > Persistent message deduplication > "ReqId store persistence"`

**Files:**

- Create: `extensions/wecom/src/enhanced/quota-tracker.ts`
- Create: `extensions/wecom/src/enhanced/quota-tracker.test.ts`
- Create: `extensions/wecom/src/enhanced/reqid-store.ts`
- Create: `extensions/wecom/src/enhanced/reqid-store.test.ts`
- Modify: `extensions/wecom/src/transport/bot-ws/sdk-adapter.ts` (dedup integration)
- Modify: `extensions/wecom/src/outbound.ts` (quota count integration)

- [ ] 3.1 Write failing test for quota-tracker (port from `vendor/openclaw-plugin-wecom/wecom/runtime-telemetry.js`, TypeScript化)

Key test cases: 24h window boundary, 24/30 nearLimit threshold, 30/30 exhausted, daily reset at UTC midnight, forecast functions.

- [ ] 3.2 Implement `src/enhanced/quota-tracker.ts` by porting `vendor/openclaw-plugin-wecom/wecom/runtime-telemetry.js` (330 lines → TypeScript)

Zero external dependencies. Core exports: `forecastReplyQuota(chatState)`, `forecastActiveSendQuota(chatState)`, `recordInboundActivity(accountState, chatId)`, `recordOutboundActivity(accountState, chatId)`.

- [ ] 3.3 Run quota-tracker tests, verify pass

- [ ] 3.4 Write failing test for reqid-store (port from `vendor/openclaw-plugin-wecom/wecom/reqid-store.js`)

Key test cases: set/get reqId, 7-day TTL expiry, 200-entry max, debounced flush, persistence across reload.

- [ ] 3.5 Implement `src/enhanced/reqid-store.ts` by porting `vendor/openclaw-plugin-wecom/wecom/reqid-store.js` (146 lines → TypeScript)

Replace hardcoded `resolveStateDir()` with injected `storeDir: string` parameter. Core exports: `createReqIdStore({ storeDir, accountId })`, returns `{ set, get, has, flush, warmup }`.

- [ ] 3.6 Run reqid-store tests, verify pass

- [ ] 3.7 Integrate dedup into `src/transport/bot-ws/sdk-adapter.ts`: in the inbound message handler, add 2 lines to check `reqIdStore.has(msgId)` before processing

- [ ] 3.8 Integrate quota counting into `src/outbound.ts`: after successful send, call `recordOutboundActivity()`

- [ ] 3.9 Commit

```bash
scripts/committer "[enhanced] feat(wecom): add quota tracking and persistent message dedup" extensions/wecom/src/enhanced/quota-tracker.ts extensions/wecom/src/enhanced/quota-tracker.test.ts extensions/wecom/src/enhanced/reqid-store.ts extensions/wecom/src/enhanced/reqid-store.test.ts extensions/wecom/src/transport/bot-ws/sdk-adapter.ts extensions/wecom/src/outbound.ts
```

---

## Task 4: 推理展示与可靠投递 [enhanced] ← 可与 T3, T6 并行

**Skill:** superpowers:test-driven-development
**covers:**

- `wecom-enhanced > ADDED > Reasoning visibility control > "Separate mode display"`
- `wecom-enhanced > ADDED > Reasoning visibility control > "Hidden mode stripping"`
- `wecom-enhanced > ADDED > Reasoning visibility control > "Code block protection"`
- `wecom-enhanced > ADDED > Reliable delivery with retry > "Failed delivery enqueue"`
- `wecom-enhanced > ADDED > Reliable delivery with retry > "Retry sweep"`
- `wecom-enhanced > ADDED > Reliable delivery with retry > "Persistence across restart"`

**Files:**

- Create: `extensions/wecom/src/enhanced/reasoning-visibility.ts`
- Create: `extensions/wecom/src/enhanced/reasoning-visibility.test.ts`
- Create: `extensions/wecom/src/enhanced/pending-reply.ts`
- Create: `extensions/wecom/src/enhanced/pending-reply.test.ts`
- Modify: `extensions/wecom/src/capability/bot/stream-delivery.ts` (reasoning integration)
- Modify: `extensions/wecom/src/outbound.ts` (pending-reply enqueue)

- [ ] 4.1 Write failing test for reasoning-visibility (port from `vendor/OpenClaw-Wechat/src/wecom/reasoning-visibility.js`)

Key test cases: separate mode extracts `<think>` content + sends separately (max 1200 chars), hidden mode strips all, append mode prepends, code block protection (` ``` ` delimiters), nested/unclosed tags.

- [ ] 4.2 Implement `src/enhanced/reasoning-visibility.ts` (104 lines → TypeScript)

Zero dependencies. Core exports: `normalizeReasoningMode()`, `applyWecomReasoningPolicy()`, `buildWecomReasoningMergedText()`.

- [ ] 4.3 Run reasoning-visibility tests, verify pass

- [ ] 4.4 Write failing test for pending-reply (port from `vendor/OpenClaw-Wechat/src/wecom/pending-reply-manager.js`)

Key test cases: enqueue on failure, sweep retries due entries, exponential backoff, maxRetries removal, JSONL persistence, load on restart.

- [ ] 4.5 Implement `src/enhanced/pending-reply.ts` (143 lines → TypeScript)

Full dependency injection: `{ reliableDeliveryStore, deliverPendingReply, sweepIntervalMs, maxRetries }`. Core exports: `createPendingReplyManager()`.

- [ ] 4.6 Run pending-reply tests, verify pass

- [ ] 4.7 Integrate reasoning-visibility into `src/capability/bot/stream-delivery.ts`: before sending final reply, apply `applyWecomReasoningPolicy()` based on `enhanced.reasoningMode` config

- [ ] 4.8 Integrate pending-reply into `src/outbound.ts`: in the catch block of failed delivery, call `pendingReplyManager.enqueue()`

- [ ] 4.9 Commit

```bash
scripts/committer "[enhanced] feat(wecom): add reasoning visibility control and reliable delivery retry" extensions/wecom/src/enhanced/reasoning-visibility.ts extensions/wecom/src/enhanced/reasoning-visibility.test.ts extensions/wecom/src/enhanced/pending-reply.ts extensions/wecom/src/enhanced/pending-reply.test.ts extensions/wecom/src/capability/bot/stream-delivery.ts extensions/wecom/src/outbound.ts
```

---

## Task 5: 配置扩展 [backend]

**Skill:** superpowers:test-driven-development
**covers:** (supports all enhanced scenarios by providing config access)

**Files:**

- Modify: `extensions/wecom/src/config/schema.ts`
- Modify: `extensions/wecom/src/config/accounts.ts`

- [ ] 5.1 Extend Zod schema in `src/config/schema.ts`: add `enhanced` optional object with fields `quotaTracking: boolean`, `reqIdPersistence: boolean`, `reasoningMode: enum("separate","append","hidden")`, `pendingReply: { enabled: boolean, maxRetries: number, sweepIntervalMs: number }`

- [ ] 5.2 Write schema tests: valid enhanced config, missing enhanced (defaults), invalid reasoningMode value

- [ ] 5.3 Update `src/config/accounts.ts`: when resolving per-account config, inherit `enhanced` from top-level if account doesn't override

- [ ] 5.4 Run all config tests

- [ ] 5.5 Commit

```bash
scripts/committer "[enhanced] feat(wecom): extend config schema with enhanced sub-section" extensions/wecom/src/config/schema.ts extensions/wecom/src/config/accounts.ts
```

---

## Task 6: MCP 配置获取 [enhanced] ← 可与 T3, T4 并行

**Skill:** superpowers:test-driven-development
**covers:**

- `wecom-mcp > ADDED > Automatic MCP config fetching > "Successful MCP config fetch"`
- `wecom-mcp > ADDED > Automatic MCP config fetching > "MCP config fetch timeout"`
- `wecom-mcp > ADDED > Automatic MCP config fetching > "MCP config not authorized"`

**Files:**

- Create: `extensions/wecom/src/enhanced/mcp-config.ts`
- Create: `extensions/wecom/src/enhanced/mcp-config.test.ts`
- Modify: `extensions/wecom/src/transport/bot-ws/sdk-adapter.ts` (onAuthenticated hook)

- [ ] 6.1 Write failing test for mcp-config

Key test cases: mock WSClient.reply() returning `{ body: { url: "http://...", type: "streamable-http", is_authed: true } }`, type fallback when response lacks type field, 15s timeout, errcode non-zero rejection, per-account file write to `~/.openclaw/wecomConfig/{accountId}/config.json`.

- [ ] 6.2 Implement `src/enhanced/mcp-config.ts`

```typescript
const MCP_GET_CONFIG_CMD = "aibot_get_mcp_config";
const MCP_TIMEOUT_MS = 15_000;

export async function fetchMcpConfig(client: WSClient): Promise<McpConfig> {
  const reqId = generateReqId("mcp_config");
  const response = await withTimeout(
    client.reply({ headers: { req_id: reqId } }, { biz_type: "doc" }, MCP_GET_CONFIG_CMD),
    MCP_TIMEOUT_MS,
  );
  // validate errcode, extract url/type/is_authed, default type to "streamable-http"
}

export async function fetchAndSaveMcpConfig(
  client: WSClient,
  accountId: string,
  log: Logger,
): Promise<void> {
  // fetch + write to ~/.openclaw/wecomConfig/{accountId}/config.json
  // failures only logged, never thrown
}
```

- [ ] 6.3 Run mcp-config tests, verify pass

- [ ] 6.4 In `src/transport/bot-ws/sdk-adapter.ts`, after successful `aibot_subscribe` acknowledgment, add call to `fetchAndSaveMcpConfig(this.client, accountId, this.log)` wrapped in try-catch (failure must not block messaging)

- [ ] 6.5 Commit

```bash
scripts/committer "[enhanced] feat(wecom): add MCP config auto-fetch on WS authentication" extensions/wecom/src/enhanced/mcp-config.ts extensions/wecom/src/enhanced/mcp-config.test.ts extensions/wecom/src/transport/bot-ws/sdk-adapter.ts
```

---

## Task 7: wecom-doc Skill 集成 [skill]

**covers:**

- `wecom-mcp > ADDED > wecom-doc Skill registration > "Skill directory declaration"`
- `wecom-mcp > ADDED > wecom-doc Skill registration > "Document creation via Skill"`
- `wecom-mcp > ADDED > wecom-doc Skill registration > "Smart table creation and data entry"`
- `wecom-mcp > ADDED > MCP config auto-detection in Skill > "Auto-detection from config file"`
- `wecom-mcp > ADDED > MCP config auto-detection in Skill > "Manual configuration fallback"`
- `wecom-mcp > ADDED > MCP config auto-detection in Skill > "Config persistence via mcporter"`

**Files:**

- Create: `extensions/wecom/skills/wecom-doc/SKILL.md`
- Create: `extensions/wecom/skills/wecom-doc/references/doc-api.md`
- Modify: `extensions/wecom/openclaw.plugin.json`

- [ ] 7.1 Create `extensions/wecom/skills/wecom-doc/` directory

- [ ] 7.2 Copy from `vendor/wecom-official/package/skills/wecom-doc/`: `SKILL.md` and `references/doc-api.md`

- [ ] 7.3 In SKILL.md, find all references to `~/.openclaw/wecomConfig/config.json` and update to per-account path pattern `~/.openclaw/wecomConfig/{accountId}/config.json`. Add note that `{accountId}` defaults to `"default"` for single-account setups.

- [ ] 7.4 In SKILL.md, find hardcoded `openclaw config get channels.wecom.botId` (around line 271-275) and update to `openclaw config get channels.wecom.bot.ws.botId`. Also add compat note: "如果使用 flat-key 配置，系统会自动映射。"

- [ ] 7.5 In `openclaw.plugin.json`, add `"skills": ["./skills"]` field

- [ ] 7.6 Commit

```bash
scripts/committer "[enhanced] feat(wecom): add wecom-doc MCP Skill for document and smart table operations" extensions/wecom/skills extensions/wecom/openclaw.plugin.json
```

---

## Task 8: 仓库集成与验证 [infra] [test]

**Skill:** superpowers:verification-before-completion, validate
**covers:** (verification of all specs)

**Files:**

- Modify: `.github/labeler.yml`
- Create: `extensions/wecom/src/enhanced/integration.test.ts`

- [ ] 8.1 Update `.github/labeler.yml`: add rule for `extensions/wecom` directory with appropriate label (follow existing extension label colors)

- [ ] 8.2 Run all extension tests

```bash
cd extensions/wecom && pnpm test
```

Expected: all original (23) + new enhanced tests pass

- [ ] 8.3 Run main repo build

```bash
pnpm build
```

Expected: zero errors, wecom extension built successfully

- [ ] 8.4 Run main repo tests

```bash
pnpm test
```

Expected: no regression in existing tests

- [ ] 8.5 Write integration test `src/enhanced/integration.test.ts`: mock WebSocket server, verify full pipeline — inbound message → dedup check → quota check → Agent routing → outbound with reasoning visibility → quota count → failure → pending-reply enqueue

- [ ] 8.6 Run integration test, verify pass

- [ ] 8.7 Final commit

```bash
scripts/committer "[enhanced] feat(wecom): add integration tests and labeler config" extensions/wecom/src/enhanced/integration.test.ts .github/labeler.yml
```

---

## Requirement Coverage Matrix

| Spec                | Requirement               | Scenario                  | Covered By                             |
| ------------------- | ------------------------- | ------------------------- | -------------------------------------- |
| **wecom-messaging** | WebSocket long connection | Auth + reception          | T1 (1.4-1.6)                           |
|                     |                           | Auto reconnect            | T1 (1.4 maxReconnect)                  |
|                     |                           | Heartbeat keepalive       | T1 (base has 30s heartbeat)            |
|                     | Streaming reply           | Thinking placeholder      | T1 (base capability)                   |
|                     |                           | Stream timeout            | T1 (base: 6min timeout)                |
|                     | DM and group chat         | DM open policy            | T2 (config-compat)                     |
|                     |                           | DM allowlist policy       | T2 (config-compat)                     |
|                     |                           | Group via dynamicAgents   | T1 (base: dynamicAgents.groupEnabled)  |
|                     | Multi-account             | Independent config        | T1 (base: accounts.\*)                 |
|                     |                           | Conflict detection        | T1 (base: resolveWecomAccountConflict) |
|                     | Dynamic Agent isolation   | Per-user workspace        | T1 (base: dynamic-agent.ts)            |
|                     |                           | Admin bypass              | T1 (base: adminUsers)                  |
|                     | Agent API proactive       | Push to user              | T1 (base: transport/agent-api/)        |
|                     |                           | WS→API fallback           | T1 (base: outbound.ts fallback)        |
|                     | Media handling            | Inbound image             | T1 (base: media.ts)                    |
|                     |                           | Outbound MEDIA directive  | T1 (base: outbound.ts MEDIA parsing)   |
| **wecom-enhanced**  | Passive quota             | Near limit warning        | T3 (3.1-3.2)                           |
|                     |                           | Exhausted blocking        | T3 (3.1-3.2, 3.8)                      |
|                     | Active quota              | Daily reset               | T3 (3.1-3.2)                           |
|                     |                           | Forecast                  | T3 (3.1-3.2)                           |
|                     | Persistent dedup          | Duplicate after reconnect | T3 (3.3-3.7)                           |
|                     |                           | ReqId persistence         | T3 (3.3-3.6)                           |
|                     | Reasoning visibility      | Separate mode             | T4 (4.1-4.3, 4.7)                      |
|                     |                           | Hidden mode               | T4 (4.1-4.3)                           |
|                     |                           | Code block protection     | T4 (4.1-4.3)                           |
|                     | Reliable delivery         | Failed enqueue            | T4 (4.4-4.6, 4.8)                      |
|                     |                           | Retry sweep               | T4 (4.4-4.6)                           |
|                     |                           | Persistence restart       | T4 (4.4-4.6)                           |
| **wecom-mcp**       | Auto MCP config           | Successful fetch          | T6 (6.1-6.4)                           |
|                     |                           | Fetch timeout             | T6 (6.1-6.3)                           |
|                     |                           | Not authorized            | T6 (6.1-6.3)                           |
|                     | wecom-doc Skill           | Skill declaration         | T7 (7.5)                               |
|                     |                           | Document creation         | T7 (7.2)                               |
|                     |                           | Smart table creation      | T7 (7.2)                               |
|                     | MCP auto-detection        | From config file          | T7 (7.3)                               |
|                     |                           | Manual fallback           | T7 (7.2, 7.4)                          |
|                     |                           | Config via mcporter       | T7 (7.2)                               |

**Coverage: 32/32 scenarios covered (100%)**. No orphaned requirements.

---

## Parallel Execution Summary

| Phase   | Tasks         | Mode     | Rationale                                                    |
| ------- | ------------- | -------- | ------------------------------------------------------------ |
| Phase 0 | T1 (基座)     | 串行     | 所有后续任务的前置依赖                                       |
| Phase 1 | T2 (配置兼容) | 串行     | T3-T6 需要兼容层就绪                                         |
| Phase 2 | T3 + T4 + T6  | **并行** | 文件集不交叉（各自 enhanced/ 独立文件 + 不同 base 文件位置） |
| Phase 3 | T5 (配置扩展) | 串行     | 依赖 T3/T4 的类型定义                                        |
| Phase 4 | T7 (Skill)    | 串行     | 依赖 T6 的 MCP 路径格式                                      |
| Phase 5 | T8 (集成验证) | 串行     | 全部任务完成后验证                                           |

# OpenSpec Review Remediation — Supplement

> 日期: 2026-04-03
> 状态: proposed
> 来源: Claude 审查发现的、`2026-04-03-openspec-remediation-plan.md` 未覆盖的问题
> 前置: Batch α/β 与主 plan 无依赖可并行；Batch γ 依赖主 plan Task 2 先完成

## 1. 目标

覆盖主 plan 未涉及的三类问题：

- OpenSpec spec 与实现的失真（spec 描述的行为不存在于代码中）和文档矛盾
- P0 上游同步模块的测试空白（source-registry、context-store）
- 自研模块测试的终态错误与业务错误盲区

本计划显式接受 calendar（~1200 行）和 mcp（~400 行）的测试债务，理由见第 8 节。

## 2. 范围

仅覆盖 `wecom-api-expansion` change。不引入新功能。

## 3. 已确认问题

### 3.1 Spec 与实现失真（mcp-bridge）

`wecom-mcp-bridge/spec.md` 的两个 scenario 描述了当前代码中不存在的行为：

1. **"Session source tracking"** (spec.md:24)：THEN 写 "session-manager 可查询该信息"，但 `extensions/wecom/src/runtime/session-manager.ts` 中无任何 source-registry 引用。实际链路是：`transport/bot-ws/sdk-adapter.ts` 调用 `registerWecomSourceSnapshot()` 写入来源快照；`calendar/tool.ts` 通过 `isWecomAgentSource()` 读取 agent-callback 来源；`mcp/tool.ts` 通过 `resolveWecomSourceSnapshot()` 读取来源并限制 `bot-ws` 会话。

2. **"Store push context"** (spec.md:33)：THEN 写 "context-store 缓存推送内容，供后续 tool 调用时引用"，但 `setPeerContext()` 当前仅有定义（`context-store.ts:170`），无任何生产调用方。context-store 模块已复制但尚未接入 Bot WS inbound pipeline。

这不仅是 Evidence 缺失问题——spec 描述的行为与实现真相不一致。同时，仓库中其他 spec（如 `wecom-calendar/spec.md:52`）已有 Evidence 写法作为实践参考，mcp-bridge 应保持一致

### 3.2 Design vs Tasks 矛盾（文档一致性）

- `design.md` 风险表："上游 source-registry 在 session-manager 中有集成逻辑，我方版本缺少此逻辑"
- `tasks.md` Section 1.3："source-registry 由 calendar/tool.ts 和 mcp/tool.ts 内部引用，无需额外 session-manager 集成"

经代码验证：**tasks.md 是正确的**。`source-registry.ts` 是纯内存 store，不依赖 session-manager；当前生产者是 `bot-ws/sdk-adapter.ts` 的 `registerWecomSourceSnapshot()`，当前消费者是 `calendar/tool.ts` 的 `isWecomAgentSource()` 和 `mcp/tool.ts` 的 `resolveWecomSourceSnapshot()`。`session-manager.ts` 当前与 source-registry 无直接关系。但 design.md 的风险描述和 **proposal.md:32**（"联动修改：`src/runtime/session-manager.ts`（source-registry 集成）"）均未更新，造成 proposal / design / tasks 三处矛盾。

### 3.3 P0 上游模块零测试

| 模块                         | 代码行数 | 复杂度                                  | 测试状态   |
| ---------------------------- | -------- | --------------------------------------- | ---------- |
| `runtime/source-registry.ts` | 247 行   | 5 层查找 fallback + LRU 淘汰 + 多维索引 | **零测试** |
| `context-store.ts`           | 265 行   | 磁盘持久化 + 双向索引 + TTL 过期        | **零测试** |
| `capability/calendar/`       | ~1200 行 | 13 method + 复杂校验                    | **零测试** |
| `capability/mcp/`            | ~400 行  | factory 模式 + schema 清洗 + RPC        | **零测试** |

这些模块来自上游同步，但上游测试未一同复制。source-registry 和 context-store 的逻辑复杂度（多维索引、LRU、磁盘 I/O）使其成为高回归风险。

### 3.4 自研模块终态错误与业务错误未测试

5 个自研模块已有重试成功路径测试（各模块最后一个 test case 均验证了"前 N-1 次失败 → 第 N 次成功"的 retry 恢复），但以下终态和业务错误场景零覆盖：

- **重试耗尽终态**：连续 3 次 fetch 均失败后的错误消息和 `isError` 标记
- **API 业务错误码**：`errcode !== 0`（如 40001 invalid credential、60011 invalid userid）
- **空结果集**：有效响应但数据为空列表/null
- **输入校验拒绝**：缺少必填字段、非法枚举值

已有覆盖的 retry 测试位置：`contact.test.ts:165`、`meeting.test.ts:157`、`todo.test.ts:127`、`approval.test.ts:206`、`external-contact.test.ts:197`

## 4. 整改顺序

1. 先修 spec 失真和文档矛盾（纯文档，无风险）
2. 再补 source-registry + context-store 测试（最高 ROI——复杂逻辑无测试）
3. 再补自研模块终态错误与业务错误测试（依赖主 plan Task 2 先修复 TS 类型）
4. Calendar/MCP 测试显式延后（见第 8 节）

## 5. 任务清单

### Task S1: 修正 mcp-bridge spec 使其回到实现真相 [docs]

**目标:** 让 wecom-mcp-bridge spec 的 THEN 子句准确描述当前实现，而不是包装未实现的行为为"已有能力"。

**Files:**

- Modify: `openspec/changes/wecom-api-expansion/specs/wecom-mcp-bridge/spec.md`

**选项 A（推荐——修正 spec 到实现真相）：**

- [ ] "Session source tracking" scenario：将 THEN 从 "session-manager 可查询该信息" 修正为当前真实链路：`transport/bot-ws/sdk-adapter.ts` 通过 `registerWecomSourceSnapshot()` 记录来源；`calendar/tool.ts` 通过 `isWecomAgentSource()` 判断 agent-callback 来源；`mcp/tool.ts` 通过 `resolveWecomSourceSnapshot()` 解析来源并仅在 `bot-ws` 会话中启用。追加对应 Evidence。
- [ ] "Store push context" scenario：移除当前 spec 中“已实现”的表述，因为 `setPeerContext()` 当前无生产调用方。若仍希望保留该能力目标，则把接入工作落到 `tasks.md` 的未完成任务或后续独立 change，而不是在当前 spec 中继续描述为既有行为。
- [ ] "Proxy MCP tool call" 和 "MCP tool discovery" scenario：追加 Evidence: `extensions/wecom/src/capability/mcp/tool.ts` — `handleCall()` / `handleList()`

**选项 B（追加缺失实现）：**

- [ ] 在 Bot WS inbound pipeline 中接入 `setPeerContext()` 调用
- [ ] 在 session-manager 中接入 source-registry 查询（如果确实需要）
- [ ] 补充对应测试
- [ ] 然后为 spec 追加 Evidence

建议走选项 A：先修正文档到真相，缺失的实现回收到未完成任务或后续 change，不在当前 spec 中伪装为既有能力。

**Exit Criteria:**

- spec 的 THEN 子句与当前代码行为一致
- 未实现的行为不再以“已实现”语气写在当前 spec 中

### Task S2: 消除 proposal / design / tasks 三处矛盾 [docs]

**目标:** 统一 session-manager 集成相关的描述，消除 proposal / design / tasks 之间的事实矛盾。

**Files:**

- Modify: `openspec/changes/wecom-api-expansion/proposal.md`
- Modify: `openspec/changes/wecom-api-expansion/design.md`

- [ ] **proposal.md:32**：删除或修正 "联动修改：`src/runtime/session-manager.ts`（source-registry 集成）"，改为 "source-registry 模块独立运行；`bot-ws/sdk-adapter.ts` 负责写入来源快照，calendar/mcp tool 直接消费，无需 session-manager 联动"
- [ ] **design.md** 风险表：在 session-manager 风险条目追加结论："经验证，source-registry 是独立的内存 store，不依赖 session-manager。当前生产者为 `registerWecomSourceSnapshot()`，当前消费者为 calendar/mcp tool；session-manager 无集成逻辑缺失。风险已消除。"
- [ ] 如有其他已消除的风险，同样标记为 resolved

**Exit Criteria:**

- proposal.md、design.md、tasks.md 关于 session-manager 集成的描述一致且与代码匹配

### Task S3: 补充 source-registry 单元测试 [backend/wecom-extension]

**目标:** 为 247 行的 source-registry 模块补充核心路径测试。

**Files:**

- Create: `extensions/wecom/src/runtime/source-registry.test.ts`

测试场景（≥10 cases）：

- [ ] `registerWecomSourceSnapshot` 基本注册 + `resolveWecomSourceSnapshot` 按 sessionKey 查找
- [ ] 按 sessionId 查找
- [ ] 按 peerKind + peerId 查找（conversation 维度）
- [ ] 多维 fallback 优先级：accountId-scoped > loose-key > conversation
- [ ] 空 / undefined / 空字符串参数的 normalize 行为
- [ ] Session snapshot LRU 淘汰：注册超过 session index cap 后旧条目被移除（messageFacts 的 messageId 索引当前无公开读取 API，不单独断言）
- [ ] `clearWecomSourceAccount` 清除指定 account 的所有索引
- [ ] `isWecomBotWsSource` / `isWecomAgentSource` 辅助判断
- [ ] 跨 account 隔离：account A 的 snapshot 不会被 account B 的查询命中

**Exit Criteria:**

- `pnpm test -- extensions/wecom/src/runtime/source-registry.test.ts` 通过
- 覆盖 register / resolve / clear / normalize / LRU 五个核心行为

### Task S4: 补充 context-store 单元测试 [backend/wecom-extension]

**目标:** 为 265 行的 context-store 模块补充核心路径测试。

**Files:**

- Create: `extensions/wecom/src/context-store.test.ts`

测试场景（≥8 cases）：

- [ ] `setPeerContext` 基本存储 + `getPeerContextToken` 读取
- [ ] `getPeerContextByToken` 反向查找
- [ ] `getAccountIdByPeer` 反向查找
- [ ] `getRecentPeerForAccount` TTL 过期过滤（超过 maxAgeMs 的不返回）
- [ ] `hasActiveSession` 活跃 vs 过期判断
- [ ] `clearPeerContexts` 清除所有索引 + 磁盘文件
- [ ] token 更新时旧 token 从反向索引移除
- [ ] `restorePeerContexts` 从磁盘恢复（使用隔离的临时状态目录）

注意：磁盘 I/O 操作必须使用隔离的临时状态目录，避免写入真实用户状态文件。

**Exit Criteria:**

- `pnpm test -- extensions/wecom/src/context-store.test.ts` 通过
- 覆盖 set / get / reverse-lookup / TTL / clear / persist / restore 七个核心行为

### Task S5: 补齐自研模块终态错误与业务错误覆盖 [backend/wecom-extension]

**目标:** 为 5 个自研模块补充当前未覆盖的错误终态测试。已有的 retry 恢复测试（各模块最后一个 case）不需要修改。

**Files:**

- Modify: `extensions/wecom/src/capability/contact/contact.test.ts`
- Modify: `extensions/wecom/src/capability/meeting/meeting.test.ts`
- Modify: `extensions/wecom/src/capability/todo/todo.test.ts`
- Modify: `extensions/wecom/src/capability/approval/approval.test.ts`
- Modify: `extensions/wecom/src/capability/external-contact/external-contact.test.ts`

每模块补充（与已有 retry 恢复测试互补，不重复）：

- [ ] **业务错误码**：mock 返回 `{ errcode: 40001, errmsg: "invalid credential" }`，验证 tool 返回 `isError: true` 且错误消息包含 errcode 和 errmsg
- [ ] **空结果集**：mock 返回有效响应但数据为空列表/null，验证不崩溃且返回合理提示
- [ ] **重试耗尽终态**：mock 连续 3 次 fetch 均抛异常（区别于已有的"前 2 次失败第 3 次成功"），验证最终抛出错误且包含重试次数信息

**Exit Criteria:**

- 每模块新增 3 个用例，总数从当前（4-7）增加到（7-10）
- `pnpm test -- extensions/wecom` 全部通过（含已有测试）
- 新增用例的断言验证了 `isError` 标记和错误消息内容

### Task S6: 验证与收口 [verification]

**目标:** 确认所有补充测试不引入新的类型错误或回归。

- [ ] 运行 `pnpm tsgo` — 新增测试文件零 TS 错误（主 plan Task 2 修复的已有错误不在此范围）
- [ ] 运行 `pnpm test -- extensions/wecom` — 全部通过
- [ ] 确认新增测试文件在 `vitest.config.ts` 中不需要额外配置（遵循 colocated `*.test.ts` 约定）

**Exit Criteria:**

- 新增测试与已有测试共存，无冲突

## 6. 建议执行批次

### Batch α（纯文档，可与主 plan Batch A 并行）

- Task S1
- Task S2

### Batch β（核心测试，可与主 plan Batch B 并行）

- Task S3
- Task S4

### Batch γ（增量测试，依赖主 plan Task 2 的类型修复先完成）

- Task S5
- Task S6

## 7. 与主 plan 的关系

| 主 plan Task          | 本 plan Task | 关系                                                                                  |
| --------------------- | ------------ | ------------------------------------------------------------------------------------- |
| Task 1 (回滚完成状态) | S1, S2       | 独立，可并行                                                                          |
| Task 2 (修复 TS 类型) | S5           | S5 依赖 Task 2 先修复 `setTimeout` 类型断言，否则新增错误路径测试会继承同样的 TS 错误 |
| Task 3-5 (前端修复)   | —            | 无关                                                                                  |
| Task 7 (验证收口)     | S6           | 可合并到同一轮验证                                                                    |

## 8. 不做的事情（显式排除）

- **Calendar 模块测试**：13 method × ~1200 行，ROI 低于 source-registry/context-store。Calendar 是上游代码且改动概率低，延后到有功能变更时再补。
- **MCP 模块测试**：factory + schema 清洗逻辑需要 mock 完整 RPC transport，工作量大。延后。
- **Spec 场景增补**（分页一致性、数据结构定义、错误边界场景）：属于 spec 质量提升，不影响当前实现的正确性。留作后续 OpenSpec change 的改进方向。
- **重试 pattern 提取**：design D4 已标记 Phase 2+，不在本轮整改范围。

## Context

WeCom 插件基于 YanHaidao/wecom fork，当前仅覆盖消息收发和文档/表格（4500+ 行，40+ action）。上游 v2.3.27 新增 calendar/mcp 模块为纯新增文件，零冲突可直接复制。通讯录/会议/待办/审批/客户联系需自研，参考 wecom-cli 源码和企微官方 API 文档。

现有基础设施：

- `getAccessToken(agent)` — per-agent token 缓存（`transport/agent-api/core.ts:87`）
- `wecomFetch()` — 统一 HTTP 层，含代理+超时（`http.ts:63`）
- `postWecomDocApi()` — 3 次重试模式（`doc/client.ts:157-189`）
- `resolveWecomEgressProxyUrlFromNetwork()` — 出口代理（`config/network.ts:4`）
- `resolveAgentAccountOrUndefined()` — 账户解析（`capability/bot/fallback-delivery.ts:27`）

每个新模块遵循 `capability/doc/` 四件套模式：client.ts / schema.ts / tool.ts / types.ts / index.ts。

## Goals / Non-Goals

**Goals:**

- P0：零冲突同步上游 calendar + mcp + source-registry + context-store
- P1：自研 contact/meeting/todo 三模块，使 Agent 能代用户查通讯录、排会议、建待办
- P2：自研 approval/external-contact，覆盖审批流程和 CRM 场景
- 所有模块复用现有凭证/HTTP/重试基础设施，模块间零依赖
- 保持渠道与 Tool 松耦合，预留将来拆分为独立 wecom-tools 插件的路径

**Non-Goals:**

- 不重构现有 doc 模块
- 不同步上游对已有文件的变更（doc/bot/agent 等）
- 不拆分渠道与 Tool 为独立插件（本期保持现有耦合）
- 不实现 OAuth2 手动授权获取敏感字段（通讯录隐私限制留给后续）

## Decisions

### D1：自研 vs 复用 wecom-cli

**选择：自研，参考 wecom-cli 源码**

替代方案：直接集成 wecom-cli 作为 AI Skill。

理由：自建应用身份 API scope 远大于机器人身份（wecom-cli 无法调用审批、完整通讯录等）；多账户矩阵支持；上下文感知（知道谁在问）；部署无额外依赖。wecom-cli 的 SKILL.md 文件是最佳 schema 参考。

### D2：渠道与 Tool 暂不拆分

**选择：保持在 extensions/wecom/ 内，但松耦合**

替代方案：立即拆分为 extensions/wecom-tools/。

理由：减少本期工作量。新模块通过 `getAccessToken(agent)` 间接获取凭证，不直接读取渠道配置结构。将来拆分只需：新建 extensions/wecom-tools/ → 移入 capability/ → 替换凭证来源。

### D3：上游同步策略 — 新增复制，已有不碰

**选择：calendar/mcp/source-registry/context-store 直接复制，doc/bot/agent 不同步**

理由：纯新增文件零冲突；我们对 doc 等已有文件改动量大（2200-3300 行差异），合并收益不抵风险。

### D4：重试模式 — 复制 pattern 而非提取共享函数

**选择：每个新 client 复制 doc/client.ts 的 3 次重试 pattern**

替代方案：提取为共享 `requestWithRetry()` 函数。

理由：本期新增模块数量有限，复制 pattern 更快且无回归风险。TODO 标记为 Phase 2+ 共享化。

### D5：Tool schema — oneOf 判别联合 + action switch 分发

沿用 doc/schema.ts 和 doc/tool.ts 的模式：schema 用 JSON Schema oneOf 按 action 字段判别，tool.ts 用 switch 分发到 client 方法。

## Risks / Trade-offs

- **[上游 import 路径差异]** → 复制上游文件后需逐一修复 import 路径（我方目录结构与上游略有差异）。缓解：tsc --noEmit 验证。
- **[session-manager 联动]** → 上游 source-registry 在 session-manager 中有集成逻辑，我方版本缺少此逻辑。缓解：仔细对比上游 diff，只提取必要的集成点。
- **[通讯录隐私限制]** → 非通讯录同步应用无法获取头像/手机号/邮箱等敏感字段。缓解：types.ts 中标注哪些字段受限，tool 返回中明确说明。
- **[重试模式重复]** → 每个 client 复制重试逻辑，将来可能漂移。缓解：pattern 简单（10 行），TODO 标记共享化。
- **[P2 审批 API 复杂度]** → 审批模板结构复杂（嵌套控件），schema 设计难度高。缓解：P2 优先级，可按需裁剪 action 数量。

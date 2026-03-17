# OpenClaw Enhanced Fork — 企业微信集成设计方案

> Status: Draft
> Created: 2026-03-17
> Author: wangym + Claude

---

## 1. 目标与范围

### 1.1 目标

为 OpenClaw enhanced fork 构建生产级企业微信集成，覆盖三个层次：

1. **消息通道** — 稳定的 WebSocket 长连接 + 流式回复 + 多账号
2. **文档协作** — 通过 MCP Skill 操作企业微信文档和智能表格
3. **企业 API** — 审批、日程、通讯录等企业能力的 AI Agent 化

### 1.2 不在范围内

- 企业微信应用市场上架（需要企业资质）
- 企业微信小程序开发
- JS-SDK 前端集成（需要 H5 页面部署）
- 微信客服（外部微信用户接入，后续可从 openclaw-china/wecom-kf 移植）

---

## 2. 技术决策

### 2.1 基座选择：Fork @yanhaidao/wecom

**决策：** Fork `@yanhaidao/wecom` (v2.3.160) 到 `extensions/wecom/`，作为企业微信频道的唯一实现。

**理由：**

| 维度           | @yanhaidao                    | 官方 @wecom      | 自研         |
| -------------- | ----------------------------- | ---------------- | ------------ |
| 源码可控       | ✅ TypeScript 完整源码        | ❌ 黑盒 npm 包   | ✅           |
| 消息管道可扩展 | ✅ 可嵌入配额/去重/Agent路由  | ❌ 封闭          | ✅           |
| 生产验证       | ✅ 腾讯云/火山引擎/天翼云采用 | ✅ 腾讯官方      | ❌           |
| 开发成本       | 低（fork + 增强）             | 中（受限于黑盒） | 高（3-6 周） |
| 架构质量       | ✅ 4 层分离 + Zod + 审计日志  | 中               | 取决于投入   |
| 多账号         | ✅                            | ❌               | 需自建       |
| 动态 Agent     | ✅                            | ❌               | 需自建       |
| 文档 API       | ✅ 双向读写                   | ✅ MCP Skill     | 需自建       |

**否决官方插件为基座的关键原因：** 官方插件不支持多账号、动态 Agent、消息去重、配额追踪、Agent API 主动推送——这些企业级核心功能无法通过伴生插件注入，因为它们需要嵌入消息处理管道内部，而官方插件是不可修改的黑盒。

### 2.2 可行性验证结论

| 检查项                     | 状态 | 说明                                           |
| -------------------------- | ---- | ---------------------------------------------- |
| OpenClaw SDK 兼容性        | ✅   | fork v2026.3.3 >= 要求 v2026.2.24              |
| 构建系统兼容性             | ✅   | tsconfig 兼容（ES2022→es2023，NodeNext）       |
| @wecom/aibot-node-sdk 版本 | ✅   | ^1.0.0 与 ^1.0.2 兼容                          |
| 频道 ID                    | ✅   | Fork 替换官方插件，保持 "wecom"                |
| MCP 配置获取               | 🟡   | 需添加 ~50 行代码，复刻 `aibot_get_mcp_config` |
| Skill 目录注册             | 🟡   | 需在 openclaw.plugin.json 添加 `"skills"` 字段 |
| 模块层兼容性               | ✅   | @sunnoy 工具模块数据结构兼容                   |

**零致命阻碍。额外工作量约 4-5 小时。**

---

## 3. 架构设计

### 3.1 整体架构

```
extensions/wecom/                          ← Fork @yanhaidao/wecom + 增强
├── src/
│   ├── transport/                         ← 原有：消息传输层
│   │   ├── bot-ws/                        ←   WebSocket 长连接（SDK adapter）
│   │   ├── bot-webhook/                   ←   HTTP 回调入站
│   │   └── agent-api/                     ←   Agent API 主动推送
│   ├── capability/                        ← 原有：能力层
│   │   ├── bot/                           ←   Bot 流式处理 + 交付
│   │   └── doc/                           ←   文档 API 客户端 + Tool
│   ├── config/                            ← 原有：配置层（Zod schema）
│   ├── crypto/                            ← 原有：AES/签名
│   ├── observability/                     ← 原有：审计日志 + 状态注册
│   ├── dynamic-agent.ts                   ← 原有：动态 Agent 隔离
│   │
│   ├── enhanced/                          ← 🆕 增强层（移植 + 自研）
│   │   ├── mcp-config.ts                  ←   MCP 配置获取（移植自官方插件）
│   │   ├── quota-tracker.ts              ←   配额追踪（移植自 @sunnoy）
│   │   ├── reqid-store.ts                ←   持久化去重（移植自 @sunnoy）
│   │   ├── reasoning-visibility.ts       ←   推理展示策略（移植自 @dingxiang-me）
│   │   └── pending-reply.ts              ←   可靠投递重试（移植自 @dingxiang-me）
│   │
│   └── types/                             ← 原有：类型定义
│
├── skills/                                ← 🆕 MCP Skill 目录
│   ├── wecom-doc/                         ←   文档+智能表格（移植官方 Skill 定义）
│   │   ├── SKILL.md
│   │   └── references/doc-api.md
│   ├── wecom-approval/                    ←   🔮 Phase 3：审批流程
│   │   └── SKILL.md
│   └── wecom-calendar/                    ←   🔮 Phase 3：日程管理
│       └── SKILL.md
│
├── index.ts                               ← 插件入口
├── openclaw.plugin.json                   ← 插件清单（含 skills 声明）
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### 3.2 层次职责

```
┌──────────────────────────────────────────────────┐
│  Skill 层（MCP 协议，AI Agent 可调用）              │
│  wecom-doc / wecom-approval / wecom-calendar      │
│  → 通过 mcporter 桥接 MCP Server                  │
│  → 每个 Skill 是独立的 SKILL.md 文件               │
├──────────────────────────────────────────────────┤
│  增强层（移植的高价值通用模块）                       │
│  quota-tracker / reqid-store / reasoning-visibility│
│  → 纯函数或轻量类，零耦合                           │
│  → 通过适配器桥接到 @yanhaidao 的运行时              │
├──────────────────────────────────────────────────┤
│  能力层（@yanhaidao 原有）                          │
│  Bot 流式处理 / 文档 API / Agent 交付               │
│  → 消息路由、流式回复、媒体处理                      │
├──────────────────────────────────────────────────┤
│  传输层（@yanhaidao 原有）                          │
│  WebSocket / HTTP Callback / Agent API             │
│  → 连接管理、心跳、重连、加解密                      │
├──────────────────────────────────────────────────┤
│  基础设施层（@yanhaidao 原有）                       │
│  Config（Zod）/ Crypto / Observability / Types     │
│  → 配置验证、审计日志、健康状态机                     │
└──────────────────────────────────────────────────┘
```

### 3.3 数据流

**入站消息流：**

```
企业微信服务器
  ↓ WebSocket (wss://openws.work.weixin.qq.com)
transport/bot-ws/sdk-adapter.ts  → 连接管理 + 心跳
  ↓
enhanced/reqid-store.ts          → 🆕 消息去重（reqId + msgId）
  ↓
enhanced/quota-tracker.ts        → 🆕 被动回复配额检查
  ↓
dynamic-agent.ts                 → Agent 路由（按用户/群隔离）
  ↓
OpenClaw Agent 核心              → LLM 处理
```

**出站消息流：**

```
OpenClaw Agent 核心
  ↓
enhanced/reasoning-visibility.ts → 🆕 thinking 展示策略
  ↓
capability/bot/stream-delivery.ts → 流式分块 + Markdown
  ↓
enhanced/quota-tracker.ts        → 🆕 配额计数
  ↓
transport/bot-ws (主)             → WebSocket 流式回复
  ↓ 失败时
transport/agent-api (备)          → HTTP API 回退
  ↓ 仍失败
enhanced/pending-reply.ts        → 🆕 持久化待发队列 + 定时重试
```

**MCP Skill 调用流：**

```
用户："帮我创建一个项目进度表"
  ↓
OpenClaw Agent → 匹配 wecom-doc Skill
  ↓
mcporter call wecom-doc.create_doc --args '{"doc_type":10}'
  ↓ (MCP 协议)
企业微信 MCP Server (StreamableHttp)
  ↓
返回 docid → Agent 继续操作（添加字段、写入数据）
```

---

## 4. 模块移植方案

### 4.1 移植清单

| 模块                | 来源                                   | 行数                  | 依赖             | 移植方式                      |
| ------------------- | -------------------------------------- | --------------------- | ---------------- | ----------------------------- |
| **MCP 配置获取**    | 官方插件逆向                           | ~50 行                | WSClient.reply() | 新建 `enhanced/mcp-config.ts` |
| **配额追踪**        | @sunnoy runtime-telemetry.js           | 330 行                | 零依赖           | 直接复制 + 类型化             |
| **持久化去重**      | @sunnoy reqid-store.js                 | 146 行                | fs + path        | 复制 + 注入 stateDir          |
| **推理展示策略**    | @dingxiang-me reasoning-visibility.js  | 104 行                | 零依赖           | 直接复制 + 类型化             |
| **可靠投递重试**    | @dingxiang-me pending-reply-manager.js | 143 行                | 依赖注入完备     | 复制 + 适配 store 接口        |
| **wecom-doc Skill** | 官方插件 skills/                       | SKILL.md + doc-api.md | mcporter CLI     | 复制 Skill 定义，适配配置路径 |

### 4.2 MCP 配置获取（关键新增）

**实现思路：** 在 WebSocket 认证成功后，发送 `aibot_get_mcp_config` 命令获取 MCP Server URL，存入 `~/.openclaw/wecomConfig/config.json`。

```typescript
// enhanced/mcp-config.ts（伪代码）
import { generateReqId, type WSClient } from "@wecom/aibot-node-sdk";

const MCP_GET_CONFIG_CMD = "aibot_get_mcp_config";
const MCP_TIMEOUT_MS = 15_000;

export async function fetchMcpConfig(client: WSClient): Promise<McpConfig> {
  const reqId = generateReqId("mcp_config");
  const response = await withTimeout(
    client.reply({ headers: { req_id: reqId } }, { biz_type: "doc" }, MCP_GET_CONFIG_CMD),
    MCP_TIMEOUT_MS,
  );
  if (response.errcode && response.errcode !== 0) {
    throw new Error(`MCP config failed: errcode=${response.errcode}`);
  }
  return { url: response.body.url, type: response.body.type, isAuthed: response.body.is_authed };
}

export async function fetchAndSaveMcpConfig(client: WSClient, accountId: string): Promise<void> {
  const config = await fetchMcpConfig(client);
  // 写入 ~/.openclaw/wecomConfig/config.json
  // wecom-doc Skill 从此文件读取 MCP Server URL
}
```

**集成点：** `transport/bot-ws/sdk-adapter.ts` 的 `onAuthenticated` 回调中调用 `fetchAndSaveMcpConfig()`。

### 4.3 配额追踪适配

@sunnoy 的 `runtime-telemetry.js` 是零依赖的纯函数模块，核心接口：

```typescript
// 被动回复配额（24h 窗口，30 会话上限）
forecastReplyQuota(chatState): "ok" | "nearLimit" | "exhausted"

// 主动发送配额（每日 10 次上限）
forecastActiveSendQuota(chatState): "ok" | "nearLimit" | "exhausted"
```

**适配方式：** 在 @yanhaidao 的 `stream-orchestrator.ts`（入站处理）和 `stream-delivery.ts`（出站处理）中插入配额检查调用。chat ID 映射：@yanhaidao 的 `peerId` = @sunnoy 的 `chatId`。

### 4.4 wecom-doc Skill 适配

官方插件的 `skills/wecom-doc/SKILL.md` 本身是纯 Markdown 指令文件，不包含可执行代码。它依赖：

1. `mcporter` CLI 工具（npm 全局安装）
2. `~/.openclaw/wecomConfig/config.json`（MCP Server URL）

适配工作：

- 复制 `SKILL.md` 和 `references/doc-api.md` 到 `extensions/wecom/skills/wecom-doc/`
- 修改 SKILL.md 中的配置检测路径（如果有硬编码）
- 确保我们的 MCP 配置获取（4.2）写入的文件路径与 Skill 期望的一致

---

## 5. 企业 API 扩展架构（MCP Skill 模式）

### 5.1 扩展模式

每个企业微信 API 域 = 一个独立的 MCP Server + Skill：

```
┌──────────────┐     MCP 协议      ┌──────────────────┐
│  wecom-doc   │ ←── mcporter ──→  │  企业微信文档 API  │
│  SKILL.md    │                   │  (StreamableHttp) │
└──────────────┘                   └──────────────────┘

┌──────────────┐     MCP 协议      ┌──────────────────┐
│ wecom-approval│ ←── mcporter ──→  │  企业微信审批 API  │
│  SKILL.md    │                   │  (自建 MCP Server)│
└──────────────┘                   └──────────────────┘
```

### 5.2 文档 + 智能表格（Phase 2，移植官方 Skill）

**来源：** 官方插件 `skills/wecom-doc/`

**已有能力：**

- 文档创建（doc_type=3）+ 全量编辑（Markdown）
- 智能表格创建（doc_type=10）+ 子表/字段/记录 CRUD
- 16 种字段类型完整支持
- MCP 配置自动检测 + 用户引导授权

**MCP Server 来源：** 企业微信官方提供（通过 `aibot_get_mcp_config` 下发 URL），无需自建。

### 5.3 审批流程（Phase 3，自建 MCP Server）

**企业微信 API：**

- `POST /oa/applyevent` — 发起审批
- `POST /oa/getapprovalinfo` — 查询审批单
- `POST /oa/getapprovaldetail` — 获取审批详情
- 回调事件：审批状态变更通知

**Skill 设计思路：**

```markdown
# wecom-approval Skill

意图触发：用户提到"审批"、"请假"、"报销"、"提交申请"
工具：

- create_approval(template_id, apply_data) → 发起审批
- query_approval(sp_no) → 查询审批状态
- list_approvals(start_time, end_time, status) → 审批列表
```

**MCP Server：** 需自建（Node.js HTTP 服务，调用企业微信审批 API），部署在 OpenClaw 网关同机。

### 5.4 日程管理（Phase 3，自建 MCP Server）

**企业微信 API：**

- `POST /oa/schedule/add` — 创建日程
- `POST /oa/schedule/get` — 查询日程
- `POST /oa/schedule/update` — 更新日程
- `POST /oa/schedule/del` — 删除日程

**Skill 设计思路：**

```markdown
# wecom-calendar Skill

意图触发：用户提到"日程"、"会议"、"安排"、"提醒"
工具：

- create_schedule(summary, start, end, attendees) → 创建日程
- query_schedule(start, end) → 查询时间段日程
- update_schedule(id, changes) → 修改日程
```

### 5.5 通讯录查询（Phase 3，可作为 Agent Tool）

通讯录查询不需要 MCP Skill（太轻量），直接注册为 Agent Tool：

```typescript
api.registerTool({
  name: "wecom_lookup_user",
  description: "查询企业微信通讯录中的成员信息",
  parameters: { query: { type: "string" } },
  execute: async ({ query }) => {
    // 调用 /cgi-bin/user/simplelist 或 /cgi-bin/user/get
  },
});
```

---

## 6. 配置结构

### 6.1 完整配置 Schema

```yaml
channels:
  wecom:
    enabled: true

    # ── Bot 长连接（主链路） ──
    botId: "xxx"
    secret: "xxx"
    wsUrl: "wss://openws.work.weixin.qq.com" # 可选

    # ── 自建应用（主动推送） ──
    agent:
      corpId: "xxx"
      corpSecret: "xxx"
      agentId: 1000002

    # ── 访问控制 ──
    dmPolicy: "open" # pairing | open | allowlist | disabled
    allowFrom: []
    groupPolicy: "open" # open | allowlist | disabled
    groupAllowFrom: []

    # ── 多账号（可选） ──
    accounts:
      sales:
        botId: "xxx"
        secret: "xxx"
      ops:
        botId: "xxx"
        secret: "xxx"

    # ── 🆕 增强配置 ──
    enhanced:
      quotaTracking: true # 配额追踪
      reqIdPersistence: true # 持久化消息去重
      reasoningMode: "separate" # separate | append | hidden
      pendingReply:
        enabled: true
        maxRetries: 3
        sweepIntervalMs: 15000
```

### 6.2 与现有配置的兼容性

Fork 保持 `channels.wecom.*` 路径不变，所有现有企业微信配置无需迁移。增强功能通过 `enhanced` 子键隔离，默认值保持向后兼容。

---

## 7. 实施阶段

### Phase 1：基座搭建（Fork + 基础验证）

**目标：** Fork @yanhaidao/wecom，确认基础消息通道正常工作。

**工作内容：**

1. Fork `@yanhaidao/wecom` 到 `extensions/wecom/`
2. 调整 `package.json`（名称、版本、peer 依赖）
3. 调整 `tsconfig.json` 对齐 fork 主仓库
4. 验证 `pnpm build` 通过
5. 验证 `pnpm test`（@yanhaidao 自带 20+ 测试文件）
6. 本地安装测试：基础对话 + 流式回复

**预估：1-2 天**

### Phase 2：增强层集成

**目标：** 移植高价值模块 + MCP Skill。

**工作内容：**

| 任务                           | 来源          | 预估                      |
| ------------------------------ | ------------- | ------------------------- |
| 实现 MCP 配置获取              | 官方插件逆向  | 2 小时                    |
| 移植配额追踪                   | @sunnoy       | 2 小时（含 TS 化 + 适配） |
| 移植持久化去重                 | @sunnoy       | 2 小时                    |
| 移植推理展示策略               | @dingxiang-me | 1 小时                    |
| 移植可靠投递重试               | @dingxiang-me | 2 小时                    |
| 移植 wecom-doc Skill           | 官方插件      | 1 小时                    |
| 添加 skills 目录到 plugin.json | —             | 0.5 小时                  |
| 增强层集成测试                 | —             | 3 小时                    |

**预估：2-3 天**

### Phase 3：企业 API 扩展（按需）

**目标：** 自建 MCP Server 暴露审批/日程/通讯录能力。

**工作内容：**

1. 自建 MCP Server 框架（基于 StreamableHttp 协议）
2. 审批 Skill（wecom-approval）
3. 日程 Skill（wecom-calendar）
4. 通讯录 Tool（registerTool）

**预估：每个 API 域 2-3 天，按业务优先级排序**

---

## 8. 上游同步策略

### 8.1 Fork 管理

```bash
# 初始 fork
cd extensions/wecom
git remote add yanhaidao https://github.com/YanHaidao/wecom.git

# 定期检查上游更新
git fetch yanhaidao
git log yanhaidao/main --oneline -20

# 选择性 cherry-pick bugfix
git cherry-pick <commit-hash>
```

### 8.2 修改原则

为降低合并冲突风险：

1. **增强功能全部放在 `src/enhanced/` 目录** — 上游不会触碰这个目录
2. **对原有文件的修改限制在最小插入点** — 通常是 1-2 行 import + 函数调用
3. **不删除/重命名原有文件** — 保持目录结构与上游一致
4. **用 `[enhanced]` 前缀标记 commit** — 方便区分 fork 自有改动和 cherry-pick

### 8.3 何时同步

- @wecom/aibot-node-sdk 大版本更新时
- @yanhaidao 修复了我们也遇到的 bug 时
- 企业微信 API 协议变更时

不需要每个版本都同步——核心传输层已经稳定。

---

## 9. 测试策略

### 9.1 继承 @yanhaidao 的测试

@yanhaidao 自带 20+ 测试文件，覆盖：

- 加密/解密（crypto.test.ts）
- 配置解析（config/\*.test.ts）
- 动态 Agent 路由（dynamic-agent.\*.test.ts）
- WebSocket 适配器（transport/bot-ws/\*.test.ts）
- 出站消息（outbound.test.ts）
- 消息监控（monitor\*.test.ts）

### 9.2 增强层测试（新增）

| 模块                    | 测试重点                                    |
| ----------------------- | ------------------------------------------- |
| mcp-config.ts           | WSClient.reply() mock + 响应解析 + 文件写入 |
| quota-tracker.ts        | 24h 窗口计算 + 边界条件 + 配额预测          |
| reqid-store.ts          | 持久化 + TTL 过期 + 内存限制                |
| reasoning-visibility.ts | 3 种模式 + 代码块保护 + 长度截断            |
| pending-reply.ts        | 重试逻辑 + 指数退避 + 持久化恢复            |

### 9.3 集成测试

无真实企业微信账号时，使用 mock WebSocket server 模拟企业微信行为：

- 认证流程（subscribe → ack）
- 消息回调（aibot_callback）
- 流式回复（stream 模式）
- MCP 配置获取（aibot_get_mcp_config）

---

## 10. 风险与缓解

| 风险                             | 概率 | 影响 | 缓解措施                                            |
| -------------------------------- | ---- | ---- | --------------------------------------------------- |
| @yanhaidao 停止维护              | 低   | 中   | 我们已有完整源码，可独立维护                        |
| @wecom/aibot-node-sdk 破坏性更新 | 低   | 高   | 锁定版本，仅在确认兼容后升级                        |
| 企业微信 API 协议变更            | 中   | 高   | MCP 配置自动获取可适应 URL 变化；协议变更需跟进 SDK |
| MCP Server URL 过期/失效         | 中   | 低   | Skill 已有完善的错误处理 + 用户引导重新授权         |
| 移植模块与原有代码冲突           | 低   | 中   | 增强层隔离在独立目录，通过适配器桥接                |
| 企业微信限流/封号                | 低   | 高   | 配额追踪主动预警 + 节流                             |

---

## 11. vendor 目录参考项目

以下项目已克隆到 `vendor/`，作为代码参考和模块提取来源：

```
vendor/
├── yanhaidao-wecom/          # 基座来源（Fork 对象）
├── openclaw-plugin-wecom/    # @sunnoy — 配额追踪、持久化去重来源
├── OpenClaw-Wechat/          # @dingxiang-me — 推理展示、可靠投递来源
├── openclaw-china/           # 多平台参考 + wecom-kf 客服（未来移植）
└── wecom-official/           # 官方插件 — MCP Skill 定义 + 配置获取逆向
    ├── package/              #   插件 npm 包
    └── wecom-official-sdk/   #   @wecom/aibot-node-sdk
```

---

## 12. 成功标准

### Phase 1 完成标准

- [ ] `extensions/wecom/` 目录存在，`pnpm build` 通过
- [ ] 所有原有测试通过（`pnpm test`）
- [ ] 本地网关启动后可与企业微信机器人对话
- [ ] 流式回复正常工作

### Phase 2 完成标准

- [ ] MCP 配置自动获取并持久化
- [ ] wecom-doc Skill 可操作文档和智能表格
- [ ] 配额追踪在日志中输出预警
- [ ] 消息去重在重连后仍有效
- [ ] 推理展示 `separate` 模式正常折叠
- [ ] 增强层测试全部通过

### Phase 3 完成标准（按域）

- [ ] 审批 Skill 可发起/查询审批
- [ ] 日程 Skill 可创建/查询日程
- [ ] 通讯录 Tool 可查询成员信息

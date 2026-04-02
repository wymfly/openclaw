# WeCom 插件 API 能力扩展设计

> 日期: 2026-04-01
> 状态: approved
> 范围: extensions/wecom

## 1. 目标

将 WeCom 插件的 API 能力从当前的「消息 + 文档/表格」扩展到覆盖企微主要业务品类，使 Agent 能代用户操作企微全域数据。

## 2. 背景与调研

### 2.1 当前能力现状

插件基于 [YanHaidao/wecom](https://github.com/YanHaidao/wecom) fork，当前实现：

- **消息收发**：Bot WS + Agent 双模融合，多账户矩阵隔离，流式响应
- **文档 CRUD**：40+ action，完整的文档/表格/智能表格/收集表操作（4500+ 行）
- **增强特性**（fork 新增）：配额追踪、持久化去重、MCP config fetch、推理可见性

### 2.2 外部项目调研

| 项目                                                                                  | 定位                 | Stars | 覆盖范围                                       | 评估                                   |
| ------------------------------------------------------------------------------------- | -------------------- | ----- | ---------------------------------------------- | -------------------------------------- |
| [WecomTeam/wecom-cli](https://github.com/WecomTeam/wecom-cli)                         | 官方 CLI + AI Skills | 1.3k  | 7 品类（消息/文档/表格/通讯录/日程/会议/待办） | Rust+TS，机器人身份 scope 有限         |
| [WecomTeam/wecom-openclaw-plugin](https://github.com/WecomTeam/wecom-openclaw-plugin) | 官方 OpenClaw 插件   | 295   | 消息 + 文档/表格/日历                          | 无双模、无多账户，架构远弱于 YanHaidao |
| [NotFound403/wecom-sdk](https://github.com/NotFound403/wecom-sdk)                     | Java SDK             | —     | 280+ 接口                                      | 好的 API 覆盖参考，语言不同            |
| YanHaidao/wecom (上游 v2.3.27)                                                        | 我们的上游           | 248   | 新增 calendar + mcp capability                 | 可直接同步                             |

### 2.3 上游差异分析 (v2.3.27 vs 我们的 v2026.3.17)

**纯新增文件（零冲突，可直接复制）：**

| 文件/目录                    | 行数              | 说明                                     |
| ---------------------------- | ----------------- | ---------------------------------------- |
| `capability/calendar/`       | 1961 行（5 文件） | 日历能力：client/schema/tool/types/index |
| `capability/mcp/`            | 685 行（4 文件）  | MCP 桥接：index/schema/tool/transport    |
| `runtime/source-registry.ts` | 244 行            | calendar 和 mcp 共同依赖                 |
| `context-store.ts`           | 264 行            | Bot WS 主动推送上下文                    |
| `transport/bot-ws/media.ts`  | 新文件            | Bot WS 媒体发送                          |

**已有文件变更（不同步）：**

| 文件              | 差异量       | 决策                       |
| ----------------- | ------------ | -------------------------- |
| `doc/*.ts`        | 2200-3300 行 | 不碰，我们的改动量太大     |
| `bot/stream-*.ts` | 64-115 行    | 暂不同步，按需 cherry-pick |
| `agent/*.ts`      | 3-10 行      | 微量差异，暂忽略           |

## 3. 决策记录

| 决策点               | 结论                                 | 理由                                                                                      |
| -------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| 自研 vs wecom-cli    | **自研，参考 wecom-cli 源码**        | 自建应用身份 API scope 更大；上下文感知（知道谁在问）；多账户支持；部署无额外依赖         |
| 渠道与 Tool 是否分离 | **暂不拆分**，但保持松耦合           | 减少当前工作量；新模块通过统一 `getAccessToken(agent)` 获取凭证，将来拆分只需替换凭证来源 |
| 上游同步策略         | **新增模块直接复制，已有模块不同步** | calendar/mcp/source-registry 是纯新增零冲突；doc 等已大幅修改不值得合并                   |

### 3.1 自研 vs wecom-cli 详细对比

增强插件在认证/多账户（★5 vs ★2）、API 权限范围（★5 vs ★3）、上下文感知（★5 vs ★1）、部署简便性（★5 vs ★2）上全面优于 wecom-cli skill。wecom-cli 仅在零开发成本（★5）和跨渠道可用性（★4）上有优势。

核心瓶颈：wecom-cli 使用机器人身份，无法调用审批、完整通讯录、客户联系等自建应用独有 API。

### 3.2 渠道与 Tool 分离的预留设计

当前耦合点：Tool 注册在渠道插件的 `register()` 中，凭证绑定在 `channels.wecom.accounts.*`。

将来拆分路径：

1. 新建 `extensions/wecom-tools/` 独立插件
2. 移入所有 capability 模块
3. 替换凭证获取为独立配置（`plugins.wecom-tools.corpId/corpSecret`）
4. 渠道插件可选依赖 wecom-tools

## 4. 能力规划与优先级

| 优先级 | 模块                         | 来源                 | 预估代码量       | 核心 API                        |
| ------ | ---------------------------- | -------------------- | ---------------- | ------------------------------- |
| **P0** | calendar（日历/日程）        | 上游同步             | ~1960 行（已有） | 日程 CRUD、空闲查询、参与者管理 |
| **P0** | mcp（MCP 桥接）              | 上游同步             | ~685 行（已有）  | MCP tool 代理调用               |
| **P0** | source-registry              | 上游同步             | ~244 行（已有）  | calendar/mcp 的必要依赖         |
| **P1** | contact（通讯录）            | 自研，参考 wecom-cli | ~800-1200 行     | 成员查询、部门树、搜索          |
| **P1** | meeting（会议）              | 自研，参考 wecom-cli | ~600-900 行      | 会议预约/取消/查询、参与者      |
| **P1** | todo（待办）                 | 自研，参考 wecom-cli | ~500-700 行      | 任务 CRUD、状态管理、提醒       |
| **P2** | approval（审批）             | 自研                 | ~1000-1500 行    | 发起/查询审批、模板管理         |
| **P2** | external-contact（客户联系） | 自研                 | ~800-1000 行     | 外部联系人、客户群管理          |

## 5. 技术架构

### 5.1 模块结构

每个新模块遵循现有 `capability/doc/` 的四件套模式：

```
src/capability/<module>/
├── client.ts    — API 调用层（复用 getAccessToken + wecomFetch + 3 次重试）
├── schema.ts    — JSON Schema（oneOf 判别联合，action 分发）
├── tool.ts      — Tool 注册（export registerWecom<Module>Tools(api)）
├── types.ts     — TypeScript 类型定义
└── index.ts     — 导出
```

### 5.2 注册方式

在 `extensions/wecom/index.ts` 的 `register()` 中追加：

```typescript
// P0 — 上游同步
registerWecomCalendarTools(api);
api.registerTool(createWeComMcpToolFactory(), { name: "wecom_mcp" });

// P1 — 自研
registerWecomContactTools(api);
registerWecomMeetingTools(api);
registerWecomTodoTools(api);

// P2 — 按需
registerWecomApprovalTools(api);
registerWecomExternalContactTools(api);
```

### 5.3 共享基础设施

所有模块复用：

- `getAccessToken(agent)` — 统一 token 管理（per-agent 缓存，位于 `transport/agent-api/core.ts`）
- `wecomFetch(url, options, { proxyUrl, timeoutMs })` — 统一 HTTP 层（代理、超时，位于 `http.ts:63-113`，**本身无重试**）
- `resolveWecomEgressProxyUrlFromNetwork(agent.network)` — 出口代理
- `resolveAgentAccountOrUndefined()` — 账户解析（位于 `capability/bot/fallback-delivery.ts:27`）

### 5.4 统一重试与错误处理规范

> **现状说明**: `wecomFetch` 本身不含重试逻辑，重试在 `doc/client.ts:170-189` 的 `postWecomDocApi` 内实现。新模块必须复用相同模式，避免行为漂移。

**每个新 capability 模块的 client 必须实现**:

```typescript
// 统一重试模式（从 doc/client.ts 提取的 pattern）
async function postWecomApi(params: {
  path: string;
  actionLabel: string;
  agent: ResolvedAgentAccount;
  body: Record<string, unknown>;
}): Promise<any> {
  const token = await getAccessToken(agent);
  const url = `https://qyapi.weixin.qq.com${path}?access_token=${encodeURIComponent(token)}`;
  const proxyUrl = resolveWecomEgressProxyUrlFromNetwork(agent.network);

  let lastErr: any;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await wecomFetch(url, { method: "POST", ... }, { proxyUrl, timeoutMs: 15_000 });
      return await parseJsonResponse(res, actionLabel);
    } catch (err) {
      lastErr = err;
      if (attempt < 3) await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw lastErr;
}
```

**可重试条件**: 网络超时、HTTP 5xx、企微 errcode `-1`（系统繁忙）。
**不可重试**: HTTP 4xx、企微 errcode 非 `-1`（如权限不足 `60011`、参数错误 `40035`）。
**幂等要求**: GET 类查询天然幂等；POST 写操作由企微 API 自身保证幂等（如重复创建会议返回已有 meetingid）。

> **TODO (Phase 2+)**: 考虑将重试逻辑提取为共享 `requestWithRetry()` 函数，供所有 capability 模块复用，而非在每个 client 中重复实现。

### 5.5 松耦合约束

- 凭证获取通过 `getAccessToken(agent)` 间接引用，不直接读取渠道配置结构
- 模块间**零依赖** — contact 不依赖 calendar，calendar 不依赖 doc
- 每个模块独立注册、独立可测试
- **将来拆分时的稳定接口**（当前为 pattern 约定，将来可提取为 interface）:
  - `TokenProvider`: `getAccessToken(agent) → string`
  - `AccountResolver`: `resolveAgentAccountOrUndefined(api, accountId?) → ResolvedAgentAccount`
  - `SourceGate`: `isWecomAgentSource(ctx) → boolean`（判断当前会话是否来自 Agent 模式）

## 6. 实施路径

```
Phase 1 (P0)：上游同步
  ├─ 复制新增文件：
  │   ├─ src/capability/calendar/ (client.ts, schema.ts, tool.ts, types.ts, index.ts)
  │   ├─ src/capability/mcp/ (index.ts, schema.ts, tool.ts, transport.ts)
  │   ├─ src/runtime/source-registry.ts
  │   └─ src/context-store.ts
  ├─ 必须联动修改的已有文件：
  │   ├─ index.ts — 添加 registerWecomCalendarTools + createWeComMcpToolFactory 注册
  │   ├─ src/runtime/session-manager.ts — 集成 source snapshot 注册逻辑
  │   │   （上游在此文件中调用 source-registry 记录会话来源，我们的版本缺少此逻辑）
  │   └─ src/app/bootstrap.ts 或 src/app/index.ts — 如有初始化时序依赖需检查
  ├─ 修复 import 路径差异（上游 vs 我们的目录结构）
  └─ 验证编译（tsc --noEmit）+ 基本功能测试

Phase 2 (P1)：自研核心模块
  ├─ contact（通讯录）— Agent 理解"谁是谁"的基础
  ├─ meeting（会议）— 与 calendar 强关联
  └─ todo（待办）— 任务分配场景
  每个模块独立可交付，按此顺序实施。

Phase 3 (P2)：企业级扩展
  ├─ approval（审批）— 流程自动化
  └─ external-contact（客户联系）— CRM 场景
  按需求优先级决定是否实施。
```

## 7. 参考索引表

### 7.1 外部仓库参考

| 仓库                                                                                  | 用途                       | 关键文件/目录                                                                                                                                                                | 版本锚点                                     |
| ------------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| [YanHaidao/wecom](https://github.com/YanHaidao/wecom)                                 | P0 上游同步源              | `src/capability/calendar/` (6 文件), `src/capability/mcp/` (4 文件), `src/runtime/source-registry.ts`, `src/context-store.ts`, `index.ts` (注册差异)                         | v2.3.27 (2026-03-27), commit 以 clone 时为准 |
| [WecomTeam/wecom-cli](https://github.com/WecomTeam/wecom-cli)                         | P1 自研参考                | `skills/wecomcli-contact/SKILL.md`, `skills/wecomcli-meeting/SKILL.md`, `skills/wecomcli-todo/SKILL.md`, `src/cmd/call.rs` (RPC 调用模式), `src/json_rpc.rs` (JSON-RPC 封装) | 2026-03-30 开源                              |
| [WecomTeam/wecom-openclaw-plugin](https://github.com/WecomTeam/wecom-openclaw-plugin) | 架构参考（非实现参考）     | `src/`, `skills/`                                                                                                                                                            | —                                            |
| [NotFound403/wecom-sdk](https://github.com/NotFound403/wecom-sdk)                     | API 覆盖完整性参考（Java） | 按 API 分类的 `*Api.java` 文件                                                                                                                                               | v1.3.3+                                      |

### 7.2 P1 模块 wecom-cli 对照表

| 我方模块 | wecom-cli Skill 文件               | wecom-cli 关键 method                                  | 我方 action 命名（建议）                                                     |
| -------- | ---------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| contact  | `skills/wecomcli-contact/SKILL.md` | `get_userlist`, `search_by_name`                       | `list_members`, `get_member`, `list_departments`, `get_department`, `search` |
| meeting  | `skills/wecomcli-meeting/SKILL.md` | `create`, `cancel`, `get_info`, `get_user_meetinglist` | `create`, `cancel`, `get_info`, `list_user_meetings`, `add_attendees`        |
| todo     | `skills/wecomcli-todo/SKILL.md`    | `create`, `update_status`, `get_list`                  | `create`, `update`, `get`, `list`, `update_status`                           |

> **注意**: wecom-cli 的 Skill 文件描述了 tool schema 和参数约束，是最有价值的参考；实际 API 调用在 `src/cmd/call.rs` → `src/json_rpc.rs` 中通过 JSON-RPC 转发到企微 Bot WS 的 `call_tool` 方法，与我方直接 HTTP 调用 `/cgi-bin/*` 的模式不同。

### 7.3 本仓库关键文件参考

| 文件                                                             | 用途                                          |
| ---------------------------------------------------------------- | --------------------------------------------- |
| `extensions/wecom/index.ts`                                      | 插件入口，Tool 注册点                         |
| `extensions/wecom/src/capability/doc/client.ts:165-193`          | 现有重试模式（3 次，1s 退避）                 |
| `extensions/wecom/src/capability/doc/schema.ts`                  | oneOf 判别联合 schema 模式                    |
| `extensions/wecom/src/capability/doc/tool.ts`                    | action switch 分发模式                        |
| `extensions/wecom/src/transport/agent-api/core.ts`               | `getAccessToken(agent)` 凭证获取              |
| `extensions/wecom/src/http.ts:63-113`                            | `wecomFetch()` HTTP 层（无重试，仅代理+超时） |
| `extensions/wecom/src/config/index.ts`                           | `resolveWecomEgressProxyUrlFromNetwork()`     |
| `extensions/wecom/src/capability/bot/fallback-delivery.ts:27-33` | `resolveAgentAccountOrUndefined()` 账户解析   |
| `extensions/wecom/src/runtime/session-manager.ts`                | 会话管理（P0 同步时需联动修改）               |

### 7.4 企微官方 API 文档

基础文档入口: https://developer.work.weixin.qq.com/document

#### P1 — Contact（通讯录）

| 端点                           | 说明                 | 官方文档                                                               | 校验日期   |
| ------------------------------ | -------------------- | ---------------------------------------------------------------------- | ---------- |
| `GET /cgi-bin/user/get`        | 读取成员详情         | [path/90196](https://developer.work.weixin.qq.com/document/path/90196) | 2026-04-02 |
| `GET /cgi-bin/user/list`       | 获取部门成员详情     | [path/90201](https://developer.work.weixin.qq.com/document/path/90201) | 2026-04-02 |
| `GET /cgi-bin/user/simplelist` | 获取部门成员 ID 列表 | [path/90200](https://developer.work.weixin.qq.com/document/path/90200) | 2026-04-02 |
| `GET /cgi-bin/department/list` | 获取部门列表         | [path/90208](https://developer.work.weixin.qq.com/document/path/90208) | 2026-04-02 |
| `GET /cgi-bin/department/get`  | 获取部门详情         | [path/95351](https://developer.work.weixin.qq.com/document/path/95351) | 2026-04-02 |
| `GET /cgi-bin/tag/get`         | 获取标签成员         | [path/90213](https://developer.work.weixin.qq.com/document/path/90213) | 2026-04-02 |

> **安全提示**: 自 2022-06-20 起，非通讯录同步应用调用 `/cgi-bin/user/get` 不再返回头像、手机号、邮箱等敏感字段，需通过 OAuth2 手动授权获取。

#### P1 — Meeting（会议）

| 端点                                         | 说明             | 官方文档                                                               | 校验日期   |
| -------------------------------------------- | ---------------- | ---------------------------------------------------------------------- | ---------- |
| `POST /cgi-bin/meeting/create`               | 创建预约会议     | [path/93706](https://developer.work.weixin.qq.com/document/path/93706) | 2026-04-02 |
| `POST /cgi-bin/meeting/update`               | 修改会议         | [path/93710](https://developer.work.weixin.qq.com/document/path/93710) | 2026-04-02 |
| `POST /cgi-bin/meeting/cancel`               | 取消会议         | [path/93709](https://developer.work.weixin.qq.com/document/path/93709) | 2026-04-02 |
| `POST /cgi-bin/meeting/get_info`             | 获取会议详情     | [path/93708](https://developer.work.weixin.qq.com/document/path/93708) | 2026-04-02 |
| `POST /cgi-bin/meeting/get_user_meetinglist` | 获取用户会议列表 | [path/93707](https://developer.work.weixin.qq.com/document/path/93707) | 2026-04-02 |

#### P1 — Todo（待办）

| 端点                                | 说明         | 官方文档                                                               | 校验日期   |
| ----------------------------------- | ------------ | ---------------------------------------------------------------------- | ---------- |
| `POST /cgi-bin/oa/addworkrecord`    | 创建待办     | [path/93258](https://developer.work.weixin.qq.com/document/path/93258) | 2026-04-02 |
| `POST /cgi-bin/oa/updateworkrecord` | 更新待办状态 | [path/93259](https://developer.work.weixin.qq.com/document/path/93259) | 2026-04-02 |
| `POST /cgi-bin/oa/getworkrecord`    | 获取待办详情 | 待实施时验证                                                           | —          |

> **修正**: 原设计误将端点写为 `/cgi-bin/wedrive/todo/*`，实际待办 API 在 `/cgi-bin/oa/` 路径下。

#### P2 — Approval（审批）

| 端点                                 | 说明             | 官方文档                                                               | 校验日期   |
| ------------------------------------ | ---------------- | ---------------------------------------------------------------------- | ---------- |
| `POST /cgi-bin/oa/applyevent`        | 提交审批申请     | [path/91853](https://developer.work.weixin.qq.com/document/path/91853) | 2026-04-02 |
| `POST /cgi-bin/oa/getapprovalinfo`   | 批量获取审批单号 | [path/91816](https://developer.work.weixin.qq.com/document/path/91816) | 2026-04-02 |
| `POST /cgi-bin/oa/getapprovaldetail` | 获取审批详情     | [path/91983](https://developer.work.weixin.qq.com/document/path/91983) | 2026-04-02 |
| `POST /cgi-bin/oa/gettemplatedetail` | 获取审批模板详情 | [path/91982](https://developer.work.weixin.qq.com/document/path/91982) | 2026-04-02 |

#### P2 — External Contact（客户联系）

| 端点                                           | 说明           | 官方文档                                                               | 校验日期   |
| ---------------------------------------------- | -------------- | ---------------------------------------------------------------------- | ---------- |
| `GET /cgi-bin/externalcontact/get`             | 获取客户详情   | [path/92114](https://developer.work.weixin.qq.com/document/path/92114) | 2026-04-02 |
| `GET /cgi-bin/externalcontact/list`            | 获取客户列表   | [path/92113](https://developer.work.weixin.qq.com/document/path/92113) | 2026-04-02 |
| `POST /cgi-bin/externalcontact/groupchat/list` | 获取客户群列表 | [path/92120](https://developer.work.weixin.qq.com/document/path/92120) | 2026-04-02 |

> **修正**: 原设计端点写为 `group_chat/list`（下划线），实际路径为 `groupchat/list`（无下划线）。

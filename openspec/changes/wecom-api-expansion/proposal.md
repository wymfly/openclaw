## Why

WeCom 插件当前仅覆盖消息收发和文档/表格操作，Agent 无法代用户管理日程、查询通讯录、安排会议或创建待办。企微自建应用拥有远超机器人身份的 API scope，是扩展 Agent 能力的最佳路径。上游 YanHaidao/wecom v2.3.27 已新增 calendar 和 mcp 模块（零冲突纯新增），应立即同步；其余高频业务模块（通讯录/会议/待办/审批/客户联系）需自研补齐。

## What Changes

- **P0 上游同步**：复制 `capability/calendar/`（1961 行）、`capability/mcp/`（685 行）、`runtime/source-registry.ts`（244 行）、`context-store.ts`（264 行），适配 import 路径并注册 Tool
- **P1 自研模块**：新增 `capability/contact/`（通讯录查询/部门树/搜索）、`capability/meeting/`（会议 CRUD/参与者管理）、`capability/todo/`（待办 CRUD/状态管理）
- **P2 企业级扩展**：新增 `capability/approval/`（审批发起/查询/模板）、`capability/external-contact/`（外部联系人/客户群）
- 所有新模块遵循现有 `capability/doc/` 四件套模式（client/schema/tool/types/index），复用 `getAccessToken(agent)` + `wecomFetch` + 3 次重试
- 在 `extensions/wecom/index.ts` 的 `register()` 中追加各模块 Tool 注册

## Capabilities

### New Capabilities

- `wecom-calendar`: 日历/日程能力 — 日程 CRUD、空闲查询、参与者管理（上游同步）
- `wecom-mcp-bridge`: MCP 桥接能力 — MCP tool 代理调用 + source-registry 依赖（上游同步）
- `wecom-contact`: 通讯录能力 — 成员查询、部门树、标签、搜索（自研）
- `wecom-meeting`: 会议能力 — 会议预约/修改/取消/查询、参与者管理（自研）
- `wecom-todo`: 待办能力 — 任务 CRUD、状态管理、提醒（自研）
- `wecom-approval`: 审批能力 — 审批发起/查询、模板管理（自研，P2）
- `wecom-external-contact`: 客户联系能力 — 外部联系人、客户群管理（自研，P2）

### Modified Capabilities

（无既有 spec 需修改）

## Impact

- **代码范围**：`extensions/wecom/src/capability/` 新增 7 个子目录，`extensions/wecom/index.ts` 追加注册调用
- **联动修改**：`src/runtime/session-manager.ts`（source-registry 集成）、可能的 bootstrap 初始化时序调整
- **依赖**：无新外部依赖，所有模块复用现有 `wecomFetch` + `getAccessToken` 基础设施
- **API scope**：自建应用身份已具备通讯录/会议/待办/审批/客户联系 API 权限，无需额外授权配置
- **风险**：P0 上游同步零冲突；P1/P2 自研模块与现有代码隔离，回归风险低

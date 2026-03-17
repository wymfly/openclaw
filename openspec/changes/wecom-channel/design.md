## Context

OpenClaw enhanced fork 需要企业微信集成。经过深度调研（评估 10+ 社区插件、4 个项目代码级分析、企业微信完整 API 能力梳理），完整技术设计已在 brainstorming 阶段产出：

> **参考设计文档：** `docs/plans/2026-03-17-wecom-integration-design.md`

当前状态：

- OpenClaw 主仓库不内置 WeCom（PR #13228 被关闭，要求社区插件维护）
- npm 上有 10+ 个 WeCom 插件，形成三个梯队（官方 / 头部社区 / 多平台）
- 5 个关键项目已克隆到 `vendor/` 完成代码分析
- 可行性验证：零致命阻碍，额外适配工作约 4-5 小时

## Goals / Non-Goals

**Goals:**

- 建立可控的企业微信消息通道（WebSocket 长连接 + 流式回复 + 多账号 + 动态 Agent）
- 集成企业级增强功能（配额追踪、持久化去重、推理展示策略、可靠投递重试）
- 通过 MCP Skill 支持企业微信文档和智能表格操作
- 保持与上游 @yanhaidao/wecom 的可同步性

**Non-Goals:**

- 企业微信应用市场上架
- 小程序 / JS-SDK 前端集成
- 微信客服（外部微信用户，后续单独提案）
- Phase 3 企业 API 扩展（审批/日程/通讯录，各自独立提案）

## Decisions

### D1：基座选择 Fork @yanhaidao/wecom

**选择：** Fork @yanhaidao/wecom (v2.3.160) 到 `extensions/wecom/`

**替代方案：**

- A) 官方 @wecom 插件 → 否决：黑盒 npm，无法嵌入配额/去重/动态 Agent
- B) 自研 → 否决：消息传输层需要数月迭代才能稳定，现有插件已经历 160 版本打磨
- C) @dingxiang-me → 否决：26K LOC 但 JS 非 TypeScript，代码量大维护负担重
- D) @sunnoy → 否决：JS 非 TypeScript，无 Zod 验证，无审计日志/健康状态机。但 @sunnoy 的 flat config keys (`channels.wecom.botId/dmPolicy/groupPolicy`) 与官方插件兼容性更好，且已实现 pairing adapter 和完整的群聊策略。选择 @yanhaidao 意味着需要额外的配置兼容适配工作。

**理由：** TypeScript 完整源码 + Zod schema + 4 层架构分离 + 审计日志/健康状态机 + 生产验证（腾讯云/火山引擎/天翼云）+ 文档双向读写。@sunnoy 的 flat config 优势通过 D2.1 兼容适配器解决。

### D2.1：配置兼容适配器

**选择：** 在增强层实现配置别名映射，使 `channels.wecom.botId` 等 flat keys 自动映射到 @yanhaidao 的嵌套 schema (`channels.wecom.bot.ws.botId`)

**理由：** 保持与官方插件和其他社区插件的配置兼容性，降低用户迁移成本。@yanhaidao 原生 schema 作为内部规范，别名映射在配置加载时一次性完成。

### D2：增强层隔离在 `src/enhanced/` 目录

**选择：** 所有移植和新增代码放在独立的 `src/enhanced/` 目录

**理由：** 最小化对原有文件的修改（仅 1-2 行 import + 调用），降低上游同步的合并冲突风险。原有文件的目录结构保持与上游一致。

### D3：MCP 配置通过 WSClient.reply() 获取

**选择：** 复刻官方插件的 `aibot_get_mcp_config` 命令实现

**替代方案：** 用户手动配置 MCP Server URL → 否决：体验差，官方 Skill 已设计了自动获取流程

**理由：** WSClient.reply() 接受任意命令字符串，实现仅需 ~50 行代码。认证成功后自动拉取，存入 `~/.openclaw/wecomConfig/config.json`，与官方 Skill 的配置读取路径一致。

### D4：wecom-doc Skill 直接复用官方定义

**选择：** 复制官方插件的 `skills/wecom-doc/SKILL.md` + `references/doc-api.md`

**理由：** Skill 定义是纯 Markdown 指令文件，不包含可执行代码。MCP Server 由企业微信官方提供（通过 D3 的配置获取下发 URL），无需自建。

### D5：上游同步采用定期 cherry-pick

**选择：** 不设自动同步，手动 cherry-pick bugfix

**替代方案：** git subtree → 否决：冲突解决更复杂

**理由：** 核心传输层已稳定（160 版本迭代），主要需跟进 SDK 兼容性更新和 bugfix，频率较低。

## Risks / Trade-offs

| 风险                                           | 缓解                                                        |
| ---------------------------------------------- | ----------------------------------------------------------- |
| @yanhaidao 停止维护 → 无 bugfix                | 我们已有完整源码可独立维护；传输层已稳定                    |
| @wecom/aibot-node-sdk 破坏性更新 → 通道中断    | 锁定版本 ^1.0.2，仅确认兼容后升级                           |
| `aibot_get_mcp_config` 命令格式变更 → MCP 失效 | Skill 支持手动配置 fallback；命令格式由 SDK 约束不常变      |
| 增强层模块与原有代码版本漂移 → 适配层失效      | 增强层通过接口而非实现耦合；每次 cherry-pick 后运行集成测试 |
| 配额追踪数据结构不匹配 → 运行时错误            | 已验证 peerId ↔ chatId 映射兼容；通过适配器桥接             |

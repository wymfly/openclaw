## Why

OpenClaw enhanced fork 需要企业微信（WeCom）集成来覆盖中国企业市场最重要的 IM 生态。当前 OpenClaw 主仓库不内置 WeCom 支持（PR #13228 被关闭），而现有社区插件要么是黑盒（官方插件无法嵌入企业级增强），要么缺少关键能力（配额追踪、MCP 文档集成）。我们需要一个可控的、企业级的 WeCom 频道实现，同时复用社区已验证的成熟代码。

## What Changes

- Fork `@yanhaidao/wecom` (v2.3.160) 到 `extensions/wecom/`，作为 WeCom 频道的唯一实现
- 新增 `src/enhanced/` 增强层，移植社区插件高价值模块：
  - MCP 配置获取（从官方插件逆向，~50 行）
  - 配额追踪（从 @sunnoy/wecom 移植，330 行）
  - 持久化消息去重（从 @sunnoy/wecom 移植，146 行）
  - 推理展示策略（从 @dingxiang-me 移植，104 行）
  - 可靠投递重试（从 @dingxiang-me 移植，143 行）
- 新增 `skills/wecom-doc/` MCP Skill 目录，移植官方插件的文档+智能表格操作能力
- 在 `openclaw.plugin.json` 中声明 skills 目录

## Capabilities

### New Capabilities

- `wecom-messaging`: WebSocket 长连接消息通道，覆盖私聊/群聊/流式回复/多账号/动态 Agent 隔离
- `wecom-enhanced`: 企业级增强层，包含配额追踪、持久化去重、推理展示策略、可靠投递重试
- `wecom-mcp`: MCP 配置自动获取 + wecom-doc Skill（企业微信文档和智能表格 CRUD）

### Modified Capabilities

（无修改的现有能力）

## Impact

- **新文件**：`extensions/wecom/` 整个目录（fork 来源 + 增强层 + skills）
- **依赖**：新增 `@wecom/aibot-node-sdk` ^1.0.2、`fast-xml-parser`、`undici`、`zod`
- **构建**：pnpm workspace 新增 `extensions/wecom` 包
- **配置**：`channels.wecom.*` 配置路径（与现有社区插件兼容）+ `channels.wecom.enhanced.*` 新增子键
- **运行时**：需出站访问 `wss://openws.work.weixin.qq.com` 和 `https://qyapi.weixin.qq.com`
- **工具依赖**：wecom-doc Skill 需要全局安装 `mcporter` CLI

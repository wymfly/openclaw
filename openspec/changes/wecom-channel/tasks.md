## 1. 基座搭建（Fork + 构建验证）

- [ ] 1.1 将 `vendor/yanhaidao-wecom` 源码复制到 `extensions/wecom/`，清理 `.git` 目录和不需要的文件
- [ ] 1.2 调整 `extensions/wecom/package.json`：修改包名为 `@openclaw-enhanced/wecom`，对齐 peerDependencies 版本，确认依赖（@wecom/aibot-node-sdk、fast-xml-parser、undici、zod）
- [ ] 1.3 调整 `extensions/wecom/tsconfig.json` 对齐主仓库配置（target: es2023）
- [ ] 1.4 执行 `pnpm install` + `pnpm build`，确认零编译错误
- [ ] 1.5 执行 `extensions/wecom` 目录下的全部测试（vitest），确认原有 20+ 测试文件全部通过
- [ ] 1.6 在 `src/transport/bot-ws/sdk-adapter.ts` 中配置 WSClient 创建参数 `maxReconnectAttempts: 100`（SDK 默认 10，不满足 spec 要求）

## 2. 增强层 — 配置兼容适配器

- [ ] 2.1 创建 `extensions/wecom/src/enhanced/` 目录结构
- [ ] 2.2 创建 `src/enhanced/config-compat.ts`：实现 flat-key 到嵌套 schema 的别名映射（`channels.wecom.botId` → `channels.wecom.bot.ws.botId`，`dmPolicy` → `bot.dm.policy` 等），在配置加载时一次性转换
- [ ] 2.3 编写 `src/enhanced/config-compat.test.ts`：验证 flat-key 输入正确映射到嵌套 schema，嵌套输入不受影响，混合输入优先级正确

## 3. 增强层 — 配额追踪与消息去重

- [ ] 3.1 从 `vendor/openclaw-plugin-wecom/wecom/runtime-telemetry.js` 移植配额追踪模块到 `src/enhanced/quota-tracker.ts`，TypeScript 化并添加类型定义
- [ ] 3.2 编写 `src/enhanced/quota-tracker.test.ts`：覆盖 24h 窗口计算、边界条件、nearLimit/exhausted 预测
- [ ] 3.3 从 `vendor/openclaw-plugin-wecom/wecom/reqid-store.js` 移植持久化去重模块到 `src/enhanced/reqid-store.ts`，注入 stateDir 路径参数替代硬编码
- [ ] 3.4 编写 `src/enhanced/reqid-store.test.ts`：覆盖持久化写入、TTL 过期、内存限制（200 条）、跨重连去重
- [ ] 3.5 在 `src/transport/bot-ws/sdk-adapter.ts` 的入站消息处理中集成 reqid-store 去重调用（最小插入点：1-2 行 import + 调用）
- [ ] 3.6 在出站消息处理中集成 quota-tracker 计数调用

## 4. 增强层 — 推理展示与可靠投递

- [ ] 4.1 从 `vendor/OpenClaw-Wechat/src/wecom/reasoning-visibility.js` 移植推理展示策略到 `src/enhanced/reasoning-visibility.ts`，TypeScript 化
- [ ] 4.2 编写 `src/enhanced/reasoning-visibility.test.ts`：覆盖 separate/append/hidden 三模式、代码块保护、长度截断
- [ ] 4.3 在流式输出管道中集成 reasoning-visibility 调用，根据 `channels.wecom.enhanced.reasoningMode` 配置选择模式
- [ ] 4.4 从 `vendor/OpenClaw-Wechat/src/wecom/pending-reply-manager.js` 移植可靠投递重试到 `src/enhanced/pending-reply.ts`，适配 @yanhaidao 的 store 接口
- [ ] 4.5 编写 `src/enhanced/pending-reply.test.ts`：覆盖重试逻辑、指数退避、持久化恢复、maxRetries 上限
- [ ] 4.6 在出站交付失败路径中集成 pending-reply 入队逻辑

## 5. 增强层 — 配置扩展

- [ ] 5.1 扩展 `src/config/schema.ts` 的 Zod schema，添加 `enhanced` 子键（quotaTracking、reqIdPersistence、reasoningMode、pendingReply）
- [ ] 5.2 编写配置 schema 测试：验证 enhanced 字段的默认值、验证规则、向后兼容性（无 enhanced 字段时不报错）
- [ ] 5.3 更新 `src/config/accounts.ts` 的账户解析逻辑，支持 enhanced 配置继承

## 6. MCP 配置获取

- [ ] 6.1 创建 `src/enhanced/mcp-config.ts`：实现 `fetchMcpConfig(client)` 和 `fetchAndSaveMcpConfig(client, accountId)`，通过 `WSClient.reply()` 发送 `aibot_get_mcp_config` 命令，默认 type 为 `"streamable-http"`（响应可能不带 type）
- [ ] 6.2 MCP 配置写入路径改为 per-account 隔离：`~/.openclaw/wecomConfig/{accountId}/config.json`，避免多账号 last-write-wins
- [ ] 6.3 编写 `src/enhanced/mcp-config.test.ts`：mock WSClient.reply() 验证请求格式、响应解析、type 兜底、超时处理、per-account 写文件逻辑
- [ ] 6.4 在 `src/transport/bot-ws/sdk-adapter.ts` 的认证成功回调中调用 `fetchAndSaveMcpConfig()`（失败仅记日志，不阻断消息通道）

## 7. wecom-doc Skill 集成

- [ ] 7.1 创建 `extensions/wecom/skills/wecom-doc/` 目录
- [ ] 7.2 从 `vendor/wecom-official/package/skills/wecom-doc/` 复制 `SKILL.md` 和 `references/doc-api.md`
- [ ] 7.3 审查并适配 SKILL.md 中的配置检测路径：MCP 配置读取路径改为 per-account 路径 `~/.openclaw/wecomConfig/{accountId}/config.json`
- [ ] 7.4 适配 SKILL.md 中硬编码的 `openclaw config get channels.wecom.botId` 路径，改为兼容 @yanhaidao 的 `channels.wecom.bot.ws.botId`（或通过 compat 层读取）
- [ ] 7.5 在 `openclaw.plugin.json` 中添加 `"skills": ["./skills"]` 声明
- [ ] 7.6 验证：gateway 启动后 Skill 被正确加载（通过 `openclaw skills list` 或日志确认）

## 8. 仓库集成

- [ ] 8.1 更新 `.github/labeler.yml`，添加 `extensions/wecom` 的标签规则，创建对应 GitHub label
- [ ] 8.2 运行 `extensions/wecom` 全部测试（原有 + 新增增强层测试），确认零失败
- [ ] 8.3 运行主仓库 `pnpm build`，确认 wecom 扩展不影响其他模块编译
- [ ] 8.4 运行主仓库 `pnpm test`，确认无回归
- [ ] 8.5 编写集成测试 `src/enhanced/integration.test.ts`：mock WebSocket server 验证完整入站→去重→配额→Agent→出站→重试流程

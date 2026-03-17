# 企业微信 AI 助手使用指南

本指南面向实际使用者：从零搭建一个在企业微信中可用的 AI 助手。

---

## 一、你会得到什么

安装完成后，你的企业微信中会出现一个 AI 机器人，它能：

- **即时对话** — 像 ChatGPT 一样流式打字回复，支持私聊和群聊
- **看图识别** — 发一张截图，AI 能分析图片内容
- **收发文件** — 发 PDF/Word/代码文件，AI 能阅读；AI 也能生成文件发给你
- **创建文档** — 对话中说"帮我建个文档"，AI 直接在企业微信协作文档中创建
- **操作表格** — 说"新建一个项目进度表"，AI 创建智能表格并填入数据
- **主动推送** — 配置定时任务后，AI 可以每天早上推送早报、监控报警
- **多人协作** — 每个用户的对话独立隔离，不会串上下文

### 增强功能（本 fork 独有）

- **配额保护** — 自动追踪 24h 回复上限（30次），快用完时提醒
- **消息去重** — WebSocket 断连重连后不会重复处理消息
- **推理展示** — AI 的"思考过程"可以单独展示、隐藏或合并到回复中
- **投递重试** — 消息发送失败会自动重试（开发中）

---

## 二、准备工作

### 2.1 你需要

| 项目               | 说明                                                 |
| ------------------ | ---------------------------------------------------- |
| 企业微信管理员权限 | 需要在工作台创建机器人                               |
| 一台服务器         | 运行 OpenClaw（Linux/Mac/Windows 均可，无需公网 IP） |
| Node.js 22+        | OpenClaw 运行环境                                    |
| AI 模型 API Key    | 如 OpenAI、Claude、DeepSeek 等                       |

### 2.2 安装 OpenClaw

```bash
npm install -g openclaw
```

### 2.3 配置 AI 模型

```bash
openclaw setup
```

按提示选择 AI 提供商并填入 API Key。

---

## 三、创建企业微信机器人

### 3.1 创建 Bot（推荐，最简单）

1. 打开企业微信 → **工作台** → **智能机器人**
2. 点击 **创建机器人**，选择 **API 模式**
3. 创建完成后，记录：
   - **BotId**（机器人 ID）
   - **Secret**（密钥）

> Bot 模式使用 WebSocket 长连接，**无需公网 IP 和域名**。

### 3.2（可选）创建 Agent（自建应用）

如果需要主动推送消息、发送文件/图片、定时任务等高级功能：

1. 企业微信管理后台 → **应用管理** → **创建应用**
2. 记录：
   - **CorpId**（企业 ID，在"我的企业"页面）
   - **AgentId**（应用 ID）
   - **AgentSecret**（应用密钥）
   - **Token** 和 **EncodingAESKey**（在"接收消息"设置中生成）
3. 设置回调 URL（需要公网可达的地址）

> 大多数场景只用 Bot 就够了。Agent 是锦上添花。

---

## 四、配置 OpenClaw 连接企业微信

### 4.1 交互式配置（推荐）

```bash
openclaw channels add
```

选择 **WeCom (企业微信)**，按提示填入 BotId 和 Secret。

### 4.2 手动配置

编辑配置文件（通常在 `~/.openclaw/config.yaml`）：

**最简配置（只用 Bot）：**

```yaml
channels:
  wecom:
    bot:
      ws:
        botId: "你的BotId"
        secret: "你的Secret"
```

**Bot + Agent 双模：**

```yaml
channels:
  wecom:
    bot:
      ws:
        botId: "你的BotId"
        secret: "你的Secret"
      dm:
        policy: "open" # open = 所有人可用, allowlist = 白名单
    agent:
      corpId: "你的CorpId"
      agentId: 1000002
      agentSecret: "你的AgentSecret"
      token: "你的Token"
      encodingAESKey: "你的AESKey"
```

**启用增强功能：**

```yaml
channels:
  wecom:
    bot:
      ws:
        botId: "你的BotId"
        secret: "你的Secret"
    enhanced:
      quotaTracking: true # 配额追踪
      reqIdPersistence: true # 消息去重持久化
      reasoningMode: "separate" # 推理展示模式
```

### 4.3 reasoningMode 三种模式说明

| 模式       | 效果                                        | 适用场景         |
| ---------- | ------------------------------------------- | ---------------- |
| `separate` | AI 思考过程单独发一条消息，正式回复另发一条 | 想看 AI 怎么想的 |
| `append`   | 思考过程追加到回复开头（折叠显示）          | 偶尔看看推理     |
| `hidden`   | 完全隐藏思考过程，只发正式回复              | 只要结果         |

---

## 五、启动

```bash
openclaw gateway run
```

看到以下日志说明连接成功：

```
[wecom-ws] authenticated account=default
[wecom-ws] connected account=default
```

### 后台运行

```bash
nohup openclaw gateway run > /tmp/openclaw.log 2>&1 &
```

### 检查状态

```bash
openclaw channels status
```

---

## 六、在企业微信中使用

### 6.1 基础对话

打开企业微信，找到你创建的机器人，直接发消息：

```
你: 帮我写一个 Python 快速排序
AI: （流式打字回复，像 ChatGPT 一样）
```

### 6.2 发送图片让 AI 分析

直接在对话中发一张图片（截图、照片等），AI 会自动识别并分析内容。

```
你: [发送一张报表截图]
你: 帮我分析这个报表的趋势
AI: 从图中可以看到...
```

### 6.3 发送文件让 AI 阅读

发送 PDF、Word、代码文件等，AI 会读取内容：

```
你: [发送 report.pdf]
你: 总结一下这份报告的要点
AI: 这份报告主要包含以下几个方面...
```

### 6.4 群聊中使用

在群聊中 @机器人 即可触发对话：

```
你: @AI助手 帮我翻译这段话成英文：今天天气很好
AI: The weather is very nice today.
```

### 6.5 创建企业微信文档

> 前提：安装 mcporter（`npm install -g mcporter`）并在企业微信后台授权机器人文档权限。

```
你: 帮我创建一个项目周报文档
AI: 已创建文档「项目周报」，链接：https://doc.weixin.qq.com/doc/w3_xxx
```

### 6.6 创建和操作智能表格

```
你: 帮我建一个项目进度跟踪表，包含：任务名称、负责人、状态、截止日期
AI: 已创建智能表格「项目进度跟踪」，包含 4 个字段...

你: 添加一条记录：任务"完成首页设计"，负责人张三，状态进行中，截止 3 月 20 日
AI: 已添加 1 条记录。
```

### 6.7 主动推送（需要 Agent 模式）

配置定时任务后，AI 可以主动给你发消息：

```yaml
# 配置示例：每天早上 9 点推送
cron:
  morning-brief:
    schedule: "0 9 * * *"
    channel: wecom
    to: "@all"
    message: "早上好！请查看今日待办事项。"
```

---

## 七、多账户配置

一个 OpenClaw 实例可以同时管理多个企业微信机器人：

```yaml
channels:
  wecom:
    defaultAccount: "team-a"
    enhanced:
      quotaTracking: true
    accounts:
      team-a:
        bot:
          ws:
            botId: "team-a-bot-id"
            secret: "team-a-secret"
      team-b:
        bot:
          ws:
            botId: "team-b-bot-id"
            secret: "team-b-secret"
```

每个账户独立运行、独立隔离，互不干扰。

---

## 八、常见问题

### Q: 机器人不回复？

1. 检查 `openclaw channels status` 是否显示 connected
2. 检查 BotId 和 Secret 是否正确
3. 查看日志：`tail -f /tmp/openclaw.log`

### Q: 回复很慢？

- 取决于 AI 模型的响应速度，不是插件问题
- 流式回复已开启，你会看到"正在输入..."的效果

### Q: 群聊中机器人没反应？

- 默认需要 @机器人 才会响应
- 确认机器人已被添加到群聊中

### Q: 配额用完了？

- 企业微信限制：同一会话 24 小时内最多被动回复 30 次
- 主动发送：每天最多 10 个会话
- 启用 `enhanced.quotaTracking: true` 后，快到限额时会提前警告

### Q: 如何升级？

```bash
openclaw plugins update wecom
```

---

## 九、配置参考速查

| 配置项     | 路径                           | 值                      | 说明                  |
| ---------- | ------------------------------ | ----------------------- | --------------------- |
| Bot ID     | `bot.ws.botId`                 | string                  | 必填                  |
| Bot Secret | `bot.ws.secret`                | string                  | 必填                  |
| DM 策略    | `bot.dm.policy`                | open/allowlist/disabled | 默认 open             |
| DM 白名单  | `bot.dm.allowFrom`             | string[]                | policy=allowlist 时填 |
| 群聊开关   | `dynamicAgents.groupEnabled`   | boolean                 | 默认 false            |
| 配额追踪   | `enhanced.quotaTracking`       | boolean                 | 默认 true             |
| 去重持久化 | `enhanced.reqIdPersistence`    | boolean                 | 默认 true             |
| 推理展示   | `enhanced.reasoningMode`       | separate/append/hidden  | 默认不启用            |
| 占位提示   | `bot.streamPlaceholderContent` | string                  | 如"正在思考..."       |
| 欢迎语     | `bot.welcomeText`              | string                  | 首次对话时发送        |

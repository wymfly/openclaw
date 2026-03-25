# Deck Upstream Sync — 功能测试计划

## 前置条件

- [ ] Gateway 从本地源码运行：`scripts/dev/deck-dev.sh`
- [ ] `NO_PROXY=localhost,127.0.0.1` 已设置
- [ ] Dashboard 可访问：`http://localhost:3000`
- [ ] Gateway 已连接（HeaderBar 显示绿色连接状态）
- [ ] 至少配置一个可用的 LLM provider（如 Anthropic/OpenAI）

---

## 模块 1：Chat 核心流程迁移

### T1-1：新会话创建（sessions.create）

- [ ] 打开 Chat 面板，确认无活跃会话
- [ ] 输入文本消息，点击发送
- [ ] **验证**：消息成功发送，助手开始流式响应
- [ ] **验证**：SessionSidebar 出现新会话条目
- [ ] **验证**：会话 key 格式为 `agent:{id}:dashboard:{uuid}`（非旧格式 `web-*`）
  - 检查方式：浏览器 DevTools → Network → 查看 `/api/chat/sessions/create` 响应中的 `key` 字段

### T1-2：后续消息发送（sessions.steer）

- [ ] 在已有会话中输入第二条消息，发送
- [ ] **验证**：消息通过 `/api/chat/send` 发送（Network 面板确认）
- [ ] **验证**：助手正常流式响应
- [ ] **验证**：在助手响应过程中发送新消息（steer 场景）
- [ ] **验证**：前一个响应被中断，新消息开始处理

### T1-3：首条消息带附件

- [ ] 新建会话，附加一张图片（或文件），输入文本，发送
- [ ] **验证**：会话创建成功
- [ ] **验证**：附件内容被正确发送到 Gateway（非静默丢弃）
  - 检查方式：Network → `/api/chat/send` 请求体包含 `attachments` 数组
- [ ] **验证**：助手响应引用了附件内容

### T1-4：中止运行（sessions.abort）

- [ ] 发送一条消息，助手开始响应
- [ ] 点击停止按钮
- [ ] **验证**：Network → `/api/chat/abort` 发送成功
- [ ] **验证**：流式响应停止
- [ ] **验证**：RunStatusBar 不再显示"运行中"

### T1-5：创建失败恢复

- [ ] 断开 Gateway 连接（停止 Gateway 进程）
- [ ] 在 Chat 面板输入消息并发送
- [ ] **验证**：发送失败后，输入框文本被恢复（非清空丢失）
- [ ] 重新启动 Gateway，验证后续操作正常

---

## 模块 2：会话生命周期状态

### T2-1：状态流转

- [ ] 发送消息，观察 RunStatusBar
- [ ] **验证**：发送中显示 `running` 状态
- [ ] **验证**：响应完成后状态变为 `done`
- [ ] **验证**：中止后状态变为 `killed`

### T2-2：session-state 事件驱动

- [ ] 打开浏览器 DevTools → Console
- [ ] 发送消息，观察 EventSource 事件
- [ ] **验证**：收到 `session-state` 类型的 SSE 事件
- [ ] **验证**：事件 payload 包含 `sessionKey`、`reason`、`phase` 字段

### T2-3：错误状态

- [ ] 配置一个无效的 API key（使模型调用失败）
- [ ] 发送消息
- [ ] **验证**：状态显示 `failed`
- [ ] **验证**：错误信息可见

---

## 模块 3：Sessions 面板增强

### T3-1：实时状态 badge

- [ ] 打开 Sessions 面板
- [ ] 在 Chat 面板发送消息
- [ ] **验证**：Sessions 面板对应会话出现 `Running`（蓝色）badge
- [ ] **验证**：响应完成后 badge 变为 `Done`（绿色）
- [ ] **验证**：中止后 badge 变为 `Killed`（橙色）

### T3-2：会话详情新字段

- [ ] 在 Sessions 面板选择一个已完成的会话
- [ ] **验证**：SessionDetail 显示状态 badge
- [ ] **验证**：显示 token 用量（totalTokens）和预估成本（estimatedCostUsd），如果 Gateway 返回了这些字段

### T3-3：子代理信息（条件显示）

- [ ] 如果有子代理会话（通过 subagent 运行产生）：
  - [ ] **验证**：SessionDetail 显示子代理角色（Orchestrator/Leaf）
  - [ ] **验证**：显示控制范围和工作区目录
- [ ] 如果是普通会话：
  - [ ] **验证**：子代理信息区域不显示

### T3-4：父子会话导航

- [ ] 如果存在有父子关系的会话：
  - [ ] **验证**：SessionDetail 显示"父会话"链接，点击可跳转
  - [ ] **验证**：显示"子会话"列表，点击可跳转

### T3-5：ContextHealthBar 实时更新

- [ ] 发送消息，观察 ContextHealthBar
- [ ] **验证**：token 进度条在流式响应过程中实时更新（由 session-state 事件驱动）

### T3-6：会话导出

- [ ] 选择一个有消息的会话
- [ ] 点击 JSON 导出
- [ ] **验证**：下载的 JSON 文件包含会话消息
- [ ] 点击 Markdown 导出
- [ ] **验证**：下载的 Markdown 文件格式正确

---

## 模块 4：Agent Tools Effective

### T4-1：Effective Tools 展示

- [ ] 打开 Agents 面板 → 选择一个 agent → Context Tab → ToolPolicyViz
- [ ] **验证**：显示 "生效工具" / "Effective Tools" 区域
- [ ] **验证**：工具按 group 分组展示
- [ ] **验证**：每个工具显示名称、Allowed/Denied badge、来源

### T4-2：无工具时的空状态

- [ ] 如果 Gateway 未返回 effective tools（旧版本或无配置）：
- [ ] **验证**：不显示 Effective Tools 区域（不报错）

---

## 模块 5：Config Schema Lookup

### T5-1：懒加载展开

- [ ] 打开 Config 面板
- [ ] 点击某个顶级 section 的展开箭头
- [ ] **验证**：Network → 发出 `/api/config/schema-lookup` 请求
- [ ] **验证**：子节点列表出现

### T5-2：子节点导航

- [ ] 展开一个 section 后，点击某个子节点
- [ ] **验证**：右侧 SchemaForm 显示对应的字段（非空白）
- [ ] **验证**：字段值与当前配置一致

### T5-3：子节点编辑

- [ ] 在子节点表单中修改一个值
- [ ] **验证**：出现"未保存更改"指示
- [ ] 点击保存
- [ ] **验证**：保存成功，值持久化

### T5-4：Fallback 机制

- [ ] 如果 Gateway 不支持 `config.schema.lookup`（旧版本）：
- [ ] **验证**：首次 lookup 失败后自动切换到 fallback 模式
- [ ] **验证**：后续不再发送 lookup 请求
- [ ] **验证**：Config 面板正常工作（使用完整 schema）

### T5-5：hint 增强

- [ ] 如果 schema lookup 返回了 hint 信息：
  - [ ] **验证**：`hint.inputType === "password"` 的字段显示为密码输入框
  - [ ] **验证**：`hint.enum` 的字段显示为下拉选择

---

## 模块 6：Gateway 基础设施

### T6-1：自动订阅

- [ ] 启动 Dashboard，连接 Gateway
- [ ] **验证**：Gateway 日志中出现 `sessions.subscribe` 请求
  - 检查方式：`tail -f /tmp/openclaw-gateway.log | grep sessions.subscribe`

### T6-2：断线重连重订阅

- [ ] Dashboard 连接 Gateway 后
- [ ] 重启 Gateway 进程
- [ ] **验证**：Dashboard 自动重连
- [ ] **验证**：重连后 `sessions.subscribe` 再次被调用

### T6-3：EventBus 事件类型

- [ ] 发送消息触发 session 事件
- [ ] **验证**：EventBus 广播 `session-state` 类型事件
- [ ] **验证**：RunEventPipeline 不处理这些事件（Layer 2 bypass）

---

## 模块 7：i18n 与主题

### T7-1：中文语言

- [ ] 切换到中文
- [ ] **验证**：所有新增 UI 元素显示中文（状态标签、子代理信息、工具面板、配置面板）
- [ ] **验证**：无硬编码英文字符串

### T7-2：英文语言

- [ ] 切换到英文
- [ ] **验证**：所有新增 UI 元素显示英文

### T7-3：暗色模式

- [ ] 切换到暗色模式
- [ ] **验证**：所有新增 badge/按钮/面板颜色使用 CSS 变量（无硬编码白色或灰色泄露）
- [ ] **验证**：状态 badge 颜色在暗色模式下可读

---

## 回归测试

### R-1：旧会话兼容性

- [ ] 如果存在旧格式 key 的会话（`agent:id:web-*`）：
- [ ] **验证**：旧会话仍可在 sidebar 中选择
- [ ] **验证**：旧会话的消息历史正常加载
- [ ] **验证**：可以在旧会话中继续发送消息

### R-2：现有 chat SSE 流

- [ ] 发送消息，观察完整的流式响应
- [ ] **验证**：文本流式增量显示（delta 事件正常）
- [ ] **验证**：工具调用卡片正常显示
- [ ] **验证**：thinking block 正常显示

### R-3：多会话切换

- [ ] 创建多个会话
- [ ] 在会话间切换
- [ ] **验证**：每个会话的消息独立保持
- [ ] **验证**：活跃会话切换时 streaming 状态不串扰

### R-4：Onboarding 流程

- [ ] 如果适用，走一遍 onboarding 的 StepFirstChat
- [ ] **验证**：onboarding 中的 chat 功能正常（该组件也调用 `/api/chat/send`）

---

## 执行说明

**优先级排序**：模块 1 > 模块 2 > 模块 3 > 回归测试 > 模块 4-7

**失败处理**：
- P1 失败（数据丢失/崩溃）→ 立即修复
- P2 失败（UI 异常/非关键功能）→ 记录并继续

**日志检查点**：
- Gateway 日志：`/tmp/openclaw-gateway.log`
- 浏览器 Console：无 uncaught error
- Network：无 5xx 响应（预期之外）

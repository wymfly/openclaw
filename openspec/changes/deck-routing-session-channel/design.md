## Context

Routing / Sessions / Channels 三个面板已在 P3（deck-agent-routing-observability）中实现基础版本：

- **Routing**：BindingTable（按 8 层 tier 排序的只读列表 + 添加/删除）+ RouteSimulator（参数输入→匹配结果展示）
- **Sessions**：SessionList（按类型筛选 + context window 占比条形图）+ SessionDetail（token 统计 + 历史气泡 + subagent 血统树）
- **Channels**：ChannelList（状态 badge）+ ChannelDetail（账户管理 + 启用/禁用）+ BindingsTab

现有痛点：运维仍需回到 config.yaml 完成条件编辑、优先级调整、DM scope 选择和企业渠道接入。

Gateway RPC 已有完整能力（`deck.routing.list/add/remove/validate/simulate`、`sessions.list/delete`、`channels.status`），本次改动**不新增 RPC 方法**，全部在 Dashboard 前端完成。

## Goals / Non-Goals

**Goals:**

- G1: 路由规则可在 Dashboard 内完成全生命周期管理（创建、编辑条件、排序、冲突检测、删除）
- G2: 运维可直观理解 DM scope 策略并切换，可监控会话上下文健康度
- G3: WeCom / Feishu 用户可通过向导完成渠道接入，无需手动编辑 config.yaml
- G4: 所有新组件与现有设计系统一致（shadcn/ui + Tailwind v4 + i18n）

**Non-Goals:**

- 不新增 Gateway RPC 方法（复用现有 deck.routing._ / sessions._ / channels.\* 接口）
- 不修改上游 src/gateway/ 代码
- 不增加新的外部渠道插件（WeCom/Feishu 插件已存在）
- 不实现实时推送（路由命中日志使用轮询）

## Decisions

### D1: 条件编辑器采用 Tag-based 组合构建器

**选择**：每个匹配维度（channel, accountId, peer, guildId, roles）渲染为可增删的 Tag pill，用户点击"+"选择维度并填入值。

**替代方案**：

- ~~表单式~~（每个维度一行 input）：维度多时页面冗长
- ~~DSL 文本输入~~：学习成本高，非 config 运维难以理解

**理由**：Tag pill 直观展示组合关系，视觉一致性好（与现有 TierBadge 风格统一），无需解析文本。

### D2: 拖拽排序使用 @dnd-kit/core

**选择**：`@dnd-kit/core` + `@dnd-kit/sortable`

**替代方案**：

- ~~react-beautiful-dnd~~：已停止维护
- ~~手写 HTML5 drag~~：可访问性差，触屏不友好

**理由**：@dnd-kit 是 React 生态活跃维护的 DnD 库，内置键盘可访问性和触屏支持。

### D3: 冲突检测为纯前端计算

**选择**：从 `deck.routing.list` 拉取全量规则后，在 store 内做 O(n²) 两两比较，标记 overlapping match 对。

**理由**：规则数量通常 < 50，O(n²) 无性能问题。避免增加 Gateway RPC。已有 `deck.routing.validate` 可做单条校验，批量冲突检测在前端做更灵活。

### D4: DM Scope 策略用四象限图解

**选择**：四个卡片（main / per-peer / per-channel-peer / per-account-channel-peer），每张卡片用 mermaid-style 简化图展示 session key 结构，当前选中项高亮。

**理由**：DM scope 是 OpenClaw 最难理解的概念之一，纯文字描述不够直观。四象限卡片可让用户立即看到每种模式下的会话隔离粒度。

### D5: 配置向导采用 Multi-step Wizard 模式

**选择**：shadcn/ui 风格的 Stepper 组件（进度条 + 步骤导航），每步独立验证。

**步骤设计**：

- WeCom（4 步）：传输模式选择 → 企业信息填写 → Callback URL 配置 → 连接测试
- Feishu（3 步）：传输模式选择（WebSocket / Webhook）→ 应用凭证填写 → 连接测试

**理由**：企业渠道配置参数多且相互依赖，一次性表单容易填错。分步引导可在每步提供上下文帮助。

### D6: 路由命中日志使用轮询而非 SSE

**选择**：每 10s 轮询 `deck.routing.simulate`（或现有 RPC 的扩展字段），展示最近 20 条实际路由结果。

**替代方案**：

- ~~SSE/WebSocket 实时推送~~：需要 Gateway 新增推送能力，超出 scope

**理由**：运维场景下 10s 粒度足够，且不引入新的后端依赖。

### D7: 会话导出格式

**选择**：JSON（完整数据）和 Markdown（可读格式）双选项，通过 Blob + `<a download>` 实现纯客户端导出。

**理由**：无需后端支持。JSON 保留元数据（timestamp、token count），Markdown 方便分享。

## Risks / Trade-offs

- **[风险] 规则数量极端情况**：若绑定规则超过 200 条，O(n²) 冲突检测可能卡顿 → **缓解**：添加 debounce + Web Worker 后台计算，超过阈值时显示"检测中"提示
- **[风险] @dnd-kit bundle size**：新增约 30KB gzipped → **缓解**：动态 import，仅在 Routing 面板加载
- **[风险] WeCom/Feishu 向导依赖插件已安装**：如果用户未安装对应扩展，向导无法完成 → **缓解**：向导首步检测插件状态，未安装时引导到安装说明
- **[权衡] 路由命中日志非实时**：10s 轮询有延迟 → 可接受，运维不需要毫秒级实时性
- **[权衡] 不新增 RPC**：部分数据（如 compaction 次数）可能在现有 RPC 中缺失字段 → 前端计算近似值或标注"数据有限"

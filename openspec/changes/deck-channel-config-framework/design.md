## Context

当前 Channels 面板结构：

- **ChannelList.tsx**: 已配置渠道列表 + 添加渠道按钮
- **ChannelsPanel.tsx**: 列表/详情切换
- **ConfigWizard.tsx**: 渠道添加入口，仅路由到 Feishu/WeCom 向导
- **FeishuWizard.tsx / WeComWizard.tsx**: 硬编码的分步配置表单
- **ThroughputChart.tsx**: 渠道吞吐量图表

后端 API 能力：

- `config.schema` — 返回 JSON Schema，含 `configUiHints`（order、sections、sensitive 标记）
- `config.schema.lookup` — 查询特定路径的 schema
- `channels.status` — 返回渠道连接状态，`probe: true` 触发主动探测（超时 10s）
- 官方 UI 的 `renderChannelConfigForm()` 递归遍历 schema 生成表单字段

已有 OpenSpec 提案 `schema-driven-ui-architecture` 定义了通用的 schema-driven 表单架构，但该提案范围更广（覆盖所有配置场景）。渠道配置是其中一个具体应用场景。

## Goals / Non-Goals

**Goals:**

- 让任何已安装渠道都能在 Deck 中配置，无需硬编码向导
- 从 config.schema 动态生成渠道配置表单（字段类型映射、验证、分组）
- 支持 sensitive 字段的密码输入处理
- 主动探测渠道连接状态并展示详细结果

**Non-Goals:**

- 不完全复制官方 `renderChannelConfigForm()` 的递归实现 — 使用声明式 schema 映射而非命令式递归
- 不废弃 Feishu/WeCom 向导 — 保留作为引导式入口，schema 表单作为编辑/高级配置
- 不实现渠道安装/卸载 — 渠道安装是插件管理的职责
- 不实现 schema-driven-ui-architecture 的完整范围 — 仅实现渠道配置所需的子集

## Decisions

### D1: 轻量 ChannelSchemaForm 而非完整 schema-driven-ui-architecture

**选择**: 为渠道配置实现轻量的 `ChannelSchemaForm` 组件，从 JSON Schema 生成表单。如果后续 `schema-driven-ui-architecture` 提案实现了通用 `SchemaForm`，ChannelSchemaForm 可迁移为其 wrapper。

**替代方案**: 等待 schema-driven-ui-architecture 完全实现后再做渠道配置。

**理由**: schema-driven-ui-architecture 范围大、时间长。渠道配置是具体、紧迫的需求，轻量实现可以先解决问题。字段类型映射相对简单（string → Input, boolean → Switch, enum → Select, password → PasswordField）。

### D2: Schema 字段类型映射规则

```
JSON Schema type     → Component
─────────────────────────────────
string               → Input
string + format:uri  → Input (url 验证)
string + enum        → Select
string + sensitive   → PasswordField (已有组件)
boolean              → Switch
number/integer       → Input (type=number)
object               → RecordField (已有组件) 或嵌套分组
array                → TypedArrayField (已有组件)
```

`configUiHints` 处理：

- `order`: 字段排序
- `sections`: 字段分组（渲染为 Card 区域）
- `sensitive`: 密码输入模式
- `help`: 字段旁的帮助文本

### D3: 渠道发现基于 config.schema 路径枚举

**选择**: 从 `config.schema` 响应中枚举所有匹配 `channels.*` 或 `extensions.*.channel` 路径的 schema 节点，自动构建已安装渠道列表。

**理由**: 无需额外 API 调用，config.schema 已经包含了所有渠道的配置信息。路径模式匹配比硬编码渠道名更可扩展。

### D4: 探测结果的展示方式

**选择**: 在渠道详情页的状态区域添加 "测试连接" 按钮，点击调用 `channels.status` 的 `probe: true`，显示详细探测结果（connected/timeout/error + 延迟 + 错误信息）。

**理由**: 主动探测可能耗时（超时 10s），不适合自动触发。按需触发让用户在修改配置后手动验证。

## Risks / Trade-offs

- **[Schema 不稳定]** config.schema 的结构可能随 Gateway 版本变化 → 表单生成器对未识别的 schema 类型降级为只读 JSON 展示
- **[configUiHints 覆盖不全]** 部分渠道可能无 hints → 无 hints 时按 schema 定义的字段顺序渲染，无分组
- **[探测超时体验]** 10s 超时较长 → 显示进度指示器和倒计时
- **[已有 Config Editor 重叠]** Config Editor 面板也可编辑渠道配置 → 渠道面板提供更友好的引导式体验，Config Editor 提供 raw 编辑能力，两者互补

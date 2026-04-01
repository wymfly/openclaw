## Why

Deck 的 Channels 面板当前仅有 Feishu 和 WeCom 两个硬编码配置向导（FeishuWizard.tsx、WeComWizard.tsx），每增加一个渠道需要手写完整的表单组件。而后端 `config.schema` API 返回每个渠道的 JSON Schema + `configUiHints`，官方 UI 通过 `renderChannelConfigForm()` 从 schema 递归生成表单。

具体差距：

1. **硬编码不可扩展** — 新渠道（Telegram、Discord、Slack、Matrix 等）在 Deck 中无配置入口，用户需要 CLI
2. **未利用 Schema 能力** — `config.schema` 返回完整 JSON Schema（含字段类型、enum、validation、descriptions）和 `configUiHints`（含 order、section grouping、sensitive 标记），Deck 仅用于 Config Editor 的通用配置
3. **无连接状态探针** — `channels.status` 支持 `probe` 参数（主动探测连接状态），Deck 仅获取静态状态不做主动探测
4. **渠道配置与 OpenSpec schema-driven-ui-architecture 提案重叠** — 已有的 schema-driven UI 架构提案可为渠道配置提供表单生成基础

## What Changes

- 新增 **Schema-driven 渠道配置表单生成器**：从 `config.schema` 的 JSON Schema + configUiHints 动态生成配置表单，替代硬编码向导
- 新增 **渠道配置路径发现**：自动检测已安装的渠道列表及其 schema 路径，无需硬编码渠道名称
- 增强 **连接状态检测**：调用 `channels.status` 的 `probe: true` 参数执行主动探测，显示详细连接状态
- 保留 Feishu/WeCom 向导作为增强的引导式配置入口，schema-driven 表单作为通用 fallback

## Capabilities

### New Capabilities

- `channel-schema-form`: 从 config.schema JSON Schema 动态生成渠道配置表单
- `channel-discovery`: 自动发现已安装渠道列表及其配置 schema 路径
- `channel-probe`: 渠道连接主动探测，显示详细探测结果

### Modified Capabilities

(none)

## Impact

- **新组件**: ChannelSchemaForm.tsx（schema-driven 表单生成器）、ChannelDiscovery.tsx（渠道发现列表）、ChannelProbeStatus.tsx（探测结果展示）
- **修改组件**: ChannelsPanel.tsx（集成发现和 schema 表单）、ConfigWizard.tsx（fallback 到 schema 表单）
- **API**: 更深入使用 `config.schema`（已允许）和 `channels.status`（已允许，增加 probe 参数）
- **依赖**: 可能复用 schema-driven-ui-architecture 提案的 SchemaForm 组件（如已实现）；否则独立实现轻量版
- **i18n**: `channels` 命名空间新增 schema 表单标签、探测状态文案

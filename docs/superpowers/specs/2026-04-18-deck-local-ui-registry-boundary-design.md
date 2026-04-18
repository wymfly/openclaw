# Deck Local UI Registry Boundary - 设计规范

> **状态**: Draft
> **日期**: 2026-04-18
> **范围**: Deck UI 架构边界收缩
> **分支**: `enhanced`
> **前置**:
>
> - `deck-access-model-contract` 已落地
> - `deck-manifest-driven-wizard` 已落地
> - `deck-plugin-manifest-expansion` 已落地
>
> **目标优先级**:
>
> 1. 最低 upstream 合并成本
> 2. WeCom 专用高质量 UI
> 3. 保留策展式通用渠道 / 插件控制能力

---

## 1. 背景

前 3 个 spec 已经证明三件事：

1. Deck 需要自己的 UI seam  
   例如 `AccessDescriptor`、`WizardRunner`、`CapabilityActionBar` 都是有价值的。

2. 通用 UI shell 是有价值的  
   一部分控制能力确实可以在不同渠道之间复用。

3. Deck-only metadata 深插 OpenClaw core 的成本偏高  
   当前实现已经把一部分 Deck 私有诉求推进到了：
   - plugin manifest
   - plugin loader
   - plugin registry
   - gateway inventory
   - build/runtime staging

这对增强 fork 来说，显著提高了后续 upstream rebase 成本。

当前更深的问题不是“OpenClaw 端有太多 Deck 字段”，而是 **UI authority 已经分裂**：

- `ChannelDetail` 控制 tab 和 handoff
- `onboarding-registry` 控制 wizard 入口
- `AccessDescriptor` 控制 access/settings/status 局部 authority
- `wizard-spec-loader` 控制 Feishu DSL path
- `deck.plugins.list` 继续承载 `setupWizardSpec / deckActionCapabilities / locales`

如果只新增一个本地 registry，而不把这些 authority 收敛成单一组合根，那么 Deck 只会多出第四个权威来源。

因此需要重新收边界：

> **Deck 的 UI 编排权应主要留在 Deck 内部，并由单一组合根统一解释，而不是继续依赖 OpenClaw core/plugin self-described UI contract。**

---

## 2. 目标

本 spec 的目标不是删除现有能力，而是**重新定义权责边界**：

1. 建立 `Deck Local Authority` 作为 UI 主来源
2. 把 WeCom 作为专用高质量 UI 对象来设计
3. 保留有限但高价值的通用控制层
4. 把 manifest-backed metadata 收敛成一个隔离的 fallback adapter
5. 为未来逐步回撤 OpenClaw 端 Deck-only metadata 做准备
6. 后续新增 WeCom / Deck UI 需求默认只改 `dashboard/`

---

## 3. 非目标

本 spec 不做以下事情：

- 不追求“任意新增插件都能自动 UI 化”
- 不要求插件自描述完整 Deck 页面
- 不在本 spec 中新增新的 Gateway / plugin 协议
- 不在本 spec 中直接回滚当前实现
- 不把 WeCom 所有 capability 立即做成完整业务后台
- 不改变现有 WeCom / Feishu / Weixin 已可用的运行时行为
- 不在本 lane 中一次性做完 WeCom 全量页面实现

---

## 4. ADR

### 4.1 Decision

采用 **Option B tightened**：

- 先建立 `Deck Local Authority`
- 让其先接管页面、tab、action、wizard、access 编排权
- 当前 OpenClaw-side metadata 只保留为一个隔离的 fallback adapter
- 然后再接 WeCom page model
- 最后才准备回撤 OpenClaw 端的 Deck-only threading

### 4.2 Drivers

- 降低 upstream merge 热点：
  - `src/plugins/manifest.ts`
  - `src/plugins/loader.ts`
  - `src/plugins/registry-types.ts`
  - `src/gateway/server-methods/deck/plugins.ts`
- 保持当前 live path 可用：
  - `CapabilityActionBar.tsx` 仍读 `deckActionCapabilities`
  - `wizard-spec-loader.tsx` 仍读 `setupWizardSpec`
  - `dashboard/src/i18n/request.ts` 仍合并 plugin locales
- 把 WeCom 的产品化页面置于第一收益位，而不是先做大回滚
- 避免继续在页面组件里散落 `channelId` 判断和 metadata interpretation

### 4.3 Alternatives Considered

#### Option A

先回滚 OpenClaw-side metadata，再补 Deck local authority。

- 优点：最快减少 core 污染
- 缺点：会立刻打断 Feishu wizard、CapabilityActionBar、plugin locales 的现有路径

**Rejected**：当前 live path 还依赖 manifest-backed metadata，先删再补违反“先替换，再回撤”。

#### Option B

先建立 `Deck Local Authority`，先接管编排权，manifest-backed metadata 只保留为 fallback adapter；等 WeCom 页面和本地 authority 稳定后再回撤。

- 优点：与当前仓库现实一致，风险最低
- 缺点：迁移期会存在双来源，需要严格定义 local authority 优先级

**Chosen**。

#### Option C

维持现有 manifest-backed 设计，只继续做 WeCom 页面。

- 优点：短期改动最少
- 缺点：继续把 Deck-only UI 诉求绑在 core manifest/loader/gateway 上

**Rejected**：与“最低 upstream 合并成本”第一优先级直接冲突。

---

## 5. 边界定义

### 5.1 OpenClaw 端长期保留

- `channels.status`
- `channels.logout`
- `config.get`
- `config.schema`
- `config.patch`
- `deck.routing.*`
- `deck.plugins.list` 的基础 inventory

### 5.2 Deck 端长期保留

- `AccessDescriptor`
- `WizardRunner`
- `CapabilityActionBar`
- `ChannelDetail / ChannelSettingsTab / PluginsPanel / BindingsTab`
- WeCom 专用页面
- `Deck Local Authority`

### 5.3 OpenClaw 端未来回撤

以下内容被视为**过渡实现**，未来应逐步迁回 Deck：

- manifest 中的 Deck-only metadata
- loader / registry 中的 Deck-only metadata 处理
- gateway inventory 中的 Deck-only metadata 透传
- Deck-only asset staging

---

## 6. Deck Local Authority

### 6.1 文件结构

```text
dashboard/src/features/channels/registry/
  channel-ui-types.ts
  channel-ui-authority.ts
  channel-ui-registry.ts
  manifest-metadata-fallback.ts
  channel-ui-registry.test.ts
  wecom-ui-definition.ts
  feishu-ui-definition.ts
  openclaw-weixin-ui-definition.ts
```

### 6.2 单一组合根

`Deck Local Registry` 不是单纯的 `Record<string, Definition>`。

它必须通过单一 authority 函数统一解释 UI：

```ts
resolveChannelUiDefinition(channelId, {
  pluginInventory,
  channelFacts,
  channelSchema,
  accessDescriptor,
  onboardingDescriptor,
});
```

### 6.3 输出契约

组合根至少输出：

- page set
- page aliases
- action set
- onboarding surface
- settings mode
- access surface
- fallback source

### 6.4 薄 consumer

以下现有文件应逐步变成 authority 的薄 consumer：

- `dashboard/src/components/panels/channels/ChannelDetail.tsx`
- `dashboard/src/components/panels/channels/ChannelSettingsTab.tsx`
- `dashboard/src/components/panels/channels/CapabilityActionBar.tsx`
- `dashboard/src/components/panels/channels/onboarding-registry.tsx`
- `dashboard/src/components/panels/channels/wizard/wizard-spec-loader.tsx`

### 6.5 Fallback adapter

manifest-backed metadata 不再被页面组件直接消费，而只允许通过一个隔离 adapter 进入 authority。

这个 fallback adapter 负责统一归一化当前过渡字段：

- `setupWizardSpec`
- `deckActionCapabilities`
- plugin locales source

其角色是 **facts-only fallback**，不是第二个 UI authority。

---

## 7. IA 迁移契约

当前 live IA 与目标 IA 不一致，因此必须显式定义 alias 迁移。

### 7.1 当前 live IA

- `status`
- `access`
- `bindings`
- `settings`
- `analytics`

### 7.2 目标 IA

- `overview`
- `onboarding`
- `access`
- `settings`
- `diagnostics`
- `capabilities`
- `bindings`

### 7.3 Alias table

| Current        | Target                         | 说明                                                             |
| -------------- | ------------------------------ | ---------------------------------------------------------------- |
| `status`       | `overview`                     | `overview` 承接当前 status tab 的 probe、alerts、account summary |
| `access`       | `access`                       | 保持不变                                                         |
| `bindings`     | `bindings`                     | 保持不变                                                         |
| `settings`     | `settings`                     | 保持不变，但编排方式改由 authority 决定                          |
| `analytics`    | `analytics` deferred / generic | 不进入 WeCom 第一阶段目标 IA；保留 generic 或后置处理            |
| `onboarding`   | action/page entry              | 第一阶段不强制成为 tab，可由 action 或 page entry 进入           |
| `diagnostics`  | new page key                   | 第一阶段先建立 page key 和编排规则                               |
| `capabilities` | new page key                   | 第一阶段先建立 page key 和编排规则                               |

### 7.4 迁移期行为

- `onActivateStatusTab` 在迁移期 alias 到 `overview`
- pending access handoff 继续落到 `access`
- schema-only `ChannelDetail` 保持 generic `overview/settings/bindings` 路径

---

## 8. WeCom 页面模型

### 8.1 WeCom Overview

作用：

- 展示接入状态、账号状态、最近探测、主要告警、快捷动作

### 8.2 WeCom Onboarding

作用：

- 管理首次接入、重连、transport 选择、callback 配置

### 8.3 WeCom Access

作用：

- 管理 allowlist / access policy / 风险摘要

### 8.4 WeCom Settings

作用：

- 管理稳定配置项
- 采用 `通用 schema form + WeCom 专用 section` 的 hybrid 模式

### 8.5 WeCom Diagnostics

作用：

- 解释“为什么不通 / 哪个账号有问题 / 下一步怎么排”

第一版建立在当前已有 API 上：

- `channels.status`
- `channels.status { probe: true }`
- 本地诊断规则

### 8.6 WeCom Capabilities

作用：

- 以目录形式展示插件支持的能力
- 第一版只做：
  - 能力说明
  - 配置依赖
  - 风险提示
  - 文档入口
  - 验证入口

不直接做完整业务后台。

---

## 9. 迁移顺序

### Phase 0

冻结边界，不再新增 OpenClaw 端 Deck-only metadata。

### Phase 1

建立 `Deck Local Authority + fallback adapter`，但不改变当前行为。

### Phase 2

让 authority 成为 UI 主来源，先接管：

- `ChannelDetail`
- `ChannelSettingsTab`
- `CapabilityActionBar`
- `onboarding-registry`
- `wizard-spec-loader`
- access seam 编排

这一步发生在 WeCom page-model wiring 之前。

### Phase 3

显式接线 IA alias 迁移和 WeCom page model：

- `overview`
- `onboarding`
- `access`
- `settings`
- `diagnostics`
- `capabilities`
- `bindings`

### Phase 4

在 authority 已稳定后，再做 WeCom 页面深化实现：

- Overview
- Onboarding
- Settings
- Access
- Diagnostics
- Capabilities

### Phase 5

在本 lane 中只准备 rollback readiness artifacts：

- transitional inventory
- rollback checklist
- fallback dependency inventory

实际删除 OpenClaw 端 Deck-only metadata 与 staging 逻辑不在本 lane 中执行，需等 authority takeover 和后续页面深化稳定后另开 lane。

---

## 10. 验收标准

1. `resolveChannelUiDefinition(...)` 作为单一 authority 被明确定义
2. 新的 WeCom / Deck UI 需求默认不需要修改 OpenClaw core
3. `ChannelDetail / Settings / ActionBar / Onboarding / wizard loader` 不再散落 channel-id logic
4. WeCom、Feishu、Weixin 和 schema-only channel 的编排都能被 authority 表达
5. 当前 IA 到目标 IA 的 alias 迁移被文档化并可测试
6. 后续可以逐步移除 OpenClaw 端 Deck-only metadata，而不破坏 Deck 可用性

---

## 11. 风险

### 11.1 双来源漂移

迁移期同时存在：

- 当前 manifest-backed metadata
- Deck Local Authority

**Mitigation**：authority 为唯一主来源；fallback 只经单一 adapter 进入 normalized shape。

### 11.2 IA 迁移打断现有 tabs/actions

如果 `status -> overview`、`analytics` 去向、pending access handoff、schema-only channel 行为不显式写死，`ChannelDetail` 会重新长分支。

**Mitigation**：将 alias 契约和 handoff 行为写进 authority，并用结构测试锁定。

### 11.3 wizard seam 分裂

`onboarding-registry`、`wizard-spec-loader`、`CapabilityActionBar` 可能继续各自解释 wizard 来源。

**Mitigation**：统一通过 authority 决定 onboarding source；保留一个 manifest fallback adapter。

### 11.4 access seam 被绕开

WeCom access handoff 和 summary 在重构中可能丢失。

**Mitigation**：`AccessDescriptor` seam 明确保留，并作为 authority 输入，而不是被替代。

### 11.5 过早回撤 OpenClaw-side metadata

Feishu plugin locales、wizard spec、action bar 仍依赖现有路径。

**Mitigation**：本 lane 只做 readiness inventory，不做删除。

---

## 12. 最终结论

> Deck 应从“插件自描述 UI”回收为“Deck 策展式通用控制 + WeCom 专用高质量 UI”。  
> 当前 OpenClaw 端的 Deck-only metadata 只是过渡实现，长期应逐步撤回 Deck 本地。  
> 真正的第一步不是先删，而是先建立单一 `Deck Local Authority` 并让其接管现有 live seam。

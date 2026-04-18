# Deck WeCom Page Shell - 设计规范

> **状态**: Draft
> **日期**: 2026-04-18
> **范围**: Deck WeCom presenter / page shell
> **分支**: `enhanced`
> **前置**:
>
> - `docs/superpowers/specs/2026-04-18-deck-local-ui-registry-boundary-design.md`
> - `deck-access-model-contract`
> - `deck-manifest-driven-wizard`
> - `deck-plugin-manifest-expansion`

---

## 1. 背景

`Deck Local Authority` 这一层已经把以下事情收回到了 Deck：

- page ownership
- legacy IA alias
- onboarding / access / settings ownership
- action presence
- fallback compatibility adapter

下一步不再是继续做边界抽象，而是把 **WeCom 作为专用产品面** 落成真正的 presenter/page shell。

当前现实仍然是：

- `ChannelDetail` 主要还是 legacy tab presenter
- `status` tab 里承载了大量本应属于 `overview` 的内容
- `settings` tab 仍然同时承担技术配置和 onboarding entry
- `diagnostics` / `capabilities` 已经在 authority 里有 page key，但 presenter 还没有真正的页面壳

因此本 spec 的作用是：

> 在当前 authority 已稳定的前提下，把 WeCom 的目标 IA 从“定义存在”推进到“页面壳存在”，同时保持当前 Gateway / plugin contract 不扩张。

---

## 2. 目标

本 spec 的目标：

1. 为 WeCom 建立明确的 page shell 体系
2. 让 WeCom 的 presenter 真正按 `overview / onboarding / access / settings / diagnostics / capabilities / bindings` 组织
3. 保留 `Bindings` 的通用责任，不把 Routing / Plugins / global inventory 混入 WeCom 页面
4. 尽量只用当前已有 API 和当前已落地的 authority/fallback 结构
5. 把 WeCom 旧的 scattered surface 收口成产品化页面结构

---

## 3. 非目标

本 spec 不做以下事情：

- 不回撤 OpenClaw-side fallback metadata
- 不新增新的 OpenClaw-side Deck-only metadata
- 不把任意 channel 都做成同等级页面体系
- 不把 WeCom capability 直接做成完整业务后台
- 不改写现有 Routing / Plugins / Analytics 的全局职责
- 不要求在这一轮实现所有细节交互

---

## 4. 设计原则

### 4.1 WeCom 是产品面，不是 generic demo

WeCom 必须被视为重点对象。页面结构和内容允许明显比 generic channel 更深，不为了复用而削平体验。

### 4.2 通用壳继续复用，但只做零件

可复用的 generic building blocks 继续保留：

- `CapabilityActionBar`
- `WizardRunner`
- `AccessDescriptor`
- `ChannelSchemaSettings`
- `ChannelProbeStatus`
- `ChannelTestTool`
- `BindingsTab`

但这些只作为 **页面零件**，不再决定 WeCom 整体信息架构。

### 4.3 优先用现有 API

本轮默认只使用当前已存在能力：

- `channels.status`
- `channels.logout`
- `config.get`
- `config.schema`
- `config.patch`
- `deck.routing.*`
- `deck.plugins.list` 基础 inventory + 当前 fallback

只有当某个页面被现有 API 明确卡死时，才单独定义最小后端增量。

### 4.4 页面壳先于深度业务页

先把页面壳建立起来：

- 页面入口
- 页面职责
- 页面 section
- 页面间跳转

之后再逐页深化具体交互和运营能力。

---

## 5. WeCom 信息架构

WeCom 目标 IA 定为：

- `Overview`
- `Onboarding`
- `Access`
- `Settings`
- `Diagnostics`
- `Capabilities`
- `Bindings`

约束：

- `Bindings` 继续复用通用 surface
- `Analytics` 不进入 WeCom 第一阶段 page shell 主路径
- `Routing` 不在 WeCom presenter 内重复实现；只允许 summary / deep-link
- `Plugins` 不在 WeCom presenter 内重复实现；只允许 plugin context / deep-link

---

## 6. 页面定义

### 6.1 Overview

**职责**

- 展示接入状态
- 展示账号状态
- 展示最近 probe / test 结果
- 展示高价值告警
- 提供进入其他页面的快捷动作

**内容块**

- `WecomOverviewHeader`
- `WecomOverviewStatusCards`
- `WecomOverviewAccounts`
- `WecomOverviewPermissionSummary`
- `WecomOverviewConfigAlerts`
- `WecomOverviewNextActions`

**数据来源**

- `channels.status`
- `ChannelHealthBadge`
- `ChannelProbeStatus`
- `ChannelTestTool`
- `AccessDescriptor.renderStatusSummary`
- `channel-health-alerts`
- `channel-health-diagnostics`

**动作**

- 登录
- 探测
- 执行检查
- 打开 Access
- 打开 Settings
- 打开 Diagnostics

### 6.2 Onboarding

**职责**

- 承载首次接入
- 承载重新接入
- 承载 transport 选择
- 承载 callback / credential setup

**内容块**

- `WecomOnboardingHeader`
- `WecomOnboardingModeSummary`
- `WecomOnboardingEntry`
- `WecomOnboardingStatus`

**数据来源**

- `WeComWizard`
- `config.get`
- `config.schema`
- `config.patch`

**动作**

- 启动向导
- 重新接入
- 复制 callback URL
- 探测
- 执行检查

### 6.3 Access

**职责**

- 管理 allowlist / policy
- 展示并编辑 access-owned config
- 保持当前 `AccessDescriptor` seam 的主地位

**内容块**

- `WecomAccessHeader`
- `WecomAccessSummary`
- `WecomAccessPolicySection`
- `WecomAccessWarnings`

**数据来源**

- `AccessDescriptor`
- `config.get`
- `config.patch`

**动作**

- 编辑 policy
- 编辑 allowFrom
- 保存 patch

### 6.4 Settings

**职责**

- 管理技术配置
- 不重复承载 access-owned 配置
- 提供进入 onboarding 的入口

**内容块**

- `WecomSettingsHeader`
- `WecomSettingsSections`
  - `Bot`
  - `Agent`
  - `Callback`
  - `Retry`
  - `Advanced`
- `WecomSettingsSchemaFallback`

**数据来源**

- `config.get`
- `config.schema`
- `config.patch`
- `ChannelSchemaSettings`

**动作**

- 编辑字段
- 保存 patch
- 打开 Onboarding

### 6.5 Diagnostics

**职责**

- 解释为什么不通
- 解释哪个账号有问题
- 给出下一步排障动作

**内容块**

- `WecomDiagnosticsHeader`
- `WecomDiagnosticsProbeSummary`
- `WecomDiagnosticsAccountList`
- `WecomDiagnosticsRecentFailures`
- `WecomDiagnosticsSuggestedFixes`

**第一阶段数据来源**

- `channels.status`
- `channels.status { probe: true }`
- `ChannelProbeStatus`
- `ChannelTestTool`
- `channel-health-alerts`
- `channel-health-diagnostics`

**动作**

- 重新探测
- 执行检查
- 打开 Onboarding
- 打开 Access

### 6.6 Capabilities

**职责**

- 以目录形式展示 WeCom 已支持能力
- 先做能力目录，不做完整业务后台

**第一阶段分类**

- Approval
- Calendar
- Contact
- Doc
- External Contact
- MCP
- Meeting
- Todo

**内容块**

- `WecomCapabilitiesHeader`
- `WecomCapabilityCategoryList`
- `WecomCapabilityCard`

**每张能力卡至少展示**

- 名称
- 描述
- 配置依赖
- 风险说明
- 文档入口
- 验证入口

**数据来源**

- Deck-local capability catalog
- `config.get`
- `config.schema`
- `deck.plugins.list` 基础 inventory

### 6.7 Bindings

**职责**

- 继续使用现有通用 `BindingsTab`
- WeCom presenter 只负责将其纳入自身信息架构

**数据来源**

- `deck.routing.*`

---

## 7. 页面与现有 authority 的关系

`resolveChannelUiDefinition(...)` 继续是唯一编排入口。

本 spec 不改它的 authority 角色，而是在其上继续落 presenter shell：

- authority 决定页面存在与 ownership
- presenter 决定页面如何排版和承载 section

也就是说：

- authority = 页面存在性 / 入口 / ownership / alias
- page shell = 内容编排 / 页面结构 / 视觉层级 / 页面内交互组织

### 7.1 Slice-1 visibility contract

authority 不仅要表达 page existence，还要表达 **page entry visibility**。

对于 WeCom slice 1，authority-owned 字段统一命名为：

- `entryVisible`

它用来表达：

- page exists
- page is entry-visible in slice 1 secondary nav

本 spec 现在明确采用 `entryVisible`，不再留作执行时决定。

- `Overview`
- `Onboarding`
- `Access`

在 slice 1 中：

- `enabled = true`
- `entryVisible = true`

而：

- `Settings`
- `Diagnostics`
- `Capabilities`
- `Bindings`
- `Analytics`

在 slice 1 中：

- `enabled = true`
- `entryVisible = false`

这意味着：

- authority 继续承认这些页面是 WeCom 的合法 page keys
- presenter 不允许把它们暴露成 slice-1 secondary nav 的可点击入口
- 不能把这个决定留给 `ChannelDetail` 局部硬编码

---

## 8. 现有 IA 到 WeCom page shell 的迁移

迁移期不要求一步切掉 legacy tab，而是分层过渡：

### Phase A

- **明确 contract**: 第一批不新增新的 primary legacy tab，而是在当前 `ChannelDetail` presenter 内为 WeCom 增加一个 **secondary page-shell nav**。
- 这个 secondary nav 只服务 WeCom，并由 current authority 决定可见页面：
  - `Overview`
  - `Onboarding`
  - `Access`
- legacy primary tabs 在第一批继续保留：
  - `status`
  - `access`
  - `bindings`
  - `settings`
  - `analytics`
- **Onboarding host/sync rule**:
  - `Onboarding` 在 slice 1 中渲染于 legacy `status` host 内
  - 选择 secondary `Onboarding` 时，primary tab 必须切到 `status`
  - 点击 legacy `status` 时，secondary page 必须重置到 `Overview`
- **state ownership**:
  - slice 1 中 `ChannelDetail` 必须同时拥有两条协调状态轴：
    - primary legacy tab state
    - WeCom secondary page state
  - pending access handoff 必须同时解析两条状态轴：
    - primary = `access`
    - secondary = `Access`
- 预期 touched files:
  - `dashboard/src/components/panels/channels/ChannelDetail.tsx`
  - `dashboard/src/features/channels/registry/channel-ui-types.ts`
  - `dashboard/src/features/channels/registry/registry-base.ts`
  - `dashboard/src/features/channels/registry/wecom-ui-definition.ts`

- `status` 继续承载 `overview` 内容壳
- 明确 `onboarding` 为独立页面入口而不是只做 button/dialog
- `access` 继续承载现有 access shell
- `settings` 继续作为技术配置 compatibility guardrail，而不是第一批 presenter headline

### Phase B

- 把 `diagnostics` presenter 壳从 `status` 中分离出来
- 把 `capabilities` presenter 壳建立出来
- 深化 `settings` presenter 壳，但不让 access-owned 字段回流

### Phase C

- 评估是否从 legacy tab presenter 进一步迁移到真正的新 page surface
- 这一阶段不在本 spec 的第一实现批次中强制完成

---

## 9. 与旧 WeCom 权限设计的关系

`docs/plans/2026-04-16-deck-wecom-permission-management-design.md` 的原始方向保留，但信息架构更新：

- 原文的 “Overview / Access / Routing / Settings / Metrics” 被重新解释为：
  - `Overview`
  - `Access`
  - `Bindings`
  - `Settings`
  - `Diagnostics`
  - `Capabilities`
- 原来想放在 channel-local primary tab 的 Route Simulator，不再回流到 WeCom presenter 主路径
- 权限管理能力仍保留在 `Access`
- 连接和健康仍保留在 `Overview`

因此，这个 spec 不是否定旧 WeCom 权限设计，而是：

> 在新的 boundary 约束下，把旧设计里的 operator value 收口到新的 presenter shell。

---

## 10. 验收标准

1. WeCom 的 page shell 信息架构被完整定义
2. 每个页面的职责、主要 section、数据来源、关键动作被明确
3. 页面壳与 authority 的边界被明确
4. WeCom presenter 不重复承载 Routing / Plugins 的全局职责
5. 第一批实现推荐被明确收敛到 `Overview + Onboarding + Access`
6. 该设计默认基于当前已有 API，不要求新的 OpenClaw-side protocol 扩张

---

## 11. 风险

### 11.1 Presenter 先于真实数据深化

页面壳可能先存在，但某些页第一阶段只是容器，不会立刻具备完整业务深度。

### 11.2 Diagnostics 深度受当前 API 上限约束

如果后续想做更细的 transport telemetry，可能仍需要最小新增 Gateway surface。

### 11.3 Capability catalog 容易越界成业务后台

必须坚持第一阶段只做目录、说明、验证，不把 WeCom presenter 做成完整业务工作台。

## 12. 第一批实现边界

第一批 presenter/page-shell 推荐范围：

- `Overview`
- `Onboarding`
- `Access`

明确 defer：

### Settings deeper shell

- **blocker**: 当前 `Settings` 已经具备技术配置和 wizard entry，继续把它作为第一批 headline 会稀释 `Access` 的 operator value 收口
- **minimum now**: 保持现有技术设置和 access-owned field exclusion 正常
- **authority state in slice 1**: 继续保留 `settings` 作为 legacy primary tab；authority 里 `settings` 仍 `enabled = true`，但 `entryVisible = false`
- **follow-up**: 在 `Overview + Onboarding + Access` 稳定后再做 deeper settings-shell restyling

### Diagnostics

- **blocker**: 当前 API 适合先做第一版信息壳，但 presenter 深化优先级低于 onboarding/access 收口
- **minimum now**: 继续保留现有 probe / test / health / alert 信息
- **authority state in slice 1**: page key 继续存在，`enabled = true`，但 `entryVisible = false`
- **follow-up**: 后续 lane 单独建立 diagnostics shell，并在必要时枚举 narrow backend blocker

### Capabilities

- **blocker**: 第一批更需要先解决 WeCom 主 presenter coherence，而不是 capability catalog 的展示深度
- **minimum now**: 保持 capability 信息仍可从现有 inventory / docs 路径获取
- **authority state in slice 1**: page key 继续存在，`enabled = true`，但 `entryVisible = false`

### Bindings / Analytics slice-1 visibility

- **Bindings authority state in slice 1**: `enabled = true`, `entryVisible = false`
- **Analytics authority state in slice 1**: `enabled = true`, `entryVisible = false`
- **minimum now**:
  - `Bindings` 继续通过 legacy primary `bindings` tab 进入
  - `Analytics` 继续通过 legacy primary `analytics` tab 进入
- **follow-up**: 后续 lane 建 capability catalog page，但坚持目录而非完整业务后台

---

## 13. 最终结论

> `deck-local-ui-registry-boundary` 解决的是 “谁拥有编排权”。  
> `deck-wecom-page-shell` 解决的是 “WeCom 页面应该如何作为产品面出现”。  
> 下一个合理的 lane 不再是继续做抽象，而是把 WeCom 的 `overview / onboarding / access / settings / diagnostics / capabilities / bindings` 页面壳真正落成。

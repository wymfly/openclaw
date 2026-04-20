# Deck Manifest-Driven Wizard — 实施计划

> **关联 spec**: `docs/superpowers/specs/2026-04-17-deck-manifest-driven-wizard-design.md`
> **日期**: 2026-04-17
> **阶段**: task-specific ralplan draft
> **分支**: `enhanced`
> **执行方式**: 独立 lane；先于 `deck-plugin-manifest-expansion`
> **当前基线**: `FeishuWizard.tsx` 存在但未接入 `onboarding-registry.tsx`；当前代码无 `WizardRunner` / `WizardSpec` / `setupWizardSpec`

---

## 目录

- [§0 前置](#0-前置)
- [§1 PR #1：DSL 契约 + 最小 Gateway 透传](#1-pr-1dsl-契约--最小-gateway-透传)
- [§2 PR #2：WizardRunner + Feishu 迁移](#2-pr-2wizardrunner--feishu-迁移)
- [§3 PR #3：删除旧 FeishuWizard 路径](#3-pr-3删除旧-feishuwizard-路径)
- [§4 Feishu 基线 rereview gate](#4-feishu-基线-rereview-gate)
- [§5 删除 gate](#5-删除-gate)
- [§6 验证 gate 合集](#6-验证-gate-合集)
- [§7 执行者 checklist](#7-执行者-checklist)

---

## §0 前置

- Spec 2 必须独立执行，不和 `deck-plugin-manifest-expansion` 合包
- 本 lane **不得**引入 `locales` / `deckActionCapabilities` / `CapabilityActionBar`
- 当前 `FeishuWizard.tsx` 是迁移基线，不是立即删除对象
- 当前 `onboarding-registry.tsx` 只有 `wecom` / `openclaw-weixin` 两条目；Feishu 迁移必须以“新增接线路径”为前提，而不是替换现有安全围栏

---

## §1 PR #1：DSL 契约 + 最小 Gateway 透传

### 1.1 目标

新增 `WizardSpec` / validator / 最小 `deck.plugins.list.setupWizardSpec?` 透传，但**暂不切 Feishu**。

### 1.2 变更清单

- 新增 `src/plugin-sdk/wizard-spec.ts`
- 新增 `src/gateway/protocol/schema/wizard-spec.ts`
- 修改 `src/channels/plugins/types.plugin.ts`：增加 `setupWizardSpec?`
- 修改 `src/gateway/protocol/schema/deck.ts`：`DeckPluginInventoryEntrySchema` 增加 `setupWizardSpec?`
- 修改 `src/gateway/server-methods/deck/plugins.ts`：handler 透传 `setupWizardSpec`
- 跑 `pnpm protocol:gen:ts`
- Dashboard 侧新增：
  - `dashboard/src/components/panels/channels/wizard/wizard-spec.types.ts`
  - `dashboard/src/components/panels/channels/wizard/wizard-spec.validator.ts`
  - `dashboard/src/components/panels/channels/wizard/wizard-spec.validator.test.ts`

### 1.3 验收标准

- `setupWizardSpec?` 为纯 additive 字段
- `pnpm protocol:gen:check` 通过
- validator 测试覆盖：
  - 合法 spec
  - 缺字段
  - 重复 step id
  - 非法 action namespace
  - 非法 `$ref`
- `onboarding-registry.tsx` / `FeishuWizard.tsx` / WeCom / Weixin 均无行为变化

---

## §2 PR #2：WizardRunner + Feishu 迁移

### 2.1 目标

落地 `WizardRunner` 最小闭环，并让 Feishu 首次走 DSL 路径，但**保留旧 `FeishuWizard.tsx` 作为迁移对照**。

### 2.2 最小闭环范围

- 只支持 Feishu 当前真实需要的 step 类型
- 可优先支持：
  - `radio`
  - `form`
  - `action`
- 如果 `info` 不是真正刚需，可以延后到 PR #3 或保持最小实现
- 暂不做 plugin locales
- 暂不做 action bar / capability 扩展

### 2.3 变更清单

- 新增：
  - `dashboard/src/components/panels/channels/wizard/WizardRunner.tsx`
  - `dashboard/src/components/panels/channels/wizard/WizardRunner.test.tsx`
  - `dashboard/src/components/panels/channels/wizard/steps/*`
  - 如需：`wizard-spec-loader.ts`
- 修改：
  - `dashboard/src/components/panels/channels/onboarding-registry.tsx`
    - 新增 Feishu DSL 查询路径
    - 保留 `wecom` / `openclaw-weixin` custom renderer
  - `extensions/feishu/src/channel.ts`
    - 增加 `setupWizardSpec`

### 2.4 Feishu 共存策略

- `FeishuWizard.tsx` 继续保留
- runner 版 Feishu 路径接入后，旧 `FeishuWizard.tsx` 只作为：
  - 行为对照
  - 回归参考
  - 迁移缓冲
- 旧组件**不应**跨到 Spec 3

### 2.5 验收标准

- Feishu 可通过 DSL 路径完整走完当前 3-step 流程
- `FeishuWizard.tsx` 仍存在，但运行时主路径已转到 DSL
- `onboarding-registry.tsx` 中 WeCom / Weixin 路径不变
- 新增等价测试覆盖 Feishu 迁移后的核心行为

---

## §3 PR #3：删除旧 FeishuWizard 路径

### 3.1 目标

在 runner 版 Feishu 已被证明等价后，删除旧 `FeishuWizard.tsx` 路径与相关冗余。

### 3.2 删除前提

- Feishu rerouted path 已稳定
- 旧行为已有 runner 等价测试覆盖
- 旧 `FeishuWizard.tsx` 不再被任何运行时路径引用

### 3.3 变更清单

- 删除 `dashboard/src/components/panels/channels/FeishuWizard.tsx`
- 清理 `onboarding-registry.tsx` 中的 Feishu 旧接线残留
- 删除只服务于旧 FeishuWizard 的冗余测试和文案引用

### 3.4 验收标准

- `rg -n 'FeishuWizard' dashboard/src/components/panels/channels` 只剩允许的测试/历史引用，或零命中
- runner 版 Feishu 集成测试全部为绿
- WeCom / Weixin 安全围栏仍完全无差异

---

## §4 Feishu 基线 rereview gate

在 PR #2 开工前，必须先完成以下 rereview：

- 明确 `FeishuWizard.tsx` 当前的用户可见行为：
  - step 顺序
  - 校验条件
  - 保存 patch 形态
  - probe 成功/失败表现
- 把这些行为写成“迁移后必须等价”的检查项

基线行为至少包括：

- step 1: connection mode
- step 2: credentials
- step 3: probe
- 完成后写入 `feishu` config patch
- 文案继续以 `wizard.feishu.*` 为基线来源

---

## §5 删除 gate

只有满足以下条件，PR #3 才允许删除 `FeishuWizard.tsx`：

1. runner 版 Feishu 等价测试为绿
2. `onboarding-registry.tsx` 不再依赖旧 Feishu 组件
3. 旧路径零引用检查通过
4. 手工走一遍 Feishu onboarding，行为与基线无实质差异

---

## §6 验证 gate 合集

### 6.1 PR #1

- `pnpm protocol:gen:ts`
- `pnpm protocol:gen:check`
- `pnpm test <touched gateway/plugin/dashboard paths>`

### 6.2 PR #2

- `pnpm --dir dashboard test <touched wizard/onboarding paths>`
- Feishu DSL integration tests
- `onboarding-registry` integration tests
- WeCom / Weixin onboarding tests

### 6.3 PR #3

- `pnpm --dir dashboard test <touched wizard/onboarding paths>`
- Feishu delete-gate tests
- zero-reference grep

---

## §7 执行者 checklist

### PR #1 前

- [ ] 读完修订后的 Spec 2
- [ ] 读完 `.omx/context/deck-manifest-driven-wizard-20260417T074500Z.md`
- [ ] 明确本 lane 不碰 Spec 3 字段

### PR #1 中

- [ ] `setupWizardSpec?` additive 透传完成
- [ ] validator 测试齐全
- [ ] `protocol:gen:check` 通过

### PR #2 中

- [ ] Feishu rereview 基线已落盘
- [ ] Feishu DSL 路径可跑通
- [ ] 旧 `FeishuWizard.tsx` 继续保留
- [ ] WeCom / Weixin 路径未变

### PR #3 中

- [ ] 删除 gate 满足
- [ ] 旧 `FeishuWizard.tsx` 删除
- [ ] 零引用验证通过

### 全程共性

- [ ] 不引入 Spec 3 字段
- [ ] 不修改 WeCom / Weixin 安全围栏行为
- [ ] 每个 PR 都有清晰 stop/go 条件

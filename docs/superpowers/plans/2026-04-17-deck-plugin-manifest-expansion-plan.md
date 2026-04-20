# Deck Plugin Manifest Expansion - 实施计划

> **关联 spec**: `docs/superpowers/specs/2026-04-17-deck-plugin-manifest-expansion-design.md`
> **日期**: 2026-04-17
> **阶段**: task-specific ralplan draft
> **分支**: `enhanced`
> **执行方式**: 独立 lane；后于 `deck-manifest-driven-wizard`
> **当前基线**: Spec 2 已完成；`deck.plugins.list` 当前为 `setupWizardSpec` 走 runtime-aware diagnostics report；Deck i18n 仍是静态 `en/zh.json` 加载

---

## 目录

- [0 前置](#0-前置)
- [1 PR 1 Metadata foundation](#1-pr-1-metadata-foundation)
- [2 PR 2 Plugin locales and Feishu migration](#2-pr-2-plugin-locales-and-feishu-migration)
- [3 PR 3 Capability action bar](#3-pr-3-capability-action-bar)
- [4 Action surface gate](#4-action-surface-gate)
- [5 验证 gate 合集](#5-验证-gate-合集)
- [6 执行者 checklist](#6-执行者-checklist)

---

## 0 前置

- Spec 3 必须独立执行，不和 Spec 2 合包。
- 当前 live 现实与早期 spec 的最大差异：
  - Spec 2 已完成，Feishu 已不再使用 bespoke `FeishuWizard.tsx`
  - `deck.plugins.list` 为了 live Feishu runner 目前走 runtime-aware report，这是临时过渡态
  - `dashboard/src/i18n/request.ts` 当前只静态加载 `./{locale}.json`
  - Feishu wizard 文案仍位于 Deck 主 `wizard.feishu.*`
- WeCom / Weixin 仍是 Safety Fence；Spec 3 只能做 additive 集成，不能改变它们的行为。

---

## 1 PR 1 Metadata foundation

### 1.1 目标

建立 Spec 3 所需的 **control-plane visible** Deck-facing metadata 基线，避免继续依赖 Spec 2 时代的 runtime-only workaround。

### 1.2 变更清单

- 扩展 plugin-facing additive contract：
  - `locales?`
  - `deckActionCapabilities?` 或最终收敛后的等价 Deck-facing action contract
- 把以下字段纳入 snapshot/control-plane 可见路径：
  - `setupWizardSpec`
  - `locales`
  - `deckActionCapabilities`
- 修改：
  - `src/channels/plugins/types.plugin.ts`
  - `src/plugins/registry.ts`
  - `src/plugins/registry-types.ts`
  - `src/plugins/status.ts`
  - `src/gateway/protocol/schema/deck.ts`
  - `src/gateway/server-methods/deck/plugins.ts`
  - `dashboard/src/stores/plugins.ts`
- 跑：
  - `pnpm protocol:gen:ts`
  - `pnpm protocol:gen:check`

### 1.3 验收标准

- `deck.plugins.list` 能在 live 会话中稳定返回 Deck-facing metadata
- 若 snapshot path 已补齐，`deck.plugins.list` 应回到 snapshot report，而不是继续依赖 diagnostics report
- 测试能覆盖“snapshot 与 live inventory 一致”的关键断言

### 1.4 说明

这一步不是可选优化，而是 Spec 3 的前置修复。否则后续 locale/action metadata 又会重蹈 `setupWizardSpec` 的 live drift。

---

## 2 PR 2 Plugin locales and Feishu migration

### 2.1 目标

为 Deck 建立 plugin locale merge 机制，并用 Feishu 完成首个真实迁移。

### 2.2 变更清单

- 新增 plugin locale 资产：
  - `extensions/feishu/locales/en.json`
  - `extensions/feishu/locales/zh.json`
- 更新 Feishu plugin metadata：
  - `extensions/feishu/src/channel.ts`
  - `setupWizardSpec` 中的 `$t:` key 改为 `plugin.feishu.*`
- Deck 新增 locale merge helper：
  - `dashboard/src/lib/plugin-locales.ts`
- 服务端消息加载改造：
  - `dashboard/src/i18n/request.ts`
  - 如有必要，抽 shared server helper，避免 SSR 阶段自调 HTTP route
- 更新 Deck plugin inventory/store 类型以承接 `locales`
- 精简 Deck 主 locale 中的 `wizard.feishu.*`

### 2.3 额外实现要求

- `WizardRunner.resolveText()` 必须支持不止 `wizard.*`，还要支持 `plugin.<pluginId>.*`
- plugin locale merge 必须在 `NextIntlClientProvider` 创建前完成
- Gateway 不可用或 inventory 不可用时，locale merge 必须优雅降级到静态 Deck messages

### 2.4 验收标准

- Feishu settings + wizard live 渲染时不再依赖 Deck 主 `wizard.feishu.*`
- zh/en 两套语言都能打开 Feishu wizard 且不出现 `MISSING_MESSAGE`
- 其他 Deck 面板不受 plugin locale merge 影响

---

## 3 PR 3 Capability action bar

### 3.1 目标

在 `ChannelDetail` header 区域新增由 plugin inventory 驱动的 `CapabilityActionBar`，避免硬编码 channel id 分支。

### 3.2 变更清单

- 新增：
  - `dashboard/src/components/panels/channels/CapabilityActionBar.tsx`
  - `dashboard/src/components/panels/channels/CapabilityActionBar.test.tsx`
- 修改：
  - `dashboard/src/components/panels/channels/ChannelDetail.tsx`
  - `dashboard/src/stores/plugins.ts`
  - 相关 plugin channel files，补齐 action metadata

### 3.3 首批接入策略

基于当前代码证据，action surface 并不统一：

- Feishu：`auth.login` + `setupWizardSpec`
- WeCom：imperative `setupWizard`
- Telegram：imperative `setupWizard`
- Slack：imperative `setupWizard`
- Discord：`approvalCapability` + `probeAccount`，未见 setup wizard

因此 PR 3 的首批接入必须经过 action-surface gate，不允许假设所有渠道都支持统一 `login` RPC。

### 3.4 验收标准

- `ChannelDetail` header 出现 additive action 区
- `CapabilityActionBar` 不包含硬编码 channel-id 比较
- 已声明 metadata 的渠道按 contract 正确显示动作
- WeCom detail 页的 additive action 不得破坏现有 custom onboarding path

---

## 4 Action surface gate

在真正实现 action bar 前，先做一次 action-surface rereview，并形成 stop/go 结论。

### 4.1 当前已知

- 仓库里没有一个现成统一的 `channel.<id>.login` RPC 族
- `deckActionCapabilities.login: true` 只是布尔信号，还不足以唯一决定运行时行为

### 4.2 本 gate 必须回答

1. `login` 的 dispatch 优先级是什么？
   - `onboarding-registry`
   - plugin auth adapter
   - dedicated RPC
   - 其他
2. `probe` 是统一调用 `/api/channels?probe=true`，还是需要 channel-specific path？
3. `testMessage` 是否当前就有稳定 surface，还是应延后到后续 lane？
4. Discord 是否应该进入首批 rollout，还是留作 follow-up？

### 4.3 Stop/Go rule

- 如果以上 4 个问题没有达成一致，**不要开始 PR 3 代码实现**
- 先补 action contract 再进入实现

---

## 5 验证 gate 合集

### 5.1 PR 1

- `pnpm test src/gateway/server-methods/deck/plugins.test.ts`
- `pnpm test src/plugins/status.test.ts`
- `pnpm protocol:gen:ts`
- `pnpm protocol:gen:check`
- live inventory spot check：确认 snapshot/live metadata 一致

### 5.2 PR 2

- `pnpm --dir dashboard test <touched i18n/wizard/plugin inventory paths>`
- `pnpm --dir dashboard build`
- live Feishu zh/en wizard walkthrough
- zero `MISSING_MESSAGE` console errors

### 5.3 PR 3

- `pnpm --dir dashboard test <touched action-bar/channel-detail paths>`
- WeCom / Weixin existing tests
- live ChannelDetail walkthrough for channels in first rollout set
- structure grep：action bar 无 channel-id 字面量分支

---

## 6 执行者 checklist

### PR 1 前

- [ ] 读完修订后的 Spec 3
- [ ] 读完 `.omx/context/deck-plugin-manifest-expansion-20260417T135756Z.md`
- [ ] 明确这条 lane 的第一个目标是修正 metadata control-plane 基线

### PR 1 中

- [ ] `locales` / Deck-facing action metadata 为 additive 字段
- [ ] snapshot path 可见性有测试锁定
- [ ] `deck.plugins.list` live 与 tests 行为一致

### PR 2 中

- [ ] plugin locale merge 在 provider 初始化前完成
- [ ] Feishu 迁移到 plugin locale 资产
- [ ] `WizardRunner` 支持 `plugin.<id>.*` 解析
- [ ] Feishu zh/en live walkthrough 通过

### PR 3 中

- [ ] action-surface gate 先通过
- [ ] `CapabilityActionBar` 无硬编码 channel 分支
- [ ] WeCom / Weixin additive 集成不破坏既有路径

### 全程共性

- [ ] 不回退到 runtime-only metadata 漂移模式
- [ ] 不破坏 Spec 2 已完成的 Feishu runner 主路径
- [ ] 不把 WeCom / Weixin 行为变更混入 Spec 3

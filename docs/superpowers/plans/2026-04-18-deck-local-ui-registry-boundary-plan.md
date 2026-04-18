# Deck Local UI Registry Boundary - 实施计划

> **关联 spec**: `docs/superpowers/specs/2026-04-18-deck-local-ui-registry-boundary-design.md`
> **日期**: 2026-04-18
> **阶段**: task-specific ralplan draft
> **分支**: `enhanced`
> **执行方式**: 独立 lane；先于 WeCom 页面深化实现
> **当前基线**: Spec 1/2/3 已落地，但 Deck-only metadata 仍然穿过 OpenClaw core/plugin control-plane

---

## 0 ADR 摘要

- **决策**: 采用 Option B tightened
- **驱动**:
  - 降低 core/plugin/gateway merge 热点
  - 保持当前 live path 可用
  - 先把编排权收回 Deck，再深化 WeCom 页面
- **替代方案**:
  - 先删 OpenClaw-side metadata：高回归风险，拒绝
  - 维持 manifest-backed 设计只做 WeCom 页面：继续增债，拒绝

---

## 1 PR 1 建立 Deck Local Authority 与 fallback adapter

### 1.1 目标

建立单一 authority 和单一 fallback adapter，为后续 authority takeover 提供基础，但不改变当前行为。

### 1.2 变更清单

- 新增：
  - `dashboard/src/features/channels/registry/channel-ui-types.ts`
  - `dashboard/src/features/channels/registry/channel-ui-authority.ts`
  - `dashboard/src/features/channels/registry/channel-ui-registry.ts`
  - `dashboard/src/features/channels/registry/manifest-metadata-fallback.ts`
  - `dashboard/src/features/channels/registry/channel-ui-registry.test.ts`
  - `dashboard/src/features/channels/registry/wecom-ui-definition.ts`
  - `dashboard/src/features/channels/registry/feishu-ui-definition.ts`
  - `dashboard/src/features/channels/registry/openclaw-weixin-ui-definition.ts`
- authority 只先表达：
  - page presence
  - page alias
  - action presence
  - generic / hybrid / bespoke mode
  - onboarding / access / settings ownership
- fallback adapter 统一归一化：
  - `setupWizardSpec`
  - `deckActionCapabilities`
  - plugin locale source

### 1.3 Go 条件

- `resolveChannelUiDefinition(...)` 存在且是唯一编排入口
- `wecom / feishu / openclaw-weixin / schema-only` 都能被 authority 表达
- manifest-backed metadata 只通过单一 adapter 进入 authority
- 当前 UI 行为无变化

---

## 2 PR 2 Authority takeover

### 2.1 目标

让现有 live seam 先全部走 authority-first，再做 WeCom page-model wiring。

### 2.2 变更清单

- 修改：
  - `dashboard/src/components/panels/channels/ChannelDetail.tsx`
  - `dashboard/src/components/panels/channels/ChannelSettingsTab.tsx`
  - `dashboard/src/components/panels/channels/CapabilityActionBar.tsx`
  - `dashboard/src/components/panels/channels/onboarding-registry.tsx`
  - `dashboard/src/components/panels/channels/wizard/wizard-spec-loader.tsx`
  - `dashboard/src/components/panels/channels/access-descriptors/*` 接线层
- 责任：
  - 页面、tab、action、wizard、access 编排全部先走 `resolveChannelUiDefinition(...)`
  - `onActivateStatusTab`、pending access handoff、schema-only `ChannelDetail` 都经 authority 解释
  - manifest metadata 仅经 fallback adapter 参与

### 2.3 Go 条件

- 上述组件均改为 authority-first
- 不再在这些组件中新增散落的 channel-id 分支
- access-descriptor seam 仍可工作
- pending access handoff 不回归
- Channels / Plugins / onboarding 关键回归测试通过

---

## 3 PR 3 IA alias transition 与 WeCom page-model wiring

### 3.1 目标

把当前 live IA 到目标 IA 的过渡规则写死在 authority 中，并在 registry 中固定 WeCom page model。

### 3.2 变更清单

- 显式定义 alias：
  - `status -> overview`
  - `access -> access`
  - `bindings -> bindings`
  - `settings -> settings`
  - `analytics -> deferred generic`
  - `onboarding -> page/action entry`
  - `diagnostics -> new page key`
  - `capabilities -> new page key`
- 明确迁移期行为：
  - `onActivateStatusTab` alias 到 `overview`
  - pending access handoff 仍落 `access`
  - schema-only `ChannelDetail` 保持 generic `overview/settings/bindings`
- 在 registry 中固定 WeCom page model：
  - `overview`
  - `onboarding`
  - `access`
  - `settings`
  - `diagnostics`
  - `capabilities`
  - `bindings`

### 3.3 Go 条件

- IA alias 规则已文档化且被测试覆盖
- WeCom page-model 编排已完全由 authority 决定
- `analytics` 处理策略明确
- 本 PR 仍不要求全量 WeCom 页面实现

---

## 4 PR 4 Transitional inventory 与 rollback readiness

### 4.1 目标

明确当前哪些 OpenClaw-side surfaces 是 transitional，并为未来 rollback 建立条件，但不立即删除 live fallback。

### 4.2 变更清单

- 新增测试或文档，明确以下为 transitional：
  - `src/plugins/manifest.ts`
  - `src/plugins/loader.ts`
  - `src/plugins/registry-types.ts`
  - `src/gateway/protocol/schema/deck.ts`
  - `src/gateway/server-methods/deck/plugins.ts`
  - `scripts/copy-bundled-plugin-metadata.mjs`
  - `scripts/stage-bundled-plugin-runtime.mjs`
- 明确 client/server live seam：
  - action bar
  - wizard spec
  - plugin locale merge
- 增加 rollback readiness checklist

### 4.3 Go 条件

- transitional surfaces 已有清单和 readiness 条件
- 没有删除任何仍被 live path 依赖的 fallback

---

## 5 验证矩阵

### 5.1 Authority 与 hardcoded-id guards

```bash
pnpm --dir dashboard test \
  src/features/channels/registry/channel-ui-registry.test.ts \
  src/components/panels/channels/channel-detail-no-hardcoded-ids.test.ts \
  src/components/panels/channels/__tests__/onboarding-registry.test.tsx \
  src/components/panels/channels/__tests__/onboarding-registry.integration.test.tsx
```

执行要求：

- 扩展 `src/components/panels/channels/channel-detail-no-hardcoded-ids.test.ts`
  或新增等效结构守卫，使 `onboarding-registry.tsx` 也受 hardcoded-id guard 保护

### 5.2 Wizard seam

```bash
pnpm --dir dashboard test \
  src/components/panels/channels/wizard/wizard-spec-loader.test.tsx \
  src/components/panels/channels/wizard/WizardRunner.test.tsx
```

### 5.3 Action bar, access, schema-only detail

```bash
pnpm --dir dashboard test \
  src/components/panels/channels/CapabilityActionBar.test.tsx \
  src/components/panels/channels/ChannelDetail.access-handoff.test.tsx \
  src/components/panels/channels/ChannelDetail.permission-summary.test.tsx \
  src/components/panels/channels/channel-detail-schema-only.test.tsx
```

### 5.4 Feishu 与 openclaw-weixin onboarding 回归

```bash
pnpm --dir dashboard test \
  src/components/panels/channels/__tests__/openclaw-weixin-wizard.test.tsx \
  src/components/panels/channels/__tests__/onboarding-registry.integration.test.tsx
```

### 5.5 Plugin locale merge 与 inventory 稳定性

```bash
pnpm --dir dashboard test \
  src/lib/__tests__/plugin-locales.test.ts \
  src/i18n/wizard-feishu-messages.test.ts \
  src/stores/__tests__/plugins.test.ts \
  src/app/api/deck/plugins/route.test.ts
```

### 5.6 Core/OpenClaw-side regression

```bash
pnpm test \
  src/gateway/server-methods/deck/plugins.test.ts \
  src/plugins/status.test.ts \
  extensions/feishu/src/channel.test.ts \
  extensions/feishu/src/locales.test.ts
```

### 5.7 Build gates

```bash
pnpm protocol:gen:check
pnpm build
pnpm --dir dashboard build
```

---

## 6 关键风险与缓解

- **双来源漂移**
  - 缓解：authority 为唯一主来源；fallback 只经 adapter 输出 normalized shape
- **IA 迁移打断现有 tabs/actions**
  - 缓解：alias map 文档化并测试化
- **wizard seam 分裂**
  - 缓解：`onboarding-registry` 和 `wizard-spec-loader` 都通过 authority 解释
- **access seam 被绕开**
  - 缓解：`AccessDescriptor` 作为 authority 输入保留
- **scope 失控**
  - 缓解：本 lane 只做 authority、alias、编排接线，不做 WeCom 全量页面实现

---

## 7 推荐执行方式

- **推荐**：`ralph`
  - 这是单一边界 lane，顺序依赖强，适合单 owner 持续推进
- **不推荐**：先用 `team` 把页面实现和 rollback 拆平行 lane
  - 当前先决条件是 authority 和 alias contract，不是 WeCom 全量页面

### 可用 agent 类型

- `architect`
- `planner`
- `executor`
- `test-engineer`
- `verifier`
- `critic`

### staffing guidance

- `ralph`:
  - leader: `executor`
  - checkpoints: `architect` + `critic` + `verifier`
- `team`:
  - 仅在 authority 已稳定后，用于 WeCom 页面深化或 rollback lane

---

## 8 执行者 checklist

- [ ] 不再新增新的 OpenClaw-side Deck-only metadata
- [ ] 先建 authority + fallback adapter
- [ ] 先接管编排权，再做 WeCom page-model wiring
- [ ] WeCom 页面优先级高于 generalized plugin self-description
- [ ] rollback 采取“先替换，再回撤”

# Deck Local UI Registry Boundary - Rollout Readiness

> **关联 spec**: `docs/superpowers/specs/2026-04-18-deck-local-ui-registry-boundary-design.md`
> **关联 plan**: `docs/superpowers/plans/2026-04-18-deck-local-ui-registry-boundary-plan.md`
> **目的**: 记录当前仍属于 transitional 的 OpenClaw-side Deck metadata surfaces，以及未来 rollback lane 的删除前提

---

## 1. 当前 transitional OpenClaw-side surfaces

以下 surface 仍然被视为 transitional compatibility layer，不应再继续扩张：

- `src/plugins/manifest.ts`
- `src/plugins/loader.ts`
- `src/plugins/registry-types.ts`
- `src/gateway/protocol/schema/deck.ts`
- `src/gateway/server-methods/deck/plugins.ts`
- `scripts/copy-bundled-plugin-metadata.mjs`
- `scripts/stage-bundled-plugin-runtime.mjs`

这些 surface 当前仍承载的 Deck-only metadata 事实包括：

- `setupWizardSpec`
- `deckActionCapabilities`
- plugin locale bundles

---

## 2. 当前仍通过 fallback 消费这些 surface 的 Deck 路径

以下 Deck consumer 仍通过 manifest-backed fallback 获取 transitional metadata：

- `dashboard/src/components/panels/channels/CapabilityActionBar.tsx`
  - 通过 authority 的 fallback adapter 获取 `deckActionCapabilities`
- `dashboard/src/components/panels/channels/wizard/wizard-spec-loader.tsx`
  - 通过 authority 的 fallback adapter 获取 `setupWizardSpec`
- `dashboard/src/lib/plugin-locales.ts`
  - 通过 `deck.plugins.list` 获取 plugin locales
- `dashboard/src/i18n/request.ts`
  - 继续在 server request path 上 merge plugin locales

结论：

- authority 已经接管 UI 编排
- 但 OpenClaw-side metadata 仍是 facts-only fallback source
- 当前不能删除这些 upstream-facing surfaces

---

## 3. 当前已完成的替换面

以下 surface 已经进入 authority-first：

- `dashboard/src/components/panels/channels/ChannelDetail.tsx`
- `dashboard/src/components/panels/channels/ChannelSettingsTab.tsx`
- `dashboard/src/components/panels/channels/CapabilityActionBar.tsx`
- `dashboard/src/components/panels/channels/wizard/wizard-spec-loader.tsx`

authority 当前已表达：

- `wecom`
- `feishu`
- `openclaw-weixin`
- schema-only channels

authority 当前已固定：

- legacy IA alias
- WeCom target page model
- onboarding/access/settings ownership
- action presence

---

## 4. 删除前提

只有当下面条件全部满足时，才允许另开 rollback lane 删除 transitional OpenClaw-side surfaces：

1. `resolveChannelUiDefinition(...)` 继续是唯一 UI composition root
2. `CapabilityActionBar` 不再需要直接或间接依赖 manifest-backed action metadata
3. `wizard-spec-loader` 不再需要直接或间接依赖 manifest-backed wizard metadata
4. plugin locale merge 有替代来源，或已明确改为 Deck-local source
5. `wecom / feishu / openclaw-weixin / schema-only` 的 authority-first regression 全绿
6. 删除动作不会要求重新把编排逻辑塞回 page component

---

## 5. 删除禁令

在满足删除前提前，禁止：

- 删除 `deck.plugins.list` 中当前仍被 live path 消费的 metadata
- 删除 loader / manifest 中当前仍被 bundle/runtime staging 使用的 Deck-only asset threading
- 通过“让测试不再覆盖”来伪装 fallback 已不再使用

---

## 6. 建议 rollback lane 范围

未来 rollback lane 应只做：

- transitional surface inventory re-check
- fallback dependency count-down
- OpenClaw-side Deck metadata 删除
- 对应 regression test 调整

未来 rollback lane 不应混入：

- WeCom 页面深化
- 新的 Deck feature work
- 新的 OpenClaw-side Deck-only metadata

---

## 7. 当前结论

当前最合理的状态是：

- authority-first 已落地
- fallback 仍有 live 消费
- readiness 已具备
- **删除尚未具备**

因此当前 lane 到此应停止在：

- authority
- alias
- seam takeover
- readiness inventory

而不是继续推进真正的 OpenClaw-side rollback。

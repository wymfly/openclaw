# Deck WeCom Page Shell - 实施计划

> **关联 spec**: `docs/superpowers/specs/2026-04-18-deck-wecom-page-shell-design.md`
> **日期**: 2026-04-18
> **阶段**: task-specific ralplan draft
> **分支**: `enhanced`
> **当前基线**: `deck-local-ui-registry-boundary` 已完成 authority / alias / seam takeover / readiness inventory

---

## 0 前置判断

- 这不是新的 boundary lane。
- 这不是 rollback lane。
- 这是 **WeCom presenter / page-shell lane**。
- 必须以当前 authority/fallback 为基线继续推进，而不是重新设计 authority。

---

## 1 第一批实现候选

### Option A

先做：

- `Overview`
- `Onboarding`
- `Settings`

优点：

- 直接提升 WeCom “进入页面后的第一印象”
- 最符合 page shell 思路
- 对现有 `status + settings + wizard` 的 presenter 收口最直接

缺点：

- `Access` 的深度 operator value 没被第一时间纳入 page-shell 改造

### Option B

先做：

- `Overview`
- `Access`
- `Diagnostics`

优点：

- 对 operator value 最强
- 更贴近旧的 permission-management baseline

缺点：

- `Onboarding` 和 `Settings` 仍会继续分裂在旧 presenter 结构里

### Option C

先做：

- `Overview`
- `Onboarding`
- `Access`
- `Settings`

优点：

- 4 个核心页面一次性成型

缺点：

- 首批 diff 和 review 面会显著扩大
- 对现有 presenter 重组风险更高

### 当前推荐

默认推荐 **Overview + Onboarding + Access**：

- `Overview` 建立 WeCom 顶层 presenter 壳
- `Onboarding` 解决当前最明显的 scattered surface 问题
- `Access` 保留并强化旧的 permission-management operator value
- `Settings` 作为 compatibility guardrail 保持稳定，但不是第一批 headline

这个推荐仍需在本轮 ralplan 中过 architect / critic。

---

## 2 可能的 PR slicing

### PR 1 WeCom Overview shell

- 在当前 `ChannelDetail` / authority 基础上建立 `Overview` presenter 壳
- 采用 **secondary page-shell nav**，不新增新的 primary legacy tab
- 先补 authority-owned visibility contract，使 presenter 不必自行硬编码筛掉 deferred pages
- authority 字段命名固定为 `entryVisible`
- slice 1 明确保留并接通 `Overview -> Access` 的现有 action seam：
  - `status-summary` / permission-summary 中的 `Open Access`
  - 必须通过共享 access-descriptor seam 和 `openAccessTab(...)` handoff 生效
  - `dashboard/src/components/panels/channels/access-descriptors/hooks.ts` 中的 no-op `openAccessTab` 不能继续作为 slice-1 运行态
- 同步规则：
  - 选择 secondary `Overview` 通过 legacy `status` 渲染
  - 点击 legacy `status` 默认落到 `Overview`
- 收口现有 status 内容块：
  - 健康
  - probe/test
  - account summary
  - permission summary
  - alerts / next actions

### PR 2 WeCom Onboarding shell

- 建立专用 Onboarding 页面入口
- 页面入口通过 WeCom-only secondary nav 暴露，不要求新增新的 legacy primary tab
- 不再只依赖 header action / wizard dialog 作为唯一入口
- 保留 `WeComWizard` 为实际接入执行器
- 同步规则：
  - `Onboarding` 在 slice 1 中渲染于 legacy `status` host 内
  - `Onboarding` 只出现在 secondary nav
  - 选择 secondary `Onboarding` 时，primary tab 切到 `status`
  - 点击 legacy `status` 时，secondary page 重置到 `Overview`
  - 不新增新的 primary legacy tab

### PR 3 WeCom Access shell

- 把 Access 作为第一批 page shell 正式纳入 presenter
- 保留并强化旧 WeCom permission-management baseline 中的 operator value
- 明确 account-target handoff、permission summary、allowFrom / DM policy / dynamic-agent editing 都继续归 Access
- 同步规则：
  - 选择 secondary `Access` 通过 legacy `access` 渲染
  - pending access handoff 同时解析两条状态轴：
    - primary = `access`
    - secondary = `Access`

### PR 4 WeCom Settings compatibility guardrail

- 保持技术设置稳定
- 保持 access-owned fields 不回流
- 明确这是 compatibility guardrail，不是第一批 headline presenter
- 同步规则：
  - `Settings` 在 slice 1 中保持 `enabled = true`
  - `Settings` 在 slice 1 secondary nav 中必须 `entryVisible = false`
  - `Settings` 继续只通过 legacy primary `settings` tab 进入

### PR 5 Diagnostics / Capabilities follow-up

- 这两个 page shell 明确 deferred
- slice 1 中 authority 继续保留 page keys，但必须通过 authority-owned visibility contract 表达为 `entryVisible = false`
- defer 必须继续遵守：
  - blocker
  - minimum shipped behavior now
  - follow-up removal step

### PR 6 Bindings / Analytics visibility contract

- `Bindings` 和 `Analytics` 在 slice 1 中继续保留为 authority pages
- 但 secondary nav 中必须 `entryVisible = false`
- 它们继续只通过 legacy primary tabs 进入，不进入 WeCom-only secondary nav

---

## 3 Stop / Go 条件

### PR 1 Go

- Overview 壳真实收口了 status 内容，而不是仅换标题
- secondary page-shell nav contract 已被锁定
- authority-owned visibility contract 已被锁定
- 现有 WeCom runtime operations 不回归

### PR 2 Go

- Onboarding 已有稳定页面入口
- 页面入口通过 WeCom-only secondary nav 稳定存在
- 不再只有 button/dialog 一条路径
- `WeComWizard` 仍是执行器，不回归

### PR 3 Go

- Access 壳建立
- access-owned fields 继续明确归 Access
- 旧 permission-management baseline 的 operator value 不回归

### PR 4 Go

- Settings 仍稳定
- access-owned fields 未回流
- `ChannelSchemaSettings` 路径未回归

### PR 5 Go

- 如果进入 follow-up lane，必须明确 blocker / minimum shipped behavior / follow-up step
- 不能把 deferred 只写成笼统 future work

---

## 4 推荐验证

```bash
pnpm --dir dashboard test \
  src/components/panels/channels/ChannelDetail.access-handoff.test.tsx \
  src/components/panels/channels/ChannelDetail.permission-summary.test.tsx \
  src/components/panels/channels/wecom-settings-technical-panel.integration.test.tsx \
  src/components/panels/channels/wecom-access-boundary.integration.test.tsx \
  src/components/panels/channels/__tests__/onboarding-registry.test.tsx \
  src/components/panels/channels/__tests__/onboarding-registry.integration.test.tsx \
  src/components/panels/channels/__tests__/openclaw-weixin-wizard.test.tsx \
  src/components/panels/channels/channel-detail-no-hardcoded-ids.test.ts \
  src/components/panels/channels/CapabilityActionBar.test.tsx

pnpm --dir dashboard build
```

如果第一批 presenter 壳引入新的页面组件，还应追加对应 component / integration tests。

还应显式补：

- `dashboard/src/features/channels/registry/channel-ui-registry.test.ts`
- `dashboard/src/components/panels/channels/channel-detail-no-hardcoded-ids.test.ts`
- `Routing / Plugins` 继续只以 summary / deep-link 形式出现的 presenter 测试
- 新 page shell 仍由 `resolveChannelUiDefinition(...)` 控制 existence/ownership 的测试
- secondary page-shell nav 的 presenter test
- deferred `Settings / Diagnostics / Capabilities` 不会暴露成 broken/empty shell 的 presenter test
- secondary nav 与 legacy `status / access` 同步行为测试
- pending access handoff 仍落到 Access page/shell 的测试

推荐把验证集合按 package name 组织为：

- `authority-registry`
- `channel-detail-no-hardcoded-ids`
- `overview-open-access-handoff`
- `secondary-nav`
- `hidden-page`
- `Routing/Plugins summary-only`
- `pending-access-handoff`
- `onboarding-host`

---

## 5 执行者 checklist

- [ ] 不重新发明 authority
- [ ] 不扩 OpenClaw-side metadata
- [ ] 不把 Routing / Plugins 复制进 WeCom presenter
- [ ] 第一批实现范围固定为 `Overview + Onboarding + Access`
- [ ] `Onboarding` 入口 contract 固定为 WeCom-only secondary page-shell nav，不新增新的 primary legacy tab
- [ ] `Onboarding` 在 slice 1 中明确渲染于 legacy `status` host 内
- [ ] `ChannelDetail` 显式拥有 primary legacy tab + WeCom secondary page 两条状态轴
- [ ] `Bindings / Analytics / Settings` 在 slice 1 secondary nav 中统一 `entryVisible = false`
- [ ] 保持旧 WeCom permission-management baseline 的 operator value 不被静默丢失

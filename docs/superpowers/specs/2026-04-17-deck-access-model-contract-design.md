# Deck Access Model Contract — 设计规范

> **状态**: Approved (2026-04-17 G2 第二轮通过，7 项契约细化已落盘)
> **日期**: 2026-04-17
> **范围**: Dashboard (`dashboard/src/components/panels/channels/**` + `panels/plugins/PluginsPanel.tsx`) 内部重构，零 Gateway 改动
> **分支**: `enhanced`
> **前置讨论**: 用户选择路径 B（L2 成熟：AccessDescriptor + Wizard DSL）、3 spec 串行、本 spec 先行
> **后续 spec**: `deck-manifest-driven-wizard`（P1）、`deck-plugin-manifest-expansion`（P2，已就绪）

---

## 1. 背景与目标

### 1.1 问题

Deck Dashboard 在 WeCom 权限管理落地（`93584159ff` "Give Deck operators a coherent WeCom permission workspace"）后，为每一个"带权限管理的渠道"都需要在 Dashboard 主代码里开发专属分支。当前仅 WeCom 一个渠道，但已经在下列文件中形成不可维护的硬编码：

- `dashboard/src/components/panels/channels/ChannelDetail.tsx:218-341` 含多处 `channelId !== "wecom"` / `channelId === "wecom"` 分支
- `dashboard/src/components/panels/channels/ChannelAccessTab.tsx:68-84` 通过 `getChannelAccessDescriptor(channelId)` 硬编码返回 wecom
- `dashboard/src/components/panels/channels/channel-access-registry.ts` 字典仅一条目
- `dashboard/src/components/panels/channels/wecom-access-model.ts` 业务逻辑与 UI 层纠缠

下一个要加权限管理的渠道（Discord、Slack、Telegram 等）若沿用这条路线，`ChannelDetail` 将继续膨胀 `if (channelId === ...)` 分支，且业务模型与 UI 渲染分离困难。

### 1.2 目标

用**最小契约 + 注册表**模式将权限管理能力从 Deck 主代码中解耦：

- 定义 `AccessDescriptor` 契约（规定"怎么挂载 Access Tab + Status Summary + Settings 排除路径"，不规定 state shape）
- 将 WeCom 现有权限工作区 1:1 包装为首个 descriptor
- 消除 `ChannelDetail` / `ChannelAccessTab` / `ChannelSettingsTab` 中所有渠道 id 字面量比较
- 保留 `selectedAccountId` handoff 语义（`ChannelDetail.access-handoff.test.tsx` 回归基线不变）
- 新增权限管理时只需"注册 descriptor"，不改 Deck 主代码

### 1.3 非目标

- ❌ 不做 Wizard DSL 抽象（下一个 spec `deck-manifest-driven-wizard`）
- ❌ 不做 Schema-first 完善（已基本达成，discovery 阶段顺手验证）
- ❌ 不做 Remote Component / 微前端（L3 层级，本次明确排除）
- ❌ 不改 Gateway RPC 契约（纯 Dashboard 内部重构）
- ❌ 不做跨渠道组件复用的强制化（`AllowFromEditor` 等保持为 wecom 私有，后续有需求再提取为可选共享组件）

---

## 2. 当前状态分析（基于 2026-04-17 代码事实核对后的修订版本）

> **修订说明**：2026-04-17 G2 审查揭示原 §2.1 低估了 wecom 代码在 Deck 侧的分布。下表是基于实际代码行号重盘点的结果。

### 2.1 受影响文件（按处置类别）

#### A. 零改动（业务逻辑，Safety Fence）

| 文件                                           | 规模     | 理由                                                                                   |
| ---------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `wecom-access-model.ts`                        | 131 行   | 业务逻辑纯函数；`buildWecomAccessModel(channel, channelConfig)` 被 descriptor 直接调用 |
| `AllowFromEditor.tsx`                          | 现状不变 | 受控 list editor；props: `entries/onChange/formatHint/normalize/placeholder`           |
| `BindingsTab.tsx`                              | 现状不变 | 与 access 无关；`channelId` prop 驱动内部 store 订阅                                   |
| `DmPolicySelector.tsx`                         | 现状不变 | 受控选择器                                                                             |
| `WeComWizard.tsx` / `OpenClawWeixinWizard.tsx` | 现状不变 | onboarding wizard，与 access descriptor 正交                                           |

#### B. 代码整体迁移（行级 1:1 保持，位置改变）

| 文件 / 片段                       | 现位置                         | 新位置                                                                             | 规模    |
| --------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------- | ------- |
| `WecomAccessTab` 组件             | `ChannelAccessTab.tsx:101-621` | `access-descriptors/wecom-access-descriptor.tsx` 的 `renderAccessTab()` export     | ~520 行 |
| WeCom permission summary UI       | `ChannelDetail.tsx:514-657`    | `access-descriptors/wecom-access-descriptor.tsx` 的 `renderStatusSummary()` export | ~140 行 |
| `WECOM_ACCESS_EXCLUDE_PATHS` 常量 | `ChannelSettingsTab.tsx:15-22` | descriptor 的 `settingsExcludePaths: readonly string[]` 元数据                     | 8 行    |

**原则**：代码**一行不改**，只是从原文件删除并在 descriptor 里以相同内容出现（仅 import 路径与 export 方式调整）。

#### C. 重构（消除硬编码分支）

| 文件                     | 变更点                                                                    | 减少的 wecom 分支                                                                          |
| ------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `ChannelDetail.tsx`      | L218 / L221 / L285-302 / L304-321 / L353-409 / L514-657 / L796-811 / L910 | 7 处 `channelId === "wecom"` 字面量比较 + 两个 wecom-only `useEffect` + 140 行 summary UI  |
| `ChannelAccessTab.tsx`   | L56-99 外层简化                                                           | `descriptor.accessKey === "wecom"` 分支消除                                                |
| `ChannelSettingsTab.tsx` | L41                                                                       | 1 处 `channelId === "wecom"` 消除；`WECOM_ACCESS_EXCLUDE_PATHS` 通过 descriptor 元数据取得 |
| `PluginsPanel.tsx`       | L15, L42                                                                  | `hasDedicatedAccessSurface` → `hasAccessDescriptor` 的 import 替换                         |

#### D. 退役（PR #3）

| 文件                              | 动作 | 理由                                              |
| --------------------------------- | ---- | ------------------------------------------------- |
| `channel-access-registry.ts`      | 删除 | 功能被新 `access-descriptor-registry.ts` 完全取代 |
| `channel-access-registry.test.ts` | 删除 | 与源文件一并                                      |

#### E. 新增（PR #1 / PR #2 / PR #3）

| 文件                                                    | PR                    | 规模                                             |
| ------------------------------------------------------- | --------------------- | ------------------------------------------------ |
| `access-descriptors/access-descriptor.types.ts`         | PR #1                 | ~60 行                                           |
| `access-descriptors/access-descriptor-registry.ts`      | PR #1                 | ~50 行                                           |
| `access-descriptors/access-descriptor-registry.test.ts` | PR #1                 | ~80 行                                           |
| `access-descriptors/AccessPanel.tsx`                    | PR #1 或 PR #2        | ~40 行                                           |
| `access-descriptors/hooks.ts`                           | PR #2                 | ~60 行                                           |
| `access-descriptors/index.ts`                           | PR #1 + PR #2（注册） | ~10 行                                           |
| `access-descriptors/wecom-access-descriptor.tsx`        | PR #2                 | ~700 行（含整体迁移的 WecomAccessTab + summary） |
| `access-descriptors/wecom-access-descriptor.test.tsx`   | PR #2                 | ~120 行                                          |
| `channel-detail-no-hardcoded-ids.test.ts`               | PR #3                 | ~30 行                                           |
| `docs/plugins/sdk-access-model.md`                      | PR #1                 | ~80 行                                           |

#### F. 回归基线（保留且必须全绿）

| 文件                                                    | 保护内容                                           |
| ------------------------------------------------------- | -------------------------------------------------- |
| `wecom-access-boundary.integration.test.tsx`            | 行为不变，import 可能微调                          |
| `ChannelDetail.permission-summary.test.tsx`             | permission summary UI 文案与结构                   |
| `ChannelDetail.access-handoff.test.tsx`                 | **selectedAccountId handoff（受控/非受控双模式）** |
| `ChannelAccessTab.test.tsx`                             | access tab 外层行为                                |
| `BindingsTab.handoff.test.tsx` / `BindingsTab.test.tsx` | bindings tab，与 access 正交                       |
| `AllowFromEditor.test.tsx`                              | list editor，与 access descriptor 正交             |
| `WeComWizard.access-guidance.test.tsx`                  | 引导文案                                           |

#### G. 禁止修改（i18n Safety Fence）

| 文件                         | 禁改范围                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| `dashboard/src/i18n/en.json` | `channels.wecom.*` / `channels.access.*` / `wecomWizard.*` / `wecomAccess.*` 相关 section |
| `dashboard/src/i18n/zh.json` | 同上                                                                                      |

### 2.2 已验证的代码事实（替代原"未知项"）

原 §2.2 的 3 个未知项已通过 2026-04-17 代码审阅确认：

1. **Tab 显隐职责**：`hasDedicatedAccessSurface(channelId)` 语义等价于"该 channelId 有 descriptor 注册"→ **不引入 `shouldShow` 元数据**，改用 `hasAccessDescriptor(channelId)` 统一判定
2. **组件 store 依赖**：
   - `AllowFromEditor` 完全由 props 驱动（无 store 引用）
   - `BindingsTab` 依赖 `useDeckRoutingStore`，但与 access descriptor 正交（非 wecom access 组件）
   - `WecomAccessTab` 依赖 `useChannelsStore` / `useDeckRoutingStore` —— descriptor 实现中**保留 store 直连**（不强制注入），理由：迁移目标是消除硬编码 channel id，不是重写 wecom 数据流
3. **`selectedAccountId` handoff 语义**：由 `ChannelDetail.access-handoff.test.tsx:147, 156` 强制保护；descriptor 契约必须提供 `handleManageAccess?(accountId, actions)` 接口让 ChannelDetail Status tab 的 "Manage Access" 按钮能把 accountId 传入 Access tab（受控模式）

---

## 3. 架构设计

### 3.1 模块布局

```
dashboard/src/components/panels/channels/access-descriptors/
├── access-descriptor.types.ts        ← 契约类型定义
├── access-descriptor-registry.ts     ← 注册表实现 + 单元测试
├── access-descriptor-registry.test.ts
├── wecom-access-descriptor.ts        ← WeCom descriptor 实现
├── wecom-access-descriptor.test.ts
└── index.ts                          ← 启动时注册所有 descriptor
```

### 3.2 调用关系

```
ChannelDetail.tsx                  ChannelAccessTab.tsx
       │                                    │
       │ <AccessPanel channelId={id}/>      │ registry.get(id)?.render(state, actions)
       │                                    │
       └────────────────┬───────────────────┘
                        ▼
         access-descriptor-registry.ts
                        │
                        │ get(channelId): AccessDescriptor | null
                        ▼
              wecomAccessDescriptor
                        │
                        │ 引用（零改动）
                        ▼
        wecom-access-model.ts (buildWecomAccessModel)
        AllowFromEditor.tsx
        BindingsTab.tsx
```

### 3.3 契约定义

```typescript
// access-descriptor.types.ts
import type { ReactNode } from "react";
import type { GatewayClient } from "@/types/gateway-client.generated";
import type { ChannelInfo } from "@/stores/channels";

/**
 * Access control descriptor for a channel.
 *
 * Contract principle: the registry only governs HOW to mount access UI;
 * the state shape is opaque and fully owned by the implementing descriptor.
 * Different channels may have radically different access models
 * (allow-lists, role-based, group filters, etc.) without contract changes.
 *
 * @template State Channel-specific access state. Opaque to the registry.
 */
export interface AccessDescriptor<State = unknown> {
  /** Stable channel id (matches Gateway channelId). */
  readonly channelId: string;

  /**
   * Load the current access state for this channel.
   * Receives DI context with optional typed Gateway client, channel info, and config snapshot.
   * May return null if load is handled entirely inside render subtree (e.g. wecom).
   */
  load(context: AccessLoadContext): Promise<State | null>;

  /**
   * Render the Access tab UI for this channel. MUST return a real ReactNode
   * (including the wecom case). Returning null is reserved for "descriptor
   * unavailable" at the AccessPanel layer, not at descriptor implementations.
   */
  render(state: State | null, actions: AccessActions): ReactNode;

  /**
   * Optional: normalize a raw config snapshot into the State shape.
   * Useful for channels that derive State from openclaw.json entries.
   */
  normalize?(raw: unknown): State;

  /**
   * Optional: render the permission summary section on the Status tab.
   * Consumed by `ChannelDetail.tsx` to replace the current L514-657 wecom summary.
   * Returning null hides the summary slot for this channel.
   */
  renderStatusSummary?(state: State | null, actions: AccessActions): ReactNode;

  /**
   * Optional: config field paths that the Settings tab should NOT render
   * (because they are managed in the Access tab instead).
   *
   * Replaces the hard-coded `WECOM_ACCESS_EXCLUDE_PATHS` in ChannelSettingsTab.tsx:15-22.
   */
  readonly settingsExcludePaths?: readonly string[];

  /**
   * Optional: handle "Manage Access" button click from the Status tab.
   * Default behavior (if absent): jump to Access tab without preselecting an account.
   * WeCom needs this to preserve selectedAccountId handoff per
   * `ChannelDetail.access-handoff.test.tsx`.
   *
   * Implementations MUST ensure actions.openAccessTab fully handles both
   * selectedAccountId preselection AND the tab switch (see AccessActions.openAccessTab).
   */
  handleManageAccess?(accountId: string, actions: AccessActions): void;

  /**
   * Optional: whether this channel manages per-account configuration inside
   * the Access tab (and thus should NOT render the fallback `AccountConfigDialog`).
   *
   * Replaces the former hard-coded `channelId !== "wecom"` gate on
   * `ChannelDetail.tsx:910`. Undefined defaults to false (descriptor-less
   * channels and descriptors that want the dialog both get the dialog).
   */
  readonly usesAccessTabForAccountConfig?: boolean;
}

/** DI context passed to descriptor.load(). */
export interface AccessLoadContext {
  readonly channelId: string;
  /**
   * Optional typed Gateway client.
   *
   * Target state: mandatory per CLAUDE.md "禁止 gatewayRequest 字符串调用".
   * Current state: optional because Deck has no `useGatewayClient()` hook yet
   * (grep confirmed zero callsites on 2026-04-17). WeCom descriptor's `load()`
   * returns null and does not consume `gw`. The first descriptor that needs
   * server-driven state will also introduce the `useGatewayClient()` infra
   * and flip `gw` back to required in a follow-up spec.
   */
  readonly gw?: GatewayClient;
  /** ChannelInfo snapshot; null if the channel is schema-only (not yet configured). */
  readonly channel: ChannelInfo | null;
  /** Raw channel config (e.g. openclaw.json entry). null until fetchChannelConfig resolves. */
  readonly configSnapshot?: Record<string, unknown> | null;
}

/** Mutation handlers provided by Deck for the descriptor to invoke. */
export interface AccessActions {
  /** Save a config patch scoped to this channel. */
  readonly save: (patch: Record<string, unknown>) => Promise<boolean>;
  /** Re-fetch channel config / bindings / health. */
  readonly refresh: () => Promise<void>;
  /**
   * Navigate to the Access tab with optional accountId preselection.
   *
   * MUST perform BOTH operations atomically:
   * 1. Preselect the account (`selectedAccountId` handoff) if `accountId` is provided
   * 2. Activate the Access tab itself
   *
   * Replaces the former inline `setAccessAccountId(...); setActiveTab("access");`
   * pair at `ChannelDetail.tsx:799-800`. Both must happen to keep
   * `ChannelDetail.access-handoff.test.tsx` green.
   */
  readonly openAccessTab: (accountId?: string) => void;
}
```

**关键约定**：

1. `State = unknown` 默认类型意味着 registry 对 state 完全不透明
2. Descriptor 自行 narrow state 类型（利用 TypeScript 泛型）
3. `normalize` 为可选，wecom 初次实现不提供（现有 `buildWecomAccessModel` 直接满足需求）
4. `AccessLoadContext.gw` 当前为可选（`gw?`），**过渡约定**见类型注释；新 descriptor 需要 server-driven state 时一并补 `useGatewayClient()` 基础设施并把 `gw` 收紧为必填
5. `renderStatusSummary` / `settingsExcludePaths` / `handleManageAccess` / `usesAccessTabForAccountConfig` 均可选——未来无 permission summary 或无 account 层的渠道可不实现
6. **`render` 必须返回真实 ReactNode**（null 仅为"AccessPanel 未找到 descriptor"的兜底情况，descriptor 实现不允许）；wecom descriptor 保留 Zustand store 直连时，`render` 返回 `<WecomAccessTabContent .../>`，store 订阅发生在子组件内部（与契约透明度无冲突）
7. `load` 可返回 `null`——wecom descriptor 现阶段保留 store 直连，`load` 实现为 `return null`，真实数据在 render 子树内部订阅

### 3.4 Registry API

```typescript
// access-descriptor-registry.ts

const descriptors = new Map<string, AccessDescriptor<unknown>>();

export function registerAccessDescriptor(descriptor: AccessDescriptor<unknown>): void {
  if (descriptors.has(descriptor.channelId)) {
    throw new Error(`AccessDescriptor already registered: ${descriptor.channelId}`);
  }
  descriptors.set(descriptor.channelId, descriptor);
}

export function getAccessDescriptor(channelId: string): AccessDescriptor<unknown> | null {
  return descriptors.get(channelId) ?? null;
}

export function hasAccessDescriptor(channelId: string): boolean {
  return descriptors.has(channelId);
}

/** Test-only helper. Production code should not clear the registry. */
export function __resetAccessDescriptorsForTesting(): void {
  descriptors.clear();
}
```

### 3.5 Deck 消费侧

新建 `access-descriptors/AccessPanel.tsx`（独立组件，供 Status 和 Access tab 两处复用）：

```tsx
// access-descriptors/AccessPanel.tsx
export function AccessPanel({
  channelId,
  slot,
  selectedAccountId,
  onSelectedAccountChange,
}: {
  channelId: string;
  slot: "access-tab" | "status-summary";
  selectedAccountId?: string;
  onSelectedAccountChange?: (accountId: string) => void;
}) {
  const descriptor = getAccessDescriptor(channelId);
  const { state, actions } = useAccessDescriptorState(descriptor, {
    selectedAccountId,
    onSelectedAccountChange,
  });
  if (!descriptor) return slot === "access-tab" ? <NoAccessControl /> : null;
  return slot === "status-summary"
    ? (descriptor.renderStatusSummary?.(state, actions) ?? null)
    : descriptor.render(state, actions);
}
```

`AccessPanel` 是**纯透传**组件——**不得**对任何 channelId 做特判，所有业务 UI 由 descriptor 的 `render` / `renderStatusSummary` 自行返回。

`ChannelDetail.tsx` 中**移除 wecom 分支**，Status tab 挂 `<AccessPanel slot="status-summary" .../>`，Access tab 挂 `<AccessPanel slot="access-tab" .../>`；"Manage Access" 按钮调 `descriptor.handleManageAccess?.(accountId, actions)` 保留 handoff 语义（`actions.openAccessTab` 负责同时做 accountId 预选 + tab 切换）。

`AccountConfigDialog` 的渲染条件从 `configAccount && channelId !== "wecom"` 改为 `configAccount && !descriptor?.usesAccessTabForAccountConfig`——以 descriptor 元数据显式表达意图，不依赖 `handleManageAccess` 的存在性推断。

`ChannelAccessTab.tsx` 简化为外层调用（~40 行）：

```tsx
export function ChannelAccessTab({
  channelId,
  channel,
  selectedAccountId,
  onSelectedAccountChange,
}) {
  return (
    <AccessPanel
      channelId={channelId}
      slot="access-tab"
      selectedAccountId={selectedAccountId}
      onSelectedAccountChange={onSelectedAccountChange}
    />
  );
}
```

`ChannelSettingsTab.tsx` 中的 `WECOM_ACCESS_EXCLUDE_PATHS` 改为从 descriptor 取：

```tsx
const descriptor = getAccessDescriptor(channelId);
const excludePaths = descriptor?.settingsExcludePaths;
// ...
<ChannelSchemaSettings channelId={channelId} schemaInfo={schemaInfo} excludePaths={excludePaths} />;
```

`PluginsPanel.tsx` 中 `hasDedicatedAccessSurface(channelId)` 替换为 `hasAccessDescriptor(channelId)`（import 路径改变，语义等价）。

---

## 4. 实施计划（3 PR 串行）

### 4.1 PR #1 — 契约骨架

**变更**：

- 新增 `access-descriptor.types.ts`
- 新增 `access-descriptor-registry.ts` + `.test.ts`
- 新增 `access-descriptors/index.ts`（空 registry，暂无注册）
- 新增文档 `docs/plugins/sdk-access-model.md`（与既有 `docs/plugins/sdk-channel-plugins.md`、`docs/plugins/architecture.md` 同目录）

**规模**: ~100 行新增

**Landing gate**:

- `pnpm check` + `pnpm test` 绿
- 新增测试覆盖：注册、查询、未知 id、重复注册错误、test-only reset

**Review 焦点**: 契约设计合理性（是否足够抽象 / 是否过度抽象）

**预期**: 合并时是"无消费者的 scaffolding"，1-2 天窗口期由 PR #2 消化。

### 4.2 PR #2 — WeCom 迁移 + 消费侧切换（核心风险 PR）

**变更**：

- 新增 `wecom-access-descriptor.tsx`（注意 `.tsx` 扩展名，含 JSX）：
  - 整体迁入 `ChannelAccessTab.tsx:101-621` 的 `WecomAccessTab` 作为 `renderAccessTab()` 的返回体（**代码 1:1 不改**）
  - 整体迁入 `ChannelDetail.tsx:514-657` 的 permission summary UI + `wecomAccessModel` / `wecomPermissionAlerts` 构建逻辑（L353-409）作为 `renderStatusSummary()` 的返回体
  - 声明 `settingsExcludePaths = WECOM_ACCESS_EXCLUDE_PATHS`（来自 `ChannelSettingsTab.tsx:15-22`）
  - 实现 `handleManageAccess(accountId, actions) { actions.openAccessTab(accountId); }`
  - `load()` 返回 `null`（保留 store 直连）
- 新增 `wecom-access-descriptor.test.tsx`：contract 行为测试（render/handleManageAccess/settingsExcludePaths）
- 新增 `access-descriptors/hooks.ts`：`useAccessDescriptorState` / `useAccessDescriptorActions`
- 新增 `access-descriptors/AccessPanel.tsx`：如 §3.5 骨架
- 修改 `access-descriptors/index.ts`：`import "./wecom-access-descriptor";` 注册副作用
- **入口文件 side-effect import**：在 `dashboard/src/app/providers.tsx`（或等效顶层）加 `import "../components/panels/channels/access-descriptors";`，避免 dead-code 摇树
- 修改 `ChannelDetail.tsx`：
  - 删除 L218 / L221 的 wecom useState
  - 删除 L285-302 / L304-321 的 wecom useEffect
  - 删除 L353-409 的 wecomAccessModel / wecomPermissionAlerts 构建
  - L514-657 permission summary UI 替换为 `<AccessPanel slot="status-summary" channelId={channelId} />`
  - L796-811 "Manage Access" 按钮的 wecom 分支改为调 `descriptor.handleManageAccess?.(account.accountId, actions)`
  - L910 `channelId !== "wecom"` 条件删除（`AccountConfigDialog` 独立渲染条件由 descriptor 决定，wecom descriptor 不用 dialog）
- 修改 `ChannelAccessTab.tsx`：外层精简为 §3.5 骨架（~40 行）；WecomAccessTab 实现下移到 descriptor 文件
- 修改 `ChannelSettingsTab.tsx`：L41 的 `channelId === "wecom" && hasFields` 改为 `descriptor?.settingsExcludePaths !== undefined && hasFields`；`excludePaths` 从 descriptor 取
- **不改** `wecom-access-model.ts` / `AllowFromEditor.tsx` / `BindingsTab.tsx` / `DmPolicySelector.tsx` / `WeComWizard.tsx` / `OpenClawWeixinWizard.tsx`

**规模**: ~900 行（WecomAccessTab ~520 迁移 + permission summary ~140 迁移 + descriptor/hooks/AccessPanel 新增 ~200 + 消费侧精简 -100 / +40）

**Landing gate**:

- `pnpm check` + `pnpm test` + `pnpm build` 全绿
- **所有 wecom 相关现有测试必须通过**（见 §5.1）—— 特别是 `ChannelDetail.access-handoff.test.tsx`（受控/非受控双模式）和 `ChannelDetail.permission-summary.test.tsx`
- CCG 双审（Claude + Codex architect）通过
- 手工在 Deck 里点一遍 wecom channel detail → Status 页 permission summary、Access tab、"Manage Access" 按钮跳转 → 视觉与交互无回归

**Review 焦点**:

- wecom 行为 1:1 对齐；状态流、错误处理、加载时序无回归
- `selectedAccountId` handoff（Status → Access tab）依然工作
- `WECOM_ACCESS_EXCLUDE_PATHS` 在 Settings tab 的排除效果不变

**回滚策略**: PR 级回滚；不引入 feature flag（非实验性变更）

### 4.3 PR #3 — 死代码清理

**变更**：

- 删除 `channel-access-registry.ts`（或简化为 deprecated re-export）
- 清理 `ChannelDetail.tsx` 中剩余的 `shouldShowWecomSummary` 等 wecom 变量
- 删除 `ChannelAccessTab.tsx` 中 `descriptor.accessKey === "wecom"` 类残留

**规模**: ~150 行删除

**Landing gate**:

- `pnpm check` + `pnpm test` + `pnpm build` 全绿
- `pnpm grep 'channel-access-registry'` / `pnpm grep 'getChannelAccessDescriptor'` 必须返回**零**引用
- §5.1 所列 wecom 测试仍然全绿（回归基线）
- §5.2 结构性断言测试通过

**执行时机**: PR #2 合入后观察 1-2 天，确认无 regression 再做

**Review 焦点**: 确认"真的没有引用" —— 用 grep 验证 `wecom-access-boundary` 等测试不再依赖被删代码

---

## 5. 验收标准（档次 B）

### 5.1 功能保障（必须通过）

现有 wecom 测试 100% 通过：

- `dashboard/src/components/panels/channels/ChannelDetail.permission-summary.test.tsx`
- `dashboard/src/components/panels/channels/ChannelDetail.access-handoff.test.tsx`
- `dashboard/src/components/panels/channels/wecom-access-boundary.integration.test.tsx`
- `dashboard/src/components/panels/channels/WeComWizard.access-guidance.test.tsx`
- `dashboard/src/components/panels/channels/BindingsTab.handoff.test.tsx`
- `dashboard/src/components/panels/channels/BindingsTab.test.tsx`
- `dashboard/src/components/panels/channels/AllowFromEditor.test.tsx`
- 其他在 `wecom-settings-technical-panel.integration.test.tsx` 等包含的 wecom 测试

### 5.2 结构保障（软性 lint 断言）

新增测试 `channel-detail-no-hardcoded-ids.test.ts`——断言 3 个文件**在重构后**不应再出现字面量渠道 id 比较：

```typescript
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const here = __dirname;
const GUARDED_FILES = ["ChannelDetail.tsx", "ChannelAccessTab.tsx", "ChannelSettingsTab.tsx"];

// 字面量 channel id 比较的 4 种变体（两审提醒的遗漏都已覆盖）
const FORBIDDEN_PATTERNS = [
  /channelId\s*===\s*["'][\w-]+["']/,
  /channelId\s*!==\s*["'][\w-]+["']/,
  /channel\.id\s*===\s*["'][\w-]+["']/,
  /channel\.id\s*!==\s*["'][\w-]+["']/,
  /switch\s*\(\s*channelId\s*\)/,
];

describe("channel-detail hardcoded channel id guard", () => {
  for (const file of GUARDED_FILES) {
    test(`${file} has no hardcoded channel id comparisons`, () => {
      const source = readFileSync(join(here, file), "utf8");
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(source, `${file} violates ${pattern}`).not.toMatch(pattern);
      }
    });
  }
});
```

> ⚠️ 合法用法规避：`accountId === "default"` 等非 channelId 的字面量比较不受影响；正则仅约束 `channelId` / `channel.id` 标识符。字符串文案中的 `"wecom"`（如 i18n key）也不匹配。

### 5.3 新增契约测试

- `access-descriptor-registry.test.ts`：注册 / 查询 / 未知 id 兜底 / 重复注册报错 / test-only reset
- `wecom-access-descriptor.test.ts`：load 返回预期 state、render 产出预期组件树、normalize 行为

### 5.4 工程 gate

- `pnpm check` 零 warning 零 error
- `pnpm test` 全绿
- `pnpm build` 成功
- 手工在 Deck 里点一遍 wecom channel detail 页 → 视觉与交互无回归
- CCG 双审（Claude + Codex）通过

### 5.5 Stretch Goals（不阻塞交付）

- 为 Telegram 或其他渠道写最简 `TelegramAccessDescriptor`（仅"暂无访问控制"占位），证明契约可扩展
- 视觉快照测试（Playwright）—— 如果当前 CI 已接入

### 5.6 明确不做

- ESLint 自定义 rule（软性测试足够，后续迭代可升级）
- 合成 `TestAccessDescriptor` 作扩展性证明（价值低）
- Feature flag / 双路径共存（非实验性变更）

---

## 6. 风险与缓解

| 风险                                                                           | 严重度 | 缓解策略                                                                                                                                                            |
| ------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WeCom summary 从 inline 移到 descriptor slot 后布局错乱                        | 中     | PR #2 合并前手工视觉验收；必要时 Playwright 快照                                                                                                                    |
| 迁移过程中 `buildWecomAccessModel` 调用点遗漏                                  | 低     | PR #2 代码移动保持 1:1，不重写业务逻辑                                                                                                                              |
| 某些 wecom 测试隐式依赖 `channelId === "wecom"` 分支执行顺序                   | 低-中  | PR #2 跑全量 wecom 测试（§5.1 七条），任何失败即 blocker                                                                                                            |
| 软性 lint 断言误杀合法用法                                                     | 低     | 正则只匹配 `channelId`/`channel.id` 标识符的字面量比较，不影响 `channelId === variable`                                                                             |
| **`selectedAccountId` handoff 语义 regression**                                | **高** | descriptor 必须实现 `handleManageAccess(accountId, actions)`；`ChannelDetail.access-handoff.test.tsx` 作 PR #2 landing gate                                         |
| **HMR 下 `registerAccessDescriptor` 重复触发抛错**                             | **中** | registry 提供 `registerAccessDescriptor(desc, { allowReplace })` 重载；生产默认严格注册，开发模式 `import.meta.hot` 时 allowReplace=true                            |
| **`access-descriptors/index.ts` 未被入口 side-effect import 导致 registry 空** | **高** | PR #2 在 `dashboard/src/app/providers.tsx` 或等效顶层文件添加 side-effect import；CI 新增冒烟测试 `registry-mounted.test.tsx` 断言 wecom descriptor 已注册          |
| **`load` 与切渠道竞态**（快速切换时旧请求回写）                                | 低     | descriptor `load` 返回 null 的 wecom 实现不受此影响；未来其他 descriptor 需自行用 AbortController 或 cancelled flag（参考 `ChannelAccessTab.tsx:143-154` 现有实现） |
| Permission summary slot 为 null 时 Status tab 布局错位                         | 低     | `<AccessPanel slot="status-summary"/>` 返回 null 时 ChannelDetail 不渲染外围 label；由 AccessPanel 自己处理边界                                                     |

### 6.1 Discovery（PR #1 开工前已完成）

原 §6.1 的 3 个 discovery 任务已在 2026-04-17 通过代码审阅完成，结果写入 §2.2："已验证的代码事实"：

1. ✅ `hasDedicatedAccessSurface` 语义 = `hasAccessDescriptor`（不需要 `shouldShow` 元数据）
2. ✅ `AllowFromEditor` 无 store 依赖；`BindingsTab` 与 access descriptor 正交；`WecomAccessTab` 保留 store 直连
3. ✅ `selectedAccountId` handoff 语义由 `handleManageAccess` 契约保护

实施前仅需一次**冒烟测试**：

```bash
# 确认本地 Deck 能正常起来、wecom 页面可访问
scripts/dev/deck-dev.sh
# → http://localhost:3000 → Channels → wecom → 各 tab 切换一遍
```

---

## 7. 成功后的下一步

PR #3 合入后：

1. 更新 `.omc/project-memory.json` 记录本 spec 完成
2. 启动下一个 spec：`deck-manifest-driven-wizard`（对应 L2 Wizard DSL）
3. Discord / Slack 等未来复杂渠道以 `wecomAccessDescriptor` 为模板实现各自 descriptor

---

## 8. 相关引用

- 讨论依据：`ChannelSettingsTab.tsx:31-89`、`ChannelDetail.tsx:197-350`、`ChannelAccessTab.tsx:56-89`、`channel-access-registry.ts`、`wecom-access-model.ts`
- 前置 commit：`93584159ff` "Give Deck operators a coherent WeCom permission workspace"
- 相关原则：`CLAUDE.md` "Core must stay extension-agnostic. No hardcoded extension/provider/channel id lists in core."
- Deck 开发规则：`dashboard/CLAUDE.md` i18n / 主题 / allowlist

---

## 9. 修订记录

| 日期       | 变更                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-17 | 初稿（基于 brainstorm Q1-Q6 共识）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-04-17 | Cross-spec consistency audit 整改（§2.1 / §7.1 wecom i18n Safety Fence 补齐）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-04-17 | **事实对齐修订（基于 ralplan G2 双审反馈）**：<br>- §1.2 目标新增"保留 `selectedAccountId` handoff 基线"<br>- §2.1 受影响文件表按代码事实重写（承认 `ChannelAccessTab.tsx:101-621` 的 520 行 WecomAccessTab 和 `ChannelDetail.tsx:514-657` 的 140 行 permission summary 需整体迁移；新增 `ChannelSettingsTab.tsx:41` 第三处 wecom 分支；新增 `PluginsPanel.tsx:15,42` 受影响项）<br>- §2.2 原"未知项"消解为"已验证代码事实"<br>- §3.3 契约扩展 3 个可选成员（`renderStatusSummary` / `settingsExcludePaths` / `handleManageAccess`）；`AccessLoadContext.gatewayRequest` 字符串调用 → `gw: GatewayClient` typed client（遵守 CLAUDE.md 硬约束）；`load` 允许返回 null<br>- §3.5 消费侧新增独立 `AccessPanel` 组件，Status / Access tab 共享消费路径<br>- §4.2 PR #2 规模 ~300 → ~900 行；文件名 `.ts` → `.tsx`；新增 side-effect import、`ChannelSettingsTab`/`PluginsPanel` 迁移、`handleManageAccess` 接线等明确动作项<br>- §5.2 结构断言正则补强覆盖 `channel.id === "..."` / `switch (channelId)`；扫描范围 +`ChannelSettingsTab.tsx`<br>- §6 风险表新增 3 条（handoff regression 高危、HMR 重复注册、side-effect import 缺失、load 竞态）；§6.1 discovery 标记为已执行 |
| 2026-04-17 | **G2 第二轮反馈契约收紧**：<br>- §3.3 `AccessLoadContext.gw` 从必填改为可选（Deck 尚无 `useGatewayClient()` 基础设施；过渡约定写入类型注释，首个消费 gw 的 descriptor 时收紧为必填）<br>- §3.3 契约新增 `readonly usesAccessTabForAccountConfig?: boolean` 元数据，用显式开关替换 `ChannelDetail.tsx:910` 的 `channelId !== "wecom"` gate（避免与 `handleManageAccess` 存在性耦合产生歧义）<br>- §3.3 明确 `render` 必须返回真实 ReactNode（null 仅为 AccessPanel 未命中 descriptor 的兜底；descriptor 实现禁止返回 null）<br>- §3.3 `AccessActions.openAccessTab` 语义硬化：必须**同时**做 accountId 预选 + tab 切换（对应 `ChannelDetail.tsx:799-800` 原子动作）<br>- §3.5 AccessPanel 明确为"纯透传"，不得对 channelId 做特判                                                                                                                                                                                                                                                                                                                                                                                                                                            |

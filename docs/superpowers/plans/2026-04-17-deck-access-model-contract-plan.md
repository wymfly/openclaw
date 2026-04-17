# Deck Access Model Contract — 实施计划（G1 v2，事实对齐版）

> **关联 spec**: `docs/superpowers/specs/2026-04-17-deck-access-model-contract-design.md`（Approved 2026-04-17 G2 第二轮）
> **日期**: 2026-04-17
> **阶段**: v3（G2 两轮双审全部 APPROVE，ralplan 闭环完成，可进 ralph 实施）
> **分支**: `enhanced`
> **交付形式**: 3 个串行 PR（契约骨架 → WeCom 迁移 → 清理）；PR #2 体量若超 1000 行，按 §2.12 拆 PR #2a/#2b
> **v3 关键变化 vs v2**: `render` 返回真实 ReactNode（非 null）；`gw` optional；`usesAccessTabForAccountConfig` 元数据；`openAccessTab` 语义硬化（accountId + tab 切换原子）；HMR 改 `NODE_ENV` gate；规模预估上调到 1100-1200 行

---

## 目录

- [§0 前置（不含 Discovery——已并入 spec §2.2）](#0-前置)
- [§1 PR #1：契约骨架 + 消费侧 Shell](#1-pr-1契约骨架--消费侧-shell)
- [§2 PR #2：WeCom 迁移（核心风险）](#2-pr-2wecom-迁移核心风险)
- [§3 PR #3：清理 + PluginsPanel 迁移 + 结构断言](#3-pr-3清理--pluginspanel-迁移--结构断言)
- [§4 WeCom Safety Fence（业务逻辑零改动）](#4-wecom-safety-fence业务逻辑零改动)
- [§5 验证 gate 合集](#5-验证-gate-合集)
- [§6 回滚策略](#6-回滚策略)
- [§7 裁决记录（G2 第一轮输出已定案）](#7-裁决记录g2-第一轮输出已定案)
- [§8 G2 第二轮关注点（审查者请重点看这里）](#8-g2-第二轮关注点)
- [§9 执行者 checklist](#9-执行者-checklist)
- [§10 修订记录](#10-修订记录)

---

## §0 前置

- spec §2.2 "已验证的代码事实"三条（Tab 显隐职责、组件 store 依赖、selectedAccountId handoff 语义）已消解原 Discovery 任务，**不再单独产出 discovery 笔记**
- PR #1 开工前只需一次冒烟：`scripts/dev/deck-dev.sh` → 确认本地 wecom 页面可访问、5 个 tab 能切换
- 本 plan 已基于实际代码行号（如 `ChannelDetail.tsx:514-657`、`ChannelAccessTab.tsx:101-621`）编写，AI 实施者遇到行号漂移（±10 行）视为正常，按**代码结构语义**而非精确行号定位

---

## §1 PR #1：契约骨架 + 消费侧 Shell

### 1.1 目标

落地契约类型 + 注册表 + 通用 `AccessPanel` 组件 + docs；**本 PR 不注册任何具体 descriptor**，为 PR #2 的 wecom 迁移留出窗口。

### 1.2 变更清单

#### 1.2.1 新增文件

| 文件                                                                                             | 角色                 | 规模   |
| ------------------------------------------------------------------------------------------------ | -------------------- | ------ |
| `dashboard/src/components/panels/channels/access-descriptors/access-descriptor.types.ts`         | 契约类型             | ~60 行 |
| `dashboard/src/components/panels/channels/access-descriptors/access-descriptor-registry.ts`      | 注册表实现           | ~50 行 |
| `dashboard/src/components/panels/channels/access-descriptors/access-descriptor-registry.test.ts` | 注册表单测           | ~80 行 |
| `dashboard/src/components/panels/channels/access-descriptors/AccessPanel.tsx`                    | 通用消费组件         | ~40 行 |
| `dashboard/src/components/panels/channels/access-descriptors/index.ts`                           | 启动注册入口（暂空） | ~8 行  |
| `docs/plugins/sdk-access-model.md`                                                               | 对外契约文档         | ~80 行 |

#### 1.2.2 修改文件

- 无（本 PR 只新增；消费侧改造延到 PR #2，便于回滚隔离）

### 1.3 关键代码骨架

> ⚠️ 代码骨架是 G1 草案。AI 实施者若发现与 repo 现有约定（import 顺序、barrel 风格、JSX prop 顺序）冲突，**按 repo 约定调整**，不盲从本节示例。

#### `access-descriptor.types.ts`

```typescript
import type { ReactNode } from "react";
import type { GatewayClient } from "@/types/gateway-client.generated";
import type { ChannelInfo } from "@/stores/channels";

export interface AccessLoadContext {
  readonly channelId: string;
  readonly gw: GatewayClient;
  readonly channel: ChannelInfo | null;
  readonly configSnapshot?: Record<string, unknown> | null;
}

export interface AccessActions {
  readonly save: (patch: Record<string, unknown>) => Promise<boolean>;
  readonly refresh: () => Promise<void>;
  readonly openAccessTab: (accountId?: string) => void;
}

export interface AccessDescriptor<State = unknown> {
  readonly channelId: string;
  load(context: AccessLoadContext): Promise<State | null>;
  render(state: State | null, actions: AccessActions): ReactNode;
  normalize?(raw: unknown): State;
  renderStatusSummary?(state: State | null, actions: AccessActions): ReactNode;
  readonly settingsExcludePaths?: readonly string[];
  handleManageAccess?(accountId: string, actions: AccessActions): void;
}
```

#### `access-descriptor-registry.ts`

```typescript
import type { AccessDescriptor } from "./access-descriptor.types";

const descriptors = new Map<string, AccessDescriptor<unknown>>();

export interface RegisterOptions {
  /** Allow replacing an existing registration (dev/HMR only). */
  readonly allowReplace?: boolean;
}

export function registerAccessDescriptor(
  descriptor: AccessDescriptor<unknown>,
  options: RegisterOptions = {},
): void {
  if (descriptors.has(descriptor.channelId) && !options.allowReplace) {
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

/** Test-only helper; production code must not invoke. */
export function __resetAccessDescriptorsForTesting(): void {
  descriptors.clear();
}
```

#### `access-descriptor-registry.test.ts`（覆盖点清单）

- ✅ register + get 返回同一对象
- ✅ 未知 id 返回 null
- ✅ hasAccessDescriptor 与 getAccessDescriptor !== null 等价
- ✅ 重复注册未传 allowReplace → throw
- ✅ 重复注册传 `{ allowReplace: true }` → 覆盖且不抛
- ✅ `__resetAccessDescriptorsForTesting` 清空后 hasAccessDescriptor 为 false
- ✅ 不同泛型参数（`<WeComState>` / `<unknown>`）均能过编译（type-only test 即可，用 `expectTypeOf` 或 `satisfies`）

#### `AccessPanel.tsx`

```tsx
"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { getAccessDescriptor } from "./access-descriptor-registry";
import { useAccessDescriptorState } from "./hooks";

// PR #1 stub: hooks.ts 在 PR #2 引入；PR #1 阶段可提供最简占位
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
}): ReactNode {
  const t = useTranslations("channels.access");
  const descriptor = getAccessDescriptor(channelId);
  const { state, actions } = useAccessDescriptorState(descriptor, {
    selectedAccountId,
    onSelectedAccountChange,
  });
  if (!descriptor) {
    if (slot === "status-summary") return null;
    return (
      <div className="px-4 py-4">
        <div
          className="rounded-lg border px-4 py-3 text-sm"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <p className="font-medium" style={{ color: "var(--foreground)" }}>
            {t("unsupportedTitle")}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
            {t("unsupportedDescription")}
          </p>
        </div>
      </div>
    );
  }
  if (slot === "status-summary") {
    return descriptor.renderStatusSummary?.(state, actions) ?? null;
  }
  return descriptor.render(state, actions);
}
```

> ⚠️ PR #1 的 `hooks.ts` 可以只给出最小骨架（`useAccessDescriptorState` 返回 `{ state: null, actions: noopActions }`），完整实现放 PR #2。或者本 PR 仅创建 `AccessPanel.tsx` 而 `hooks.ts` 完全放 PR #2，由执行者权衡（两种选择对 landing gate 都可行）。

#### `access-descriptors/index.ts`

```typescript
// Registration entry point. PR #1 ships empty by design.
// PR #2 will add: import "./wecom-access-descriptor";
export {};
```

#### `docs/plugins/sdk-access-model.md` — 必须覆盖的小节

- 契约动机（为什么不是 Schema-only / Remote Component）
- 7 个契约成员语义（3 required + 4 optional）
- `AccessLoadContext.gw` 为什么是 typed client 而非字符串 method
- 最小 descriptor 示例：`telegram-access-descriptor` 仅实现 `channelId` + `load()=>null` + `render()=>null`（占位，证明契约可扩展）
- 注册流程：descriptor 文件末尾 side-effect register + `access-descriptors/index.ts` barrel import + 顶层 side-effect import
- **Safety 条款**：不得在 `render` 返回树里 import global store（建议而非强制；wecom 迁移期允许例外，见 §2）

### 1.4 验证步骤

```bash
pnpm check
pnpm test dashboard/src/components/panels/channels/access-descriptors
pnpm build  # PR #1 全新增，理论可跳；但 enhanced 分支 push 前跑一次保险
```

**Landing gate**：

- [ ] `pnpm check` 零 warning 零 error
- [ ] registry 测试 7 条覆盖点全中
- [ ] `git diff --stat` 仅新增文件（无误改）
- [ ] `rg 'access-descriptor' dashboard/src/ | rg -v 'access-descriptors/'` 返回空（确认 PR #1 未被其他文件引用）

### 1.5 Commit

```bash
scripts/committer "[enhanced] feat(deck): add AccessDescriptor contract + registry scaffold" \
  dashboard/src/components/panels/channels/access-descriptors/ \
  docs/plugins/sdk-access-model.md
```

---

## §2 PR #2：WeCom 迁移（核心风险）

### 2.1 目标

- 将 `ChannelAccessTab.tsx:101-621` 的 `WecomAccessTab` 整体迁移到 `wecom-access-descriptor.tsx`（代码 1:1，仅 export 方式改变）
- 将 `ChannelDetail.tsx:514-657` 的 permission summary UI 整体迁移到同一 descriptor 的 `renderStatusSummary()`
- 保留 `selectedAccountId` handoff 语义（通过 `handleManageAccess`）
- 重构 `ChannelDetail.tsx` / `ChannelAccessTab.tsx` / `ChannelSettingsTab.tsx` 消费侧
- **不改** `wecom-access-model.ts` / `AllowFromEditor.tsx` / `BindingsTab.tsx` / `DmPolicySelector.tsx` / `WeComWizard.tsx` / `OpenClawWeixinWizard.tsx`

### 2.2 新增文件

| 文件                                                                                           | 规模    |
| ---------------------------------------------------------------------------------------------- | ------- |
| `dashboard/src/components/panels/channels/access-descriptors/wecom-access-descriptor.tsx`      | ~700 行 |
| `dashboard/src/components/panels/channels/access-descriptors/wecom-access-descriptor.test.tsx` | ~120 行 |
| `dashboard/src/components/panels/channels/access-descriptors/hooks.ts`（若 PR #1 未建）        | ~80 行  |

### 2.3 修改文件

| 文件                                                                   | 动作                                                                              |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `dashboard/src/components/panels/channels/access-descriptors/index.ts` | 加入 `import "./wecom-access-descriptor";`                                        |
| `dashboard/src/components/panels/channels/ChannelDetail.tsx`           | 见 §2.5 详细 diff                                                                 |
| `dashboard/src/components/panels/channels/ChannelAccessTab.tsx`        | 外层简化为 ~40 行（见 §2.6）                                                      |
| `dashboard/src/components/panels/channels/ChannelSettingsTab.tsx`      | 见 §2.7 详细 diff                                                                 |
| `dashboard/src/app/providers.tsx`（或 `layout.tsx` 等效顶层）          | 加入 `import "@/components/panels/channels/access-descriptors";` 顶层 side-effect |

### 2.4 `wecom-access-descriptor.tsx` 结构

```typescript
"use client";

// 1. 导入现有业务逻辑（零改动）
import {
  buildWecomAccessModel,
  normalizeWecomAllowFromEntry,
  type WecomAccessModel,
  type WecomDmState,
  type DmPolicy,
} from "../wecom-access-model";
import { AllowFromEditor } from "../AllowFromEditor";
import { DmPolicySelector } from "../DmPolicySelector";

// 2. 导入 access-descriptor 契约
import type { AccessActions, AccessDescriptor, AccessLoadContext } from "./access-descriptor.types";
import { registerAccessDescriptor } from "./access-descriptor-registry";

// 3. 其他 deps — 从 ChannelAccessTab.tsx 和 ChannelDetail.tsx 迁入
import { useChannelsStore, type ChannelInfo } from "../../../../stores/channels";
import { useDeckRoutingStore } from "../../../../stores/deck-routing";
import { Button } from "../../../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../ui/select";
import { navigateToRouting } from "../../../../lib/panel-navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

// -----------------------------------------------------------------------------
// Access Tab 实现（迁自 ChannelAccessTab.tsx:101-621，~520 行，代码一行不改）
// -----------------------------------------------------------------------------

function SectionAlert({ message }: { message: string }) { /* 迁自 ChannelAccessTab.tsx:21-35 */ }
function SaveBar({ disabled, saving, onSave }: { ... }) { /* 迁自 ChannelAccessTab.tsx:37-54 */ }

export function WecomAccessTabContent({
  channel,
  selectedAccountId: controlledSelectedAccountId,
  onSelectedAccountChange,
}: {
  channel: ChannelInfo;
  selectedAccountId?: string;
  onSelectedAccountChange?: (accountId: string) => void;
}) {
  /* 迁自 ChannelAccessTab.tsx:101-621，内容完全不改 */
}

// -----------------------------------------------------------------------------
// Status Summary 实现（迁自 ChannelDetail.tsx:514-657，~140 行，代码一行不改）
// -----------------------------------------------------------------------------

type PermissionAlert = { message: string; accountId: string; action: "access" };

function WecomPermissionSummary({
  channel,
  bindingsLoaded,
  wecomConfigLoaded,
  onOpenAccess,
}: {
  channel: ChannelInfo;
  bindingsLoaded: boolean;
  wecomConfigLoaded: boolean;
  onOpenAccess: (accountId: string) => void;
}) {
  /* 迁自 ChannelDetail.tsx:353-409 的 wecomAccessModel / wecomPermissionAlerts 构建
     + ChannelDetail.tsx:514-657 的 summary UI 渲染
     事件处理器 `setAccessAccountId + setActiveTab` 替换为 onOpenAccess(accountId) callback */
}

// -----------------------------------------------------------------------------
// Descriptor 导出与注册
// -----------------------------------------------------------------------------

export const WECOM_ACCESS_EXCLUDE_PATHS: readonly string[] = [
  "bot.dm",
  "agent.dm",
  "dynamicAgents",
  "routing.failClosedOnDefaultRoute",
  "accounts.*.bot.dm",
  "accounts.*.agent.dm",
];

// WeCom 的 State 现阶段为 null（保留 store 直连），未来有需要时再切实化
export const wecomAccessDescriptor: AccessDescriptor<null> = {
  channelId: "wecom",

  async load(_context: AccessLoadContext): Promise<null> {
    // 保留 store 直连；真实数据加载发生在 WecomAccessTabContent 内部
    return null;
  },

  render(_state, actions) {
    // 真实返回 ReactNode。state 在 wecom 下未使用，因为 WecomAccessTabContent
    // 仍保留 Zustand store 直连；actions 由子组件的 "Manage Access" 等交互路径按需调用。
    return (
      <WecomAccessTabContent
        // AccessPanel 透传的 selectedAccountId / onSelectedAccountChange 通过 actions / 外层 prop 注入
        // —— 具体参数见 hooks.ts 和 AccessPanel.tsx 的真实数据流
        actions={actions}
      />
    );
  },

  renderStatusSummary(_state, actions) {
    return <WecomPermissionSummary actions={actions} />;
  },

  settingsExcludePaths: WECOM_ACCESS_EXCLUDE_PATHS,

  usesAccessTabForAccountConfig: true,

  handleManageAccess(accountId: string, actions: AccessActions) {
    // actions.openAccessTab 原子性完成：1) accountId 预选；2) 激活 Access tab
    actions.openAccessTab(accountId);
  },
};

// HMR-safe registration.
// Next.js dev server (Webpack/Turbopack) 使用 module.hot，不是 import.meta.hot；
// Deck 仓库中也无 import.meta.hot 先例（grep 零命中）。用 NODE_ENV 做 dev-mode gate：
// - 生产构建：allowReplace=false，重复注册 throw（CI 冒烟测试可立即发现）
// - 开发构建：allowReplace=true，dev-server reload 时不抛错
registerAccessDescriptor(wecomAccessDescriptor as AccessDescriptor<unknown>, {
  allowReplace: process.env.NODE_ENV !== "production",
});
```

> ⚠️ **render 返回真实 ReactNode**：wecom descriptor 的 `render` 必须返回 `<WecomAccessTabContent/>`，`renderStatusSummary` 必须返回 `<WecomPermissionSummary/>`。AccessPanel 做**纯透传**（不得对 channelId 特判），契约透明度由此得到保证；WecomAccessTabContent 内部保留 store 直连属于子组件实现细节，不穿透到契约层。

### 2.5 `ChannelDetail.tsx` 精确 diff 指南

**删除区块**：

| 行号     | 代码片段                                                                             | 动作                                                                                                                                                                                        |
| -------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L218     | `const [wecomConfigLoaded, setWecomConfigLoaded] = useState(channelId !== "wecom");` | 删除                                                                                                                                                                                        |
| L221     | `const [bindingsLoaded, setBindingsLoaded] = useState(channelId !== "wecom");`       | 删除（bindings 用独立 hook）                                                                                                                                                                |
| L285-302 | wecom-only `useEffect` 做 fetchChannelConfig                                         | 删除                                                                                                                                                                                        |
| L304-321 | wecom-only `useEffect` 做 fetchBindings                                              | 删除                                                                                                                                                                                        |
| L353-409 | `shouldShowWecomSummary` / `wecomAccessModel` / `wecomPermissionAlerts` 构建         | 删除                                                                                                                                                                                        |
| L514-657 | permission summary UI                                                                | 删除                                                                                                                                                                                        |
| L796-811 | `channelId === "wecom"` 分支的 "Manage Access" 按钮                                  | **改写**：若 `descriptor?.handleManageAccess` 存在则调 `descriptor.handleManageAccess(account.accountId, actions)`；否则回退到原"configure" dialog 分支（现有 `setConfigAccount(account)`） |
| L910     | `configAccount && channelId !== "wecom"` 条件                                        | 改写为 `configAccount && !descriptor?.usesAccessTabForAccountConfig`（用 descriptor 显式元数据，而非 `handleManageAccess` 存在性——避免歧义）                                                |

**新增**：

- Status tab 内 accounts section 之前（~L512 位置）插入：
  ```tsx
  <AccessPanel
    slot="status-summary"
    channelId={channelId}
    selectedAccountId={accessAccountId}
    onSelectedAccountChange={setAccessAccountId}
    onActivateAccessTab={() => setActiveTab("access")}
  />
  ```
- Access tab（L884-890 TabsContent）保持不变（内部 `<ChannelAccessTab/>` 已走新 `AccessPanel` 路径；但 `ChannelAccessTab` 新签名需透传 `onActivateAccessTab`——见 §2.6）
- 顶层导入 `getAccessDescriptor` from `./access-descriptors/access-descriptor-registry`
- L796-811 "Manage Access" 按钮的改写（handoff 闭环关键）：
  ```tsx
  // 通用 "configure account" 按钮
  const descriptor = getAccessDescriptor(channelId);
  const openAccessTabWithAccount = (accountId: string) => {
    setAccessAccountId(accountId);
    setActiveTab("access");
  };
  // ...在渲染每个 account 行内：
  {
    descriptor?.handleManageAccess ? (
      <button
        onClick={() =>
          descriptor.handleManageAccess!(account.accountId, {
            save: (patch) => saveChannelConfig(channelId, patch),
            refresh: () => fetchChannelConfig(channelId),
            openAccessTab: (accountId) => openAccessTabWithAccount(accountId ?? account.accountId),
          })
        }
      >
        <Settings2 size={10} />
        {t("access.manage")}
      </button>
    ) : (
      <button onClick={() => setConfigAccount(account)}>
        <Settings2 size={10} />
        {t("accountConfig.configure")}
      </button>
    );
  }
  ```
  > ⚠️ `openAccessTabWithAccount` 的闭包把 `setAccessAccountId + setActiveTab` 打包为原子动作——这是保持 `ChannelDetail.access-handoff.test.tsx` 绿的关键。

**保留**：

- `setAccessAccountId` / `setActiveTab` 状态机（handoff 的 controller 仍在 ChannelDetail）
- accessAccountId prop 通过 `ChannelAccessTab` 传入（保持 access-handoff test 绿）

### 2.6 `ChannelAccessTab.tsx` 重写

精简为 ~40 行（外层包装），所有 props 真实透传，**不使用下划线前缀绕过未使用告警**（违反 CLAUDE.md "fix all 类型错误和未使用 import"）：

```tsx
"use client";
import { AccessPanel } from "./access-descriptors/AccessPanel";
import type { ChannelInfo } from "../../../stores/channels";

export function ChannelAccessTab({
  channelId,
  channel,
  selectedAccountId,
  onSelectedAccountChange,
  onActivateAccessTab,
}: {
  channelId: string;
  channel: ChannelInfo;
  selectedAccountId?: string;
  onSelectedAccountChange?: (accountId: string) => void;
  onActivateAccessTab?: () => void;
}) {
  return (
    <AccessPanel
      channelId={channelId}
      channel={channel}
      slot="access-tab"
      selectedAccountId={selectedAccountId}
      onSelectedAccountChange={onSelectedAccountChange}
      onActivateAccessTab={onActivateAccessTab}
    />
  );
}
```

`ChannelDetail.tsx` L884-890 的 `<ChannelAccessTab/>` 调用点需同步加 `onActivateAccessTab={() => setActiveTab("access")}` prop（保证 Access tab 内部的 descriptor 也能通过 `actions.openAccessTab` 切回自己）。

> ⚠️ 移除对 `getChannelAccessDescriptor` / `channel-access-registry` 的 import；移除 `buildWecomAccessModel` 等 wecom 特定 import。

### 2.7 `ChannelSettingsTab.tsx` 精确 diff

原逻辑（ChannelSettingsTab.tsx:31-89）是**两层**判断：

- 外层 `if (onboardingDescriptor)` 分支（L38-75）：专属 onboarding 渠道，`showSchemaPanel` 控制是否同时渲染 schema 面板
- 内层 `if (schemaInfo) { ... return <ChannelSchemaSettings ...>; }`（L79-84）：通用 schema-first 路径

**改动原则**：只替换 L41 的 `channelId === "wecom"` 字面量和 L15-22 的 wecom 常量；不改变外层/内层的分支语义。

**删除**：L15-22 的 `WECOM_ACCESS_EXCLUDE_PATHS` 常量（已迁入 descriptor）

**改写**：整个 `ChannelSettingsTab` 函数体——用 descriptor 的 `settingsExcludePaths` 替换两处 wecom 耦合：

```tsx
export function ChannelSettingsTab({ channelId }: ChannelSettingsTabProps) {
  const t = useTranslations("channels.settings");
  const { channelSchemas } = useChannelsStore();
  const [wizardOpen, setWizardOpen] = useState(false);
  const schemaInfo = channelSchemas.get(channelId);
  const onboardingDescriptor = getChannelOnboardingDescriptor(channelId);
  const accessDescriptor = getAccessDescriptor(channelId);
  // 过去："wecom 专属 schema 面板，用 wecom 常量排除 access 字段"
  // 现在："任一有 settingsExcludePaths 元数据的 descriptor 都显示 schema 面板并按其清单排除"
  const excludePaths = accessDescriptor?.settingsExcludePaths;

  if (onboardingDescriptor) {
    const props = schemaInfo?.schema.properties;
    const hasFields = props && typeof props === "object" && Object.keys(props).length > 0;
    // 原：channelId === "wecom" && hasFields
    // 新：excludePaths 存在说明该渠道在 Access tab 管理部分 schema，需要同时显示 schema 面板并排除这些路径
    const showSchemaPanel = Boolean(excludePaths && hasFields);

    return (
      <>
        <div className="flex flex-col h-full">
          {/* wizard trigger button 原样保留 */}
          <div className="px-4 pt-3 pb-2">
            <button onClick={() => setWizardOpen(true)} /* ... */>
              <Settings2 size={14} style={{ color: "var(--primary)" }} />
              <span>{t("configureWizard")}</span>
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {showSchemaPanel && schemaInfo ? (
              <ChannelSchemaSettings
                channelId={channelId}
                schemaInfo={schemaInfo}
                excludePaths={excludePaths}
              />
            ) : (
              onboardingDescriptor.renderPanel()
            )}
          </div>
        </div>
        {onboardingDescriptor.renderDialog({ open: wizardOpen, onOpenChange: setWizardOpen })}
      </>
    );
  }

  // 通用 schema-first 路径（L79-84 原样；此处不需要 excludePaths，因为没有 wecom-style access tab 接管）
  if (schemaInfo) {
    const props = schemaInfo.schema.properties;
    const hasFields = props && typeof props === "object" && Object.keys(props).length > 0;
    if (hasFields) {
      return <ChannelSchemaSettings channelId={channelId} schemaInfo={schemaInfo} />;
    }
  }

  return <ChannelLegacySettingsPanel channelId={channelId} />;
}
```

**语义保证**：

- wecom：`accessDescriptor?.settingsExcludePaths` = `WECOM_ACCESS_EXCLUDE_PATHS` 6 元素；外层 `onboardingDescriptor` 为 wecom onboarding（现有行为）；`showSchemaPanel = true`（hasFields 成立时） → 渲染 `ChannelSchemaSettings` 带排除清单。**与原行为 1:1 等价**。
- 无 access descriptor 的 onboarding 渠道：`excludePaths` 为 undefined → `showSchemaPanel = false` → 走 `onboardingDescriptor.renderPanel()`（现有 fallback）。**与原行为 1:1 等价**。
- 通用 schema-first 渠道：不经过 onboarding 分支，直接用 `<ChannelSchemaSettings>` 不带 excludePaths。**与原行为 1:1 等价**。

### 2.8 `hooks.ts` 实现

```typescript
import { useCallback, useEffect, useMemo, useState } from "react";
import { useChannelsStore, type ChannelInfo } from "../../../../stores/channels";
import type { AccessActions, AccessDescriptor, AccessLoadContext } from "./access-descriptor.types";

// gw 客户端：Deck 现状无 useGatewayClient() hook（grep 零命中）。
// 按 spec §3.3 过渡约定，AccessLoadContext.gw 当前为 optional；
// 本 hook 暂传 undefined，wecom load 返回 null 不受影响。
// 首个消费 gw 的 descriptor 引入时再补 useGatewayClient() 基础设施。

export function useAccessDescriptorState<State>(
  descriptor: AccessDescriptor<State> | null,
  handoff: {
    channel: ChannelInfo | null;
    selectedAccountId?: string;
    onSelectedAccountChange?: (accountId: string) => void;
    onActivateAccessTab?: () => void;
  },
): { state: State | null; actions: AccessActions } {
  const [state, setState] = useState<State | null>(null);
  const channelConfig = useChannelsStore((s) => s.channelConfig);
  const saveChannelConfig = useChannelsStore((s) => s.saveChannelConfig);
  const fetchChannelConfig = useChannelsStore((s) => s.fetchChannelConfig);

  // load effect：context 真实组装
  useEffect(() => {
    if (!descriptor) {
      setState(null);
      return;
    }
    let cancelled = false;
    const context: AccessLoadContext = {
      channelId: descriptor.channelId,
      gw: undefined, // 过渡期，见上方注释
      channel: handoff.channel,
      configSnapshot: channelConfig,
    };
    void descriptor
      .load(context)
      .then((loaded) => {
        if (!cancelled) setState(loaded);
      })
      .catch(() => {
        if (!cancelled) setState(null);
      });
    return () => {
      cancelled = true;
    };
    // 依赖：仅 descriptor 变化时重 load；handoff.selectedAccountId 变化不影响 load
    // （wecom 场景 load 返回 null，无副作用；未来 descriptor 若需要 account-scoped load
    //  可在 descriptor 内部用 handoff 数据重构 state 而非依赖 effect 重入）
  }, [descriptor, handoff.channel, channelConfig]);

  const actions: AccessActions = useMemo(
    () => ({
      save: async (patch) => {
        if (!descriptor) return false;
        return saveChannelConfig(descriptor.channelId, patch);
      },
      refresh: async () => {
        if (!descriptor) return;
        await fetchChannelConfig(descriptor.channelId);
      },
      // openAccessTab 原子性完成 accountId 预选 + tab 切换（契约硬约束）
      openAccessTab: (accountId?: string) => {
        if (accountId) handoff.onSelectedAccountChange?.(accountId);
        handoff.onActivateAccessTab?.();
      },
    }),
    [
      descriptor,
      saveChannelConfig,
      fetchChannelConfig,
      handoff.onSelectedAccountChange,
      handoff.onActivateAccessTab,
    ],
  );

  return { state, actions };
}
```

> ⚠️ `AccessLoadContext.gw` 当前总是 `undefined`。spec §3.3 的类型注释已说明此过渡约定。第一个实现真实 `load()` 的 descriptor 必须连同 `useGatewayClient()` 基础设施一起引入——本 spec 范围内不做。

### 2.9 顶层 side-effect import

在 `dashboard/src/app/providers.tsx` 或 `dashboard/src/app/layout.tsx` 顶部添加：

```typescript
import "@/components/panels/channels/access-descriptors";
```

**PR 合规自检**：编译后 bundle 里应包含 `wecomAccessDescriptor` 符号。通过新增 `registry-mounted.test.tsx` 验证注册已发生——**直接导入 descriptor barrel**，避免 Next.js App Router 下的 `"use client"` 边界和 SSR provider 依赖使 vitest 崩溃：

```tsx
import { afterEach, describe, expect, test } from "vitest";
import { __resetAccessDescriptorsForTesting } from "./access-descriptor-registry";

describe("access descriptor side-effect mounting", () => {
  afterEach(() => {
    __resetAccessDescriptorsForTesting();
  });

  test("wecom descriptor is registered when barrel is imported", async () => {
    // 直接 import barrel（与生产入口顶层 import 等价）
    await import("@/components/panels/channels/access-descriptors");
    const { hasAccessDescriptor } =
      await import("@/components/panels/channels/access-descriptors/access-descriptor-registry");
    expect(hasAccessDescriptor("wecom")).toBe(true);
  });
});
```

### 2.10 验证步骤

```bash
# 1. 类型 + lint
pnpm check

# 2. wecom 回归测试（Safety Fence 核心）
pnpm test \
  dashboard/src/components/panels/channels/ChannelDetail.permission-summary.test.tsx \
  dashboard/src/components/panels/channels/ChannelDetail.access-handoff.test.tsx \
  dashboard/src/components/panels/channels/wecom-access-boundary.integration.test.tsx \
  dashboard/src/components/panels/channels/WeComWizard.access-guidance.test.tsx \
  dashboard/src/components/panels/channels/BindingsTab.handoff.test.tsx \
  dashboard/src/components/panels/channels/BindingsTab.test.tsx \
  dashboard/src/components/panels/channels/AllowFromEditor.test.tsx \
  dashboard/src/components/panels/channels/ChannelAccessTab.test.tsx

# 3. 新增 descriptor / registry / hooks 测试
pnpm test dashboard/src/components/panels/channels/access-descriptors

# 4. registry 挂载冒烟
pnpm test dashboard/src/components/panels/channels/access-descriptors/registry-mounted.test

# 5. build
pnpm build

# 6. 手工视觉验收
scripts/dev/deck-dev.sh
# → localhost:3000 → Channels → wecom → 依次检查：
#    (a) Status tab permission summary 显示（含 account cards、alerts）
#    (b) "Manage Access" 按钮 → 跳转到 Access tab 且 accountId 正确预选
#    (c) Access tab 5 个 section 可编辑并保存
#    (d) Settings tab schema 面板排除 bot.dm / agent.dm 等
#    (e) 控制台无新 warning/error
```

**Landing gate**：

- [ ] §5.1 wecom 测试 8 条全绿
- [ ] `pnpm check` / `pnpm build` 成功
- [ ] 手工视觉验收（6 项）无回归
- [ ] **G2 第二轮双审 APPROVE**
- [ ] Safety Fence 文件（§4）diff 为空
- [ ] registry-mounted.test 证明 wecom 已注册

### 2.11 Commit

```bash
scripts/committer "[enhanced] feat(deck): migrate wecom access UI to AccessDescriptor registry" \
  dashboard/src/components/panels/channels/access-descriptors/ \
  dashboard/src/components/panels/channels/ChannelDetail.tsx \
  dashboard/src/components/panels/channels/ChannelAccessTab.tsx \
  dashboard/src/components/panels/channels/ChannelSettingsTab.tsx \
  dashboard/src/app/providers.tsx
```

### 2.12 规模预估（G2 第二轮修正版）

**~1100-1200 行**（diff 单位，向上调整 25%）：

原 ~900 行估计低估了以下"搬家税"：

- 实测 `ChannelAccessTab.tsx:101-621` = 521 行 + `ChannelDetail.tsx:514-657` = 144 行 + L353-409 的 wecomAccessModel/alerts 构建 ~57 行 + L285-321 两个 useEffect ~37 行 = **~759 行纯迁移**
- 加上 import 重整、useMemo 依赖修复、类型补齐（descriptor 签名、hooks 泛型）、对 AccessPanel 新 prop 链路的适配 = 搬家税约 15-20%

实际 diff 分布：

- +840 `wecom-access-descriptor.tsx`（迁移 ~759 + descriptor 组合/注册 ~80）
- +150 `wecom-access-descriptor.test.tsx`
- +100 `hooks.ts`
- +40 `AccessPanel.tsx`（若 PR #1 未建）
- +50 `index.ts` + `providers.tsx` + `registry-mounted.test.tsx`
- -759 ChannelAccessTab/ChannelDetail 中 wecom 代码迁出
- -50 ChannelDetail 其他 wecom 分支删除（L218/L221/L285-321/L796-811/L910）
- -15 ChannelSettingsTab.tsx 常量删除 + 分支改写
- +50 ChannelAccessTab.tsx 精简重写（40 行）+ onActivateAccessTab prop 接线
- +40 ChannelDetail.tsx 改写（AccessPanel 插入 + Manage Access 通用化回调 + openAccessTabWithAccount 闭包）

**拆 PR 策略**（若 PR 单体超 1000 行合审困难）：

- **PR #2a**：AccessPanel + hooks + wecom descriptor 的 Access Tab 迁移（`WecomAccessTabContent`）+ ChannelAccessTab 精简（~600 行）
- **PR #2b**：wecom descriptor 的 Status Summary 迁移（`WecomPermissionSummary`）+ ChannelDetail wecom 分支清理 + ChannelSettingsTab 迁移（~550 行）

PR #2a 合入后 Access Tab 可独立验证；PR #2b 再收尾 Status tab 的 summary 迁移。若选择拆分，PR #3 清理顺延。由 ralph 实施时根据实测 diff 体量决定。

---

## §3 PR #3：清理 + PluginsPanel 迁移 + 结构断言

### 3.1 目标

- 退役老 `channel-access-registry.ts` 和其 test
- 迁移 `PluginsPanel.tsx` 从 `hasDedicatedAccessSurface` 到 `hasAccessDescriptor`
- 引入结构断言测试
- 零引用验证

### 3.2 前置

PR #2 合入后观察 ≥1 天，确认无生产/联调 regression。

### 3.3 文件变更

| 文件                                                                               | 动作                                     |
| ---------------------------------------------------------------------------------- | ---------------------------------------- |
| `dashboard/src/components/panels/channels/channel-access-registry.ts`              | **删除**                                 |
| `dashboard/src/components/panels/channels/channel-access-registry.test.ts`         | **删除**                                 |
| `dashboard/src/components/panels/plugins/PluginsPanel.tsx`                         | L15 import + L42 调用点迁移到新 registry |
| `dashboard/src/components/panels/channels/channel-detail-no-hardcoded-ids.test.ts` | **新增**                                 |

### 3.4 `PluginsPanel.tsx` diff

```tsx
// before (L15):
import { hasDedicatedAccessSurface } from "../channels/channel-access-registry";
// after:
import { hasAccessDescriptor } from "../channels/access-descriptors/access-descriptor-registry";

// before (L42):
const accessChannels = visibleChannels.filter((channelId) => hasDedicatedAccessSurface(channelId));
// after:
const accessChannels = visibleChannels.filter((channelId) => hasAccessDescriptor(channelId));
```

### 3.5 结构断言 `channel-detail-no-hardcoded-ids.test.ts`

（完整代码见 spec §5.2）

### 3.6 验证步骤

```bash
pnpm check
pnpm test dashboard/src/components/panels/channels
pnpm test dashboard/src/components/panels/plugins
pnpm build

# 零引用校验
rg -n 'channel-access-registry' dashboard/src/          # 必须为空
rg -n 'getChannelAccessDescriptor' dashboard/src/       # 必须为空
rg -n 'hasDedicatedAccessSurface' dashboard/src/        # 必须为空
rg -n 'ChannelAccessDescriptor' dashboard/src/          # 仅匹配新 AccessDescriptor（注意：旧类型名不同，无冲突）
```

**Landing gate**：

- [ ] 全部 zero-reference 校验通过
- [ ] 结构断言 3 条（3 个文件 × 5 个 pattern）全绿
- [ ] §5.1 wecom 测试仍全绿
- [ ] `pnpm build` 成功
- [ ] G2 第二轮审查 APPROVE（若 PR #2 已过审，PR #3 可放宽为单审）

### 3.7 Commit

```bash
scripts/committer "[enhanced] chore(deck): retire channel-access-registry after descriptor migration" \
  dashboard/src/components/panels/plugins/PluginsPanel.tsx \
  dashboard/src/components/panels/channels/channel-access-registry.ts \
  dashboard/src/components/panels/channels/channel-access-registry.test.ts \
  dashboard/src/components/panels/channels/channel-detail-no-hardcoded-ids.test.ts
```

### 3.8 规模预估

-40（老 registry + test）+ 30（新结构断言）+ 2（PluginsPanel import + call）≈ 净增 -8 行。

---

## §4 WeCom Safety Fence（业务逻辑零改动）

**下列文件在 3 个 PR 中业务逻辑零改动**。PR #2 中 `ChannelAccessTab.tsx` / `ChannelDetail.tsx` / `ChannelSettingsTab.tsx` 确有改动，但**非业务逻辑**——仅移除 wecom 分支并让位给 descriptor。

### A. 真正零改动（一行不碰）

```
dashboard/src/components/panels/channels/wecom-access-model.ts
dashboard/src/components/panels/channels/AllowFromEditor.tsx
dashboard/src/components/panels/channels/BindingsTab.tsx
dashboard/src/components/panels/channels/DmPolicySelector.tsx
dashboard/src/components/panels/channels/WeComWizard.tsx
dashboard/src/components/panels/channels/OpenClawWeixinWizard.tsx
```

### B. i18n 保护（对应 section 不改）

```
dashboard/src/i18n/en.json —  channels.access.* / channels.wecom.* / wecomWizard.* / wecomAccess.* section
dashboard/src/i18n/zh.json —  同上
```

### C. 测试基线保留（不修改测试内容）

```
dashboard/src/components/panels/channels/wecom-access-boundary.integration.test.tsx
dashboard/src/components/panels/channels/ChannelDetail.permission-summary.test.tsx
dashboard/src/components/panels/channels/ChannelDetail.access-handoff.test.tsx
dashboard/src/components/panels/channels/BindingsTab.handoff.test.tsx
dashboard/src/components/panels/channels/BindingsTab.test.tsx
dashboard/src/components/panels/channels/AllowFromEditor.test.tsx
dashboard/src/components/panels/channels/WeComWizard.access-guidance.test.tsx
dashboard/src/components/panels/channels/ChannelAccessTab.test.tsx
```

### D. Safety Fence 自检脚本

每个 PR push 前执行：

```bash
# A 区真正零改动校验
PROTECTED_A=(
  "dashboard/src/components/panels/channels/wecom-access-model.ts"
  "dashboard/src/components/panels/channels/AllowFromEditor.tsx"
  "dashboard/src/components/panels/channels/BindingsTab.tsx"
  "dashboard/src/components/panels/channels/DmPolicySelector.tsx"
  "dashboard/src/components/panels/channels/WeComWizard.tsx"
  "dashboard/src/components/panels/channels/OpenClawWeixinWizard.tsx"
)
VIOLATIONS=0
for f in "${PROTECTED_A[@]}"; do
  if git diff --name-only origin/main...HEAD | grep -qx "$f"; then
    echo "BLOCKER: protected file changed: $f"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done
if [ "$VIOLATIONS" -gt 0 ]; then
  exit 1
fi
echo "Safety Fence A: OK"
```

B 区（i18n section）依赖 code review 目视；C 区（测试文件）依赖 Landing gate 的测试绿。

---

## §5 验证 gate 合集

### 5.1 WeCom 回归测试（所有 PR 必跑）

（命令见 §2.10 第 2 步，此处不重复）

### 5.2 结构断言（PR #3 起持续跑）

```bash
pnpm test dashboard/src/components/panels/channels/channel-detail-no-hardcoded-ids.test.ts
```

### 5.3 Registry 挂载冒烟（PR #2 起持续跑）

```bash
pnpm test dashboard/src/components/panels/channels/access-descriptors/registry-mounted.test.tsx
```

### 5.4 工程 gate（每个 PR push 前）

```bash
pnpm check
pnpm test      # 全量（或增量，遵循 AGENTS.md 测试规则）
pnpm build     # 触碰 build 边界才跑；本 spec 三个 PR 均建议跑
```

### 5.5 手工视觉验收（PR #2 强制）

`scripts/dev/deck-dev.sh` 启动后按 §2.10 第 6 步清单验证。

---

## §6 回滚策略

| 阶段  | 回滚方式                                                                                                                                                 |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR #1 | `git revert <sha>`；骨架无消费者，零侧效应                                                                                                               |
| PR #2 | **若合并 24h 内 wecom regression → `git revert <sha>`**；由于 `wecom-access-model.ts` / `AllowFromEditor.tsx` / `BindingsTab.tsx` 未动，业务代码立刻恢复 |
| PR #3 | `git revert <sha>`；老 registry 复活；`PluginsPanel.tsx` import 路径回退                                                                                 |

**无 feature flag**（非实验性变更，spec §4.2 明确）。

---

## §7 裁决记录（G2 两轮双审已定案）

### §7.1 G2 第一轮（plan v1）输出

原 plan v1 的 6 个开放问题已由 G2 第一轮（Claude architect + Codex）共识裁决：

| Q   | 内容                                | 裁决                           | 理由                                                                        |
| --- | ----------------------------------- | ------------------------------ | --------------------------------------------------------------------------- |
| Q1  | PluginsPanel 时序（PR #2 or PR #3） | **PR #3**                      | PR #2 风险焦点不稀释；`hasDedicatedAccessSurface` 在 PR #2 期间保持兼容即可 |
| Q2  | `shouldShow` 去留                   | **去掉**                       | `hasAccessDescriptor` 语义等价，避免二层真相                                |
| Q3  | typed gw client vs 字符串 method    | **typed gw**                   | CLAUDE.md repo 级硬约束                                                     |
| Q4  | zod runtime schema                  | **不引入**                     | State opaque 由 TS 泛型保证                                                 |
| Q5  | hooks 位置                          | **独立文件** `hooks.ts`        | 便于测试与复用                                                              |
| Q6  | AccessPanel 落位                    | **独立文件** `AccessPanel.tsx` | Status / Access 两处消费共享                                                |

### §7.2 G2 第二轮（plan v2）输出

plan v2 §8 列出的 6 个 Q-R 已由 G2 第二轮 Claude architect + 主 session 代码事实实测（grep `useGatewayClient` / `import.meta.hot`、`ChannelDetail.tsx:799-800` 原文）共识裁决：

| Q-R  | 内容                                | 裁决                                                                                      | 落地                                                         |
| ---- | ----------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Q-R1 | render 返回 null + AccessPanel 特判 | **reject** —— descriptor.render 必须返回真实 ReactNode；AccessPanel 纯透传                | spec §3.3 硬化；plan §2.4 骨架已改写                         |
| Q-R2 | gw 注入方式                         | **改为 optional** —— Deck 无 `useGatewayClient()` 基础设施（grep 零命中）                 | spec §3.3 `gw?: GatewayClient`；plan §2.8 hooks 传 undefined |
| Q-R3 | L910 条件改写                       | **用显式元数据** `usesAccessTabForAccountConfig` 替代 `handleManageAccess` 存在性推断     | spec §3.3 新增字段；plan §2.5 条件改写                       |
| Q-R4 | cancelled flag 并发处理             | **接受现状**（wecom load null 无风险；未来真实 load 可按需升级）                          | plan §2.8 effect 依赖明确                                    |
| Q-R5 | 规模预估                            | **上调到 ~1100-1200 行**                                                                  | plan §2.12 重写 + 拆 PR #2a/#2b 策略                         |
| Q-R6 | HMR 判定                            | **改用 `NODE_ENV` gate** —— `import.meta.hot` 在 Next.js (Webpack/Turbopack) 下恒为 false | plan §2.4 骨架已改写                                         |

### §7.3 Claude architect G2 第二轮额外 3 项 blocker 修订

| 编号 | 内容                                               | 落地                                                                                                                                                |
| ---- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1   | handleManageAccess 闭环丢 `setActiveTab("access")` | plan §2.5 新增 `openAccessTabWithAccount` 打包闭包；§2.8 `openAccessTab` 调 `onActivateAccessTab`；spec §3.3 `AccessActions.openAccessTab` 语义硬化 |
| B2   | `_channel` 下划线绕过未使用告警                    | plan §2.6 移除下划线，真实透传 `channel` prop                                                                                                       |
| B3   | ChannelSettingsTab 单行替换语义微妙                | plan §2.7 改写为完整 if/else 函数体，附 3 条"与原行为 1:1 等价"语义保证                                                                             |

---

## §8 G2 第二轮关注点（已裁决归档）

> 本节在 plan v2 首发时作为"待 G2 第二轮定向审查"的问题清单。G2 第二轮已完成，6 项 Q-R + 3 项 blocker 全部裁决，裁决结果落入 §7.2 / §7.3，代码骨架改动落入 §2.4 / §2.5 / §2.6 / §2.7 / §2.8 / §2.9 / §2.12。本节保留仅供追溯。

---

## §9 执行者 checklist

### PR #1 开工前

- [ ] 读完 spec §1-§3（基于 2026-04-17 Revised 版本）
- [ ] 读完本 plan §1-§2（PR #1 + PR #2 范围）
- [ ] G2 第二轮对本 plan APPROVE

### PR #1 执行中

- [ ] 6 个新文件全部创建
- [ ] `pnpm check` 零告警
- [ ] registry test 7 条覆盖点全中
- [ ] `git diff --stat` 只含新增
- [ ] Safety Fence 自检脚本（§4.D）通过

### PR #2 执行中

- [ ] §4 Safety Fence A 区 6 个文件零改动
- [ ] `WecomAccessTabContent` / `WecomPermissionSummary` 代码**逐行对比**原位置确认 1:1（`git diff --color-words`）
- [ ] §2.5 ChannelDetail.tsx 8 处删除点全部清理
- [ ] §2.7 ChannelSettingsTab.tsx diff 完成
- [ ] 顶层 side-effect import 落地（providers.tsx 或等效）
- [ ] §5.1 wecom 回归测试 8 条全绿
- [ ] §5.3 registry-mounted 测试绿
- [ ] 手工视觉验收 6 项通过
- [ ] G2 第二轮双审 APPROVE

### PR #3 执行中

- [ ] PR #2 合入 ≥1 天
- [ ] `PluginsPanel.tsx` 2 处改写
- [ ] 老 registry + test 删除
- [ ] 结构断言测试引入并通过（3 文件 × 5 pattern）
- [ ] 4 条零引用 grep 命令均返回空
- [ ] §5.1 wecom 测试仍全绿

### 每个 PR push 前共性

- [ ] `pnpm check` 通过
- [ ] `pnpm test` 通过
- [ ] `git log` 仅含本 PR 预期 commit
- [ ] Safety Fence 自检脚本（§4.D）通过
- [ ] commit 使用 `scripts/committer`

---

## §10 修订记录

| 日期       | 阶段         | 变更                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-17 | G1 v1        | 首稿（基于 spec v1）                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-04-17 | G2 第一轮    | Claude architect REVISE + Codex REJECT；暴露 3 类 blocker + §7 六问共识裁决                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-04-17 | G1 v2        | 完全重写：基于 spec Revised 版本对齐代码事实；PR #2 规模 300→900；新增 §8 Q-R1~R6 针对性审查问题供 G2 第二轮定向裁决                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-04-17 | G2 第二轮    | Claude architect REVISE + 主 session 代码事实实测（`useGatewayClient` / `import.meta.hot` 零命中 + `ChannelDetail.tsx:799-800` 原文确认）；Q-R1~Q-R6 逐条裁决 + 3 项 blocker                                                                                                                                                                                                                                                                                                           |
| 2026-04-17 | v3（本版本） | G3 共识修订落地：§2.4 wecom-access-descriptor `render` 改真实返回 ReactNode + HMR 改 NODE_ENV；§2.5 新增 handleManageAccess 原子闭包 + L910 条件改为 `usesAccessTabForAccountConfig`；§2.6 `_channel` 下划线移除；§2.7 ChannelSettingsTab 完整 if/else 分支 + 三条等价语义保证；§2.8 hooks 真实组装 context + openAccessTab 闭环 `onActivateAccessTab`；§2.9 registry-mounted 改 import barrel；§2.12 规模上调 ~1100-1200 行 + 拆 PR #2a/#2b 策略；§7.2/§7.3 裁决归档；§8 标记为已归档 |

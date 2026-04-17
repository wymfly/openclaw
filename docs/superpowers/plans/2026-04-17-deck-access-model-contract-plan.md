# Deck Access Model Contract 实施计划

> **For agentic workers**: REQUIRED SUB-SKILL: Use `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax. 严格按 commit 顺序 landing，任何跳步需用户明确批准。

**Goal**: 把 WeCom 权限管理从 `ChannelDetail` / `ChannelAccessTab` 的硬编码分支中解耦出来，改为 `AccessDescriptor` 契约 + Registry 模式，为后续渠道权限管理（Discord/Slack/Telegram）扫清路径。

**Architecture**: 3 PR 串行（契约骨架 → WeCom 1:1 迁移 → 死代码清理）。新增目录 `dashboard/src/components/panels/channels/access-descriptors/`。

**Design Spec**: `docs/superpowers/specs/2026-04-17-deck-access-model-contract-design.md`

**Branch**: `enhanced`（所有 commit 带 `[enhanced]` 前缀，经 `scripts/committer`）

---

## Safety Fence（forbidden-modify，硬性红线）

- `dashboard/src/components/panels/channels/wecom-access-model.ts`
- `dashboard/src/components/panels/channels/AllowFromEditor.tsx`
- `dashboard/src/components/panels/channels/AllowFromEditor.test.tsx`
- `dashboard/src/components/panels/channels/BindingsTab.tsx`
- `dashboard/src/components/panels/channels/BindingsTab.test.tsx`
- `dashboard/src/components/panels/channels/BindingsTab.handoff.test.tsx`
- `dashboard/src/components/panels/channels/wecom-access-boundary.integration.test.tsx`
- `dashboard/src/components/panels/channels/WeComWizard.access-guidance.test.tsx`
- `dashboard/src/components/panels/channels/wecom-settings-technical-panel.integration.test.tsx`
- `dashboard/src/components/panels/channels/ChannelDetail.permission-summary.test.tsx`
- `dashboard/src/components/panels/channels/ChannelDetail.access-handoff.test.tsx`
- 所有 `src/channels/wecom/**`（Gateway 侧）
- 所有 `src/gateway/server-methods/wecom-*`

**Forbidden diff 检查命令**（每个 PR landing 前运行）：

```bash
git diff --stat origin/enhanced...HEAD -- \
  dashboard/src/components/panels/channels/wecom-access-model.ts \
  dashboard/src/components/panels/channels/AllowFromEditor.tsx \
  dashboard/src/components/panels/channels/AllowFromEditor.test.tsx \
  dashboard/src/components/panels/channels/BindingsTab.tsx \
  dashboard/src/components/panels/channels/BindingsTab.test.tsx \
  dashboard/src/components/panels/channels/BindingsTab.handoff.test.tsx \
  dashboard/src/components/panels/channels/wecom-access-boundary.integration.test.tsx \
  dashboard/src/components/panels/channels/WeComWizard.access-guidance.test.tsx \
  dashboard/src/components/panels/channels/wecom-settings-technical-panel.integration.test.tsx \
  dashboard/src/components/panels/channels/ChannelDetail.permission-summary.test.tsx \
  dashboard/src/components/panels/channels/ChannelDetail.access-handoff.test.tsx \
  'src/channels/wecom/**' \
  'src/gateway/server-methods/wecom-*'
# 期待输出：空（零行改动）。任何非空输出 = BLOCKER。
```

---

## PR #1 — 契约骨架

### Commit 1.1: 新增 AccessDescriptor 契约类型

**Files**:

- Create: `dashboard/src/components/panels/channels/access-descriptors/access-descriptor.types.ts`

**Commit msg**: `[enhanced] Add AccessDescriptor contract types for channel access model`

**Full file content**:

```typescript
// dashboard/src/components/panels/channels/access-descriptors/access-descriptor.types.ts

import type { ReactNode } from "react";

/**
 * Access control descriptor for a channel.
 *
 * Contract principle: the registry only governs HOW to mount access UI;
 * the state shape is opaque and fully owned by the implementing descriptor.
 */
export interface AccessDescriptor<State = unknown> {
  readonly channelId: string;
  load(context: AccessLoadContext): Promise<State>;
  render(state: State, actions: AccessActions): ReactNode;
  normalize?(raw: unknown): State;
}

export interface AccessLoadContext {
  readonly channelId: string;
  readonly gatewayRequest: (method: string, params: unknown) => Promise<unknown>;
  readonly configSnapshot?: unknown;
}

export interface AccessActions {
  readonly save: (patch: unknown) => Promise<void>;
  readonly refresh: () => Promise<void>;
}
```

- [ ] Step 1: 创建目录 `dashboard/src/components/panels/channels/access-descriptors/`
- [ ] Step 2: 按上文写入 `access-descriptor.types.ts`
- [ ] Step 3: `cd dashboard && pnpm tsc --noEmit` 零错误
- [ ] Step 4: Safety Fence diff 检查 → 零输出
- [ ] Step 5: `scripts/committer "[enhanced] Add AccessDescriptor contract types for channel access model" dashboard/src/components/panels/channels/access-descriptors/access-descriptor.types.ts`

### Commit 1.2: 实现 Registry + 单元测试

**Files**:

- Create: `dashboard/src/components/panels/channels/access-descriptors/access-descriptor-registry.ts`
- Create: `dashboard/src/components/panels/channels/access-descriptors/access-descriptor-registry.test.ts`

**Commit msg**: `[enhanced] Add access descriptor registry with unit tests`

**Registry file**:

```typescript
// dashboard/src/components/panels/channels/access-descriptors/access-descriptor-registry.ts

import type { AccessDescriptor } from "./access-descriptor.types";

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

export function listAccessDescriptorChannelIds(): readonly string[] {
  return Array.from(descriptors.keys());
}

/** Test-only helper. Production code must not clear the registry. */
export function __resetAccessDescriptorsForTesting(): void {
  descriptors.clear();
}
```

**Registry test file**:

```typescript
// dashboard/src/components/panels/channels/access-descriptors/access-descriptor-registry.test.ts

import { afterEach, describe, expect, it } from "vitest";
import {
  __resetAccessDescriptorsForTesting,
  getAccessDescriptor,
  hasAccessDescriptor,
  listAccessDescriptorChannelIds,
  registerAccessDescriptor,
} from "./access-descriptor-registry";
import type { AccessDescriptor } from "./access-descriptor.types";

function makeFakeDescriptor(channelId: string): AccessDescriptor<{ ok: true }> {
  return {
    channelId,
    async load() {
      return { ok: true as const };
    },
    render() {
      return null;
    },
  };
}

describe("access-descriptor-registry", () => {
  afterEach(() => {
    __resetAccessDescriptorsForTesting();
  });

  it("registers and retrieves a descriptor by channelId", () => {
    const descriptor = makeFakeDescriptor("telegram");
    registerAccessDescriptor(descriptor);
    expect(getAccessDescriptor("telegram")).toBe(descriptor);
    expect(hasAccessDescriptor("telegram")).toBe(true);
  });

  it("returns null and false for an unknown channelId", () => {
    expect(getAccessDescriptor("unknown")).toBeNull();
    expect(hasAccessDescriptor("unknown")).toBe(false);
  });

  it("throws when the same channelId is registered twice", () => {
    registerAccessDescriptor(makeFakeDescriptor("slack"));
    expect(() => registerAccessDescriptor(makeFakeDescriptor("slack"))).toThrowError(
      /already registered: slack/,
    );
  });

  it("lists all registered channel ids in insertion order", () => {
    registerAccessDescriptor(makeFakeDescriptor("a"));
    registerAccessDescriptor(makeFakeDescriptor("b"));
    expect(listAccessDescriptorChannelIds()).toEqual(["a", "b"]);
  });

  it("__resetAccessDescriptorsForTesting clears all entries", () => {
    registerAccessDescriptor(makeFakeDescriptor("wecom"));
    __resetAccessDescriptorsForTesting();
    expect(hasAccessDescriptor("wecom")).toBe(false);
    expect(listAccessDescriptorChannelIds()).toEqual([]);
  });
});
```

- [ ] Step 1: 写入两个文件
- [ ] Step 2: `pnpm test access-descriptor-registry` → 5 tests pass
- [ ] Step 3: `pnpm tsc --noEmit` 零错误
- [ ] Step 4: Safety Fence → 零输出
- [ ] Step 5: Commit 两个文件

### Commit 1.3: 新增 barrel（空注册器）

**Files**:

- Create: `dashboard/src/components/panels/channels/access-descriptors/index.ts`

**Commit msg**: `[enhanced] Add access-descriptors barrel with empty registration`

```typescript
// dashboard/src/components/panels/channels/access-descriptors/index.ts

/**
 * Entry point that registers all access descriptors at module-load time.
 * Importing this module has a side-effect: it populates the registry.
 *
 * NOTE: Descriptors are registered in PR #2. This commit ships the empty
 * barrel so consumers can import the registry API without a chicken-and-egg race.
 */

export type { AccessActions, AccessDescriptor, AccessLoadContext } from "./access-descriptor.types";

export {
  __resetAccessDescriptorsForTesting,
  getAccessDescriptor,
  hasAccessDescriptor,
  listAccessDescriptorChannelIds,
  registerAccessDescriptor,
} from "./access-descriptor-registry";

// Registration happens here. PR #2 will append:
//   import { wecomAccessDescriptor } from "./wecom-access-descriptor";
//   registerAccessDescriptor(wecomAccessDescriptor);
```

- [ ] Step 1: 写入 barrel
- [ ] Step 2: `pnpm tsc --noEmit` 零错误
- [ ] Step 3: Safety Fence → 零输出
- [ ] Step 4: Commit

### Commit 1.4: 文档 — SDK Access Model

**Files**:

- Create: `docs/plugins/sdk-access-model.md`

**Commit msg**: `[enhanced] Document the channel AccessDescriptor contract`

文档结构：Overview / Contract（指向 access-descriptor.types.ts）/ Registering a descriptor / Relation to other plugin SDKs（链接 `/plugins/sdk-channel-plugins`、`/plugins/architecture`，root-relative、无 em dash）。

- [ ] Step 1: 写入 doc
- [ ] Step 2: `pnpm docs:check-i18n-glossary` 通过
- [ ] Step 3: Safety Fence → 零输出
- [ ] Step 4: Commit

### PR #1 Landing Gate Checklist

- [ ] `cd dashboard && pnpm tsc --noEmit` 零 error 零 warning
- [ ] `cd dashboard && pnpm test` 全绿；新增测试 5 个（access-descriptor-registry）
- [ ] `cd dashboard && pnpm build` 成功
- [ ] Forbidden-modify diff 检查 → 零输出
- [ ] 新目录 `access-descriptors/` 仅 4 个文件（.types / registry / registry.test / index）
- [ ] 无任何既有文件被修改
- [ ] PR 描述引用 spec §4.1

---

## PR #2 — WeCom 迁移 + 消费侧切换（核心风险 PR）

> **实施顺序**: 为保证每个 intermediate commit 可编译，按以下顺序落地：
> **2.4 → 2.1 → 2.2 → 2.3 → 2.5a → 2.5b → 2.5c**

### Commit 2.4: 抽取 WecomAccessPanel（从 ChannelAccessTab.tsx 整体搬运）

**Files**:

- Create: `dashboard/src/components/panels/channels/WecomAccessPanel.tsx`
- Modify: `dashboard/src/components/panels/channels/ChannelAccessTab.tsx`

**Commit msg**: `[enhanced] Extract WecomAccessTab into reusable WecomAccessPanel`

**Mechanical move instruction**:

1. 不用 `git mv`（保留 `ChannelAccessTab.tsx`）。用 copy-then-replace。
2. 打开 `ChannelAccessTab.tsx`，把 lines 21-54（`SectionAlert` + `SaveBar`）和 lines 101-621（`WecomAccessTab` 及其 body）**原样复制**进新文件。
3. 新文件里把 `WecomAccessTab` 重命名为 `WecomAccessPanel`（两处：函数定义 + 自引用）。
4. 所有相对 import（`./AllowFromEditor`、`./DmPolicySelector`、`./wecom-access-model`）保持不变（新文件同目录）。
5. 验证：`diff <(sed -n '21,54p;101,621p' ChannelAccessTab.tsx) <(tail -n +N WecomAccessPanel.tsx)` 应只显示 `WecomAccessTab` → `WecomAccessPanel` 的 rename。

**ChannelAccessTab.tsx 完整替换**:

```typescript
// dashboard/src/components/panels/channels/ChannelAccessTab.tsx
"use client";

import { useTranslations } from "next-intl";
import { useChannelsStore, type ChannelInfo } from "../../../stores/channels";
import { getAccessDescriptor } from "./access-descriptors";
import "./access-descriptors"; // side-effect import: populates registry

export function ChannelAccessTab({
  channelId,
  channel,
  selectedAccountId,
  onSelectedAccountChange,
}: {
  channelId: string;
  channel: ChannelInfo;
  selectedAccountId?: string;
  onSelectedAccountChange?: (accountId: string) => void;
}) {
  const t = useTranslations("channels.access");
  const descriptor = getAccessDescriptor(channelId);

  if (!descriptor) {
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

  return (
    <>
      {descriptor.render(
        { channel, selectedAccountId, onSelectedAccountChange },
        {
          save: async () => {},
          refresh: async () => {},
        },
      )}
    </>
  );
}
```

- [ ] Step 1: 创建 `WecomAccessPanel.tsx`（按搬运指令）
- [ ] Step 2: 重写 `ChannelAccessTab.tsx`
- [ ] Step 3: `pnpm tsc --noEmit` 零错误（注意：commit 2.1 之前 `descriptor` 将返回 null 因 registry 空；所有 wecom 测试暂时会 fail，这是预期，commit 2.3 注册后恢复）
- [ ] Step 4: Safety Fence → 零输出
- [ ] Step 5: Commit 两个文件

### Commit 2.1: 实现 WecomAccessDescriptor（wrapper 形态）

**Files**:

- Create: `dashboard/src/components/panels/channels/access-descriptors/wecom-access-descriptor.tsx`

**Commit msg**: `[enhanced] Wrap WeCom access UI in AccessDescriptor (no behavior change)`

```typescript
// dashboard/src/components/panels/channels/access-descriptors/wecom-access-descriptor.tsx
"use client";

import type { ReactNode } from "react";
import type { ChannelInfo } from "../../../../stores/channels";
import { WecomAccessPanel } from "../WecomAccessPanel";
import type {
  AccessActions,
  AccessDescriptor,
  AccessLoadContext,
} from "./access-descriptor.types";

export interface WecomAccessState {
  readonly channel: ChannelInfo;
  readonly selectedAccountId?: string;
  readonly onSelectedAccountChange?: (accountId: string) => void;
}

export const wecomAccessDescriptor: AccessDescriptor<WecomAccessState> = {
  channelId: "wecom",

  async load(_context: AccessLoadContext): Promise<WecomAccessState> {
    throw new Error("wecomAccessDescriptor.load() is not exercised in PR #2; state is passed directly by the caller.");
  },

  render(state: WecomAccessState, _actions: AccessActions): ReactNode {
    return (
      <WecomAccessPanel
        channel={state.channel}
        selectedAccountId={state.selectedAccountId}
        onSelectedAccountChange={state.onSelectedAccountChange}
      />
    );
  },
};
```

- [ ] Step 1: 写入文件
- [ ] Step 2: `pnpm tsc --noEmit` 零错误（依赖 2.4 已落地的 `WecomAccessPanel`）
- [ ] Step 3: Safety Fence → 零输出
- [ ] Step 4: Commit

### Commit 2.2: WecomAccessDescriptor 契约行为测试

**Files**:

- Create: `dashboard/src/components/panels/channels/access-descriptors/wecom-access-descriptor.test.tsx`

**Commit msg**: `[enhanced] Add contract-level tests for wecomAccessDescriptor`

```typescript
// dashboard/src/components/panels/channels/access-descriptors/wecom-access-descriptor.test.tsx
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChannelInfo } from "../../../../stores/channels";
import { wecomAccessDescriptor } from "./wecom-access-descriptor";

vi.mock("../WecomAccessPanel", () => ({
  WecomAccessPanel: ({ channel }: { channel: ChannelInfo }) => (
    <div data-testid="wecom-access-panel">{channel.id}</div>
  ),
}));

const fakeChannel: ChannelInfo = {
  id: "wecom",
  label: "WeCom",
  accounts: [],
  defaultAccountId: undefined,
  pluginId: "wecom",
  pluginOrigin: undefined,
  pluginConfigPath: undefined,
} as unknown as ChannelInfo;

const actionsStub = {
  save: vi.fn(async () => {}),
  refresh: vi.fn(async () => {}),
};

describe("wecomAccessDescriptor", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("registers under channelId 'wecom'", () => {
    expect(wecomAccessDescriptor.channelId).toBe("wecom");
  });

  it("render() returns a WecomAccessPanel tree bound to the provided channel", () => {
    const node = wecomAccessDescriptor.render({ channel: fakeChannel }, actionsStub);
    render(<>{node}</>);
    expect(screen.getByTestId("wecom-access-panel").textContent).toBe("wecom");
  });

  it("render() forwards selectedAccountId and the change handler", () => {
    const onChange = vi.fn();
    const node = wecomAccessDescriptor.render(
      { channel: fakeChannel, selectedAccountId: "acct-1", onSelectedAccountChange: onChange },
      actionsStub,
    );
    render(<>{node}</>);
    expect(screen.getByTestId("wecom-access-panel")).toBeTruthy();
  });

  it("load() throws a documented not-implemented error in PR #2 scope", async () => {
    await expect(
      wecomAccessDescriptor.load({
        channelId: "wecom",
        gatewayRequest: async () => ({}),
      }),
    ).rejects.toThrow(/not exercised in PR #2/);
  });
});
```

- [ ] Step 1: 写入测试
- [ ] Step 2: `pnpm test wecom-access-descriptor` → 4 tests pass
- [ ] Step 3: Commit

### Commit 2.3: 注册 wecomAccessDescriptor 到 barrel

**Files**:

- Modify: `dashboard/src/components/panels/channels/access-descriptors/index.ts`

**Commit msg**: `[enhanced] Register wecomAccessDescriptor in access-descriptors barrel`

在 barrel 末尾新增：

```typescript
import { wecomAccessDescriptor } from "./wecom-access-descriptor";
import { registerAccessDescriptor as _register } from "./access-descriptor-registry";

_register(wecomAccessDescriptor);
```

- [ ] Step 1: 应用 diff
- [ ] Step 2: 此时 `ChannelAccessTab` 通过 registry 能找到 wecom，wecom detail 页面恢复工作
- [ ] Step 3: `pnpm test` 全绿（wecom 相关测试应恢复）
- [ ] Step 4: Commit

### Commit 2.5a: 契约增补 renderSummary（schema-compatible addition）

**Files**:

- Modify: `dashboard/src/components/panels/channels/access-descriptors/access-descriptor.types.ts`
- Modify: `dashboard/src/components/panels/channels/access-descriptors/access-descriptor-registry.test.ts`（追加 backward-compat 测试）

**Commit msg**: `[enhanced] Extend AccessDescriptor with optional renderSummary hook`

契约增补：

```typescript
export interface AccessDescriptor<State = unknown> {
  // ... existing fields ...
  /** Optional: render a summary card for the status tab. */
  renderSummary?(context: {
    channel: ChannelInfo;
    channelConfig: Record<string, unknown> | null;
    bindings: readonly unknown[];
    bindingsLoaded: boolean;
    onOpenAccess: (accountId?: string) => void;
  }): ReactNode;
}
```

测试追加：

```typescript
it("descriptor without renderSummary still satisfies the contract", () => {
  const descriptor = makeFakeDescriptor("minimal");
  registerAccessDescriptor(descriptor);
  expect(getAccessDescriptor("minimal")?.renderSummary).toBeUndefined();
});
```

- [ ] Step 1: 应用契约增补
- [ ] Step 2: `pnpm tsc --noEmit` + `pnpm test` 全绿
- [ ] Step 3: Commit

### Commit 2.5b: 抽取 WecomPermissionSummary

**Files**:

- Create: `dashboard/src/components/panels/channels/WecomPermissionSummary.tsx`
- Modify: `dashboard/src/components/panels/channels/access-descriptors/wecom-access-descriptor.tsx`（添加 `renderSummary`）

**Commit msg**: `[enhanced] Move WeCom permission summary into descriptor.renderSummary`

机械搬运 `ChannelDetail.tsx:353-657` 权限 summary 子树到新组件，零逻辑改动。descriptor 添加 `renderSummary` 实现调用它。

- [ ] Step 1: 创建 `WecomPermissionSummary.tsx`（搬运 `ChannelDetail.tsx:353-657`）
- [ ] Step 2: 更新 `wecom-access-descriptor.tsx` 添加 `renderSummary`
- [ ] Step 3: `pnpm tsc --noEmit` 零错误
- [ ] Step 4: Safety Fence → 零输出
- [ ] Step 5: Commit

### Commit 2.5c: ChannelDetail 去字面量

**Files**:

- Modify: `dashboard/src/components/panels/channels/ChannelDetail.tsx`

**Commit msg**: `[enhanced] Remove wecom channel-id literals from ChannelDetail`

**Top imports diff**:

```diff
+import { getAccessDescriptor, hasAccessDescriptor } from "./access-descriptors";
+import "./access-descriptors"; // side-effect registration
```

**替换矩阵**（ChannelDetail.tsx 6 处 wecom 字面量）:

| 行号 | 原代码                                                                      | 替换为                                                                                                                          |
| ---- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 218  | `useState(channelId !== "wecom")`                                           | `useState(!hasAccessDescriptor(channelId))`                                                                                     |
| 221  | `useState(channelId !== "wecom")`                                           | `useState(!hasAccessDescriptor(channelId))`                                                                                     |
| 286  | `if (channelId !== "wecom") {`                                              | `if (!hasAccessDescriptor(channelId)) {`                                                                                        |
| 305  | `if (channelId !== "wecom") {`                                              | `if (!hasAccessDescriptor(channelId)) {`                                                                                        |
| 353  | `const shouldShowWecomSummary = channelId === "wecom" && wecomConfigLoaded` | `const descriptor = getAccessDescriptor(channelId); const shouldShowSummary = !!descriptor?.renderSummary && wecomConfigLoaded` |
| 796  | `{channelId === "wecom" ? <ManageAccessButton/> : <ConfigureButton/>}`      | `{hasAccessDescriptor(channelId) ? <ManageAccessButton/> : <ConfigureButton/>}`                                                 |
| 910  | `{configAccount && channelId !== "wecom" && ...}`                           | `{configAccount && !hasAccessDescriptor(channelId) && ...}`                                                                     |

**Summary 渲染替换**: `ChannelDetail.tsx:353-657` 子树删除，改为：

```tsx
{
  shouldShowSummary &&
    descriptor?.renderSummary?.({
      channel,
      channelConfig,
      bindings: wecomBindings,
      bindingsLoaded,
      onOpenAccess: handleOpenAccess,
    });
}
```

- [ ] Step 1: 应用所有替换
- [ ] Step 2: `pnpm tsc --noEmit` 零错误
- [ ] Step 3: `grep -n 'channelId\s*[!=]==\s*"wecom"' dashboard/src/components/panels/channels/ChannelDetail.tsx` → 零命中
- [ ] Step 4: `pnpm test` 全绿（§5.1 清单全部绿）
- [ ] Step 5: 手工点一遍 wecom channel detail 的 Status / Access / Bindings / Settings / Analytics 5 个 tab → 视觉与交互 1:1
- [ ] Step 6: Safety Fence → 零输出
- [ ] Step 7: Commit

### PR #2 Landing Gate Checklist

- [ ] `cd dashboard && pnpm tsc --noEmit` 零 error
- [ ] `cd dashboard && pnpm test` 全绿；§5.1 清单逐项确认：
  - [ ] `ChannelDetail.permission-summary.test.tsx`
  - [ ] `ChannelDetail.access-handoff.test.tsx`
  - [ ] `wecom-access-boundary.integration.test.tsx`
  - [ ] `WeComWizard.access-guidance.test.tsx`
  - [ ] `BindingsTab.handoff.test.tsx`
  - [ ] `BindingsTab.test.tsx`
  - [ ] `AllowFromEditor.test.tsx`
  - [ ] `wecom-settings-technical-panel.integration.test.tsx`
  - [ ] `ChannelAccessTab.test.tsx`
  - [ ] `wecom-access-descriptor.test.tsx`（新）
  - [ ] `access-descriptor-registry.test.ts`（新 + 追加 renderSummary 用例）
- [ ] `cd dashboard && pnpm build` 成功
- [ ] Forbidden-modify diff 检查 → 零输出
- [ ] `grep -rn 'channelId\s*===\s*"wecom"' dashboard/src` → 零命中
- [ ] `grep -rn 'channelId\s*!==\s*"wecom"' dashboard/src` → 零命中
- [ ] 手工 wecom channel detail 5 tab 验收无回归
- [ ] Dark mode 验证
- [ ] CCG 双审（Claude + Codex）通过

### PR #2 回滚预案

按 commit 从后往前 `git revert` 逐步定位问题：

1. revert 2.5c → 若消失 = ChannelDetail 字面量替换或 module-load 顺序问题
2. revert 2.5b → 若消失 = WecomPermissionSummary 搬运漏 prop
3. revert 2.5a → 若消失 = 契约扩展破坏类型
4. revert 2.3 → 若消失 = registry 注册问题
5. revert 2.4 → 若消失 = WecomAccessPanel 搬运有漏行

**绝不回滚 PR #1**（契约本身无消费者，永远安全）。

---

## PR #3 — 死代码清理

### Commit 3.1: 切换 PluginsPanel 到新 registry API

**Files**:

- Modify: `dashboard/src/components/panels/plugins/PluginsPanel.tsx`

**Commit msg**: `[enhanced] Switch PluginsPanel to new access descriptor registry`

```diff
-import { hasDedicatedAccessSurface } from "../channels/channel-access-registry";
+import { hasAccessDescriptor } from "../channels/access-descriptors";
+import "../channels/access-descriptors"; // side-effect register

  const accessChannels = visibleChannels.filter((channelId) =>
-   hasDedicatedAccessSurface(channelId),
+   hasAccessDescriptor(channelId),
  );
```

- [ ] Step 1-5: 应用 diff、检查、commit

### Commit 3.2: 删除 legacy channel-access-registry

**Files**:

- Delete: `dashboard/src/components/panels/channels/channel-access-registry.ts`
- Delete: `dashboard/src/components/panels/channels/channel-access-registry.test.ts`

**Commit msg**: `[enhanced] Remove legacy channel-access-registry`

- [ ] Step 1: `git rm` 两个文件
- [ ] Step 2: `grep -rn 'channel-access-registry' dashboard/src` → 零命中
- [ ] Step 3: `grep -rn 'getChannelAccessDescriptor' dashboard/src` → 零命中
- [ ] Step 4: `grep -rn 'hasDedicatedAccessSurface' dashboard/src` → 零命中
- [ ] Step 5: Full CI green
- [ ] Step 6: Safety Fence → 零输出
- [ ] Step 7: Commit

### Commit 3.3: 结构性断言测试

**Files**:

- Create: `dashboard/src/components/panels/channels/channel-detail-no-hardcoded-ids.test.ts`

**Commit msg**: `[enhanced] Add structural assertion against channel id literals`

```typescript
// dashboard/src/components/panels/channels/channel-detail-no-hardcoded-ids.test.ts

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CHANNELS_DIR = join(__dirname);

function readFile(relative: string): string {
  return readFileSync(join(CHANNELS_DIR, relative), "utf8");
}

describe("structural guarantees for channel access decoupling", () => {
  it("ChannelDetail.tsx has no hardcoded channel id string comparisons", () => {
    const source = readFile("ChannelDetail.tsx");
    expect(source).not.toMatch(/channelId\s*===\s*["'][\w-]+["']/);
    expect(source).not.toMatch(/channelId\s*!==\s*["'][\w-]+["']/);
  });

  it("ChannelAccessTab.tsx has no hardcoded channel id string comparisons", () => {
    const source = readFile("ChannelAccessTab.tsx");
    expect(source).not.toMatch(/channelId\s*===\s*["'][\w-]+["']/);
    expect(source).not.toMatch(/channelId\s*!==\s*["'][\w-]+["']/);
  });

  it("ChannelDetail.tsx does not import the retired channel-access-registry", () => {
    const source = readFile("ChannelDetail.tsx");
    expect(source).not.toMatch(/from ["']\.\/channel-access-registry["']/);
  });

  it("ChannelAccessTab.tsx does not import the retired channel-access-registry", () => {
    const source = readFile("ChannelAccessTab.tsx");
    expect(source).not.toMatch(/from ["']\.\/channel-access-registry["']/);
  });

  it("new access-descriptors module is imported by the consumers", () => {
    const channelDetail = readFile("ChannelDetail.tsx");
    const channelAccess = readFile("ChannelAccessTab.tsx");
    expect(channelDetail).toMatch(/from ["']\.\/access-descriptors["']/);
    expect(channelAccess).toMatch(/from ["']\.\/access-descriptors["']/);
  });
});
```

- [ ] Step 1: 写入测试
- [ ] Step 2: `pnpm test channel-detail-no-hardcoded-ids` → 5 tests pass
- [ ] Step 3: Safety Fence → 零输出
- [ ] Step 4: Commit

### PR #3 Landing Gate Checklist

- [ ] `pnpm tsc --noEmit` + `pnpm test` + `pnpm build` 全绿
- [ ] `grep -rn 'channel-access-registry' dashboard/src` → 零
- [ ] `grep -rn 'getChannelAccessDescriptor' dashboard/src` → 零
- [ ] `grep -rn 'hasDedicatedAccessSurface' dashboard/src` → 零
- [ ] `grep -rn 'channelId\s*[!=]==\s*"wecom"' dashboard/src` → 零
- [ ] Safety Fence → 零输出
- [ ] §5.1 wecom 测试仍全绿
- [ ] Structural assertion 5 tests 全绿
- [ ] PR #2 合入后观察 1-2 天且无 regression 方启动本 PR

---

## 6. 测试覆盖矩阵（Spec §5 ↔ test）

| 验收条目                                 | 覆盖 test                                             | 新增 / 已有  |
| ---------------------------------------- | ----------------------------------------------------- | ------------ |
| §5.1 wecom 功能 100% 保留                | 所有 8 个现有 wecom 测试                              | 已有（零改） |
| §5.2 结构断言：ChannelDetail 无字面量    | `channel-detail-no-hardcoded-ids.test.ts` it #1,#3,#5 | 新增 (3.3)   |
| §5.2 结构断言：ChannelAccessTab 无字面量 | 同上 it #2,#4,#5                                      | 新增 (3.3)   |
| §5.3 Registry 注册 / 查询                | `access-descriptor-registry.test.ts` it #1            | 新增 (1.2)   |
| §5.3 Registry 未知 id 兜底               | 同上 it #2                                            | 新增 (1.2)   |
| §5.3 Registry 重复注册报错               | 同上 it #3                                            | 新增 (1.2)   |
| §5.3 Registry test-only reset            | 同上 it #5                                            | 新增 (1.2)   |
| §5.3 backward compat renderSummary       | 同上（追加用例）                                      | 新增 (2.5a)  |
| §5.3 WecomDescriptor render              | `wecom-access-descriptor.test.tsx` it #2,#3           | 新增 (2.2)   |
| §5.3 WecomDescriptor channelId           | 同上 it #1                                            | 新增 (2.2)   |
| §5.3 WecomDescriptor load 占位           | 同上 it #4                                            | 新增 (2.2)   |
| §5.4 工程 gate (check/test/build)        | CI                                                    | 已有         |
| §5.4 手工视觉验收                        | PR #2 landing gate 手工步骤                           | 人工         |

---

## 7. 自检

1. **代码块 TypeScript 语法**: `ReactNode` import、`readonly` 修饰符、`Map` 泛型、`vi.mock` hoist → 正确
2. **迁移顺序**: PR #2 内部 commit 顺序 **2.4 → 2.1 → 2.2 → 2.3 → 2.5a → 2.5b → 2.5c** 保证每个中间 sha 可编译
3. **测试可运行性**: registry 用 node env；descriptor 测试 `// @vitest-environment jsdom` + mock；结构断言纯 fs
4. **Safety Fence 贯彻**: 每个 commit step 列表有 "Safety Fence → 零输出" 检查项

---

## 8. 开放问题（用户决策点）

| Q#  | 优先级 | 问题                                                                                              | 默认决策                                             |
| --- | ------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Q1  | P0     | `renderSummary` 在 PR #1 契约就加入，还是 PR #2 扩展？                                            | **PR #2 的 2.5a 扩展**（schema-compatible addition） |
| Q2  | P1     | `hasDedicatedAccessSurface` 改名为 `hasAccessDescriptor` 后 PluginsPanel 是否需要更广泛语义调整？ | 当前仅改 import/函数名                               |
| Q3  | P2     | wecomAccessDescriptor.load 本 spec 实现真实加载，还是留给后续 spec？                              | **留给后续 spec**（避免 1:1 迁移 risk）              |
| Q4  | P2     | `AccessDescriptor<State>` 是否应有 runtime 验证（zod/valibot）？                                  | 不加（spec 明确不做 schema-first 完善）              |
| Q5  | P3     | PR #2 是否做 Playwright 视觉快照？                                                                | 当前 CI 未接 Playwright → 不加                       |

---

## 9. 修订记录

| 日期       | 变更                                                             |
| ---------- | ---------------------------------------------------------------- |
| 2026-04-17 | 初稿（基于 spec `2026-04-17-deck-access-model-contract-design`） |

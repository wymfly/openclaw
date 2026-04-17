# Deck Access Model Contract — 设计规范

> **状态**: Approved (brainstorm)
> **日期**: 2026-04-17
> **范围**: Dashboard (`dashboard/src/components/panels/channels/**`) 内部重构，零 Gateway 改动
> **分支**: `enhanced`
> **前置讨论**: 用户选择路径 B（L2 成熟：AccessDescriptor + Wizard DSL）、3 spec 串行、本 spec 先行
> **后续 spec**: `deck-manifest-driven-wizard`（P1）、第三 spec TBD

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

- 定义 `AccessDescriptor` 契约（仅规定"怎么挂载"，不规定 state shape）
- 将 WeCom 现有权限工作区 1:1 包装为首个 descriptor
- 消除 `ChannelDetail` / `ChannelAccessTab` 中所有渠道 id 字面量比较
- 新增权限管理时只需"注册 descriptor"，不改 Deck 主代码

### 1.3 非目标

- ❌ 不做 Wizard DSL 抽象（下一个 spec `deck-manifest-driven-wizard`）
- ❌ 不做 Schema-first 完善（已基本达成，discovery 阶段顺手验证）
- ❌ 不做 Remote Component / 微前端（L3 层级，本次明确排除）
- ❌ 不改 Gateway RPC 契约（纯 Dashboard 内部重构）
- ❌ 不做跨渠道组件复用的强制化（`AllowFromEditor` 等保持为 wecom 私有，后续有需求再提取为可选共享组件）

---

## 2. 当前状态分析

### 2.1 受影响文件（按处置类别）

| 文件                                                                                                            | 处置               | 理由                                                                             |
| --------------------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------- |
| `wecom-access-model.ts`                                                                                         | **零改动**         | 业务逻辑纯函数，直接被 descriptor 引用                                           |
| `AllowFromEditor.tsx`                                                                                           | **零改动**         | UI 组件，被 wecom descriptor 引用                                                |
| `BindingsTab.tsx`                                                                                               | **零改动**         | UI 组件，被 wecom descriptor 引用                                                |
| WeCom 在 `ChannelAccessTab.tsx` 中的渲染逻辑（`channel-access-registry.ts:accessKey === "wecom"` 所选中的子树） | **整体提取**       | 搬进 `wecom-access-descriptor.ts` 的 `render()` 实现；原位置被 registry 调用替代 |
| `channel-access-registry.ts`                                                                                    | **退役**           | 功能被新 `access-descriptor-registry.ts` 取代                                    |
| `ChannelDetail.tsx`                                                                                             | **重构**           | 移除所有 wecom 分支，新增 `<AccessPanel/>` 通用 slot                             |
| `ChannelAccessTab.tsx`                                                                                          | **重构**           | 改为从 `access-descriptor-registry` 查询并渲染                                   |
| `wecom-access-boundary.integration.test.tsx`                                                                    | **保留作回归基线** | 行为不变，仅 import 可能微调                                                     |
| `ChannelDetail.permission-summary.test.tsx`                                                                     | **保留作回归基线** | 同上                                                                             |
| `ChannelDetail.access-handoff.test.tsx`                                                                         | **保留作回归基线** | 同上                                                                             |
| `BindingsTab.handoff.test.tsx` / `BindingsTab.test.tsx`                                                         | **保留作回归基线** | 同上                                                                             |
| `AllowFromEditor.test.tsx`                                                                                      | **保留作回归基线** | 同上                                                                             |
| `WeComWizard.access-guidance.test.tsx`                                                                          | **保留作回归基线** | 同上                                                                             |
| `dashboard/src/i18n/en.json` / `zh.json` 中 `channels.wecom.*` / `wecomWizard.*` / `wecomAccess.*` section      | **禁止修改**       | Safety Fence 补齐：i18n 资产与 Spec 3 约定保持 1:1，本 spec 明确不触碰           |

### 2.2 未知项

- `channel-access-registry.ts` 中 `getChannelAccessDescriptor(channelId)` 与 `ChannelAccessTab.tsx:84` 的 `descriptor.accessKey === "wecom"` 分支的职责边界：
  - 前者判断"该渠道是否有访问控制 Tab"
  - 后者决定"如何渲染访问控制 Tab"
  - 新 `access-descriptor-registry` 要承担两个职责，还是保留"是否显示 Tab"作为 descriptor 元数据
    → Discovery 阶段验证，见 §6

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
   * Receives DI context with Gateway client, config store, etc.
   */
  load(context: AccessLoadContext): Promise<State>;

  /**
   * Render the access UI for this channel.
   * Actions surface mutation handlers (save, reset, etc.) that the
   * descriptor's internal components can wire up.
   */
  render(state: State, actions: AccessActions): ReactNode;

  /**
   * Optional: normalize a raw config snapshot into the State shape.
   * Useful for channels that derive State from openclaw.json entries.
   */
  normalize?(raw: unknown): State;
}

/** DI context passed to descriptor.load(). */
export interface AccessLoadContext {
  readonly channelId: string;
  readonly gatewayRequest: (method: string, params: unknown) => Promise<unknown>;
  readonly configSnapshot?: unknown;
}

/** Mutation handlers provided by Deck for the descriptor to invoke. */
export interface AccessActions {
  readonly save: (patch: unknown) => Promise<void>;
  readonly refresh: () => Promise<void>;
}
```

**关键约定**：

1. `State = unknown` 默认类型意味着 registry 对 state 完全不透明
2. Descriptor 自行 narrow state 类型（利用 TypeScript 泛型）
3. `normalize` 为可选，wecom 初次实现可不提供
4. `AccessLoadContext` 使用 DI，**禁止** descriptor 直接 import global store — 方便未来测试与沙箱化

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

`ChannelDetail.tsx` 新增通用 slot：

```tsx
function AccessPanel({ channelId }: { channelId: string }) {
  const descriptor = getAccessDescriptor(channelId);
  if (!descriptor) return null;
  // state 通过 useAccessDescriptorState(descriptor) 加载，略
  return <>{descriptor.render(state, actions)}</>;
}
```

`ChannelAccessTab.tsx` 改为：

```tsx
const descriptor = getAccessDescriptor(channelId);
if (!descriptor) return <NoAccessControl />;
return descriptor.render(state, actions);
```

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

- 新增 `wecom-access-descriptor.ts`：包装 `buildWecomAccessModel` 和 `AllowFromEditor` / `BindingsTab`
- 新增 `wecom-access-descriptor.test.ts`：契约行为测试
- 修改 `access-descriptors/index.ts`：注册 wecom descriptor
- 修改 `ChannelDetail.tsx`：移除 wecom 分支 → `<AccessPanel/>` slot
- 修改 `ChannelAccessTab.tsx`：删除 `getChannelAccessDescriptor` 调用、删除 `descriptor.accessKey === "wecom"` 分支及其 wecom 渲染子树；改为 `getAccessDescriptor(channelId)?.render(state, actions)`（单一调用，无条件分支）
- `wecom-access-model.ts` / `AllowFromEditor.tsx` / `BindingsTab.tsx` 零改动

**规模**: ~300 行（多数是移动而非新增）

**Landing gate**:

- `pnpm check` + `pnpm test` + `pnpm build` 全绿
- **所有 wecom 相关现有测试必须通过**（见 §5.1）
- CCG 双审（Claude + Codex architect）通过
- 手工在 Deck 里点一遍 wecom channel detail → 视觉无回归

**Review 焦点**: wecom 行为 1:1 对齐；状态流、错误处理、加载时序无回归

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

新增测试（例如 `channel-detail-no-hardcoded-ids.test.ts`）：

```typescript
import { readFileSync } from "fs";
import { join } from "path";

test("ChannelDetail.tsx has no hardcoded channel id comparisons", () => {
  const source = readFileSync(join(__dirname, "ChannelDetail.tsx"), "utf8");
  expect(source).not.toMatch(/channelId\s*===\s*["'][\w-]+["']/);
  expect(source).not.toMatch(/channelId\s*!==\s*["'][\w-]+["']/);
});

test("ChannelAccessTab.tsx has no hardcoded channel id comparisons", () => {
  const source = readFileSync(join(__dirname, "ChannelAccessTab.tsx"), "utf8");
  expect(source).not.toMatch(/channelId\s*===\s*["'][\w-]+["']/);
  expect(source).not.toMatch(/channelId\s*!==\s*["'][\w-]+["']/);
});
```

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

| 风险                                                                     | 严重度 | 缓解策略                                                                                |
| ------------------------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------- |
| WeCom summary 从 inline 移到 slot 后布局错乱                             | 中     | PR #2 合并前手工视觉验收；必要时 Playwright 快照                                        |
| `buildWecomAccessModel` 参数签名与 descriptor 不对齐                     | 低     | PR #2 第一个 commit 是纯包装，业务逻辑不动                                              |
| 某些 wecom 测试隐式依赖 `channelId === "wecom"` 分支执行顺序             | 低-中  | PR #2 跑全量 wecom 测试，任何失败即 blocker                                             |
| 软性 lint 断言误杀合法用法                                               | 低     | 正则只匹配字面量比较，不影响 `channelId === variable`                                   |
| `channel-access-registry.ts` 的 Tab 显隐职责与新 registry 的渲染职责混淆 | 中     | Discovery 阶段 §6.1 验证；必要时 descriptor 增加 `shouldShow?(ctx): boolean` 可选元数据 |

### 6.1 Discovery 任务（实施前先做）

在 PR #1 开工前：

1. 跑一次本地 Deck，验证 `channelSchemas.size` 和各渠道的 schema 覆盖度（确认 P0 schema-first 现状）
2. 审视 `channel-access-registry.ts:getChannelAccessDescriptor` 的全部调用点，确定"是否显示 Tab"职责应该：
   - (a) 并入 `AccessDescriptor`（通过可选 `shouldShow?(ctx)` 方法）
   - (b) 保留独立的"Tab 显隐"开关，与新 descriptor 解耦
3. 确认 `AllowFromEditor.tsx` / `BindingsTab.tsx` 对 Deck global store 的依赖深度，确保 descriptor 模式下能通过 context 注入

Discovery 产出：1 份 discovery 笔记 +（如需要）spec 的微调。

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

| 日期       | 变更                               |
| ---------- | ---------------------------------- |
| 2026-04-17 | 初稿（基于 brainstorm Q1-Q6 共识） |

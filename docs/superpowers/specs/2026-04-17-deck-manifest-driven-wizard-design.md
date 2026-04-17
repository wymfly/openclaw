# Deck Manifest-Driven Wizard — 设计规范

> **状态**: Approved (brainstorm)
> **日期**: 2026-04-17
> **范围**: Dashboard (`dashboard/src/components/panels/channels/**`) 扩展 + 最小 Gateway 契约 additive 变更
> **分支**: `enhanced`
> **前置**: Spec 1 `deck-access-model-contract`（同日 brainstorm，独立实施）
> **工作流**: 主 session brainstorm → ralplan 深化 → 串行 PR 实施

---

## 1. 背景与目标

### 1.1 问题

Deck 当前每个需要"引导式接入"的渠道都要写一个 React Wizard 组件：

- `WeComWizard.tsx`（~200 行，双模式 + 凭证 + probe）
- `FeishuWizard.tsx`（~248 行，connectionMode + 凭证 + probe）
- `OpenClawWeixinWizard.tsx`（~100 行，CLI 扫码登录）
- `onboarding-registry.tsx` 手工登记，仅 2 条目

Next up: Discord、Slack、Telegram 等要接入复杂渠道，继续这条路线 = **每加一个渠道写一份 ~200 行 React 组件**。

同时 `ChannelPlugin` 契约早已声明 `capabilities` 和 `setupWizard` 字段（`src/channels/plugins/types.plugin.ts:53`），但 Dashboard **从未消费** —— 后端声明的能力在前端一概看不见。

### 1.2 目标

用**声明式 DSL + manifest 透传**把"引导向导"从 React 组件代码中解耦：

1. 定义可序列化的 `WizardSpec` DSL（4 种 step：`form` / `radio` / `action` / `info`）
2. Deck 实现通用 `WizardRunner` 组件，读 spec 渲染向导
3. Gateway 通过 additive 字段 `setupWizardSpec` 在 `deck.plugins.list` 结果里透传 DSL
4. 把 `FeishuWizard.tsx` 作为**首个 DSL 消费者**迁移（证明契约覆盖真实渠道）
5. 未来 Discord/Slack/Telegram 只需在 manifest 写 `setupWizardSpec`，**无需改 Deck 代码**

### 1.3 非目标（硬性红线）

- ❌ **不修改 WeComWizard.tsx**，WeCom 保留 custom renderer 路径
- ❌ **不修改 OpenClawWeixinWizard.tsx**，Weixin CLI 扫码是 UI outlier 不入 DSL
- ❌ **不修改 `wecom-access-model.ts` / `AllowFromEditor.tsx` / `BindingsTab.tsx` / `wizard-steps/` 下的 wecom 相关文件** —— 所有 WeCom 相关资产受 Safety Fence 保护（完整清单见 §7）
- ❌ **不删除 `onboarding-registry.tsx` 的 custom renderer 协议** —— 它是 wecom/weixin 的 escape hatch，必须保留
- ❌ **不引入条件表达式引擎**（如 `when: "!pluginInstalled"`） —— 过度设计，插件可用性应在 Deck 外层入口处判断
- ❌ **不做 `oauth` / `qr-code` / `wait` step 类型** —— 等第一个真实非 Feishu 渠道需求出现时设计更准
- ❌ **不做 capability action bar** —— 独立微提案或 Spec 1 顺带处理
- ❌ **不做跨渠道组件强制复用** —— Feishu 的渲染可以引用 WeCom 的 `AllowFromEditor` 组件是**可选**，不是契约义务

### 1.4 WeCom 功能不变式（贯穿承诺）

**本 spec 以及任何后续 spec 中，WeCom 功能、UI 像素、业务规则、测试都保持 1:1 不变。任何破坏 WeCom 相关测试的改动 = 实施失败，必须回滚。**

---

## 2. 当前状态分析

### 2.1 受影响文件（按处置类别）

| 文件                                                                | 处置                        | 说明                                                                    |
| ------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------- |
| `FeishuWizard.tsx`                                                  | **退役**（被 DSL 等价替代） | 改造完成后从 `onboarding-registry.tsx` 移除 feishu 的 custom descriptor |
| `ConfigWizard.tsx`                                                  | **零改动保留**              | 通用 step runner，WeComWizard 仍然依赖，继续存在                        |
| `onboarding-registry.tsx`                                           | **扩展**，不破坏            | 引入 DSL 查询路径；保留 custom renderer 协议                            |
| `WeComWizard.tsx`                                                   | **完全零改动**              | Safety Fence 保护                                                       |
| `OpenClawWeixinWizard.tsx`                                          | **完全零改动**              | Safety Fence 保护                                                       |
| `wecom-access-model.ts` / `AllowFromEditor.tsx` / `BindingsTab.tsx` | **完全零改动**              | Safety Fence 保护                                                       |
| `dashboard/src/i18n/en.json` / `zh.json`                            | **微调**                    | Feishu 相关 i18n key 保留（DSL 渲染时仍用 next-intl）                   |

### 2.2 新增文件

```
dashboard/src/components/panels/channels/wizard/
├── wizard-spec.types.ts          ← WizardSpec / WizardStep / RadioOption TypeBox + TS 类型
├── wizard-spec.validator.ts       ← 加载时校验 spec + action 命名空间检查
├── wizard-spec.validator.test.ts
├── WizardRunner.tsx              ← 通用 runner，消费 WizardSpec 渲染
├── WizardRunner.test.tsx
├── steps/
│   ├── InfoStep.tsx
│   ├── RadioStep.tsx
│   ├── FormStep.tsx              ← 内部复用 lib/schema-parser.ts 和 SchemaForm
│   └── ActionStep.tsx            ← 调用 Gateway RPC + 结果展示
└── wizard-spec-loader.ts         ← 从 channelsStore 读 setupWizardSpec（由 deck.plugins.list 填充）

src/plugin-sdk/wizard-spec.ts      ← SDK 公共契约（供插件作者 import）
src/gateway/protocol/schema/wizard-spec.ts  ← TypeBox schema（protocol codegen）
```

### 2.3 未知项（Discovery 阶段验证）

- `deck.plugins.list` 的 result schema 当前形态（字段、嵌套），加 `setupWizardSpec?` 字段的侵入度
- Feishu 的 i18n key（`feishu.step1Title` 等）在 DSL 中是 inline 字面量还是 `t()` 引用 —— DSL 怎么处理翻译？
  → **答案（当前方案）**：DSL 中 `title` / `body` / `label` 等字段**支持 i18n key**，约定见 §3.5（只接受 `$t:` 前缀形式，runner 用 `useTranslations` 解析）。

---

## 3. 架构设计

### 3.1 DSL Schema（TypeBox 定义）

```typescript
// src/plugin-sdk/wizard-spec.ts（精简伪代码）

/**
 * I18nString：要么是字面量（直接显示），要么是 "$t:namespace.key" 格式（runner 解析）。
 * Runner 通过前缀判断：startsWith("$t:") → useTranslations；否则原样展示。
 */
export const I18nString = Type.String(); // runtime 做 prefix 检查

export const WizardSpecSchema = Type.Object({
  steps: Type.Array(WizardStepSchema, { minItems: 1 }),
  onComplete: Type.Object({
    action: Type.String(), // 例："channel.feishu.saveConfig"
    params: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  }),
});

export const WizardStepSchema = Type.Union([
  InfoStepSchema,
  RadioStepSchema,
  FormStepSchema,
  ActionStepSchema,
]);

export const InfoStepSchema = Type.Object({
  id: Type.String(),
  type: Type.Literal("info"),
  title: I18nString, // "$t:channels.feishu.intro.title" | "Introduction"
  body: I18nString,
});

export const RadioStepSchema = Type.Object({
  id: Type.String(),
  type: Type.Literal("radio"),
  title: I18nString,
  options: Type.Array(RadioOptionSchema, { minItems: 2 }),
});

export const RadioOptionSchema = Type.Object({
  value: Type.String(),
  label: I18nString,
  description: Type.Optional(I18nString),
  badge: Type.Optional(Type.String()), // 自由字符串，runner 支持 "recommended" / "advanced" 等
});

export const FormStepSchema = Type.Object({
  id: Type.String(),
  type: Type.Literal("form"),
  title: I18nString,
  schema: JSONSchemaObject, // 标准 JSON Schema subset（复用 lib/schema-parser）
});

export const ActionStepSchema = Type.Object({
  id: Type.String(),
  type: Type.Literal("action"),
  title: I18nString,
  description: Type.Optional(I18nString),
  action: Type.String(), // 例："channel.feishu.probe"
  params: Type.Optional(ParamRefSchema), // 可以引用前面 step 的值
  successMessage: Type.Optional(I18nString),
  failureMessage: Type.Optional(I18nString),
});

export const ParamRefSchema = Type.Record(
  Type.String(),
  Type.Union([
    Type.String(), // literal
    Type.Number(),
    Type.Boolean(),
    Type.Object({ $ref: Type.String() }), // 严格 JSON path，见下方约定
  ]),
);
```

**`$ref` 语法严格定义**：

- 格式：`$steps.<stepId>.value(.<fieldName>)*`
- 正则：`^\$steps\.[a-zA-Z0-9_-]+\.value(\.[a-zA-Z0-9_-]+)*$`
- 示例合法：`$steps.creds.value`、`$steps.creds.value.appId`、`$steps.mode.value`
- 示例非法（validator 拒绝）：
  - `$steps.creds.value.__proto__`（原型污染）
  - `$steps.creds.value.constructor`（同上）
  - `$steps.foo..bar`（空段）
  - `$globals.anything`（不支持的命名空间）
  - `${something}`（不支持模板语法）
- 解析失败 → `InvalidWizardSpecError`，不渲染向导

**约束**：

- `id` 必须唯一
- `action.action` 必须以 `channel.<channelId>.*` 开头（验证器检查，见 §3.4）
- `onComplete.action` 同规则
- spec 校验失败 → runner 显示"插件 DSL 无效"错误，不渲染向导

### 3.2 WizardRunner 组件

```typescript
interface WizardRunnerProps {
  channelId: string;
  spec: WizardSpec;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

内部状态机：

- 每个 step 的 `value`（表单输入 / radio 选择 / action 结果）存在 `stepValues: Record<stepId, unknown>`
- `$ref` 解析器按 JSON path 从 `stepValues` 取值
- Action step 调用时拼装 `params` 并调 `gatewayRequest(action, resolvedParams)`
- 最终 step 完成后调 `onComplete.action` 提交累积数据

**视觉复用**：

- 内部使用现有 `ConfigWizard` 作为 step 容器/进度条/前后按钮 —— **不重造 step machine**
- FormStep 内部使用 `lib/schema-parser.ts` + `SchemaForm`（已有）
- InfoStep / RadioStep / ActionStep 是全新 ~30-60 行的简单组件

### 3.3 Gateway 透传（additive 变更）

**契约扩展**：

```typescript
// src/plugin-sdk/channel-contract.ts
export interface ChannelPlugin<...> {
  // ...existing fields...
  setupWizard?: ChannelPluginSetupWizard;        // existing imperative field (retained)
  setupWizardSpec?: WizardSpec;                  // NEW: declarative JSON spec
}
```

**RPC 输出扩展**：

```typescript
// src/gateway/server-methods/deck/plugins.ts
// deck.plugins.list result 里每个 plugin 对象加 setupWizardSpec?: WizardSpec 字段
```

**上游同步流程**（按 CLAUDE.md "Gateway Protocol SDK 流程"）：

1. 改 `src/gateway/protocol/schema/` 里 deck.plugins.list result schema（加可选字段）
2. 改 `src/gateway/server-methods/deck/plugins.ts` handler 让它从 plugin 读取 `setupWizardSpec` 透传
3. 跑 `pnpm protocol:gen:ts`，让 `dashboard/src/types/gateway-*.generated.ts` 自动更新
4. 跑 `pnpm protocol:gen:check` 验证
5. **allowlist 无需变更**（已有方法扩字段）

**风险等级**：低（纯 additive，不破坏任何现有调用方）

### 3.4 Action 命名空间安全边界

**规则**（runner 加载 spec 时静态验证 + 运行时双保险）：

```
允许:
  channel.<channelId>.*         例：channel.feishu.probe, channel.feishu.saveConfig

拒绝:
  config.*                      配置写入 RPC 必须由 onComplete 的上游 handler 内部发起
  commands.*                    命令执行
  tools.*                       工具 RPC
  logs.* / sessions.* / gateway.* / deck.*   任何基础设施 RPC
  channel.<otherChannelId>.*    跨渠道调用禁止
```

验证失败 → 抛出 `InvalidWizardSpecError` → runner 显示错误提示（i18n key `wizard.error.invalidSpec`）→ 用户看到"该渠道 DSL 有问题，请联系插件作者"。

**逃生舱**：如果 Feishu（或未来任何渠道）真的需要调 `config.patch` 之类 —— 插件应**在后端封装一个 `channel.feishu.saveConfig` RPC**，内部调 `config.patch`。插件完全拥有业务封装权。

### 3.5 i18n 约定

DSL 中字符串字段（`title` / `body` / `label` 等）可以是：

- **字面量**：直接显示（适合英文开源插件）
- **i18n key**（以 `$t:` 前缀）：runner 用 `useTranslations` 解析

示例：

```yaml
title: "$t:channels.feishu.step1Title" # runner 查 i18n 字典
body: "Welcome to Feishu setup" # 直接显示
```

Deck 现有 `en.json` / `zh.json` 的 `channels.feishu.*` 命名空间保留，迁移时不改。

---

## 4. 实施计划（3 PR 串行）

### 4.1 PR #1 — 契约骨架 + Gateway 透传

**变更**：

- 新增 `src/plugin-sdk/wizard-spec.ts`：TypeBox schema + TS 类型
- 新增 `src/gateway/protocol/schema/wizard-spec.ts`：protocol schema
- 修改 `src/plugin-sdk/channel-contract.ts`：添加 `setupWizardSpec?` 字段
- 修改 `src/gateway/server-methods/deck/plugins.ts`：result 包含该字段
- 跑 `pnpm protocol:gen:ts` 生成 typed client
- Dashboard 侧新增 `wizard-spec.types.ts` 从 generated types 导出
- Dashboard 侧新增 `wizard-spec.validator.ts` + 测试（namespace 检查、schema 校验）

**规模**: ~300 行（含 TypeBox 定义）

**Landing gate**:

- `pnpm check` + `pnpm test` 绿
- `pnpm protocol:gen:check` 通过
- 新增 validator 测试覆盖合法 spec、非法 action 命名空间、缺字段、重复 id 等

**Review 焦点**: TypeBox schema 设计、namespace 规则、contract additive 正确性

**预期**: 合并时无消费者，1-2 天窗口期由 PR #2 消化

### 4.2 PR #2 — WizardRunner + Feishu 迁移（核心 PR）

**变更**：

- 新增 `WizardRunner.tsx` + 4 种 step 子组件 + 单元测试
- 修改 `onboarding-registry.tsx`：feishu 条目改为"从 channelsStore 读 setupWizardSpec 并 render <WizardRunner/>"
- **删除 `FeishuWizard.tsx`**
- extensions/feishu 侧（后端）：manifest 加 `setupWizardSpec`（feishu 的 DSL 版本）
- 运行时验证：打开 Feishu 向导 → step 1 选 mode → step 2 填凭证 → step 3 probe → onComplete 保存
- 手工点一遍 WeCom 向导 → 视觉与行为 1:1 不变（Safety Fence 验证）

**规模**: ~400 行（含新组件 + 测试；FeishuWizard.tsx 248 行被删）

**Landing gate**:

- `pnpm check` + `pnpm test` + `pnpm build` 全绿
- Safety Fence 清单全部满足（§7）
- 所有 wecom 相关测试绿
- 新增 WizardRunner / Step 组件测试
- 结构性断言测试通过（§5.2）
- CCG 双审（Claude + Codex）通过
- 视觉回归手工验证（Feishu + WeCom + Weixin 三个向导）

**Review 焦点**: Feishu 迁移行为 1:1 对齐；Safety Fence 未被破坏；WizardRunner 通用性

**回滚策略**: PR 级回滚；**不引入 feature flag**

### 4.3 PR #3 — Feishu DSL 细节打磨 + 清理

**变更**：

- 修正 PR #2 合入后在真实使用中发现的边缘问题（badges 样式、错误态提示、i18n key 覆盖等）
- 清理 `onboarding-registry.tsx` 中 feishu 的冗余代码
- 如适用：把 i18n key 中 feishu 专属的"step 描述"等移到 feishu plugin 的翻译资产里（让 Deck 主翻译表瘦身）

**规模**: ~100-150 行（多为 polish + 清理）

**Landing gate**:

- `pnpm check` + `pnpm test` + `pnpm build` 全绿
- Safety Fence 清单仍然满足
- §5 验收清单全部满足

**执行时机**: PR #2 合入后观察 1-2 天

**Review 焦点**: 打磨是否到位、有没有新的硬编码渗漏

---

## 5. 验收标准（档次 B）

### 5.1 功能保障（必须通过）

- Feishu 接入向导完整走 3 步（mode / credentials / probe）→ onComplete 保存配置 → 行为与迁移前 1:1 对齐
- **所有现有 Feishu 测试**（`FeishuWizard.*.test.tsx` 等）：在 PR #2 中若被删除，必须新增等价的 `WizardRunner.feishu.integration.test.tsx` 覆盖相同场景
- **所有 wecom 相关测试 100% 通过**（§7 Safety Fence 清单）
- **WeCom / Weixin custom renderer 路径仍然工作**（新增集成测试断言）

### 5.2 结构保障（软性 lint 断言）

新增测试（例如 `wizard-runner-no-hardcoded-ids.test.ts`）：

```typescript
test("WizardRunner.tsx has no hardcoded channel id literals", () => {
  const source = readFileSync(
    "dashboard/src/components/panels/channels/wizard/WizardRunner.tsx",
    "utf8",
  );
  expect(source).not.toMatch(/channelId\s*===\s*["'][\w-]+["']/);
  expect(source).not.toMatch(/channelId\s*!==\s*["'][\w-]+["']/);
});

test("WeCom custom renderer path still active", () => {
  const descriptor = getChannelOnboardingDescriptor("wecom");
  expect(descriptor).not.toBeNull();
  expect(descriptor?.renderDialog).toBeDefined();
});

test("Weixin custom renderer path still active", () => {
  const descriptor = getChannelOnboardingDescriptor("openclaw-weixin");
  expect(descriptor).not.toBeNull();
});
```

### 5.3 新增契约测试

- `wizard-spec.validator.test.ts`：
  - 合法 spec 通过
  - 非法 action 命名空间被拦截（跨渠道、基础设施 RPC）
  - 缺必填字段被拦截
  - 重复 step id 被拦截
  - 循环 `$ref` 引用被拦截
- `WizardRunner.test.tsx`：
  - 4 种 step 类型各自渲染测试
  - 完整 3-step 流程集成测试
  - Action 失败错误态测试
  - `$ref` 参数解析测试

### 5.4 工程 gate

- `pnpm check` + `pnpm test` + `pnpm build` 全绿
- `pnpm protocol:gen:ts` + `pnpm protocol:gen:check` 通过
- `dashboard/server/gateway-allowlist.ts` 无需变更（已有 method 扩字段）
- CCG 双审（Claude + Codex architect）通过
- 手工点一遍 Feishu / WeCom / Weixin 三个向导 → 视觉与行为无回归

### 5.5 Stretch Goals（不阻塞交付）

- 合成 `TestWizardSpec` fixture 证明非 Feishu 渠道用 DSL 可行（价值偏低，可选）
- Playwright 视觉快照测试（如 CI 已接入）

### 5.6 明确不做

- `when` 条件表达式引擎
- OAuth / QR / Wait step 类型
- ESLint 自定义 rule（软性测试足够）
- Feature flag / 双路径共存

---

## 6. 风险与缓解

| 风险                                                       | 严重度 | 缓解                                                                                                 |
| ---------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| FeishuWizard 删除后 i18n key 孤立在 Deck `zh.json/en.json` | 低     | PR #3 顺手迁移到 feishu plugin 自带翻译；不影响 PR #2                                                |
| Gateway codegen 未同步导致 Deck 类型错误                   | 中     | PR #1 landing gate 要求 `pnpm protocol:gen:check` 通过；CI 强制                                      |
| `$ref` JSON path 解析引入安全漏洞（如 `__proto__` 污染）   | 中     | validator 静态拒绝 `$ref` 中的危险路径段（`__proto__` / `constructor` / 非 `$steps.*.value.*` 模式） |
| Feishu 的 "pluginInstalled 警告" 移除后用户迷惑            | 低     | Deck 外层入口（"添加渠道"按钮）判断插件安装状态；按钮 disabled + tooltip 引导安装                    |
| DSL 迭代时需要扩字段，破坏上下游                           | 低     | 契约严格 additive；新字段一律可选；老插件的 spec 仍可被新 runner 渲染                                |
| Action 命名空间正则误杀合法情况                            | 低     | 正则仅匹配 `channelId === "literal"`；`channelId === variable` 不受影响                              |

### 6.1 Discovery 任务（实施前先做）

在 PR #1 开工前：

1. 读 `src/gateway/server-methods/deck/plugins.ts` 现有 result schema，确认加 `setupWizardSpec?` 字段的最小侵入路径
2. 读 `extensions/feishu/src/channel.ts` + `package.json` 或 `openclaw.plugin.json`，确认 manifest 写入 DSL 的位置（是 `channel.ts` 的 `setupWizardSpec` 字段还是独立文件）
3. 读 `ConfigWizard.tsx` 当前 step 渲染接口，确认 WizardRunner 可直接复用它（不破坏 WeComWizard）
4. 读 `dashboard/src/lib/schema-parser.ts` 确认 FormStep 可复用（包括 password format 等细节）

Discovery 产出：1 份 discovery 笔记 +（如需要）spec 的微调。

---

## 7. WeCom Safety Fence（硬性不变式）

### 7.1 禁止修改的文件

**任何 Spec 2 PR 的 diff 不得包含以下文件**：

- `dashboard/src/components/panels/channels/WeComWizard.tsx`
- `dashboard/src/components/panels/channels/OpenClawWeixinWizard.tsx`
- `dashboard/src/components/panels/channels/wecom-access-model.ts`
- `dashboard/src/components/panels/channels/AllowFromEditor.tsx`
- `dashboard/src/components/panels/channels/BindingsTab.tsx`
- `dashboard/src/components/panels/channels/wizard-steps/`（wecom 相关子文件）
- `dashboard/src/components/panels/channels/ChannelSettingsTab.tsx` 中的 `WECOM_ACCESS_EXCLUDE_PATHS` 定义
- `dashboard/src/components/panels/channels/ChannelDetail.tsx` 的 wecom summary 分支（这部分归 Spec 1 修）
- `dashboard/src/components/panels/channels/ChannelAccessTab.tsx`（归 Spec 1 修）
- `dashboard/src/components/panels/channels/wecom-access-boundary.integration.test.tsx`
- `dashboard/src/components/panels/channels/wecom-settings-technical-panel.integration.test.tsx`
- `dashboard/src/components/panels/channels/WeComWizard.access-guidance.test.tsx`
- 其他以 `wecom` / `Wecom` / `WeCom` 前缀命名的文件
- `dashboard/src/i18n/en.json` / `zh.json` 中 `channels.wecom.*` / `wecomWizard.*` / `wecomAccess.*` section（i18n 资产不动；Spec 3 将统一处理插件 i18n 时也遵守 Safety Fence）

### 7.2 必须保留的运行时路径

- `onboarding-registry.tsx` 中 wecom 条目继续指向 `WeComWizard` 的 custom renderer
- `onboarding-registry.tsx` 中 openclaw-weixin 条目继续指向 `OpenClawWeixinWizard`
- `ConfigWizard.tsx` 通用组件保留（WeCom/Weixin 内部仍依赖）
- `getChannelOnboardingDescriptor("wecom")` 返回非 null
- `getChannelOnboardingDescriptor("openclaw-weixin")` 返回非 null

### 7.3 必须通过的 wecom 测试

`pnpm test` 运行后，以下测试必须绿：

- `ChannelDetail.permission-summary.test.tsx`
- `ChannelDetail.access-handoff.test.tsx`
- `wecom-access-boundary.integration.test.tsx`
- `WeComWizard.access-guidance.test.tsx`
- `BindingsTab.handoff.test.tsx`
- `BindingsTab.test.tsx`
- `AllowFromEditor.test.tsx`
- `wecom-settings-technical-panel.integration.test.tsx`
- `onboarding-registry.integration.test.tsx`（新增断言：wecom/weixin 条目仍存在）
- 其他 `*wecom*.test.*` 模式匹配的文件

### 7.4 违反时的响应

- PR 审查时发现触碰 §7.1 文件 = **blocker**，必须拆分/删除相关 diff
- CI 中任何 wecom 测试变红 = **blocker**，必须回滚或修复
- CCG 双审时 reviewer 应明确检查 Safety Fence 合规

---

## 8. 成功后的下一步

PR #3 合入后：

1. 更新 `.omc/project-memory.json` 记录 Spec 2 完成
2. 评估是否需要 Spec 3（如果 Spec 1 + Spec 2 已解决痛点，**建议取消 Spec 3**）
3. 未来 Discord/Slack/Telegram 等新渠道可直接在 manifest 中写 `setupWizardSpec`，不改 Deck 代码

---

## 9. 相关引用

- 讨论依据：`FeishuWizard.tsx:1-248`、`WeComWizard.tsx`、`OpenClawWeixinWizard.tsx`、`onboarding-registry.tsx:22-47`、`ConfigWizard.tsx`、`lib/schema-parser.ts`
- Spec 1：`docs/superpowers/specs/2026-04-17-deck-access-model-contract-design.md`
- 契约基础：`src/channels/plugins/types.plugin.ts:53` `ChannelPlugin` 已声明 `setupWizard` 和 `capabilities`
- Gateway 协议流程：`CLAUDE.md` "Gateway Protocol SDK → 上游 rebase 后的 Protocol 同步流程"
- Dashboard 开发规则：`dashboard/CLAUDE.md`（i18n、主题、allowlist、Gateway Device Identity）

---

## 10. 修订记录

| 日期       | 变更                               |
| ---------- | ---------------------------------- |
| 2026-04-17 | 初稿（基于 brainstorm Q1-Q6 共识） |

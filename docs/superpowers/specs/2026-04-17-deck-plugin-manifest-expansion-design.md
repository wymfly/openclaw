# Deck Plugin Manifest Expansion — 设计规范

> **状态**: Approved (brainstorm)
> **日期**: 2026-04-17
> **范围**: Dashboard + Gateway additive 契约扩展（zero breaking change）
> **分支**: `enhanced`
> **前置**: Spec 1 `deck-access-model-contract`、Spec 2 `deck-manifest-driven-wizard`
> **工作流**: 主 session brainstorm → ralplan 深化 → 串行 PR 实施
> **原始痛点**: 每加一个新渠道，Deck 主 i18n 文件膨胀 + `capabilities` 字段前端没消费

---

## 1. 背景与目标

### 1.1 问题

随着渠道扩张（Feishu/Telegram/Slack/Discord 等），Deck 当前存在**两个并列缺口**：

**缺口 A — i18n 膨胀**

- 每个渠道的 UI 文本（step 标题、field help、错误提示等 50-200 个 key/渠道）挤在 Deck 主 `dashboard/src/i18n/{en,zh}.json`
- 插件无法自带翻译资产，Deck 必须在合入插件前**同步修改**主翻译表
- 规模线性增长：10 个渠道 = 500-2000 新 key；20 个 = 1000-4000

**缺口 B — capabilities 字段未被消费**

- `ChannelPlugin.capabilities: ChannelCapabilities`（`src/channels/plugins/types.plugin.ts:56`）已声明为契约字段
- 后端声明 `login: true` / `probe: true` / `testMessage: true` 等 boolean 标志
- Dashboard 代码 grep 结果：**0 处引用**
- 结果：Deck 无法根据能力动态显示/隐藏按钮，永远用硬编码 UI

### 1.2 目标

用**两个 additive Gateway 字段**和**两个 Deck 新组件**同时解决：

1. **i18n 插件化**：
   - 契约：`extensions/<id>/locales/{en,zh}.json` 成为 plugin 资产
   - Gateway：`deck.plugins.list` 返回增加 `locales` 字段（内嵌 JSON bundle）
   - Deck：启动时合并所有 plugin locales，next-intl 命名空间 `plugin.<pluginId>.*`
   - Feishu 作为**首个消费者**：主表 `channels.feishu.*` section 迁移到 `extensions/feishu/locales/`

2. **Capability Action Bar**：
   - 契约：已有 `ChannelCapabilities` 透传（additive）
   - Gateway：`deck.plugins.list` 返回增加 `capabilities` 字段（plugin 声明）
   - Deck：`<CapabilityActionBar/>` 新组件，消费 capabilities，渲染 Login/Probe/TestMessage 三个按钮
   - 按钮动作：调 `channel.<id>.<action>` RPC 或（login + qrCodeAuth 组合时）打开 Spec 2 的 WizardRunner

**非目标 / Out of Scope**:

- ❌ 不迁移 WeCom / Weixin 的 i18n（Safety Fence，见 §7）
- ❌ 不修改 `WeComWizard.tsx` / `OpenClawWeixinWizard.tsx` / wecom 访问相关任何文件
- ❌ 不引入插件动态安装/卸载 UX
- ❌ 不做 Capability → Tab 显隐联动（留给 future spec）
- ❌ 不做 runtime 热更新 locale（启动一次加载）
- ❌ 不引入条件表达式引擎
- ❌ 不定义新的 capability 字段（本 spec 消费已有 `login` / `probe` / `testMessage`）

### 1.3 WeCom 功能不变式（贯穿承诺）

**与 Spec 1 / Spec 2 一致**：所有 WeCom 功能、UI 像素、i18n 文本、业务规则、测试都保持 1:1 不变。任何破坏 WeCom 相关测试的改动 = 实施失败，必须回滚。

---

## 2. 当前状态分析

### 2.1 i18n 现状

- Deck 主文件：`dashboard/src/i18n/en.json` / `zh.json`
- next-intl 使用方式：`useTranslations("channels.feishu")` 访问 `channels.feishu.*` section
- Feishu 涉及 key 清单（从 `FeishuWizard.tsx` 提取）：
  - `channels.feishu.title` / `step1Title` / `step2Title` / `step3Title`
  - `channels.feishu.modeWebSocket` / `modeWebSocketDesc` / `modeWebhook` / `modeWebhookDesc`
  - `channels.feishu.appId` / `appIdHint` / `appIdHelp` / `appSecret` / `appSecretHint` / `appSecretHelp`
  - `channels.feishu.probeSuccess` / `probeFailed` / `probeNoChannel`
  - `channels.feishu.pluginNotInstalled` / `testDesc` / `probeConfigNote`

### 2.2 capabilities 字段现状

- 契约：`ChannelPlugin.capabilities: ChannelCapabilities`（`src/channels/plugins/types.plugin.ts:56`）
- 已知字段（以代码为准）：`login` / `probe` / `testMessage` / `groupRouting` / `threading` / `qrCodeAuth` 等
- Gateway 透传：**目前未透传**到 Deck（需本 spec 添加）
- Deck 消费：**无任何消费**（需本 spec 添加）

### 2.3 Gateway 契约扩展面

本 spec 对 Gateway 的改动与 Spec 2 同类（additive field）：

```typescript
// src/gateway/protocol/schema/deck.ts — DeckPluginInventoryEntrySchema
{
  id, name, version, origin, status, enabled, ...,
  setupWizardSpec?: WizardSpec,              // Spec 2 adds
  locales?: PluginLocaleBundle,              // Spec 3 adds (i18n)
  capabilities?: ChannelCapabilitiesSpec,    // Spec 3 adds (capability bar)
}

type PluginLocaleBundle = Record<string, Record<string, unknown>>;
// e.g. { en: { wizardTitle: "..." }, zh: { wizardTitle: "..." } }

type ChannelCapabilitiesSpec = {
  login?: boolean;
  probe?: boolean;
  testMessage?: boolean;
  qrCodeAuth?: boolean;
  groupRouting?: boolean;
  threading?: boolean;
};
```

**Gateway codegen**（与 Spec 2 共享一次 `pnpm protocol:gen:ts`）。

### 2.4 受影响文件

| 文件                                                                    | 处置                                                                    |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/channels/plugins/types.plugin.ts`                                  | 无改动（`capabilities` / `setupWizardSpec` 已存在）                     |
| `src/gateway/protocol/schema/deck.ts`                                   | **扩展** additive 字段（Spec 2 + Spec 3 合并一次）                      |
| `src/gateway/server-methods/deck/plugins.ts`                            | **扩展** handler 透传 locales / capabilities                            |
| `src/plugins/status.ts`                                                 | 可能需要扩 `SnapshotPlugin` 保留引用                                    |
| `extensions/feishu/locales/{en,zh}.json`                                | **新增**，Feishu i18n 迁入                                              |
| `extensions/feishu/src/channel.ts` 或 `index.ts`                        | **扩展**，加载 locale 并注入 `ChannelPlugin.locales`                    |
| `dashboard/src/i18n/en.json` / `zh.json`                                | **删除** `channels.feishu.*` section（整 section 删）                   |
| `dashboard/src/components/panels/channels/CapabilityActionBar.tsx`      | **新增**                                                                |
| `dashboard/src/components/panels/channels/CapabilityActionBar.test.tsx` | **新增**                                                                |
| `dashboard/src/components/panels/channels/ChannelDetail.tsx`            | **扩展**，header 区域加 `<CapabilityActionBar/>`（只增不改 wecom 分支） |
| `dashboard/src/lib/plugin-locales.ts`                                   | **新增**，合并 plugin locale bundle 到 next-intl messages               |
| `dashboard/src/app/layout.tsx` 或 i18n provider                         | **扩展**，启动时调用 `mergePluginLocales`                               |
| `dashboard/src/stores/channels.ts`                                      | **扩展**，暴露 plugin inventory 含 capabilities（如尚未）               |
| `docs/plugins/sdk-i18n.md`                                              | **新增**，plugin 作者 guide                                             |
| `docs/plugins/sdk-capabilities.md`                                      | **新增**，capability guide                                              |
| `dashboard/server/gateway-allowlist.ts`                                 | **无需改**（`deck.plugins.list` 已在 allowlist）                        |

### 2.5 未知项（Discovery 阶段验证）

1. **next-intl 是否支持运行时动态合并 messages 树**？API：`NextIntlClientProvider` 的 `messages` prop 是否允许在 client 启动后再替换 / 合并？
2. **Feishu plugin 当前加载 locale 的机制**：是否已有 `i18n` 字段在 `openclaw.plugin.json`？若有，需对齐；若无，新建。
3. **`channelsStore` 是否暴露 plugin inventory**：`deck.plugins.list` 结果是否已 cached 到 store？如无，需扩 store。
4. **`channel.<id>.login` / `probe` / `sendTest` 后端 RPC 是否齐备**：
   - Feishu：`probe` 已有（`FeishuWizard.tsx:53` 调 `/api/channels?probe=true`）
   - Telegram / Slack / Discord：未知，需查 `extensions/<id>/`
5. **WeCom capabilities 声明**：`extensions/wecom/src/channel.ts` 里 `capabilities.login` 是否 true？这决定 wecom CapabilityActionBar 是否显示 Login 按钮。

---

## 3. 架构设计

### 3.1 i18n 合并机制

**Plugin 侧结构**：

```
extensions/<id>/
├── locales/
│   ├── en.json         # 必需
│   └── zh.json         # 可选（缺失时 fallback 到 en）
└── src/channel.ts
```

**Plugin 侧代码**（feishu 示例）—— 采用 **build-time static import**（不用 runtime lazy）：

```typescript
// extensions/feishu/src/channel.ts
import enLocale from "../locales/en.json" assert { type: "json" };
import zhLocale from "../locales/zh.json" assert { type: "json" };

export const feishuChannel: ChannelPlugin = {
  id: "feishu",
  // ...existing fields...
  capabilities: { login: true, probe: true, testMessage: true },
  locales: { en: enLocale, zh: zhLocale },
};
```

**静态 import 的理由**：locale 是启动时必须的数据，lazy 加载无实际收益（不会因此少加载），反而引入复杂度（Promise 链、loading 态）。

**Gateway 透传**：在 `deck.plugins.list` result schema 中加 `locales?: PluginLocaleBundle` 字段，handler 原样 passthrough。

**Deck 合并（`dashboard/src/lib/plugin-locales.ts`）**：

```typescript
// dashboard/src/lib/plugin-locales.ts

type PluginLocaleBundle = Record<string, Record<string, unknown>>;

interface PluginInventoryEntry {
  id: string;
  locales?: PluginLocaleBundle;
}

export function mergePluginLocales(
  deckMessages: Record<string, Record<string, unknown>>,
  plugins: readonly PluginInventoryEntry[],
  locale: string,
): Record<string, unknown> {
  const deckForLocale = deckMessages[locale] ?? {};
  const pluginMessages: Record<string, unknown> = {};
  for (const plugin of plugins) {
    if (!plugin.locales) continue;
    const bundle = plugin.locales[locale] ?? plugin.locales.en;
    if (bundle) {
      pluginMessages[plugin.id] = bundle;
    }
  }
  return {
    ...deckForLocale,
    plugin: pluginMessages, // namespace: plugin.<pluginId>.*
  };
}
```

**Deck 消费**：两条消费路径：

1. **React 组件直接消费**（Spec 2 前的路径 / 其他渠道保留）：
   ```typescript
   // 旧写法：const t = useTranslations("channels.feishu"); t("step1Title")
   // 新写法：
   const t = useTranslations("plugin.feishu");
   t("step1Title"); // resolves plugin.feishu.step1Title
   ```
2. **DSL 消费**（Spec 2 已约定 `$t:` 前缀）：
   ```yaml
   title: "$t:plugin.feishu.step1Title" # WizardRunner 解析
   ```

两种路径都命中同一个 namespace。

**命名空间规则**（硬性）：

- Plugin 提供的 bundle 是原始内容（如 `{ "step1Title": "..." }`）
- Deck 强制 wrap 到 `plugin.<pluginId>.*`
- Plugin 作者**不需要**写前缀，也**不可能**污染 Deck 主 namespace
- 若两个 plugin 同 id → plugin loader 已拦截（非 i18n 问题）

### 3.2 Capability Action Bar 机制

**Gateway 透传**：在 `deck.plugins.list` result 加 `capabilities?: ChannelCapabilitiesSpec` 字段。

**Deck 新组件**（`dashboard/src/components/panels/channels/CapabilityActionBar.tsx`）骨架：

```typescript
"use client";

import { LogIn, Activity, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { gatewayRequest } from "@/lib/api-helpers";
import { useChannelsStore } from "@/stores/channels";
import { getChannelOnboardingDescriptor } from "./onboarding-registry";

export function CapabilityActionBar({ channelId }: { channelId: string }) {
  const t = useTranslations("channels.actionBar");
  const { pluginsInventory } = useChannelsStore();
  const plugin = pluginsInventory.find((p) => p.channelIds.includes(channelId));
  const caps = plugin?.capabilities;

  if (!caps) return null;

  const handleLogin = async () => {
    if (caps.qrCodeAuth) {
      // Defer to Spec 2's WizardRunner via onboarding-registry
      getChannelOnboardingDescriptor(channelId)?.renderDialog({ open: true, onOpenChange: () => {} });
      return;
    }
    try {
      await gatewayRequest(`channel.${channelId}.login`, {});
      toast.success(t("loginSuccess"));
    } catch (e: unknown) {
      toast.error(String((e as Error).message ?? t("loginFailed")));
    }
  };

  const handleProbe = async () => { /* similar to handleLogin, calls probe RPC */ };
  const handleTestMessage = async () => { /* opens Dialog for target + text, calls sendTest */ };

  const buttons = [
    caps.login && <Button key="login" onClick={handleLogin}><LogIn size={14}/>{t("login")}</Button>,
    caps.probe && <Button key="probe" onClick={handleProbe}><Activity size={14}/>{t("probe")}</Button>,
    caps.testMessage && <Button key="test" onClick={handleTestMessage}><Send size={14}/>{t("testMessage")}</Button>,
  ].filter(Boolean);

  if (buttons.length === 0) return null;

  return <div className="flex gap-2">{buttons}</div>;
}
```

**挂载点**：`ChannelDetail.tsx` header 区域，所有渠道通吃：

```tsx
<header>
  <h1>{channel.label}</h1>
  <CapabilityActionBar channelId={channelId} />
</header>
```

**WeCom 自然支持**（契约层面，实际行为待 Discovery D5 验证 wecom 具体 capability 声明）：

- 如果 wecom 后端已声明 `capabilities.login: true, qrCodeAuth: true` → Login 按钮出现 → 点击调 `onboarding-registry` 里 wecom 的 custom renderer → `WeComWizard` 原样打开
- 如果 wecom 后端**未**声明这些 capability → 按钮不渲染（零影响）
- 如果 wecom 已声明但缺 `qrCodeAuth` → Login 按钮点击会尝试直接调 `channel.wecom.login` RPC（可能失败，需补后端 handler 或调整 capability 声明）
- **无论哪种情况，都不需要修改 wecom 任何前端文件**（Safety Fence 保证）

### 3.3 Gateway 契约变更面（与 Spec 2 共享）

```
src/gateway/protocol/schema/deck.ts
  + DeckPluginInventoryEntrySchema 增加 optional:
    - setupWizardSpec (Spec 2)
    - locales         (Spec 3, new)
    - capabilities    (Spec 3, new)

src/gateway/server-methods/deck/plugins.ts
  + handler 透传这些字段（plugin 如果声明则带上）

src/plugins/status.ts
  + SnapshotPlugin 保留原 ChannelPlugin 引用（如未保留）

dashboard/src/types/gateway-*.generated.ts
  = 跑 pnpm protocol:gen:ts 自动生成

dashboard/server/gateway-allowlist.ts
  = 无需变更（deck.plugins.list 已在 allowlist）
```

**风险等级**：低（纯 additive，不破坏任何现有调用方）

### 3.4 Plugin 作者 Guide

**新增文档**：

- `docs/plugins/sdk-i18n.md`
  - 文件结构约定
  - Locale JSON 格式（扁平或嵌套都可，每 plugin 内部自由）
  - Namespace 自动 wrap（plugin 不需写前缀）
  - Missing locale fallback 规则
  - 消费侧（`useTranslations("plugin.<id>")` 或 Spec 2 DSL 的 `$t:plugin.<id>.key`）

- `docs/plugins/sdk-capabilities.md`
  - `ChannelCapabilities` 字段清单 + 语义
  - 每个 capability 触发 Deck 什么 UI
  - 如何声明对应的 `channel.<id>.<action>` RPC handler
  - `qrCodeAuth + login` 组合如何触发 WizardRunner

---

## 4. 实施计划（3 PR 串行）

### 4.1 PR #1 — i18n 机制 + Feishu 迁移（核心）

**变更**：

- Gateway：`deck.plugins.list` 加 `locales?` + `capabilities?` additive 字段。**codegen 策略**：
  - 若 Spec 2 已先落地 → 本 spec 只需再跑一次 `pnpm protocol:gen:ts`（additive 扩展已有 schema）
  - 若 Spec 2 未落地或与本 spec 同窗口推进 → 两份 spec 的 PR 各跑一次 codegen，互相为 additive 基底，不冲突
  - 无论哪种情况，**本 spec 的 PR 独立 landing**，不合并到 Spec 2 的 PR
- Plugin：`extensions/feishu/locales/{en,zh}.json` 创建，内容从 Deck 主表 `channels.feishu.*` 整 section 剪切过来
- Plugin：`extensions/feishu/src/channel.ts`（或 `index.ts`）注入 `locales` 字段
- Deck：`dashboard/src/lib/plugin-locales.ts` 新建合并器
- Deck：i18n provider / layout 初始化时调 `mergePluginLocales`
- Deck：所有对 `channels.feishu.*` 的 `useTranslations` 调用改为 `plugin.feishu.*`
- Deck：主 `en.json/zh.json` 删除 `channels.feishu.*` section
- 结构性断言测试：`plugin-locales.test.ts`

**规模**: ~400 行（含新合并器 + 测试 + Feishu locale 文件）

**Landing gate**:

- `pnpm check` + `pnpm test` + `pnpm build` 全绿
- `pnpm protocol:gen:ts` + `pnpm protocol:gen:check` 通过
- `grep 'channels.feishu' dashboard/src/i18n/*.json` → 零命中
- 手工：Feishu 向导在 en / zh 下正确显示
- Safety Fence 清单满足

### 4.2 PR #2 — CapabilityActionBar + 4 渠道接入

**变更**：

- Deck：`CapabilityActionBar.tsx` + 测试
- Deck：`ChannelDetail.tsx` header 区域引入 `<CapabilityActionBar/>`
- Deck：`stores/channels.ts` 扩展暴露 plugin inventory（如尚未）
- Plugin：`extensions/{feishu,telegram,slack,discord}/src/channel.ts` 补全 capabilities 声明（如缺失）
- 补齐后端 RPC（如缺失）：`channel.<id>.login` / `channel.<id>.probe` / `channel.<id>.sendTest`
- 结构性断言测试：`CapabilityActionBar.tsx` 无 channel id 字面量
- wecom 集成回归测试：wecom ChannelDetail 显示 CapabilityActionBar 且 Login 按钮点击打开 WeComWizard

**规模**: ~500 行

**Landing gate**:

- 上 gate 全绿
- wecom 相关测试 100% 通过（Safety Fence）
- 手工：Feishu / Telegram / Slack / Discord 4 渠道按钮显示 + 点击行为正确
- 手工：WeCom detail 页 CapabilityActionBar 显示，Login 跳 WeComWizard 无破坏

### 4.3 PR #3 — Plugin guide + cleanup

**变更**：

- `docs/plugins/sdk-i18n.md` 写作
- `docs/plugins/sdk-capabilities.md` 写作
- 清理：若有 dead i18n key 残留在 Deck 主表，删除
- 清理：补齐 PR #2 遗漏的 edge case

**规模**: ~300 行（多为 docs）

**Landing gate**: 常规 + docs i18n glossary check（`pnpm docs:check-i18n-glossary`）

---

## 5. 验收标准（档次 B）

### 5.1 功能保障（必须通过）

- Feishu 接入向导在中/英文下所有文本正确显示
- Deck 主 `en.json/zh.json` 不含 `channels.feishu.*` 任何 key（grep 测试）
- Feishu / Telegram / Slack / Discord 4 渠道的 CapabilityActionBar 按 capability 声明正确渲染按钮
- Login / Probe / TestMessage 按钮点击：RPC 成功 → toast 成功；失败 → toast 错误
- WeCom 所有 i18n key 保持 1:1（未删除、未改动）
- WeCom detail 显示 CapabilityActionBar；Login 按钮点击打开 `WeComWizard`（custom renderer 路径）

### 5.2 结构性断言

新增测试（`dashboard/src/components/panels/channels/capability-bar-no-hardcoded-ids.test.ts`）：

```typescript
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const CHANNELS_DIR = join(__dirname);
const I18N_DIR = join(__dirname, "../../../i18n");

function readFile(relative: string): string {
  return readFileSync(join(CHANNELS_DIR, relative), "utf8");
}
function readJSON(relative: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(I18N_DIR, relative), "utf8"));
}

describe("structural guarantees for Spec 3", () => {
  test("CapabilityActionBar.tsx has no hardcoded channel id comparisons", () => {
    const source = readFile("CapabilityActionBar.tsx");
    expect(source).not.toMatch(/channelId\s*===\s*["'][\w-]+["']/);
    expect(source).not.toMatch(/channelId\s*!==\s*["'][\w-]+["']/);
  });

  test("Deck i18n main files no longer contain channels.feishu.*", () => {
    const en = readJSON("en.json") as { channels?: Record<string, unknown> };
    const zh = readJSON("zh.json") as { channels?: Record<string, unknown> };
    expect(en.channels?.feishu).toBeUndefined();
    expect(zh.channels?.feishu).toBeUndefined();
  });

  test("WeCom main i18n preserved 1:1 (Safety Fence)", () => {
    const en = readJSON("en.json") as { channels?: Record<string, unknown> };
    const zh = readJSON("zh.json") as { channels?: Record<string, unknown> };
    expect(en.channels?.wecom).toBeDefined();
    expect(zh.channels?.wecom).toBeDefined();
  });

  test("plugin-locales.ts wraps bundle under plugin.<id>.* namespace", () => {
    const source = readFileSync(join(__dirname, "../../../lib/plugin-locales.ts"), "utf8");
    expect(source).toMatch(/plugin/); // sanity: wrap is present
    expect(source).not.toMatch(/channels\./); // no accidental channels.* wrap
  });
});
```

### 5.3 新增契约测试

- `plugin-locales.test.ts`：
  - 合并正常
  - en 作为 fallback（zh 缺失时）
  - 命名空间 wrap 正确（plugin.<id>.\*）
  - 多 plugin 不冲突
  - 空 bundle 不污染
- `CapabilityActionBar.test.tsx`：
  - 无 capability → 不渲染
  - 各 capability 组合 → 对应按钮出现
  - `qrCodeAuth + login` → 点击 Login 打开 wizard
  - `login` 无 qrCodeAuth → 点击直接调 RPC
  - RPC 失败 → toast

### 5.4 工程 gate

- `pnpm check` + `pnpm test` + `pnpm build` 全绿
- `pnpm protocol:gen:ts` + `pnpm protocol:gen:check` 通过
- `dashboard/server/gateway-allowlist.ts` 无需改（`deck.plugins.list` 已在）
- `pnpm docs:check-i18n-glossary`（PR #3）通过
- CCG Codex 审查（跳过 Gemini，按你偏好）
- 手工视觉验收：Feishu 中/英 + WeCom + Telegram / Slack / Discord CapabilityActionBar

### 5.5 明确不做

- 迁移 wecom / weixin 的 i18n（Safety Fence）
- 合成 `TestPluginWithLocales` fixture（价值低）
- Runtime 热更新 locale
- Capability → Tab 显隐联动
- 新的 capability 字段定义

---

## 6. 风险与缓解

| 风险                                                              | 严重度 | 缓解                                                                                           |
| ----------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| next-intl 不支持运行时动态合并 messages                           | 中     | Discovery D1 验证；若不支持，在 Deck 启动前 await plugin inventory 再创建 provider（同步时序） |
| Feishu plugin 后端 RPC（login/probe/sendTest）不齐全              | 中     | Discovery D4 验证；缺失的 PR #2 内补齐（Feishu 侧 additive）                                   |
| Plugin locale payload 过大影响启动                                | 低     | 当前规模可控（~100 KB gzip）；真膨胀时迁 lazy                                                  |
| Plugin 两个 locale 内部冲突                                       | 低     | 启动 warn + 取 en 作权威                                                                       |
| WeCom CapabilityActionBar 显示按钮 → 点击破坏                     | 中     | 强制回归测试 + 手工验收；只增不改 wecom 分支                                                   |
| 主 i18n 删除 feishu section 漏删某 key 导致 undefined             | 中     | 结构断言 test + Feishu 手工全流程走一遍                                                        |
| capabilities 字段默认值偏差（plugin 没声明 = undefined vs false） | 低     | Deck 一律按 "undefined / false = 不显示按钮" 处理                                              |

### 6.1 Discovery 任务（实施前）

- **D1**: 确认 Deck 启动时序 —— `NextIntlClientProvider` 的创建位置相对 `deck.plugins.list` 首次 RPC 返回的时序；确认 `mergePluginLocales` 可在 provider 创建前（首屏 SSR/CSR hydration 前）完成，以便静态 messages prop 传入时已包含 plugin 内容（无需 next-intl 运行时动态合并能力）
- **D2**: 读 `extensions/feishu/` 当前结构，确认 locale 注入位置
- **D3**: 读 `dashboard/src/stores/channels.ts`，确认 plugin inventory 是否已暴露、是否含 capabilities
- **D4**: 对 Feishu / Telegram / Slack / Discord 四个渠道，核对后端 RPC `channel.<id>.{login,probe,sendTest}` 是否已有
- **D5**: 读 `extensions/wecom/src/channel.ts` 的 capabilities 声明，验证 CapabilityActionBar 在 wecom 上会显示哪些按钮
- **D6**: 读 `src/plugins/status.ts` 的 `SnapshotPlugin`，确认是否保留原 `ChannelPlugin` 引用以读 `locales` / `capabilities`

Discovery 产出：1 份报告 +（如必要）spec 微调 / 新增 PR 子步骤。

---

## 7. WeCom Safety Fence（硬性不变式）

### 7.1 禁止修改的文件（任何 Spec 3 PR 的 diff 不得包含）

**i18n 相关**：

- `dashboard/src/i18n/en.json` 中 `channels.wecom.*` / `wecomWizard.*` / `wecomAccess.*` 所有 section
- `dashboard/src/i18n/zh.json` 同上 section
- 任何以 `wecom` / `weixin` 前缀的 i18n 命名空间

**组件与业务逻辑**：

- `dashboard/src/components/panels/channels/WeComWizard.tsx`
- `dashboard/src/components/panels/channels/OpenClawWeixinWizard.tsx`
- `dashboard/src/components/panels/channels/wecom-access-model.ts`
- `dashboard/src/components/panels/channels/AllowFromEditor.tsx`
- `dashboard/src/components/panels/channels/BindingsTab.tsx`
- `dashboard/src/components/panels/channels/wizard-steps/` 下 wecom 相关文件
- `dashboard/src/components/panels/channels/ChannelSettingsTab.tsx` 中的 `WECOM_ACCESS_EXCLUDE_PATHS` 定义
- `dashboard/src/components/panels/channels/ChannelAccessTab.tsx`（归 Spec 1 修）
- `dashboard/src/components/panels/channels/ChannelDetail.tsx` 的 wecom summary 分支（归 Spec 1 修）

**测试**：

- `ChannelDetail.permission-summary.test.tsx`
- `ChannelDetail.access-handoff.test.tsx`
- `wecom-access-boundary.integration.test.tsx`
- `WeComWizard.access-guidance.test.tsx`
- `BindingsTab.handoff.test.tsx`
- `BindingsTab.test.tsx`
- `AllowFromEditor.test.tsx`
- `wecom-settings-technical-panel.integration.test.tsx`

**例外（允许的改动）**：

- `ChannelDetail.tsx` header 区域新增 `<CapabilityActionBar channelId={id}/>` —— 只增不改 wecom 条件分支
- `dashboard/src/stores/channels.ts` 扩展暴露 plugin inventory（通用基础设施）

### 7.2 必须保留的运行时路径

- wecom 在 Deck 主 i18n 的所有 key 可正常查询
- `onboarding-registry` 的 wecom / weixin custom renderer 条目
- `WeComWizard` / `OpenClawWeixinWizard` 调用路径完整
- wecom ChannelDetail 的 Access Tab / Bindings Tab / Settings Tab 渲染无变化

### 7.3 必须通过的 wecom 测试

（与 Spec 1 / Spec 2 相同 8 个 + 新增的"wecom CapabilityActionBar 集成测试"）

### 7.4 违反时响应

- PR 审查时发现触碰 §7.1 文件 = blocker，必须拆分
- CI 中 wecom 测试变红 = blocker，必须回滚
- CCG Codex 审查应明确检查 Safety Fence 合规

---

## 8. 成功后的下一步

PR #3 合入后：

1. 更新 `.omc/project-memory.json` 记录 Spec 3 完成
2. 基于使用反馈评估：是否要做 Discovery 3'（C schema gap）的正式 spec
3. 未来新渠道接入的标准流程：
   - 后端：声明 `capabilities`、提供 `locales/{en,zh}.json`、实现 `channel.<id>.<action>` RPC
   - Deck：**零改动**（CapabilityActionBar + Wizard DSL + AccessDescriptor 契约全覆盖）
4. Feishu 迁移成功 → 评估是否逐步迁其他渠道（Telegram/Slack/Discord 等）

---

## 9. 相关引用

- 讨论依据：`FeishuWizard.tsx`、`dashboard/src/i18n/{en,zh}.json` 的 `channels.feishu` section、`src/channels/plugins/types.plugin.ts:56` (`capabilities` 字段)
- Spec 1：`docs/superpowers/specs/2026-04-17-deck-access-model-contract-design.md`
- Spec 2：`docs/superpowers/specs/2026-04-17-deck-manifest-driven-wizard-design.md`
- Gateway 协议流程：根目录 `CLAUDE.md` "Gateway Protocol SDK"
- Dashboard 开发规则：`dashboard/CLAUDE.md`（i18n / 主题 / allowlist）
- 工作流原则：质量 > 速度；CCG Codex 审查（Gemini 按用户偏好不用）

---

## 10. 修订记录

| 日期       | 变更                               |
| ---------- | ---------------------------------- |
| 2026-04-17 | 初稿（基于 brainstorm Q1-Q6 共识） |

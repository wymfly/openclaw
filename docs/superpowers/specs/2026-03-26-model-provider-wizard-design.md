# Model Provider Configuration Wizard — 设计文档

**目标**：重新设计模型供应商配置流程，利用已有 800+ 模型目录减少用户配置负担，同时支持完全自定义供应商和 OAuth/插件供应商。

**架构**：将现有 AddProviderDialog 替换为分步向导（AddProviderWizard），在 Step 1 区分三种供应商类型，Step 2 根据类型展示不同配置表单。

**技术栈**：React + shadcn/ui + next-intl + Zustand store + Gateway RPC

---

## 1. 交互流程

### 入口

ProviderConfigTab 侧边栏底部的"添加供应商"按钮 → 打开 AddProviderWizard Dialog。

### Step 1：选择供应商类型

三个区域，从上到下排列：

**已知供应商（从目录选择）**

- 搜索框 + 网格/列表，展示从全量目录提取的 distinct provider 列表。
- 每个 provider 卡片：名称、模型数量 badge、认证类型标签。
- 已配置 provider：灰色底 + "已配置"标记，不可点击。
- 点击未配置 provider → Step 2A。

**自定义供应商**

- 单个入口卡片："自定义供应商 — 手动配置 API 兼容的供应商（Ollama / vLLM / LiteLLM 等）"。
- 点击 → Step 2B。

**OAuth / 插件（分隔线下方）**

- 列出通过插件注册的 OAuth 类型供应商。
- 已授权（authStatus=ready）：✅ + 名称 + "已授权"，点击查看授权信息和可用模型。
- 未授权（authStatus=missing 且 authType=oauth）：名称 + "可接入"，点击显示接入说明（"请通过 CLI 运行 `openclaw login --provider {name}` 完成授权"）。
- 无 OAuth 供应商时隐藏此区域。

### Step 2A：已知供应商配置

- 标题：`配置 {provider名称}`。
- Base URL：自动填充（从 `KNOWN_PROVIDER_DEFAULTS` 映射），可修改。
- API Key：输入框，支持环境变量引用（`$DEEPSEEK_API_KEY`）。
- 模型列表：从全量目录过滤该 provider 的所有模型，checkbox 列表，默认全选。每个模型显示名称、上下文窗口、推理能力标记。顶部有全选/全不选 toggle。
- 确认按钮："添加供应商"。

### Step 2B：自定义供应商配置

与当前 AddProviderDialog 表单一致：

- 供应商名称（手动输入，小写字母+数字+连字符）。
- API 格式选择（openai-completions / anthropic-messages / ollama 等）。
- 认证类型选择（api-key / oauth / aws-sdk / token）。
- Base URL。
- API Key。
- 模型列表（手动添加行：模型 ID、显示名称、上下文窗口、最大输出）。
- 确认按钮："添加供应商"。

---

## 2. 数据流与后端变更

### 新增 Gateway RPC：`models.catalog.providers`

从全量目录按 provider 分组，返回结构化的 provider + 模型列表。

```typescript
// 请求
{ method: "models.catalog.providers", params: {} }

// 响应
{
  providers: [
    {
      id: "deepseek",
      displayName: "DeepSeek",
      modelCount: 8,
      defaultBaseUrl: "https://api.deepseek.com",
      authType: "api-key",
      models: [
        { id: "deepseek-chat", name: "DeepSeek Chat", contextWindow: 128000, reasoning: false },
        { id: "deepseek-reasoner", name: "DeepSeek Reasoner", contextWindow: 128000, reasoning: true }
      ]
    }
  ]
}
```

数据来源：`loadGatewayModelCatalog()` 800+ 模型按 `provider` 分组 + `KNOWN_PROVIDER_DEFAULTS` 映射合并 `defaultBaseUrl` 和 `authType`。

### Provider 默认值映射表

新增 `src/agents/provider-defaults.ts`：

```typescript
export const KNOWN_PROVIDER_DEFAULTS: Record<
  string,
  {
    displayName: string;
    defaultBaseUrl: string;
    authType: "api-key" | "oauth" | "aws-sdk" | "token";
  }
> = {
  anthropic: {
    displayName: "Anthropic",
    defaultBaseUrl: "https://api.anthropic.com",
    authType: "api-key",
  },
  openai: {
    displayName: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    authType: "api-key",
  },
  deepseek: {
    displayName: "DeepSeek",
    defaultBaseUrl: "https://api.deepseek.com",
    authType: "api-key",
  },
  google: {
    displayName: "Google",
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    authType: "api-key",
  },
  moonshot: {
    displayName: "Moonshot",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    authType: "api-key",
  },
  mistral: {
    displayName: "Mistral",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    authType: "api-key",
  },
  groq: {
    displayName: "Groq",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    authType: "api-key",
  },
  // ... 其他已知 provider
};
```

映射表放在 Gateway 侧，通过 RPC 返回给前端。前端不硬编码 provider 知识。

### Store 变更

`dashboard/src/stores/models.ts` 新增：

```typescript
// 状态
catalogProviders: CatalogProvider[]
catalogProvidersLoading: boolean

// 方法
fetchCatalogProviders: () => Promise<void>  // 调用 /api/models/catalog-providers
```

- 懒加载：仅在 AddProviderWizard 打开时调用，不在页面初始化时加载。
- OAuth provider 数据从现有 `authOverview` 过滤 `authType === "oauth"`，不需要新端点。

### 保存流程

与当前一致，复用 `addCustomProvider` / `updateProviderConfig`。已知供应商和自定义供应商最终写入 `config.models.providers[name]`，结构相同，区别只在前端预填充。

### Dashboard API 路由

新增 `dashboard/src/app/api/models/catalog-providers/route.ts`，代理到 Gateway RPC `models.catalog.providers`。

### Gateway Allowlist

`models.catalog.providers` 加入 `dashboard/server/gateway-allowlist.ts` + `src/gateway/method-scopes.ts`（READ_SCOPE）。

---

## 3. 前端组件结构

```
AddProviderWizard.tsx (Dialog 容器，管理步骤状态)
├── WizardStepSelect.tsx (Step 1：选择供应商类型)
│   ├── KnownProviderGrid.tsx (已知供应商搜索+网格)
│   ├── CustomProviderEntry.tsx (自定义入口卡片)
│   └── OAuthProviderSection.tsx (OAuth/插件区域)
├── WizardStepKnown.tsx (Step 2A：已知供应商配置)
│   └── ModelCheckboxList.tsx (模型 checkbox 列表)
└── WizardStepCustom.tsx (Step 2B：自定义供应商配置)
    └── 复用现有 AddProviderDialog 的表单逻辑
```

### 关键交互细节

**KnownProviderGrid**：搜索框实时过滤。卡片数量多时（20+）搜索为主要导航方式。已配置 provider 灰色不可点击。

**ModelCheckboxList**：全选/全不选 toggle 在顶部。每行 checkbox + 模型名称 + 上下文窗口 + 推理标记。默认全选。列表 10+ 时固定高度可滚动。

**WizardStepCustom**：从现有 AddProviderDialog 提取表单逻辑，不重写，只改容器。

### 替换策略

- 新增 `AddProviderWizard.tsx` 及子组件。
- 删除旧 `AddProviderDialog.tsx`。
- `ProviderConfigTab.tsx` 中将 Dialog 引用替换为 Wizard。

---

## 4. 边界情况

| 场景                      | 处理                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------ |
| 已知供应商无目录模型      | 显示"暂无预设模型，请手动添加" + 手动添加行                                          |
| API Key 验证              | 保存时不验证，保存后可"运行诊断"验证连通性                                           |
| 重复 Provider             | Step 1 已配置的标记灰色不可点击。修改已有 provider 在 ProviderConfigTab 右侧面板操作 |
| OAuth 未授权              | 显示说明文本 + CLI 命令提示，不做浏览器内授权流程                                    |
| catalogProviders 加载失败 | 已知供应商区域显示"无法加载" + 重试按钮；自定义和 OAuth 区域不受影响                 |

---

## 5. i18n

所有新增用户可见文字通过 `useTranslations("models")` 调用。`zh.json` 和 `en.json` 同步新增以下 key：

- `wizardTitle` / `wizardStepSelect` / `wizardStepConfigure`
- `knownProviders` / `customProvider` / `customProviderHint`
- `oauthProviders` / `authorized` / `connectable` / `oauthCliHint`
- `selectAll` / `deselectAll` / `noModelsInCatalog` / `addModelManually`
- `configured` / `catalogLoadError` / `retry`

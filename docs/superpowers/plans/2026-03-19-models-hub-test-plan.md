# Models Hub 测试计划

> **范围**: Models Hub 全部功能点（网关 RPC + Dashboard Store + UI 组件 + E2E）
> **关联 Spec**: `docs/superpowers/specs/2026-03-19-models-hub-design.md`
> **关联实施**: `docs/superpowers/plans/2026-03-19-models-hub.md`

---

## 1. 测试覆盖现状

| 层                          | 文件                                           | 测试数 | 状态                    |
| --------------------------- | ---------------------------------------------- | ------ | ----------------------- |
| Gateway: auth-diagnostics   | `src/agents/auth-diagnostics.test.ts`          | 8      | ✅ 已覆盖               |
| Gateway: deck-auth RPC      | `src/gateway/server-methods/deck-auth.test.ts` | 6      | ✅ 已覆盖               |
| Gateway: model-catalog cost | `src/gateway/server-model-catalog.test.ts`     | 4      | ✅ 已覆盖               |
| Dashboard: models store     | —                                              | 0      | ❌ 缺失                 |
| Dashboard: UI 组件          | —                                              | 0      | ❌ 缺失（组件测试可选） |
| Dashboard: E2E              | —                                              | 0      | ❌ 缺失                 |

**本计划覆盖的新增测试**: Store 单元测试 + E2E 场景测试

---

## 2. 网关单元测试（已有，列出覆盖点）

### 2.1 auth-diagnostics (`src/agents/auth-diagnostics.test.ts`)

| ID      | 测试用例                          | 验证点                          |
| ------- | --------------------------------- | ------------------------------- |
| G-AD-01 | API Key 有效 → ready              | status 映射 ok/static → ready   |
| G-AD-02 | OAuth 即将过期 → warning          | status 映射 expiring → warning  |
| G-AD-03 | OAuth 过期 + API Key 可用 → ready | 多凭证降级选择最佳可用          |
| G-AD-04 | cooldown 状态 → 含 cooldown 字段  | rate_limit reason + remainingMs |
| G-AD-05 | billing disabled → 含 cooldown    | billing reason 正确             |
| G-AD-06 | 使用配额窗口 → usage.windows[]    | resetAt→resetsInMs 转换         |
| G-AD-07 | 多 provider 批量处理              | 返回数组长度 = 输入长度         |
| G-AD-08 | 无 profile → unknown              | 区分 missing vs unknown         |

### 2.2 deck-auth RPC (`src/gateway/server-methods/deck-auth.test.ts`)

| ID      | 测试用例                       | 验证点                       |
| ------- | ------------------------------ | ---------------------------- |
| G-DA-01 | overview 返回 provider 列表    | respond(true, { providers }) |
| G-DA-02 | probe 缺少 provider 参数 → 400 | 参数校验                     |
| G-DA-03 | probe 空 provider → 400        | 空字符串校验                 |
| G-DA-04 | probe 返回 status + latencyMs  | 结果结构正确                 |
| G-DA-05 | probe 自定义 timeout           | 传参透传                     |
| G-DA-06 | probe 默认 timeout/maxTokens   | 缺省值 8000/8                |

### 2.3 model-catalog cost (`src/gateway/server-model-catalog.test.ts`)

| ID      | 测试用例                  | 验证点                        |
| ------- | ------------------------- | ----------------------------- |
| G-MC-01 | 合并 cost + maxTokens     | config 定价数据出现在 catalog |
| G-MC-02 | 无匹配 config → undefined | 不报错，cost/maxTokens 为空   |
| G-MC-03 | 已有 cost 不被覆盖        | 保护已有数据                  |
| G-MC-04 | 大小写不敏感匹配          | provider/model ID 匹配容错    |

---

## 3. Dashboard Store 单元测试（新增）

**文件**: `dashboard/src/stores/__tests__/models.test.ts`
**框架**: Vitest + mock fetch
**参考**: `dashboard/src/stores/__tests__/docs.test.ts` 的 mock 模式

### 3.1 fetchModels

| ID      | 测试用例         | 验证点                                       |
| ------- | ---------------- | -------------------------------------------- |
| S-FM-01 | 成功获取模型列表 | models 数组正确填充，loading 切换 true→false |
| S-FM-02 | API 返回空列表   | models = []，无报错                          |
| S-FM-03 | API 请求失败     | models 保持原值，loading=false               |

### 3.2 fetchAuthOverview

| ID      | 测试用例                 | 验证点                                     |
| ------- | ------------------------ | ------------------------------------------ |
| S-FA-01 | 成功获取 auth overview   | authOverview 数组正确填充                  |
| S-FA-02 | 返回多 provider 不同状态 | ready/warning/missing/unknown 全部正确映射 |
| S-FA-03 | API 失败                 | authOverview 保持原值，authLoading=false   |

### 3.3 runProbe

| ID      | 测试用例      | 验证点                                                 |
| ------- | ------------- | ------------------------------------------------------ |
| S-RP-01 | 探针成功 ok   | probeResults[provider] 更新，status="ok"，有 latencyMs |
| S-RP-02 | 探针失败 auth | probeResults[provider].status="auth"，有 error         |
| S-RP-03 | 网络错误      | 不崩溃，probeResults 不更新                            |

### 3.4 fetchFallbacks

| ID      | 测试用例                                       | 验证点                                   |
| ------- | ---------------------------------------------- | ---------------------------------------- |
| S-FF-01 | config 中 model 为 string                      | primaryModel=该字符串，fallbacks=[]      |
| S-FF-02 | config 中 model 为 { primary, fallbacks } 对象 | primaryModel 和 fallbacks 正确提取       |
| S-FF-03 | config 中无 agents.defaults.model              | primaryModel=null，fallbacks=[]          |
| S-FF-04 | imageModel 同时提取                            | imagePrimaryModel 和 imageFallbacks 正确 |
| S-FF-05 | configRaw + configHash 被保存                  | 后续 updateFallbacks 可用                |

### 3.5 updateFallbacks

| ID      | 测试用例                      | 验证点                                    |
| ------- | ----------------------------- | ----------------------------------------- |
| S-UF-01 | 成功保存                      | PATCH 请求包含正确的 raw + baseHash       |
| S-UF-02 | 保存后 refetch                | configRaw/configHash 被刷新               |
| S-UF-03 | baseHash 冲突 (409)           | 自动调用 fetchFallbacks 重新同步          |
| S-UF-04 | 保留原对象其他字段            | spread 原 config 再覆盖 primary/fallbacks |
| S-UF-05 | updateImageFallbacks 相同逻辑 | imageModel 字段正确更新                   |

### 3.6 fetchUsageSummary

| ID      | 测试用例                    | 验证点                               |
| ------- | --------------------------- | ------------------------------------ |
| S-US-01 | 成功获取 cost + status      | usageCost 和 usageProviders 正确填充 |
| S-US-02 | cost 请求成功但 status 失败 | usageCost 有值，usageProviders 为空  |
| S-US-03 | 两者都失败                  | 保持原值，不崩溃                     |

---

## 4. Dashboard E2E 测试（新增）

**文件**: `dashboard/e2e/models.spec.ts`
**框架**: Playwright
**策略**: 使用 `page.route()` 拦截 API 请求，注入 mock 数据。不依赖真实网关。

### 4.1 Tab 导航

| ID       | 测试用例              | 步骤                                               | 验证点                      |
| -------- | --------------------- | -------------------------------------------------- | --------------------------- |
| E-NAV-01 | 四个 Tab 可见且可切换 | 进入 Models 面板 → 逐个点击 Tab                    | 每个 Tab 内容区渲染，无报错 |
| E-NAV-02 | 默认选中 Catalog Tab  | 进入 Models 面板                                   | Catalog Tab 高亮，内容可见  |
| E-NAV-03 | Tab 切换保持状态      | Catalog 选中 provider → 切到 Config → 切回 Catalog | 之前的选中状态保留          |

### 4.2 Catalog Tab

| ID       | 测试用例                 | 步骤                                | 验证点                                         |
| -------- | ------------------------ | ----------------------------------- | ---------------------------------------------- |
| E-CAT-01 | Provider 列表加载        | Mock models.list 返回 3 个 provider | 3 个 provider 分组可见，模型数量 badge 正确    |
| E-CAT-02 | Auth 状态点显示          | Mock auth overview (ready/missing)  | 绿点和红点分别出现在对应 provider              |
| E-CAT-03 | 展开 Provider 查看模型   | 点击 provider 折叠区                | 模型列表展开，显示名称+上下文窗口              |
| E-CAT-04 | 默认模型星标             | Mock 一个 isDefault=true            | 该模型行显示 ★                                 |
| E-CAT-05 | 选中 Provider → 右栏概览 | 点击 provider 标题                  | 右栏显示模型对比表格（名称、价格、能力）       |
| E-CAT-06 | 选中模型 → 右栏详情      | 点击具体模型                        | 右栏显示模型详情（名称、ID、价格明细、badges） |
| E-CAT-07 | 模型价格显示             | Mock cost 数据                      | 输入/输出价格以 $X.XX/M 格式显示               |
| E-CAT-08 | 空模型列表               | Mock 空返回                         | 显示"未发现可用模型"空状态                     |
| E-CAT-09 | 设为默认操作             | 点击 [Set as Default] 按钮          | config.patch 被调用，按钮状态更新              |

### 4.3 Provider Config Tab

| ID       | 测试用例                | 步骤                                    | 验证点                              |
| -------- | ----------------------- | --------------------------------------- | ----------------------------------- |
| E-CFG-01 | 已配置/未配置分组       | Mock auth overview (2 ready, 1 missing) | 左栏显示两组，数量正确              |
| E-CFG-02 | Auth 类型 badge         | Mock api_key/oauth 类型                 | Badge 分别显示 API Key / OAuth      |
| E-CFG-03 | 认证健康卡片 — ready    | 选中 ready provider                     | 显示 🟢 Ready + auth 来源           |
| E-CFG-04 | 认证健康卡片 — warning  | Mock expiring OAuth                     | 显示 🟡 Warning + 过期倒计时        |
| E-CFG-05 | 认证健康卡片 — cooldown | Mock cooldown 数据                      | 显示冷却原因 + 剩余时间 + 进度条    |
| E-CFG-06 | 探针诊断 — 成功         | Mock probe 返回 ok + 238ms              | 按钮变 loading → 显示 ✅ ok · 238ms |
| E-CFG-07 | 探针诊断 — 失败         | Mock probe 返回 auth error              | 显示 ❌ + 错误信息                  |
| E-CFG-08 | API Key 输入            | 输入 sk-test-123                        | 密码遮罩，眼睛切换可见              |
| E-CFG-09 | 保存配置                | 填写 API Key → 点保存                   | config.patch 调用，显示 ✓ Saved     |
| E-CFG-10 | 未配置 Provider 引导    | 选中 missing provider                   | 显示环境变量提示 + 空表单           |

### 4.4 Fallbacks Tab

| ID      | 测试用例       | 步骤                              | 验证点                                             |
| ------- | -------------- | --------------------------------- | -------------------------------------------------- |
| E-FB-01 | 主力模型卡片   | Mock primary = moonshot/kimi-k2.5 | 顶部显示主力模型卡片，无拖拽手柄                   |
| E-FB-02 | 回退链卡片列表 | Mock 2 个 fallback                | 主力下方显示 2 张卡片，有 ≡ 手柄和 ✕ 按钮          |
| E-FB-03 | 箭头连接       | 有回退链                          | 卡片之间显示 "▼ On failure" 箭头                   |
| E-FB-04 | 卡片信息完整   | Mock 含价格和能力                 | 显示 provider/model、上下文窗口、价格、能力 badges |
| E-FB-05 | Auth 缺失警告  | Mock fallback 的 auth=missing     | 红色虚线边框 + 警告文字 + [Configure →]            |
| E-FB-06 | 拖拽排序       | 拖动第 2 张到第 1 位              | config.patch 被调用，新顺序正确                    |
| E-FB-07 | 删除回退       | 点击 ✕ → 确认                     | 卡片移除，config.patch 被调用                      |
| E-FB-08 | 添加回退模型   | 点击 [+ Add] → 选择模型           | 新卡片出现，config.patch 被调用                    |
| E-FB-09 | 更换主力模型   | 点击 [Change ▾] → 选择新模型      | 主力卡片更新，config.patch 被调用                  |
| E-FB-10 | 空回退链       | Mock 无 fallback                  | 显示空状态提示 + [+ Add] 按钮                      |
| E-FB-11 | 图像模型区域   | Mock imageModel 数据              | 独立的图像模型回退链区域显示正确                   |
| E-FB-12 | 自动保存反馈   | 操作后                            | 底部短暂显示 "✓ Saved"                             |

### 4.5 Usage Tab

| ID      | 测试用例             | 步骤                          | 验证点                                   |
| ------- | -------------------- | ----------------------------- | ---------------------------------------- |
| E-US-01 | 今日成本卡片         | Mock cost 数据 (今日 $12.38)  | 显示 $12.38 + vs yesterday 百分比        |
| E-US-02 | 本周成本卡片         | Mock 7 天 cost 数据           | 显示总和 + vs last week 百分比           |
| E-US-03 | 活跃 Provider 卡片   | Mock auth (3 ready / 5 total) | 显示 3 / 5                               |
| E-US-04 | Provider 配额卡片    | Mock 2 provider 有 windows    | 两张卡片，显示进度条 + 百分比 + 重置时间 |
| E-US-05 | 配额进度条颜色       | Mock 30%/80%/95%              | 蓝色 / 黄色 / 红色                       |
| E-US-06 | 7 天趋势图渲染       | Mock 7 天 cost 数据           | Recharts 柱状图可见，7 根柱子            |
| E-US-07 | 趋势图 hover tooltip | Hover 某个柱子                | Tooltip 显示日期 + 金额                  |
| E-US-08 | 查看详细分析链接     | 点击链接                      | 导航到 Usage 面板（或链接可点击）        |
| E-US-09 | 无数据空状态         | Mock 空 cost 数组             | 显示"暂无用量数据"                       |
| E-US-10 | Provider 无配额数据  | Mock provider 只有 error      | 显示灰色"配额数据不可用"                 |

### 4.6 跨 Tab 集成

| ID       | 测试用例                | 步骤                                       | 验证点                              |
| -------- | ----------------------- | ------------------------------------------ | ----------------------------------- |
| E-INT-01 | Catalog → Config 跳转   | Catalog 点 [Configure →]                   | 切到 Config Tab，该 provider 被选中 |
| E-INT-02 | Fallbacks → Config 跳转 | Fallbacks 点 auth 缺失卡片的 [Configure →] | 切到 Config Tab                     |
| E-INT-03 | Catalog [加入回退链]    | 点击模型详情的 [Add to Fallback Chain]     | 切到 Fallbacks Tab（或 toast 确认） |
| E-INT-04 | 数据共享一致性          | Catalog 和 Config 的 auth 状态点           | 同一 provider 的状态点颜色一致      |

---

## 5. i18n 验证

| ID      | 测试用例     | 验证点                                     |
| ------- | ------------ | ------------------------------------------ |
| I18N-01 | 英文渲染完整 | 所有 Tab 无 missing key 警告               |
| I18N-02 | 中文渲染完整 | 切换到 zh 后所有文本显示中文               |
| I18N-03 | 参数插值     | "{provider} is ready" 正确替换 provider 名 |

---

## 6. 深浅色主题

| ID    | 测试用例                    | 验证点                        |
| ----- | --------------------------- | ----------------------------- |
| TH-01 | 深色模式下所有组件可读      | 文字对比度足够，背景正确      |
| TH-02 | 浅色模式下所有组件可读      | 无"深色文字在深色背景"问题    |
| TH-03 | Auth 状态点在两种模式下可辨 | 绿/黄/红/灰四色均可区分       |
| TH-04 | Recharts 图表主题适配       | 柱状图在浅色/深色模式下均可读 |
| TH-05 | 进度条颜色在两种模式下正确  | 蓝/黄/红三色均可辨            |

---

## 7. 边界条件与容错

| ID    | 测试用例                         | 验证点                                      |
| ----- | -------------------------------- | ------------------------------------------- |
| BC-01 | 网关断连                         | 所有 Tab 显示错误状态 + 重试按钮，不白屏    |
| BC-02 | models.list 超大列表 (100+ 模型) | ProviderList 虚拟滚动或正常渲染无卡顿       |
| BC-03 | 并发保存冲突                     | 两次快速拖拽 → debounce 合并为一次 PATCH    |
| BC-04 | 探针超时                         | 8s 超时后显示 timeout 状态，不 hang         |
| BC-05 | config.get 返回畸形 raw          | fetchFallbacks 不崩溃，fallback 为空        |
| BC-06 | 无任何 provider 有认证           | Config Tab 左栏全在"未配置"组，右栏显示引导 |
| BC-07 | 单 provider 多 usage windows     | ProviderQuotaGrid 显示多个进度条            |

---

## 8. 执行优先级

| 优先级 | 测试组                         | 测试数 | 说明                                  |
| ------ | ------------------------------ | ------ | ------------------------------------- |
| **P0** | Store 单元测试 (§3)            | ~20    | 数据层正确性是一切 UI 的基础          |
| **P0** | E2E Fallbacks Tab (§4.4)       | 12     | 拖拽+自动保存逻辑最复杂，回归风险最高 |
| **P1** | E2E Catalog Tab (§4.2)         | 9      | 核心浏览体验                          |
| **P1** | E2E Config Tab (§4.3)          | 10     | 认证诊断是关键新功能                  |
| **P1** | E2E Usage Tab (§4.5)           | 10     | 数据可视化验证                        |
| **P2** | Tab 导航 + 跨 Tab (§4.1, §4.6) | 7      | 集成完整性                            |
| **P2** | i18n + 主题 (§5, §6)           | 8      | 体验层面                              |
| **P3** | 边界条件 (§7)                  | 7      | 防御性                                |

**总计: ~83 个测试用例**（已有 18 + 新增 ~65）

---

## 9. Mock 数据规范

### models.list mock

```typescript
const mockModels = [
  {
    id: "kimi-k2.5",
    name: "Kimi K2.5",
    provider: "moonshot",
    contextWindow: 262144,
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 0.57, output: 3.0, cacheRead: 0.04, cacheWrite: 0.57 },
    maxTokens: 32768,
    isDefault: true,
  },
  {
    id: "MiniMax-M2.5",
    name: "MiniMax M2.5",
    provider: "minimax",
    contextWindow: 205000,
    reasoning: true,
    input: ["text"],
    cost: { input: 0.3, output: 1.2, cacheRead: 0, cacheWrite: 0 },
    maxTokens: 16384,
  },
  {
    id: "gpt-5.1-codex",
    name: "GPT 5.1 Codex",
    provider: "openai",
    contextWindow: 131072,
    reasoning: false,
    input: ["text", "image"],
    cost: { input: 2.5, output: 10, cacheRead: 0.5, cacheWrite: 2.5 },
    maxTokens: 32768,
  },
];
```

### auth overview mock

```typescript
const mockAuth = [
  {
    provider: "moonshot",
    status: "ready",
    auth: { type: "api_key", source: "env:MOONSHOT_API_KEY", profileId: "moonshot:default" },
  },
  {
    provider: "minimax",
    status: "warning",
    auth: { type: "oauth", source: "profile:minimax:oauth" },
    oauth: { expiresAt: Date.now() + 3600000, remainingMs: 3600000, status: "expiring" },
  },
  { provider: "openai", status: "missing", auth: null },
];
```

### config mock

```typescript
const mockConfig = {
  raw: JSON.stringify({
    agents: {
      defaults: {
        model: { primary: "moonshot/kimi-k2.5", fallbacks: ["minimax/MiniMax-M2.5"] },
        imageModel: "openai/gpt-5.1-codex",
      },
    },
  }),
  hash: "abc123",
};
```

### usage mock

```typescript
const mockCost = [
  { date: "2026-03-13", cost: 8.5 },
  { date: "2026-03-14", cost: 12.3 },
  { date: "2026-03-15", cost: 9.8 },
  { date: "2026-03-16", cost: 15.2 },
  { date: "2026-03-17", cost: 11.0 },
  { date: "2026-03-18", cost: 7.6 },
  { date: "2026-03-19", cost: 12.38 },
];

const mockUsageProviders = [
  {
    provider: "moonshot",
    displayName: "Moonshot",
    windows: [{ label: "Daily", usedPercent: 72, resetsInMs: 19380000 }],
    plan: "Standard",
  },
  {
    provider: "openrouter",
    displayName: "OpenRouter",
    windows: [{ label: "Monthly", usedPercent: 15, resetsInMs: 1900800000 }],
    plan: "Explorer",
  },
];
```

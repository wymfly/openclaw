# Deck Model Configuration Source-of-Truth Design

> Date: 2026-04-06  
> Status: Draft  
> Branch: enhanced  
> Role: 本文档冻结 Deck 模型配置/供应商配置的来源边界，解决“主配置、agent-local 配置、运行时聚合视图不一致”导致的 UI 误导与运维混乱问题。

## 背景

在当前 enhanced 分支中，Deck 的模型模块已经具备以下功能：

- Provider Config：编辑 `openclaw.json` 中的 `models.providers`
- Configured Models：查看当前已配置模型
- Auth Overview：查看 provider 认证健康状态
- Add Provider Wizard：从 catalog 或自定义信息新增 provider

但实际排查发现，Gateway 的模型/供应商配置并不是单一来源，而是至少同时存在三层：

1. **主配置层**：`~/.openclaw/openclaw.json`
2. **agent-local 层**：`~/.openclaw/agents/<agent>/agent/models.json` 与 `auth-profiles.json`
3. **运行时聚合层**：Gateway 的 `models.configured` / `models.list` / `deck.auth.overview` 等 RPC 所返回的综合视图

这导致一个典型问题：

- 用户曾经配置过 provider `cpa`
- `main` agent 仍然在用 `cpa/gpt-5.4`
- `auth-profiles.json` 与 `models.json` 中仍保留 `cpa`
- 但 Deck 的 Provider Config 页面中看不到 `cpa`

对用户而言，这会被理解为：

> “供应商配置丢了。”

但从系统真实状态看，实际情况是：

> **主配置层没有 `cpa`，agent-local 层有 `cpa`，运行时仍然能使用 `cpa`。**

也就是说，当前 UI 呈现的是一部分真相，而不是完整真相。

---

## 问题定义

### 当前问题不是单纯的“显示 bug”

当前问题的核心不是前端少显示了一行 provider，而是：

- Deck UI 没有明确声明自己正在展示的是哪一层配置
- Gateway 的运行时模型可见性来自多层聚合
- 前端却把“主配置中的 provider 列表”展示成了“当前系统的 provider 真相”

这会带来三类风险：

### 1. 运维误判

用户在 UI 中看不到某个 provider，会以为：

- 该 provider 已被删除
- 当前 agent 不再可使用该 provider
- auth 已失效

但这可能完全不成立。

### 2. 配置误写

用户在一个只编辑主配置的界面里进行修改，却可能以为自己在修改：

- 全系统 provider 配置
- 当前 agent 的 provider 配置
- 当前实际运行中的 provider 选择

这会导致“改了但不生效”或“生效范围和预期不同”。

### 3. 设计心智错误

Deck 当前模型模块把以下概念混在了一起：

- provider definition
- provider auth
- model catalog
- configured models
- agent runtime model selection

而 Gateway 实际上已经把它们拆成不同来源、不同语义层。

---

## 设计目标

1. **明确模型配置的来源边界**：UI 必须能区分主配置、agent-local、运行时聚合视图。
2. **避免“UI 假装知道全部真相”**：任何页面都不能把单一来源伪装成全系统真实状态。
3. **让用户知道“某个 provider 为什么能用/为什么显示/为什么不能编辑”。**
4. **保留 Gateway 为权威**：Deck 不重新定义 provider/model 语义，只消费并呈现 Gateway 暴露的权威信息。
5. **为后续实现留出渐进迁移空间**：不要求一步完成所有 RPC 重构，但先冻结正确架构。

---

## 非目标

以下内容不属于本文档立即要解决的问题：

1. 不重新设计模型选择算法。
2. 不重构 `models.list` / `models.configured` 的全部内部实现。
3. 不在本次设计中解决 agent-local 配置与主配置的写回统一问题。
4. 不要求 Deck 在本次修改中支持编辑所有 provider 级高级字段。
5. 不要求 UI 立即变成完整的模型控制台。

本文档的重点是：

> **先冻结“什么数据从哪里来、UI 应该如何表达它”的模型。**

---

## 核心原则

### 原则 1：来源必须可见

任何 provider / model / auth 状态，只要会出现在 Deck 中，就必须能回答：

- 它来自哪里？
- 它属于谁？
- 它是否可编辑？
- 它的编辑会影响哪一层？

### 原则 2：主配置视图不等于运行时视图

`openclaw.json` 中的 `models.providers` 只是模型体系的一部分。

因此：

- 编辑主配置的页面只能自称“主配置视图”
- 不能把它展示成“全部 provider 配置”
- 更不能暗示“这里看不到就说明系统里没有”

### 原则 3：运行时 inventory 是聚合层，不是编辑层

`models.configured`、`deck.auth.overview`、`models.list` 等接口代表的是运行时综合视图。

它们的职责是：

- 告诉前端当前真实可见/可用状态
- 告诉前端来源与健康状态

而不是直接承担配置写入语义。

### 原则 4：UI 必须表达 provenance，而不是藏起 provenance

对于 provider/model，UI 至少需要表达：

- source
- scope
- editability

否则用户无法理解为什么：

- 某个 provider 能用却看不到配置
- 某个 provider 能看见但不能编辑
- 某个模型在 configured 里有，但在 provider config 里没有

### 原则 5：Deck 跟随 Gateway，而不是自己推断模型体系

Deck 不应通过前端启发式去猜：

- 这是不是“真正存在的 provider”
- 这是不是“只来自 auth profile”
- 这是不是“应该显示在 provider config 页面”

这些信息应由 Gateway 明确提供。

---

## 当前架构的真实分层

### Layer A：Global Provider Config

来源：

- `~/.openclaw/openclaw.json`
- 路径：`models.providers`

语义：

- 全局 provider 定义
- 面向主配置
- 是一种**配置来源**，不是全部运行时来源

当前 Deck 对应页面：

- Provider Config

### Layer B：Agent-local Provider/Auth State

来源：

- `~/.openclaw/agents/<agent>/agent/models.json`
- `~/.openclaw/agents/<agent>/agent/auth-profiles.json`

语义：

- 与 agent 绑定的 provider / auth / model catalog 视图
- 可能保留主配置中已经不存在的 provider
- 也可能补充主配置中没有声明的 provider

当前 Deck：

- 基本没有显式表达这层来源

### Layer C：Runtime Provider Inventory

来源：

- Gateway 聚合结果
- 包括 config / auth-profile / env / agent-local / discovery 等来源

当前典型 RPC：

- `models.configured`
- `models.list`
- `deck.auth.overview`
- `models.catalog.providers`

语义：

- “当前系统实际可见或可用的 provider/model 真相”
- 这是 UI 最应该信任的运行时展示层

---

## 当前 UI 的问题拆解

### Provider Config 页面的语义错误

当前页面实际做的是：

- 读取 `/api/models/config`
- 修改 `openclaw.json` 的 `models.providers`

这本身没有问题。

问题在于它的展示语义过强，用户会天然理解为：

> “这里展示的是当前所有 provider 的配置。”

但事实不是。

### Configured Models 页面缺少来源说明

当前 `models.configured` 展示的是运行时结果，但没明确告诉用户：

- 这个 model/provider 来自主配置还是 agent-local
- 这个 provider 是否可编辑
- 这个 provider 的 auth 来源是什么

### Auth Health 页面只表达健康，不表达归属

Auth card 现在能看状态，但无法回答：

- 这个 auth 是绑定在全局配置上还是 agent-local 上？
- 当前 provider 是 config-only、auth-only，还是两者都有？

### Add Provider Wizard 的目标对象不明确

当前 wizard 更像是：

- 往主配置里新增 provider

但 UI 没把这件事说得足够明确。

---

## 冻结后的目标 UI 模型

模型页面应拆成两个核心视角，而不是继续让一个 provider 列表承担全部语义。

## View 1：Global Provider Config

### 目标

明确表达：

> 这里编辑的是 **主配置 `openclaw.json` 中的 `models.providers`**。

### 应展示

- provider 名称
- baseUrl
- auth mode
- api adapter
- model list
- 可选高级字段（headers、authHeader、injectNumCtxForOpenAICompat）

### 必须增加的说明

页面标题或副标题必须明确写清：

- 这是 **全局主配置层**
- 不一定等于全部运行时 provider 来源

### 允许的操作

- 新增主配置 provider
- 编辑主配置 provider
- 删除主配置 provider

### 不应该暗示的事

- 这里看不到的 provider 不存在
- 这里的列表等于全部可用 provider

---

## View 2：Runtime Provider Inventory

### 目标

展示当前 Gateway 真实看到的 provider / model / auth 状态。

### 这个视图应该成为用户判断“系统现在实际能不能用”的主视图。

### 每个 provider 最少需要暴露的字段

```ts
interface ProviderInventoryEntry {
  provider: string;
  source: "config" | "agent-models" | "auth-profile" | "env" | "discovered" | "mixed";
  scope: "global" | "agent:main" | `agent:${string}`;
  editable: boolean;
  authStatus: "ready" | "warning" | "missing" | "unknown";
  configPresent: boolean;
  authPresent: boolean;
  modelsPresent: boolean;
}
```

### 每个 model 最少需要暴露的字段

```ts
interface ConfiguredModelEntry {
  provider: string;
  id: string;
  authStatus: string;
  source: "config" | "agent-models" | "mixed";
  scope: "global" | "agent:main" | `agent:${string}`;
  editable: boolean;
}
```

### UI 上应该如何显示

至少用 badge / label 表达：

- Source
- Scope
- Editable / Read-only

例如：

- `Source: Global config`
- `Source: Main agent models.json`
- `Source: Mixed`
- `Read-only from agent-local config`

---

## Gateway 需要提供的最小协议补充

为了让 Deck 不再猜 provenance，Gateway 侧应逐步补充这类能力。

## 方案 A：增强现有 RPC（推荐）

### `models.configured`

增加：

- `source`
- `scope`
- `editable`

### `deck.auth.overview`

增加：

- `scope`
- `source`
- `configPresent`
- `authPresent`

### `models.catalog.providers`

继续保持“catalog/template”定位，不承担运行时 truth 语义。

优点：

- 改动最小
- 不需要引入太多新 RPC
- 最适合当前系统增量演进

## 方案 B：新增 `models.inventory`（更干净）

单独做一个 runtime inventory RPC：

- 聚合 provider
- auth
- model visibility
- source / scope / editable

优点：

- 语义最清晰
- UI 可以只信一个 inventory 入口

缺点：

- 新增协议面较大
- 需要重新调整前端数据流

### 本文推荐

**短期采用方案 A，长期可演进到方案 B。**

---

## 当前 Deck UI 的建议调整

## 第一阶段（低风险高收益）

### 1. 重命名 / 重描述 Provider Config 页面

把它明确成：

- **Global Provider Config**
- 或在副标题中写：
  - “Edits `openclaw.json` only”

### 2. 在 provider sidebar 中增加 provenance badge

对 provider 至少标记：

- Config
- Agent-local
- Mixed

### 3. 在 Configured Models 中显示来源和 scope

例如：

- `cpa / gpt-5.4`  
  `Source: main agent models.json`  
  `Auth: ready`

### 4. 对不可编辑来源给出只读说明

如果某个 provider 只来自 agent-local：

- 要显示它
- 但要告诉用户：
  - 不能在 Global Provider Config 中直接编辑它

## 第二阶段（结构性完善）

### 5. 增加 provider inventory 统一视图

把：

- provider config
- auth health
- configured models

这三者串起来，用 inventory 做上层导航。

### 6. 明确 global / agent-local 的切换视图

例如：

- Global
- Main agent
- Selected agent

这样用户就不会把所有来源混成一层看。

---

## 关于“模型参数”的判断

当前 Deck 的模型模块对于“模型参数设置”的支持是不完整的。

### 现在能表达的

- baseUrl
- apiKey
- auth
- api
- model list
- fallback / primary 模型（另一路）

### 现在表达不完整的

- provider 高级 headers
- `authHeader`
- `injectNumCtxForOpenAICompat`
- `mode`（merge / replace）
- 某些 provider/model 的更深层 runtime 特性
- agent-local `models.json` 中的来源与差异

因此当前页面的正确定位应该是：

> **常用 provider 配置器 + 运行时模型可见性面板**

而不是：

> **完整模型体系控制台**

---

## 设计结论

### 结论 1

当前 Deck 模型 UI 不是完全错误，但它**不足以充分反映 Gateway 实际的模型配置方式**。

### 结论 2

核心缺口不是某个字段没显示，而是：

> **UI 没有表达多层配置来源（global config / agent-local / runtime inventory）的边界。**

### 结论 3

短期最有价值的改造不是补更多表单字段，而是：

1. 补 provenance
2. 区分主配置视图与运行时视图
3. 让用户知道“为什么某个 provider 能用/为什么能看见/为什么不能编辑”

### 结论 4

如果不先解决 provenance 与 source-of-truth 问题，继续往现有 Provider Config 页面里塞更多编辑能力，只会扩大误导。

---

## 推荐后续工作

### Priority 1

新增一份 implementation plan，专门处理：

- provider provenance
- runtime inventory
- Global Provider Config 语义收紧

### Priority 2

在 Gateway RPC 上补齐：

- `source`
- `scope`
- `editable`

### Priority 3

再考虑扩张 provider/model 高级参数编辑能力。

---

## 最终一句话

> **Deck 当前的模型模块编辑的是“主配置中的 provider”，但用户需要看到的是“Gateway 实际正在用哪些 provider，以及它们来自哪里”。**

后续设计必须围绕这两个视角的分离来做，而不是继续把它们混在一个页面里。

# Codex Prototype Quality Assessment

> **Date:** 2026-05-03
> **Scope:** `frontend-handoff/modules/agents/` handoff package produced by Codex
> **Baseline:** `frontend-handoff/modules/chat/` handoff package produced by Claude Design (validated pilot)
> **Audience:** Codex (and any agent tasked with producing handoff prototypes)

---

## Executive Summary

Agents module handoff package 的 5 个 markdown 文档（README / components / states / interactions / api-usage）质量合格，对齐了后端 DTO 真相，API discrepancy 记录准确。但核心交付物 `prototype.html` 存在结构性缺陷：它是一个**静态 HTML 截图**，不是协议要求的**交互式 React 原型**。这导致 Claude Code 在实施阶段被迫兼任设计 agent，自行"发明"了 6/7 section 的 UI 布局和交互流程。

---

## 1. 问题定位

### 1.1 不是审美问题

Codex 的原型正确使用了 design system tokens（`--ds-*` 颜色、间距、字体、圆角），视觉效果不出错。Design system 成功兜住了审美底线。

### 1.2 是产物定义认知问题

Codex 把"高保真原型"理解为"**视觉像素还原的 HTML 截图**"，但协议和 skill 定义要求的是"**行为保真的交互式 React 应用**"。

`interactive-prototype` skill 原文：

> _"Create a fully interactive prototype with realistic state management and transitions. Use React useState/useEffect for dynamic behavior. Include hover states, click interactions, form validation, animated transitions, and multi-step navigation flows. It should feel like a real working app, not a static mockup."_

### 1.3 是交互设计完成度问题

原型只渲染了 7 个 section 中的 1 个（Overview），另外 6 个 section 的 UI 布局、状态流转、edge case 完全没有视觉参考。

---

## 2. 定量对比

### 2.1 架构对比

| 维度      | Chat 原型 (Claude Design)                                                                | Agents 原型 (Codex)                       |
| --------- | ---------------------------------------------------------------------------------------- | ----------------------------------------- |
| 架构      | 多文件：`prototype.html` 45 行壳 + 8 个 `.jsx` + `styles.css` + `data.js` + `tokens.css` | 单文件 778 行，CSS / HTML / JS 全 inline  |
| 框架      | React 18 + Babel standalone，真实 `useState` / `useEffect`                               | 纯 HTML，零 React，3 个 CSS class toggle  |
| Mock 数据 | `data.js` 独立文件，contract-shaped JSON payload                                         | 硬编码在 HTML 标签中                      |
| 组件隔离  | 7 个独立 JSX 文件，1:1 映射到工程组件                                                    | 0 个组件，扁平 HTML                       |
| Tokens    | `tokens.css` 外链，与 canonical `index.css` 同步                                         | 在 `<style>` 中重新定义了全部 74 行 token |
| 总代码量  | ~2694 LOC (JSX + CSS + data)                                                             | 778 LOC (全包)                            |

### 2.2 交互能力对比

| 交互           | Chat                                                                        | Agents                                             |
| -------------- | --------------------------------------------------------------------------- | -------------------------------------------------- |
| 可探索的状态数 | 12+ 种（theme / density / streaming / approval / search / canvas / SSE 等） | 4 种（ready / empty / error / create，CSS toggle） |
| Tweaks 面板    | 有，所有状态组合可实时切换                                                  | 无                                                 |
| Section 导航   | —                                                                           | 7 个 tab 存在但点击无效，始终显示 Overview         |
| 表单交互       | textarea + 提交 + slash-command                                             | input 只是视觉壳，无 onChange                      |
| 列表选择       | session 切换驱动 transcript                                                 | 选中行是硬编码 `is-selected` class                 |
| 流式动画       | streaming dots / cursor / block-by-block                                    | 无                                                 |
| 搜索           | 实时 filter + highlight                                                     | input 存在但无功能                                 |
| 键盘           | Cmd+K / Escape / arrow keys                                                 | 无                                                 |

### 2.3 Section 覆盖对比

| Section       | 原型中的 UI                         | 真实实现中的 UI                                                     |
| ------------- | ----------------------------------- | ------------------------------------------------------------------- |
| Overview      | 4 个 input + runtime/preview 静态行 | 5 个 input + dirty/saving/error 状态 + meta strip                   |
| Skills        | **空**                              | mode toggle (all/whitelist) + per-skill Toggle 行 + conflict banner |
| Subagents     | **空**                              | permission 行 + model inherit input + conflict banner               |
| Tool Policy   | **空**                              | layer 预览行 + tool allowed/denied Badge + recompute                |
| System Prompt | **空**                              | layer 预览 + bootstrap files + char count                           |
| Files         | **空**                              | 文件列表 + 编辑器双栏 + file name input + save                      |
| Event Streams | **空**                              | subscription toggle 行 + 5 个 declared stream options               |
| Create        | 单步表单（4 field）                 | 3-step wizard: identity → runtime-note → review                     |
| Delete        | **无**                              | 确认 dialog + deleting/error 状态                                   |

**结论：原型覆盖了约 15% 的最终 UI 面积。Claude Code 在实施阶段被迫自行设计了 85% 的 UI。**

---

## 3. 根因分析

### 3.1 产物格式错误

Codex 产出了一个用 `body[data-state="X"]` CSS selector 切换的静态页面，而不是 React 应用。这不是"简化"——这是**产物类型错误**。

正确的 prototype 是一个 React 应用：

- `prototype.html` 只是 45 行的壳（加载 React + Babel + 外部 JSX 文件）
- 组件逻辑在 `.jsx` 文件中，1:1 映射到未来的 `.tsx` 工程文件
- 状态用 `useState` / `useEffect` 管理，Claude Code 翻译时直接搬运

### 3.2 交互设计深度不足

原型的价值不是"长什么样"，而是"怎么动"。具体缺失：

- **状态转换路径**：选中 agent → 加载 detail → 切换 section → 编辑 → dirty → save → conflict — 这整条路径应该在原型里可点击走通
- **Edge case 可视化**：empty list / filtered-empty / detail-loading / detail-error / conflict / saving — 每种状态应该通过 Tweaks 面板可切换
- **数据层**：mock 数据应该是 contract-shaped JSON 对象（`DeckGoAgentSummary` / `DeckGoAgentDetailResponse` 等），不是硬编码字符串

### 3.3 完成度不足

7 个 section 只渲染了 1 个。即使架构和交互深度正确，15% 的覆盖也不足以指导翻译。

---

## 4. 正确做法指南

### 4.1 文件结构

```
frontend-handoff/modules/<module>/
├── prototype.html          ← 45 行壳（加载 React + Babel + 外部文件）
├── tokens.css              ← link 到 canonical tokens（不重新定义）
├── styles.css              ← 模块专属样式，~400-600 LOC
├── data.js                 ← contract-shaped mock 数据（export 为全局 window.MOCK）
├── icons.jsx               ← 模块图标集（如果有）
├── <component-1>.jsx       ← 独立组件文件
├── <component-2>.jsx
├── ...
├── app.jsx                 ← 主 shell + Tweaks 面板 + 状态编排
├── README.md
├── components.md
├── states.md
├── interactions.md
├── api-usage.md
└── tokens-proposal.md      ← (可选)
```

### 4.2 prototype.html 壳模板

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>deck-go <module> — hifi prototype</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
    />
    <link rel="stylesheet" href="tokens.css" />
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <div id="root"></div>
    <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js" crossorigin></script>
    <script src="data.js"></script>
    <script type="text/babel" src="<component-1>.jsx"></script>
    <script type="text/babel" src="<component-2>.jsx"></script>
    <script type="text/babel" src="app.jsx"></script>
  </body>
</html>
```

### 4.3 tokens.css

**不要重新定义 token。** 直接复制 canonical `frontend-new/src/design-system/tokens/index.css` 的内容，或者更好的做法是保持一份和 canonical 完全一致的 mirror（drift 由 `scripts/check-tokens-drift.sh` 检测）。

### 4.4 data.js（mock 数据）

Mock 数据必须是 contract-shaped，和 `contracts/generated/ts/deck-api.generated.ts` 中的 DTO 对齐：

```js
window.MOCK = {
  agents: [
    {
      id: "main",
      name: "Main",
      status: "idle",
      isDefault: true,
      model: "gpt-5.4",
      workspace: "/workspace",
      sessionCount: 18,
      bindingCount: 4,
      lastActiveAtMs: 1714600000000,
      emoji: "M",
    },
    {
      id: "ops",
      name: "Ops Runner",
      status: "busy",
      isDefault: false,
      model: "sonnet-4.6",
      workspace: "/workspace/ops",
      sessionCount: 7,
      bindingCount: 2,
    },
    // ... 更多 agent，包含 missing optional fields 的情况
  ],

  // 每个 section 的 detail response
  agentDetail: {
    id: "main",
    name: "Main",
    // ... 完整 DeckGoAgentDetailResponse shape
  },

  skills: {
    mode: "whitelist",
    skills: ["read", "write"],
    available: [
      { key: "read", name: "Read files", eligible: true },
      { key: "write", name: "Write files", eligible: true },
      { key: "exec", name: "Execute commands", eligible: true },
    ],
    configHash: "abc123",
  },

  subagentConfig: {
    /* ... DeckGoAgentSubagentConfigResponse shape */
  },
  toolPolicy: {
    /* ... DeckGoAgentToolPolicyPreviewResponse shape */
  },
  systemPrompt: {
    /* ... DeckGoAgentSystemPromptPreviewResponse shape */
  },
  files: {
    /* ... DeckGoAgentFilesResponse shape */
  },
  eventStreams: {
    /* ... DeckGoAgentEventStreamsResponse shape */
  },
};
```

### 4.5 app.jsx（Tweaks 面板 + 状态编排）

每个原型 **必须** 包含 Tweaks 面板，让审阅者可以不修改代码就探索所有状态组合：

```jsx
const TWEAK_DEFAULTS = {
  theme: "dark",
  density: "comfortable",
  // 模块专属状态旋钮
  listState: "ready", // idle / loading / ready / empty / error
  selectedAgent: "main", // null / "main" / "ops" / ...
  activeSection: "overview", // overview / skills / subagents / ...
  detailState: "ready", // loading / ready / error
  overviewDirty: false,
  skillsConflict: false,
  createStep: -1, // -1=closed / 0=identity / 1=runtime / 2=review
  deleteOpen: false,
  streamStatus: "connected", // connected / reconnecting / error
};

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  // ... 根据 tweaks 渲染不同状态
}
```

**Tweaks 面板的意义**：审阅者（人类或设计 agent 做反向签收时）可以在浏览器中探索：

- 空列表长什么样？
- 搜索无结果长什么样？
- 加载中长什么样？
- 保存冲突长什么样？
- 创建第 2 步长什么样？
- Light theme 下长什么样？
- Compact density 下长什么样？

**没有 Tweaks 面板 = 原型不可审阅。**

### 4.6 组件文件

每个 `.jsx` 文件对应一个未来的 `.tsx` 工程文件。组件用 React function component 写，props 用 JSDoc 注释：

```jsx
/** @param {{ agents: Agent[], selected: string|null, onSelect: (id:string)=>void }} props */
function AgentsList({ agents, selected, onSelect }) {
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState("all");
  // ... 真实的 state 管理
}
```

**禁止**：

- 硬编码具体库 API（Zustand / TanStack / React Router）
- 用 CSS selector 模拟状态切换
- 用硬编码字符串替代 mock 数据对象

### 4.7 Section 覆盖要求

**所有在 components.md 组件树中列出的 section，必须在原型中有可渲染的 UI。** 不允许只做"重要"的几个——Claude Code 需要所有 section 的视觉参考才能机械翻译。

| 要求                       | 标准                                |
| -------------------------- | ----------------------------------- |
| 每个 section               | 有真实布局、字段、行、操作按钮      |
| 每个 section 的 loading    | 有 skeleton / spinner 状态          |
| 每个 section 的 error      | 有 error banner + retry             |
| 每个 section 的 empty      | 有 empty state + 引导操作           |
| 可编辑 section 的 dirty    | 有 dirty banner + save 按钮状态变化 |
| 可编辑 section 的 conflict | 有 conflict banner + reload         |

### 4.8 交互覆盖要求

`interactions.md` 中列出的每个交互，必须在原型中可实际触发：

- 列表行点击 → 切换 detail
- Section nav 点击 → 切换内容
- 表单编辑 → dirty 状态
- Save → saving → success/error
- Create → 多步 wizard 走通
- Delete → confirm dialog → deleting → done
- 搜索 → 实时过滤
- 键盘快捷键（至少 Escape / Enter / 数字键切 section）

### 4.9 质量检查清单

在提交 handoff 前，自查：

- [ ] `prototype.html` 是 React 应用（有 `useState`），不是静态 HTML
- [ ] 有 Tweaks 面板，可以切换所有状态
- [ ] 所有 section 都有 UI 内容（不是空壳）
- [ ] mock 数据在 `data.js` 中，是 contract-shaped JSON
- [ ] tokens 从 canonical 引入，不重新定义
- [ ] 组件文件 1:1 映射到 components.md 的组件树
- [ ] 每个可编辑 section 覆盖 clean / dirty / saving / error / conflict 状态
- [ ] 列表覆盖 loading / ready / empty / filtered-empty / error 状态
- [ ] 键盘交互至少覆盖 Escape / Enter / Section 数字键
- [ ] 浏览器打开后可以完整走通"选 agent → 切 section → 编辑 → 保存 → 创建 → 删除"全流程

---

## 5. 对现有 agents handoff 的修正建议

### 保留（质量合格）

- `README.md` — 结构和 contract truth 引用正确
- `components.md` — 组件树合理
- `states.md` — 状态枚举完整（已覆盖 list / selection / detail / editable / create / delete / realtime）
- `interactions.md` — 交互规范基本到位
- `api-usage.md` — DTO shape 和 wrapper 引用正确
- `api-discrepancy.md` — 7 个差距点记录准确
- `implementation-notes.md` — baseline 决策和 adaptation map 有用

### 重做（质量不合格）

- `prototype.html` — 从单文件静态 HTML 重做为多文件交互 React 原型
- 新增 `tokens.css` — mirror canonical，不 inline 重定义
- 新增 `styles.css` — 模块专属样式独立文件
- 新增 `data.js` — contract-shaped mock 数据
- 新增 `app.jsx` — shell + Tweaks 面板
- 新增 `agents-list.jsx` / `agent-detail.jsx` / `sections/*.jsx` — 7 个 section 全部出 UI
- 可选新增 `tokens-proposal.md` — 如果需要新 token

### 修正后的 README.md Status

```
Status: revised v3 — pending implementation
```

---

## 6. 根本教训

| 误解                                   | 正确理解                                                     |
| -------------------------------------- | ------------------------------------------------------------ |
| "高保真" = 视觉像素还原                | "高保真" = **行为保真**（交互、状态机、转换流程的保真度）    |
| prototype = 给人看的截图               | prototype = 给人**点**的应用                                 |
| 只需做"重要"的部分                     | **所有** section 都需要 UI 参考，Claude Code 不负责设计      |
| mock 数据 = 随便写几个字符串           | mock 数据 = contract-shaped JSON，和 DTO 对齐                |
| CSS toggle 模拟状态 = 交互             | React useState 管理状态 = 交互                               |
| design system 兜了审美所以原型可以简单 | design system 兜审美，原型兜**交互设计完成度**——两者是正交的 |

**一句话**：Design system 解决"看起来对不对"，prototype 解决"用起来对不对"。Codex 把两者混为一谈，认为 token 到位了原型就可以简化。实际上 token 越完善，原型越应该聚焦在交互和状态覆盖上，因为视觉不用操心了。

# Interactive Prototype — Skill 原文

> 来源：Claude 内置 skill "Interactive prototype"。
> 用途：把一个 app / 模块做成可点击的高保真原型（mock 数据、假交互、走通流程）。

---

## 完整 Skill 指令原文

Create a fully interactive prototype with realistic state management and transitions. Use React useState/useEffect for dynamic behavior. Include hover states, click interactions, form validation, animated transitions, and multi-step navigation flows. It should feel like a real working app, not a static mockup.

---

## 关键摘要

- **何时用**：要演示给团队/客户看、要走通某个流程、要让 PM 体验交互。
- **不是 Storybook**：是"假装在用真产品"，包含 hover、click、form 校验、多步导航。
- **配合 deck-go**：以后做 deck list、editor、settings 时，先做交互原型走通流程，再移植到源码。

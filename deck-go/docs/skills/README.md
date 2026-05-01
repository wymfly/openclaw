# Design / UI Skills 索引

本目录存放与前端 UI 设计开发相关的内置 skill 原文，便于查阅和回顾。
每个 skill 是 Claude 在执行特定类型设计任务时加载的工作指令。

---

## 文件清单

### 设计类 skill

| 文件                                                                               | Skill 名                    | 用途                                                                                 |
| ---------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------ |
| [`create-design-system.md`](./create-design-system.md)                             | Create design system        | 从零搭建/规范化一个 design-system 项目                                               |
| [`frontend-design-system-engineering.md`](./frontend-design-system-engineering.md) | Design system engineering   | 已有 design system 的工程化整理（5 步法：扫描→tokens→molecules→canvas→反 slop 文档） |
| [`design-system-feedback-loop.md`](./design-system-feedback-loop.md)               | Design system feedback loop | 模块设计 → 季度反哺 design system 的工作流（自由度分层 + 反哺标准 + batch review）   |
| [`ui-requirements-elicitation.md`](./ui-requirements-elicitation.md)               | UI requirements elicitation | 苏格拉底式提问，把模糊"感觉"翻译成可执行 UI 需求（5 维度 × 对比式提问 × 输出 brief） |
| [`frontend-design.md`](./frontend-design.md)                                       | Frontend design             | 没有现有品牌系统时，从零定一个有态度的视觉方向                                       |
| [`interactive-prototype.md`](./interactive-prototype.md)                           | Interactive prototype       | 把模块做成可点击的高保真原型（mock 数据 + 假交互）                                   |
| [`wireframe.md`](./wireframe.md)                                                   | Wireframe                   | 低保真多方案探索（3-5 种显著不同方案对比）                                           |
| [`make-a-deck.md`](./make-a-deck.md)                                               | Make a deck                 | HTML 幻灯片（1920×1080，可导出 PPTX/PDF）                                            |
| [`make-tweakable.md`](./make-tweakable.md)                                         | Make tweakable              | 给设计加实时可调的控制面板                                                           |
| [`animated-video.md`](./animated-video.md)                                         | Animated video              | 时间轴动效（产品演示、转场、loading 状态）                                           |

### 交付类 skill

| 文件                                                         | Skill 名                     | 用途                               |
| ------------------------------------------------------------ | ---------------------------- | ---------------------------------- |
| [`export-pptx-editable.md`](./export-pptx-editable.md)       | Export as PPTX (editable)    | 导出可编辑 PPT（原生文本框/形状）  |
| [`export-pptx-screenshots.md`](./export-pptx-screenshots.md) | Export as PPTX (screenshots) | 导出截图版 PPT（像素准但不可编辑） |
| [`save-as-pdf.md`](./save-as-pdf.md)                         | Save as PDF                  | 印刷友好 PDF                       |
| [`save-standalone-html.md`](./save-standalone-html.md)       | Save as standalone HTML      | 单文件 HTML，离线可看              |
| [`send-to-canva.md`](./send-to-canva.md)                     | Send to Canva                | 推送到 Canva 当可编辑 design       |
| [`handoff-to-claude-code.md`](./handoff-to-claude-code.md)   | Handoff to Claude Code       | 给开发者打包设计交付材料           |

---

## 在 deck-go 中怎么用这些 skill

### 做新模块（deck list / editor / settings）

1. **需求模糊 / 不知道怎么描述** → 先 [`ui-requirements-elicitation`](./ui-requirements-elicitation.md) 把需求问清楚（强烈推荐非设计背景的用户每次新模块都先走这个）
2. **需求清楚** → 直接做（已经有 design-system 了），遵循 [`design-system-feedback-loop`](./design-system-feedback-loop.md) 的自由度分层
3. **需求不清且要探索多方向** → 先 [`wireframe`](./wireframe.md) 出 3-5 版对比
4. **要给团队/客户看** → [`interactive-prototype`](./interactive-prototype.md)
5. **想让 PM 边看边调** → 加 [`make-tweakable`](./make-tweakable.md)

### 维护 / 演进 design system

- 工程化整理一次现有 DS → [`frontend-design-system-engineering`](./frontend-design-system-engineering.md)
- 季度反哺周期管理 → [`design-system-feedback-loop`](./design-system-feedback-loop.md)

### 给同事/客户演示进展

- 做 PPT → [`make-a-deck`](./make-a-deck.md)
- 做产品介绍动画 → [`animated-video.md`](./animated-video.md)

### 不适用于 deck-go 内部模块的

- **`frontend-design`**：那是给"无品牌系统"的项目用的；deck-go 已有 design-system，应优先复用 tokens 而不是另起炉灶。

---

## 怎么主动让 Claude 用这些 skill

默认情况下 Claude 会根据需求自动判断要不要调用 skill。如果想**强制使用**某个 skill，在对话里明说：

> "用 Wireframe skill 做 deck list 的探索"
> "把 settings 做成 Interactive prototype"

这会让 Claude 调出对应 skill 的指令，按那套规则干活。

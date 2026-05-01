# Handoff to Claude Code — Skill 原文

> 来源：Claude 内置 skill "Handoff to Claude Code"。
> 用途：把设计打包成开发者交付材料，让另一个 Claude Code 实例能在真实代码库里实现这个设计。

---

## 完整 Skill 指令原文

Create a comprehensive handoff package so a developer using Claude Code can implement this design in a real codebase.

### Steps

1. **建 handoff 文件夹**：

   ```
   mkdir -p <project-folder>/design_handoff_<feature-name>/
   ```

   名字用功能描述，例如 `design_handoff_onboarding_flow`、`design_handoff_settings_redesign`。

2. **写 README.md** 包含下列章节：

#### README.md 结构

```markdown
# Handoff: <Feature Name>

## Overview

简述这个设计是干嘛的、目标是什么。

## About the Design Files

明确说：bundle 里的文件是**用 HTML 做的设计参考**——展示意图的样子和行为，不是 production code。
任务是**在目标代码库现有环境里**重新实现这些设计（React、Vue、SwiftUI、native 等等），用它已有的模式和库。
如果目标项目还没有环境，选最合适的 framework 实现。

## Fidelity

明确说当前 mocks/prototypes 是：

- **High-fidelity (hifi)**：像素级 mockup，最终颜色/字体/间距/交互。开发者应该用代码库已有库重做到像素级一致。
- **Low-fidelity (lofi)**：wireframe / 粗布局，展示结构和流程。开发者应该当成布局和功能指南，但用代码库已有 design system 做样式。

## Screens / Views

每个屏幕/视图：

- **Name**
- **Purpose**：用户在这做什么
- **Layout**：详细布局描述（grid、flex、宽高、margin、padding）
- **Components**：每个 UI 组件：
  - 位置和尺寸
  - 颜色（精确 hex 如果是 hifi）
  - 字体（family、size、weight、line-height、letter-spacing）
  - border-radius、阴影、边框
  - hover/active/focus 状态
  - 文案（精确文本）

## Interactions & Behavior

- 点击/导航流
- 动画/过渡（duration、easing、property）
- hover、loading、error 状态
- 表单校验规则
- 响应式行为

## State Management

- 需要哪些 state 变量
- state 变化和触发条件
- 数据获取需求

## Design Tokens

所有用到的设计值：

- 颜色（hex）
- spacing scale
- typography scale
- border radius
- shadow

## Assets

图片、icon、其他资源清单及来源。

## Files

项目里包含设计的 HTML/CSS/JS 文件清单，开发者可参考。
```

3. **复制相关设计文件**到 handoff 文件夹（HTML 原型、组件文件等）。

4. **用 `present_fs_item_for_download`** 传 handoff 文件夹路径，让用户下载 zip。

### Important Notes

- 测量、颜色、字体要**极其精确**——开发者要靠这份文档干活
- README 必须开头就说 bundled HTML 是**design references**，目标是在目标 app 已有环境（或合适 framework）里复刻，不是直接 ship HTML
- 用了 Anthropic 品牌资源就提一句让他们用代码库现有 brand system
- 完了**问**用户要不要附设计截图，默认不附
- README 必须**自洽**——一个不在这个对话里的开发者光看 README 就能实现

---

## 关键摘要

- **本质**：写一份给开发者（人或另一个 Claude Code）的"设计规约"——精确到每个组件的 hex/字号/状态。
- **核心强调**：HTML 是"设计参考"不是"生产代码"，要在目标技术栈里重做。
- **交付方式**：`present_fs_item_for_download` 整个 handoff 文件夹（自动打 zip）。

---

## 在 deck-go 里什么时候用

如果未来：

- 你的某个模块设计完了，想交给团队的开发同事在另一个代码库（比如 mobile app、桌面端）实现
- 想让 Claude Code 离线接手某个模块的实现工作

可以用这个 skill 出一份完整 handoff 包。但如果是在 deck-go 仓库内部继续做，不用这个 skill——直接 `str_replace_edit` 改源码就够了。

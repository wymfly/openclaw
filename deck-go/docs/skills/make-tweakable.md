# Make Tweakable — Skill 原文

> 来源：Claude 内置 skill "Make tweakable"。
> 用途：给已有设计加一套实时可调的控制面板（颜色、密度、布局变体）。

---

## 完整 Skill 指令原文

Make sure your design supports Tweaks. If the user tells you what to make tweakable, do that. If not, pick a few high-impact values — key colors, a layout variant, a feature flag, headline copy. Keep the Tweaks panel small and tasteful; hide it completely when Tweaks is off.

---

## 关键摘要

- **何时用**：边看边调参数、对比几个变体、不确定哪个值最好时。
- **实现**：用 `copy_starter_component("tweaks_panel.jsx")`，里面有 `useTweaks()` hook + 各种 Tweak 控件。
- **原则**：选高影响值（主色、布局变体、headline 文案），面板小而精，关闭时完全隐藏。
- **协议**：通过 postMessage 与外壳通信，`__edit_mode_set_keys` 可以把改动持久化到磁盘。

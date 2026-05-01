# Export as PPTX (screenshots) — Skill 原文

> 来源：Claude 内置 skill "Export as PPTX (screenshots)"。
> 用途：把 HTML deck 导出成 `.pptx`，每页是**整张 PNG 截图**——像素准但不可编辑。

---

## 完整 Skill 指令原文

Export an HTML slide deck to a `.pptx` as full-bleed PNG images. Pixel-perfect, not editable. One `gen_pptx` tool call.

### Steps

1. `show_to_user` the deck.
2. Call `gen_pptx`:

```jsonc
{
  "mode": "screenshots",
  "width": 1920,
  "height": 1080,
  "slides": [
    { "showJs": "goToSlide(0)", "selector": "body" },
    { "showJs": "goToSlide(1)", "selector": "body" },
  ],
  "hideSelectors": [".nav", ".progress"],
  "filename": "my-deck",
}
```

`slides[].delay` 默认 600ms。

### Validation

跟 editable 模式一样的 flags，但：

- 不会有 `reset_selector_miss` / `slide_size_mismatch`（因为 iframe 锁定到 width × height）
- 仍要看 `duplicate_adjacent`（showJs 是否真的切换了）

Speaker notes 同样从 `#speaker-notes` 自动读取。

---

## 关键摘要

- **何时用**：editable 模式渲染有问题、字体太复杂、用了 PowerPoint 不支持的 CSS 特效（filter / clip-path / 复杂阴影）。
- **缺点**：不能在 PowerPoint 里改文字。
- **优点**：所见即所得。

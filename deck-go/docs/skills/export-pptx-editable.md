# Export as PPTX (editable) — Skill 原文

> 来源：Claude 内置 skill "Export as PPTX (editable)"。
> 用途：把 HTML deck 导出成 `.pptx`，**带原生 PowerPoint 对象**（可编辑的文本框/形状/图片）。

---

## 完整 Skill 指令原文

Export an HTML slide deck to a `.pptx` with native PowerPoint objects (editable text, shapes, images). One `gen_pptx` tool call does everything: capture, font handling, generation, download.

### What you do

1. **Know the deck.** You probably wrote it. If not, `read_file` the HTML to find: the slide selector, how to navigate (function name? class toggle?), what fonts it uses, whether there's a scaling wrapper.
2. **`show_to_user`** the deck so it's in the user's preview.
3. **Call `gen_pptx`** with the inputs below.
4. **Read the validation flags** in the result and decide if you need to retry.

### gen_pptx inputs

```jsonc
{
  "width": 1920,
  "height": 1080,
  "slides": [
    { "showJs": "goToSlide(0)", "selector": ".slide.active" },
    { "showJs": "goToSlide(1)", "selector": ".slide.active" },
  ],
  "hideSelectors": [".nav", ".progress", "[data-noncommentable]"],
  "resetTransformSelector": ".slide-container",
  "googleFontImports": ["Poppins", "Lora"],
  "fontSwaps": [{ "from": "BrandSans", "to": "Poppins" }],
  "filename": "my-deck",
}
```

`slides[].showJs` runs as a sync expression — don't `await`. Per-slide `delay` (default 600ms) covers the transition.

### If using `<deck-stage>` starter

- `resetTransformSelector: "deck-stage"` — exporter sets `noscale` attribute, component drops its shadow-DOM scale.
- `slides[N].showJs`: `"document.querySelector('deck-stage').goTo(N)"` — 0-indexed.
- `slides[N].selector`: `"deck-stage > [data-deck-active]"`.
- `hideSelectors` 不需要 — overlay 在 shadow DOM 里。

### Speaker notes

自动从 `<script type="application/json" id="speaker-notes">` 读取，按 index 关联。

### Validation flags

读警告，判断是否真的有问题：

- `duplicate_adjacent` — slides 捕获相同。多半是 `showJs` 没切换。
- `slide_size_mismatch` — selector 匹配错了 wrapper。
- `notes_count_mismatch` — speaker-notes 数量 ≠ slides 数量。
- `no_speaker_notes` — 没有 notes，预期就这样的话忽略。
- `fonts_timeout` / `images_failed` / `reset_selector_miss` — 各自含义。

**对用户说话**：不要直接念 flag 名字，用人话描述问题。

### Font strategy

| 指令                 | 输入                                            |
| -------------------- | ----------------------------------------------- |
| 保留品牌字体         | 都不写                                          |
| 用 web-safe 替代     | `fontSwaps: [{from:"BrandFont", to:"Arial"}]`   |
| 用 Google Fonts 替代 | `googleFontImports: [...]` + `fontSwaps: [...]` |

---

## 关键摘要

- **核心调用**：一个 `gen_pptx` 就够，不用手写截图循环。
- **可编辑** vs 截图模式：这是"原生 PPT 对象"，文本/形状能在 PowerPoint 里继续改。
- **看 flags**：返回有 validation flags，需要判断是真问题还是预期情况。

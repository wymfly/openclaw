# Save as PDF — Skill 原文

> 来源：Claude 内置 skill "Save as PDF"。
> 用途：把当前 HTML 设计导出成印刷友好的 PDF。

---

## 完整 Skill 指令原文

Export the current HTML design as a print-friendly HTML file optimized for PDF export.

### Steps

1. **Read the current HTML design file**.

2. **Create a print-ready HTML file**. 路径规则：`source-print.html`（同目录、同 basename + `-print`）。
   - 如果源是 `slides/deck.html` → 写 `slides/deck-print.html`
   - **不要**用 deck title 或 project name 当文件名
   - **不要**写到 project root（如果源在子目录里）——任何目录深度变化都会让所有相对路径失效（`@font-face url(...)`、`<img src>`、CSS `background: url(...)`）

   - 加 `@media print` 样式：
     - `@page { size: landscape; margin: 0.5cm; }` for 16:9 slide-like
     - `-webkit-print-color-adjust: exact` 保留背景色
   - 用 CSS page break：
     - `break-before: page` 起新页
     - `break-inside: avoid` 防止元素被分页切断
     - `break-after: page`
   - 把滚动/交互布局转成静态分页布局
   - 移除 hover、动画、过渡、`overflow: hidden` 裁剪
   - 移除无意义的 JS 交互
   - 保留所有视觉内容——图片、SVG、颜色、字体

   如果用的是未修改的 `deck-stage.js`，deck 已经是 print-ready，直接 copy 然后加 auto-print 脚本。

3. **测试文件** 用 `show_html`，确认无 JS 错误。

4. **加 auto-print 脚本**（在确认布局正确之后才加）：
   - 调 `window.print()`，但要等到布局就绪
   - 等所有字体加载完
   - 如果用 Babel JSX，等 transform 解析完
   - 加 500ms 兜底 delay

5. **调 `open_for_print`** 打开打印预览，传 project-relative 路径。

### Important Notes

- 目标是浏览器"打印 → 另存为 PDF"看起来还原原设计
- slide deck 每张幻灯片占一页
- `-print.html` 是中间产物，**不要** `present_fs_item_for_download` 它——它的相对路径只在 project file server 下生效，单独打开会断。

---

## 关键摘要

- **核心**：写一个 `-print.html` 副本，加 print CSS + auto-print 脚本，调 `open_for_print`。
- **路径强约束**：必须同目录同 basename，否则相对资源全断。
- **不要下载**：`-print.html` 只走 `open_for_print`，不能 download。

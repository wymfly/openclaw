# Save as Standalone HTML — Skill 原文

> 来源：Claude 内置 skill "Save as standalone HTML"。
> 用途：把当前设计导出成**单文件 HTML**——所有依赖内联，离线可看。

---

## 完整 Skill 指令原文

Export the current design as a single self-contained HTML file that works completely offline — no external dependencies.

### How it works

有一个确定性 bundler（`super_inline_html` 工具）能内联所有**HTML 属性里直接引用的资源**：img src/srcset、source src/srcset、video/audio/track src、video poster、SVG `<image href>`/`<use href>`、link href、script src、CSS url() 和 @import、inline style。

但它**抓不到**只在 JS/JSX 字符串里出现的资源，例如：

- React `<img src={"./hero.png"} />`
- styled-components `background: url('./pattern.svg')`
- 动态 import 的脚本

你的工作是把 HTML 准备好让 bundler 抓得到，然后跑它。

### Step 1: Copy & 找代码引用的资源

复制 HTML 文件，读所有 inline script、imported JSX、styled-components、内联 style，找所有以字符串形式出现的资源 URL。

注意：如果项目用了 Anthropic API，离线版**用不了**。如果这是核心功能，**停下来告诉用户**。

### Step 2: 加 ext-resource-dependency meta

每个找到的资源在 `<head>` 加：

```html
<meta name="ext-resource-dependency" content="<url>" data-resource-id="<id>" />
```

然后改代码用 `window.__resources[id]` 替换硬编码 URL：

```html
<meta name="ext-resource-dependency" content="./hero.png" data-resource-id="heroImg" />

<!-- 把 <img src={"./hero.png"} /> -->
<!-- 改成 <img src={window.__resources.heroImg} /> -->
```

**重要**：

- `content` 里的相对路径相对于 HTML 页本身
- 外部 script 自己又引用资源的，那些引用也要 lift 出来
- 漏一个就缺图

### Step 3: 加 thumbnail（必须，bundler 没它就报错）

加一个轻量 SVG 当 splash screen，bundler 解包时显示：

```html
<template id="__bundler_thumbnail" data-bg-color="#0a5e3e">
  <svg viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg">
    <!-- 简化 icon -->
  </svg>
</template>
```

- `data-bg-color` 配页面 bg
- viewBox 让 SVG aspect-fit
- 简单就行——这只是 loading placeholder
- 用设计里的真实色，过渡感更连贯

bundler 会在解包时全屏显示这个，解完替换成真页面；JS 关闭时也作为永久 fallback。

### Step 4: 跑 bundler

```
super_inline_html({ input_path: "<path>", output_path: "My Deck.html" })
```

输出文件取一个友好的人类可读名字。

### Step 5: 内部验证（不是交付步骤）

读 tool result——任何没解析的资源 bundler 会列出来（"asset not found: ./foo.png"）。修了相应引用再 rerun。

然后用 `show_html` 打开 bundled output 检查工作没问题，看 `get_webview_logs`。

### Step 6: 交付（必做）

**必须**用 `present_fs_item_for_download` 指向 inlined HTML 输出。这是唯一正确的交付方式。

- **不要**用 `show_html` / `show_to_user` 当交付——那些是预览工具，用户存不下来
- **不要**问"要不要下载"——直接 `present_fs_item_for_download`

---

## 关键摘要

- **核心**：bundler 抓 HTML 属性里的资源，**抓不到** JS 字符串里的——那些要手动 lift 到 meta + `window.__resources`。
- **必须**有 `<template id="__bundler_thumbnail">`，否则 bundler 拒绝。
- **必须**用 `present_fs_item_for_download` 交付。

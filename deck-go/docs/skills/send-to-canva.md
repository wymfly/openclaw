# Send to Canva — Skill 原文

> 来源：Claude 内置 skill "Send to Canva"。
> 用途：把当前设计推送到 Canva，作为可编辑的 Canva design。

---

## 完整 Skill 指令原文

Export the current design to Canva as an editable design.

Canva imports a self-contained HTML file via URL. The flow is: confirm Canva is connected, bundle the design into a single HTML file, expose it at a public URL, then ask Canva to import from that URL.

### Process

1. **确认 Canva 已连接。** 在可用工具里搜 Canva import tool（如 `canva__create-design-import-job` 或 `canva__import-design-from-url`）。如果没有，**停下来**——不要 bundle。告诉用户去 Connectors 面板连 Canva。可以提议同时准备一份可下载的 self-contained HTML 当 fallback（走步骤 3-4，然后 `present_fs_item_for_download` with `origin: 'canva_fallback'`）。

2. **找到设计文件**（当前打开的 HTML），用 `show_to_user` 确保在 preview 里。

3. **复制副本到 `export/src/`** 用于 bundling：包括它 import 的 JSX 和它引用的 asset 目录（保留相对结构）。下一步的改动会改写资源引用为 `window.__resources`，这只在 bundled output 里存在，所以**不能改原文件**。在副本里：bundler 抓不到 JS/JSX 字符串里的资源——React `<img src={url}>`、CSS-in-JS background、动态 import script、`fetch()`——读副本所有 inline script 和 imported JSX，每个这种引用加 `<meta name="ext-resource-dependency" content="<url>" data-resource-id="<id>">` 到 `<head>`，然后改代码用 `window.__resources.<id>`。再加 `<template id="__bundler_thumbnail">` splash SVG（bundler 没它会拒绝）。存。

4. **Bundle**：`super_inline_html({ input_path: 'export/src/<design.html>', output_path: 'export/<name>.html' })`。读 tool result——有"asset not found"就修引用 rerun。然后 `show_html` 预览 bundled output，看 `get_webview_logs` 检查运行时错误。

5. **拿 public URL**：`get_public_file_url` 传 `export/<name>.html`。

6. **调 Canva import 工具**（步骤 1 找到的那个），传 URL。如果返回 job ID，轮询对应 status 工具直到 import 完成，把结果 Canva design 链接给用户。如果 4xx/auth 错误，**不要重新 bundle**——告诉用户重连 Canva，提议用已经 bundle 好的 HTML 走 `present_fs_item_for_download` with `origin: 'canva_fallback'`。

### Notes

- public URL 短命，拿到后立刻调 import 工具。

---

## 关键摘要

- **本质**：跟 Save as Standalone HTML 一样的 bundle 流程，多一步"拿公开 URL → 调 Canva import 工具"。
- **前置**：用户必须先连 Canva connector，不然没工具可调。
- **失败兜底**：Canva 连不上时，把 bundled HTML 用 `present_fs_item_for_download` 给用户，origin 标记 `canva_fallback`。

# Artifact Preview Enhancement — Functional Test Plan

**Document**: Browser-based functional test specification
**Scope**: Artifact detection, SharedRenderer rendering, download, ArtifactPanel toolbar, panel mutual exclusion
**Test Environment**: Browser (Chrome), Deck Dashboard (`http://localhost:3000`)
**Date**: 2026-03-25
**Prerequisites**: Gateway running (`scripts/dev/deck-dev.sh`), at least one agent configured

---

## 1. ARTIFACT DETECTION (detectArtifact)

**Location**: `dashboard/src/components/panels/chat/artifacts/detectArtifact.ts`
**Trigger**: Agent 调用 write/edit/read 等工具后，ToolResultCard 渲染时自动执行检测

### 1.1 Extension Priority Detection

**前提**: Agent 使用 write 工具写入文件，tool_use.input 包含 file_path

| #   | 测试场景         | 操作                                                   | 预期结果                                                                       |
| --- | ---------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| D1  | .html 扩展名检测 | 让 agent 写一个 HTML 文件（如 `write index.html`）     | ToolResultCard 下方出现 ArtifactCard，显示文件名 `index.html`，语言标签 `html` |
| D2  | .py 扩展名检测   | 让 agent 写一个 Python 文件                            | ArtifactCard 显示文件名，语言标签 `code`                                       |
| D3  | .css 扩展名检测  | 让 agent 写一个 CSS 文件                               | ArtifactCard 显示文件名（如 `styles.css`），语言标签 `code`                    |
| D4  | .json 需内容验证 | 让 agent 写一个名为 `.json` 但内容不是有效 JSON 的文件 | 不应检测为 json artifact（扩展名不覆盖内容验证失败）                           |
| D5  | .csv 需内容验证  | 让 agent 写一个名为 `.csv` 但内容只有 1 行的文件       | 不应检测为 csv artifact                                                        |
| D6  | 无扩展名文件     | 让 agent 写一个无扩展名的文件（如 `Makefile`）         | 如果内容匹配其他启发式则检测，否则检测为 code（因为是 write 工具）             |
| D7  | .svg 扩展名      | 让 agent 写一个 SVG 文件                               | ArtifactCard 显示文件名，语言标签 `svg`                                        |
| D8  | .md 扩展名       | 让 agent 写一个 Markdown 文件                          | ArtifactCard 显示文件名，语言标签 `markdown`                                   |

### 1.2 Image Detection

| #   | 测试场景           | 操作                                               | 预期结果                            |
| --- | ------------------ | -------------------------------------------------- | ----------------------------------- |
| D9  | base64 PNG 检测    | 工具结果包含 `data:image/png;base64,...` 格式内容  | ArtifactCard 出现，语言标签 `image` |
| D10 | base64 JPEG 检测   | 工具结果包含 `data:image/jpeg;base64,...` 格式内容 | ArtifactCard 出现，语言标签 `image` |
| D11 | 非 base64 图片内容 | 工具结果包含普通文本（不是 data URI）              | 不应检测为 image                    |

### 1.3 Content Heuristic Detection (existing, regression)

| #   | 测试场景                 | 操作                                                        | 预期结果                                              |
| --- | ------------------------ | ----------------------------------------------------------- | ----------------------------------------------------- |
| D12 | HTML 内容检测            | 工具结果包含 `<!DOCTYPE html><html>...</html>`              | ArtifactCard 出现，语言 `html`，标题从 `<title>` 提取 |
| D13 | SVG 内容检测             | 工具结果包含 `<svg xmlns="...">...</svg>`                   | ArtifactCard 出现，语言 `svg`                         |
| D14 | Mermaid 检测             | 工具结果包含 ` ```mermaid\ngraph TD\n... ``` `              | ArtifactCard 出现，语言 `mermaid`                     |
| D15 | JSON 检测                | 工具结果是 >40 字符的有效 JSON 对象                         | ArtifactCard 出现，语言 `json`                        |
| D16 | CSV 检测                 | 工具结果是 ≥3 行、列数一致的逗号分割数据                    | ArtifactCard 出现，语言 `csv`                         |
| D17 | Markdown 检测（heading） | 工具结果以 `# Title` 开头                                   | ArtifactCard 出现，语言 `markdown`                    |
| D18 | Markdown 检测（宽松）    | 工具结果 ≥40 字符且包含 1 个 markdown 模式（如 `**bold**`） | ArtifactCard 出现，语言 `markdown`                    |
| D19 | Code 检测（write 工具）  | 使用 write 工具写代码但内容不匹配其他类型                   | ArtifactCard 出现，语言 `code`                        |
| D20 | 短内容不检测             | 工具结果 <20 字符                                           | 不出现 ArtifactCard                                   |
| D21 | 错误结果不检测           | 工具返回 `isError: true` 的结果                             | 不出现 ArtifactCard                                   |

### 1.4 ArtifactCard Title Display

| #   | 测试场景                     | 操作                                          | 预期结果                                                            |
| --- | ---------------------------- | --------------------------------------------- | ------------------------------------------------------------------- |
| D22 | 有 filePath 时显示文件名     | 写入 `/app/src/main.css`                      | ArtifactCard 标题显示 `main.css`（不是完整路径）                    |
| D23 | 无 filePath 时显示 i18n 标签 | 内容检测到 JSON（无 filePath）                | ArtifactCard 标题显示 `JSON 数据`（i18n key `artifactJson` 的翻译） |
| D24 | HTML 从 title 标签提取       | 内容检测到 HTML 且有 `<title>My Page</title>` | ArtifactCard 标题显示 `My Page`                                     |

---

## 2. SHARED RENDERER (渲染)

**Location**: `dashboard/src/components/panels/chat/shared-renderer/SharedRenderer.tsx`
**Trigger**: 用户点击 ArtifactCard 的"打开"按钮后，在右侧面板中渲染

### 2.1 HTML 渲染

| #   | 测试场景       | 操作                                             | 预期结果                                                 |
| --- | -------------- | ------------------------------------------------ | -------------------------------------------------------- |
| R1  | 完整 HTML 页面 | 打开包含完整 HTML（含 CSS/JS）的 artifact        | iframe 中渲染出完整页面，样式和脚本生效                  |
| R2  | HTML 安全沙箱  | 打开包含 `<script>alert('xss')</script>` 的 HTML | iframe 在 `sandbox="allow-scripts"` 中渲染，不影响父页面 |
| R3  | HTML 片段      | 打开只有 `<body>` 标签的 HTML                    | 在 iframe 中正常渲染内容                                 |

### 2.2 SVG 渲染

| #   | 测试场景 | 操作               | 预期结果                               |
| --- | -------- | ------------------ | -------------------------------------- |
| R4  | SVG 图形 | 打开 SVG artifact  | iframe 中居中显示 SVG 矢量图，白色背景 |
| R5  | 大型 SVG | 打开 >100KB 的 SVG | 正常渲染，iframe 可滚动                |

### 2.3 Mermaid 渲染

| #   | 测试场景       | 操作                                           | 预期结果                                           |
| --- | -------------- | ---------------------------------------------- | -------------------------------------------------- |
| R6  | Mermaid 流程图 | 打开包含 `graph TD` 的 mermaid artifact        | iframe 中渲染出可视化流程图（加载 CDN mermaid.js） |
| R7  | Mermaid 序列图 | 打开包含 `sequenceDiagram` 的 mermaid artifact | iframe 中渲染出序列图                              |

### 2.4 JSON 渲染

| #   | 测试场景       | 操作                               | 预期结果                                    |
| --- | -------------- | ---------------------------------- | ------------------------------------------- |
| R8  | JSON 树展示    | 打开 JSON artifact                 | 显示可折叠的 JSON 树，键名和值有不同颜色    |
| R9  | JSON 折叠/展开 | 点击 JSON 树中的 `{` 或 `[` 图标   | 该层级折叠/展开，显示 "N keys" 或 "N items" |
| R10 | 嵌套 JSON      | 打开多层嵌套（>3 层）的 JSON       | 前 2 层自动展开，更深层折叠                 |
| R11 | 无效 JSON      | 打开被检测为 JSON 但解析失败的内容 | 显示"无效 JSON"错误提示（i18n）             |

### 2.5 CSV 渲染

| #   | 测试场景        | 操作                                       | 预期结果                         |
| --- | --------------- | ------------------------------------------ | -------------------------------- |
| R12 | CSV 表格        | 打开 CSV artifact                          | 表头行加粗置顶，数据行可悬停高亮 |
| R13 | CSV 带引号字段  | 打开包含 `"New York, NY"` 等引号字段的 CSV | 引号内的逗号不拆分，列数正确     |
| R14 | 少于 2 行的 CSV | 打开只有表头没有数据的 CSV                 | 显示"无数据"提示（i18n）         |

### 2.6 Markdown 渲染

| #   | 测试场景           | 操作                                     | 预期结果                          |
| --- | ------------------ | ---------------------------------------- | --------------------------------- |
| R15 | Markdown 标题      | 打开包含 `#`/`##`/`###` 的 markdown      | 标题以不同大小渲染                |
| R16 | Markdown 列表+加粗 | 打开包含列表和 `**bold**` 的 markdown    | 正确渲染为有序/无序列表和加粗文字 |
| R17 | Markdown 代码块    | 打开包含 ` ```python ` 代码块的 markdown | 代码块带语法高亮渲染              |

### 2.7 Code 渲染

| #   | 测试场景        | 操作                               | 预期结果                       |
| --- | --------------- | ---------------------------------- | ------------------------------ |
| R18 | Python 代码     | 打开 `.py` 文件的 code artifact    | 代码带 Python 语法高亮和行号   |
| R19 | TypeScript 代码 | 打开 `.ts` 文件的 code artifact    | 代码带 TypeScript 语法高亮     |
| R20 | 无语言提示      | 打开没有 codeLang 的 code artifact | 代码以等宽字体渲染，无特定高亮 |

### 2.8 Image 渲染

| #   | 测试场景     | 操作                            | 预期结果                                     |
| --- | ------------ | ------------------------------- | -------------------------------------------- |
| R21 | PNG 图片     | 打开 base64 PNG image artifact  | 图片居中显示，保持原始比例                   |
| R22 | JPEG 图片    | 打开 base64 JPEG image artifact | 图片居中显示                                 |
| R23 | 大图片自适应 | 打开尺寸大于面板的图片          | 图片缩小适应面板（`object-contain`），不溢出 |

---

## 3. ARTIFACT PANEL (工具栏)

**Location**: `dashboard/src/components/panels/chat/artifacts/ArtifactPanel.tsx`
**Trigger**: 用户点击 ArtifactCard 的"打开"按钮

### 3.1 Panel Structure

| #   | 测试场景   | 操作                           | 预期结果                                                                |
| --- | ---------- | ------------------------------ | ----------------------------------------------------------------------- |
| P1  | 面板打开   | 点击 ArtifactCard 的"打开"按钮 | 右侧面板出现，显示标题栏 + 渲染内容                                     |
| P2  | 标题栏信息 | 查看标题栏                     | 显示 artifact 标题 + 语言标签（大写） + 4 个按钮（下载/复制/全屏/关闭） |
| P3  | 面板宽度   | 拖动面板左边缘                 | 面板宽度可调（由 RightPanel 提供，min 320px ~ max 800px）               |

### 3.2 Download Button

| #   | 测试场景             | 操作                                                          | 预期结果                                                        |
| --- | -------------------- | ------------------------------------------------------------- | --------------------------------------------------------------- |
| P4  | 下载 HTML            | 点击下载按钮（HTML artifact）                                 | 浏览器下载文件，文件名为原始文件名或 `artifact.html`，内容完整  |
| P5  | 下载 JSON            | 点击下载按钮（JSON artifact）                                 | 下载 `.json` 文件，MIME 为 `application/json`                   |
| P6  | 下载 CSV             | 点击下载按钮（CSV artifact）                                  | 下载 `.csv` 文件                                                |
| P7  | 下载 Markdown        | 点击下载按钮（Markdown artifact）                             | 下载 `.md` 文件                                                 |
| P8  | 下载 Code            | 点击下载按钮（Code artifact）                                 | 下载 `.txt` 文件（code 类型默认扩展名）                         |
| P9  | 下载 Image           | 点击下载按钮（Image artifact）                                | 下载二进制图片文件（从 data URI 解码），MIME 与原始图片类型一致 |
| P10 | 下载文件名优先级     | 打开有 source.fileName 的 artifact 并下载                     | 文件名使用 source.fileName（如 `index.html`）                   |
| P11 | 下载文件名 fallback  | 打开无 source.fileName 的 artifact（如内容检测的 JSON）并下载 | 文件名为 `artifact.json`（不使用 i18n key 做文件名）            |
| P12 | 损坏 base64 图片下载 | 打开包含损坏 base64 的 image artifact 并下载                  | 不崩溃，降级为文本文件下载                                      |

### 3.3 Copy Button

| #   | 测试场景     | 操作                         | 预期结果                                          |
| --- | ------------ | ---------------------------- | ------------------------------------------------- |
| P13 | 复制内容     | 点击复制按钮                 | 内容复制到剪贴板，按钮图标从 Copy 变为 Check（✓） |
| P14 | 复制图标恢复 | 点击复制按钮后等待 2 秒      | 按钮图标恢复为 Copy                               |
| P15 | 复制大内容   | 复制 >100KB 的 artifact 内容 | 正常复制到剪贴板，无截断                          |

### 3.4 Fullscreen Button

| #   | 测试场景   | 操作                         | 预期结果                                     |
| --- | ---------- | ---------------------------- | -------------------------------------------- |
| P16 | 进入全屏   | 点击全屏按钮                 | 面板全屏覆盖（`fixed inset-0 z-50`），带边框 |
| P17 | 退出全屏   | 在全屏状态下再次点击全屏按钮 | 面板恢复为右侧面板尺寸                       |
| P18 | 全屏中渲染 | 进入全屏后查看渲染内容       | 内容（iframe/JSON 树等）自适应全屏尺寸       |

### 3.5 Close Button

| #   | 测试场景       | 操作                                         | 预期结果                                    |
| --- | -------------- | -------------------------------------------- | ------------------------------------------- |
| P19 | 关闭面板       | 点击关闭按钮                                 | 右侧面板关闭（`rightPanelMode → "hidden"`） |
| P20 | 关闭后重新打开 | 关闭面板后再次点击同一 ArtifactCard 的"打开" | 面板重新打开，显示相同内容                  |

---

## 4. PANEL MUTUAL EXCLUSION (互斥切换)

**Location**: `dashboard/src/components/panels/chat/ChatPanel.tsx`

### 4.1 Canvas ↔ Artifact 切换

| #   | 测试场景             | 操作                                                               | 预期结果                                                              |
| --- | -------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| M1  | Artifact 覆盖 Canvas | 先打开 Canvas（通过 canvas toggle 按钮），再点击 ArtifactCard 打开 | 右侧面板从 Canvas 切到 Artifact                                       |
| M2  | Canvas 覆盖 Artifact | 正在查看 Artifact 时，agent 推送 `canvas.present`                  | 右侧面板自动从 Artifact 切到 Canvas                                   |
| M3  | Canvas toggle 独立   | 点击输入栏的 Canvas toggle 按钮                                    | Canvas 面板打开/关闭，不影响 Artifact 状态                            |
| M4  | Artifact toggle 独立 | 点击输入栏的 Artifact toggle 按钮                                  | 如有活跃 artifact 则打开/关闭 Artifact 面板；无活跃 artifact 则无反应 |

### 4.2 Session 切换重置

| #   | 测试场景                  | 操作                                                           | 预期结果                                               |
| --- | ------------------------- | -------------------------------------------------------------- | ------------------------------------------------------ |
| M5  | 切换 session 关闭面板     | 正在查看 Artifact 时，点击 SessionSidebar 切换到另一个 session | 右侧面板关闭（`mode → "hidden"`），activeArtifact 清除 |
| M6  | 切换后新 session artifact | 切换到新 session 后，该 session 有 artifact 卡片               | 点击打开正常工作，显示新 session 的 artifact           |

### 4.3 Toggle 按钮状态

| #   | 测试场景             | 操作                    | 预期结果                                         |
| --- | -------------------- | ----------------------- | ------------------------------------------------ |
| M7  | Canvas toggle 高亮   | Canvas 面板打开时       | Canvas toggle 按钮变为主色调（`var(--primary)`） |
| M8  | Artifact toggle 高亮 | Artifact 面板打开时     | Artifact toggle 按钮变为主色调                   |
| M9  | 两个 toggle 互斥高亮 | 从 Canvas 切到 Artifact | Canvas toggle 变灰，Artifact toggle 变蓝         |

---

## 5. TOOLRESULTCARD INTEGRATION

**Location**: `dashboard/src/components/panels/chat/blocks/ToolResultCard.tsx`

### 5.1 filePath Extraction

| #   | 测试场景             | 操作                                                            | 预期结果                                         |
| --- | -------------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| T1  | file_path 参数       | Agent 使用 `write` 工具，input 含 `file_path: "/tmp/test.html"` | detectArtifact 收到 filePath，扩展名优先检测生效 |
| T2  | path 参数            | Agent 使用 `edit` 工具，input 含 `path: "/tmp/test.py"`         | detectArtifact 收到 filePath                     |
| T3  | filePath (camelCase) | Agent 使用工具，input 含 `filePath: "/tmp/test.css"`            | detectArtifact 收到 filePath（camelCase 兼容）   |
| T4  | 无路径参数           | Agent 使用 bash 工具（无 file_path/path/filePath）              | filePath 为 undefined，回退到内容启发式检测      |

### 5.2 ArtifactCard in Message Flow

| #   | 测试场景       | 操作                                         | 预期结果                                                            |
| --- | -------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| T5  | 卡片渲染位置   | 查看包含 artifact 的 ToolResultCard          | ArtifactCard 出现在 ToolResultCard 下方                             |
| T6  | 卡片样式       | 查看 ArtifactCard                            | 浅蓝底色（`primary-muted`），Play 图标，文件名/类型标签，"打开"按钮 |
| T7  | 错误结果不显示 | 工具返回 isError=true 的结果                 | 不显示 ArtifactCard                                                 |
| T8  | 多个 artifact  | 同一 session 中多个工具结果都检测到 artifact | 每个 ToolResultCard 下都有对应的 ArtifactCard，点击任一都能打开     |

---

## 6. DARK MODE & RESPONSIVE

### 6.1 Dark Mode

| #   | 测试场景           | 操作                         | 预期结果                                                                              |
| --- | ------------------ | ---------------------------- | ------------------------------------------------------------------------------------- |
| V1  | ArtifactCard 深色  | 切换到深色模式               | ArtifactCard 的背景色、文字色跟随主题（CSS 变量）                                     |
| V2  | ArtifactPanel 深色 | 深色模式下打开 Artifact 面板 | 标题栏、工具栏按钮、边框颜色跟随主题                                                  |
| V3  | JSON 树深色        | 深色模式下查看 JSON artifact | 键名/字符串/数字颜色跟随主题（使用 CSS 变量如 `--success`, `--primary`, `--warning`） |
| V4  | CSV 表格深色       | 深色模式下查看 CSV artifact  | 表头背景、边框、悬停色跟随主题                                                        |

### 6.2 Responsive

| #   | 测试场景     | 操作                              | 预期结果                                    |
| --- | ------------ | --------------------------------- | ------------------------------------------- |
| V5  | 窄屏右侧面板 | 在 768px 宽度下打开 Artifact 面板 | 面板有最小宽度（320px），不遮挡消息列表全部 |
| V6  | 全屏在移动端 | 在移动端点击全屏按钮              | 面板全屏覆盖整个视口                        |

---

## 7. I18N (国际化)

| #   | 测试场景        | 操作                                       | 预期结果                                                                      |
| --- | --------------- | ------------------------------------------ | ----------------------------------------------------------------------------- |
| I1  | 中文 UI         | 使用中文 locale                            | 按钮 tooltip 显示"下载"/"复制"/"全屏"/"关闭"，"打开"按钮文字正确              |
| I2  | 英文 UI         | 使用英文 locale                            | 按钮 tooltip 显示 "Download"/"Copy"/"Fullscreen"/"Close"，"Open" 按钮文字正确 |
| I3  | i18n key 做标题 | 内容检测到 JSON（title 为 `artifactJson`） | ArtifactCard 标题显示翻译后的 `JSON 数据` 而非 raw key                        |
| I4  | 非 i18n 做标题  | 扩展名检测的文件（title 为 `main.css`）    | ArtifactCard 标题直接显示 `main.css`                                          |

---

## Test Summary

| 类别                          | 测试数 |
| ----------------------------- | ------ |
| 1. Artifact Detection         | 24     |
| 2. SharedRenderer Rendering   | 23     |
| 3. ArtifactPanel Toolbar      | 20     |
| 4. Panel Mutual Exclusion     | 9      |
| 5. ToolResultCard Integration | 8      |
| 6. Dark Mode & Responsive     | 6      |
| 7. I18N                       | 4      |
| **Total**                     | **94** |

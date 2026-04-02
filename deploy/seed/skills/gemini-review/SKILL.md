---
name: gemini-review
description: Use when reviewing code quality, frontend UI/UX design, performing technical research, or contributing creative design ideas during brainstorming. Triggers on code review, frontend implementation review, visual comparison, responsive layout audit, design system compliance check, technology evaluation, or creative solution design.
---

# Gemini Review

Use Gemini CLI for **代码审查**、**设计质量审查**、**技术调研** 和 **方案设计创新**。与 codex-review 形成双重审查视角。

**前置步骤（审查场景）：** 用 Read 工具读取 `~/.claude/skills/review-protocol.md`，按其流程组装 Review Request 和审查 Prompt。

本 skill 定义 Gemini **专有的**命令语法和独有能力。Review Request 格式、审查指令、竞争模式、多轮协议、结果处理均见 `review-protocol.md`（单一真源）。

---

## 角色定位

```
Gemini = 全能审查者 + 创意设计者
  ├── 代码/设计/计划/OpenSpec 审查：与 Codex 并行双重覆盖（见 review-protocol.md）
  ├── UI/UX 设计审查（独有：多模态截图分析）
  ├── 技术调研（独有：Google Search grounding）
  └── 方案设计创意（独有：brainstorming 阶段，不用竞争模式）
```

---

## 命令参考

```bash
gemini -s -p "<prompt>" -o text                              # 基本模式
gemini -s --include-directories <dir> -p "<prompt>" -o text  # 扩展可访问目录
```

**关键参数：**

- `-s` sandbox — 审查场景**必须使用**
- `-p` 非交互 — 自动执行
- `-o text` 纯文本输出
- `--include-directories` — 扩展可访问目录（截图在 /tmp 时）

**图片传递：** 无 `-f`/`--file` 参数。在 prompt 中指示读取：

```bash
gemini -s -p "Read the image file screenshots/page.png and analyze..." -o text
# 工作区外 → --include-directories /tmp/screenshots
```

---

## Prompt 组装（审查场景）

按 `review-protocol.md` Step 3 的通用结构组装 prompt，通过 `gemini -s -p` 发送。

### 代码审查

```bash
gemini -s -p "你是资深软件工程师，负责代码审查。

<Review Request — Code Review（protocol 类型 A，完整 6 段）>

<代码审查指令（protocol 标准指令）>

\`\`\`diff
$(cat /tmp/review-scope.diff)
\`\`\`

<竞争上下文（protocol）>" -o text
```

### 设计文档 / 计划 / OpenSpec 审查

结构同上，替换 Review Request 类型和审查指令（类型 B/C/D），文档内容用 `$(cat <file>)` 内联。

### 大 Diff 处理

| Diff 大小    | Gemini 策略                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| < 30KB       | 内联到 prompt                                                                                                          |
| 30KB - 100KB | 保存到 `/tmp/review-scope.diff`，prompt 中指示 `Read the file /tmp/review-scope.diff`，加 `--include-directories /tmp` |
| > 100KB      | 按文件/模块拆分多次审查，每次 < 30KB                                                                                   |

---

## 多轮执行

按 `review-protocol.md` 多轮审查协议执行。每轮的 **Gemini 命令**：

```bash
# R2/R3
gemini -s -p "<R2/R3 Prompt（protocol 模板，含原始 Review Request + 前轮上下文）>

\`\`\`diff
$(git diff <prev-review-commit>..HEAD -- $REVIEW_FILES)
\`\`\`

<竞争上下文>" -o text
```

---

## 独有能力

以下场景是 Gemini 的独有能力，**不使用 Review Request 模板**，有独立的 prompt 格式。

### UI/UX 设计审查

```bash
gemini -s -p "你是资深 UI/UX 设计师。Read the image file <path> and evaluate:
1) Visual hierarchy and information architecture
2) Color harmony and brand consistency
3) Spacing rhythm and typography
4) Animation/interaction quality
5) Overall professionalism

Rate each 1-10 with specific improvement suggestions including concrete values.
[竞争上下文]" -o text
```

### 截图 vs 设计稿比对

```bash
gemini -s -p "你是 UI 审查专家。Read two image files: design spec at <design-path> and implementation screenshot at <impl-path>. Compare:
1) Element alignment and spacing accuracy
2) Color value accuracy
3) Font size and line-height correctness
4) Border-radius, shadow, and detail fidelity
5) Missing or extra elements

Rate severity: Critical/Major/Minor with fix suggestions." -o text
```

### 响应式断点审查

```bash
gemini -s -p "你是移动端 UI 专家。Read the image files at <desktop-path>, <tablet-path>, <mobile-path>. Evaluate:
1) Layout reflow quality across breakpoints
2) Touch target sizes (>=44px) on mobile
3) Content readability at each width
4) Horizontal overflow issues
5) Consistent visual hierarchy across all sizes." -o text
```

### 方案设计创意（brainstorming 阶段，不用竞争模式）

```bash
gemini -s -p "你是有丰富经验的产品架构师，以创新思维著称。当前正在设计：<功能描述>。
已有初步方案：<当前方案摘要>。

请从以下角度提供创意输入：
1) 有没有完全不同的实现思路？
2) 业界类似产品如何解决这个问题？（请搜索最新案例）
3) 用户体验上有没有更令人惊喜的交互方式？
4) 技术上有没有更优雅的架构？
5) 有什么潜在风险是当前方案没有考虑的？

大胆想象，不受限于当前框架。" -o text
```

### 技术调研（Google Search grounding）

```bash
gemini -s -p "Search for the latest 2025-2026 information about <topic>. Focus on:
1) Latest community evaluations and benchmarks
2) Compatibility with <tech-stack>
3) Bundle size and performance data
4) Maintenance activity and community health

Provide source links for all claims." -o text
```

---

## 降级策略

### 触发条件（任一即降级）

- 退出码非 0
- 输出包含 `rate limit`、`quota`、`429`、`503`、`timeout`、`RESOURCE_EXHAUSTED`
- 命令超时（> 120s 无响应）

### 按场景降级

| 原始场景                         | 降级方案                          | 说明                                                                |
| -------------------------------- | --------------------------------- | ------------------------------------------------------------------- |
| **代码/设计/计划/OpenSpec 审查** | Claude Code sub-agent             | 使用 `review-protocol.md` 降级 Prompt 模板，嵌入完整 Review Request |
| **UI/设计审查**                  | Claude Code sub-agent + 截图描述  | 质量显著下降，无多模态能力                                          |
| **技术调研**                     | Claude Code WebSearch 工具        | 缺少 Google Search grounding 深度                                   |
| **方案创意**                     | Claude Code sub-agent（创意模式） | 使用 `review-protocol.md` 方案创意降级 Prompt 模板                  |

降级结果标记 `[degraded: gemini → claude-sub-agent]` 或 `[degraded: gemini → websearch]`。

---

## Integration Points

| 流程节点         | 场景                      | Review Request?    |
| ---------------- | ------------------------- | ------------------ |
| brainstorming    | 方案设计创意 + 技术调研   | 不需要（独有能力） |
| OpenSpec 提案后  | OpenSpec 审查             | 类型 D             |
| brainstorming 后 | 设计文档审查              | 类型 B             |
| writing-plans 后 | 实施计划审查              | 类型 C             |
| 实现后           | 代码审查（与 Codex 并行） | 类型 A             |
| 实现后（前端）   | UI/UX 设计审查            | 不需要（独有能力） |
| verification     | 截图 vs 设计稿比对        | 不需要（独有能力） |

---

## Gotchas

- **没有 `review` 子命令** — 所有审查都用 `gemini -s -p "..." -o text`
- **没有 `-f`/`--file` 参数** — 在 prompt 中指示读取文件
- `-s` sandbox **必须用于审查场景**
- 只能读取**工作区目录**内的文件 — 工作区外用 `--include-directories`
- 自动加载项目 `GEMINI.md`（等同于 `CLAUDE.md`）
- 大 diff（> 30KB）不要内联 — 保存到文件后指示读取
- 技术调研结果需交叉验证 — 用 `gh api`/`npm view` 验证硬数据
- 竞争模式只在**审查**时加；brainstorming 创意不加

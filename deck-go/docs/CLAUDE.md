# deck-go / docs

> 这是 deck-go 项目的设计与工程文档目录。本文件是给 **Claude（AI 协作者）** 看的目录索引。
> 所有文档都按"用途"而非"格式"分组。看这一份就能定位需要的文档。

> **Protocol version:** `protocol-v1`（2026-05-01 locked，OpenSpec change `deck-go-frontend-protocol-v1`）
>
> **deck-go 仓库的协议三入口（必须互引）：**
> - **本文件** (`docs/CLAUDE.md`) — 项目文档导航；先读这里
> - [`../frontend-new/CLAUDE.md`](../frontend-new/CLAUDE.md) — 真实工程协议（Claude Code 在新工程区的工作约定，**新工作落这里**）
> - [`../frontend-handoff/CLAUDE.md`](../frontend-handoff/CLAUDE.md) — 双 agent 协作协议（设计 Agent 与 Claude Code 协作的契约）
>
> 老入口（已冻结）：
> - [`../frontend/CLAUDE.md`](../frontend/CLAUDE.md) — ⚠️ **frozen**；新工作转到 `frontend-new/CLAUDE.md`
>
> **解耦的支撑文档（CLAUDE.md 链接它们而不嵌入项目细节）：**
> - [`./project/stack-decisions.md`](./project/stack-decisions.md) — 当前技术栈选择（locked / defaulting / pending）
> - [`./project/current-state.md`](./project/current-state.md) — 项目代码现状人类可读快照（5 分钟入门）

---

## 仓库整体结构（deck-go 根）

```
deck-go/
├── docs/                         ← 文档（你正在这里）
├── frontend-new/                 ← 真实工程（新）— Claude Code 维护，**新工作落这里**
│   └── CLAUDE.md                  · 真实工程协议（protocol-v1）
├── frontend/                     ← 老真实工程 — ⚠️ **frozen**（包含 chat pilot 工程代码、36 atoms canonical 等，等待协议化迁移）
│   └── CLAUDE.md                  · 冻结提示，引导切换
├── frontend-handoff/             ← 设计 ↔ 工程交接区 — 设计 Agent 维护
│   ├── CLAUDE.md                  · 双 agent 协作协议（protocol-v1）
│   ├── design-system/             · DS 提议层（tokens mirror + atoms + preview + proposals）
│   ├── modules/                   · 已定稿的模块交接包队列
│   └── explorations/              · 设计探索区（Claude Code 不读）
└── scripts/
    └── check-tokens-drift.sh      · tokens 双向一致检查（protocol-v1 增强 #7）
```

## docs 目录结构

```
docs/
├── CLAUDE.md                     ← 你正在看的这个（目录索引）
│
├── project/                      ← deck-go 项目专属的方案、记录、计划
│   ├── stack-decisions.md          · ⭐ 当前技术栈决策（解耦自协议）
│   ├── current-state.md            · ⭐ 项目代码现状人类可读快照（5 分钟入门）
│   └── design-system-implementation-plan.md
│
├── skills/                       ← 内置 skill 原文 + 设计工作流方法论
│   ├── README.md                 ← skill 清单和使用指南
│   ├── create-design-system.md
│   ├── frontend-design-system-engineering.md
│   ├── design-system-feedback-loop.md
│   ├── ui-requirements-elicitation.md
│   ├── frontend-design.md
│   ├── interactive-prototype.md
│   ├── wireframe.md
│   ├── make-a-deck.md
│   ├── make-tweakable.md
│   ├── animated-video.md
│   ├── export-pptx-editable.md
│   ├── export-pptx-screenshots.md
│   ├── save-as-pdf.md
│   ├── save-standalone-html.md
│   ├── send-to-canva.md
│   └── handoff-to-claude-code.md
│
└── design-references/            ← 视觉参考卡（光谱锚点）
    ├── README.md
    ├── claude-ai.html
    ├── linear.html
    └── stripe.html
```

---

## 三类文档的关系

| 类别 | 是什么 | 什么时候读 |
|---|---|---|
| **`project/`** | deck-go 这个具体项目的实施方案、审计、决策记录 | 在 deck-go 仓库里干活时 |
| **`skills/`** | 通用工作方法（不绑定 deck-go），含设计技法和交付方式 | 不知道"怎么做"时查方法 |
| **`design-references/`** | 视觉味道样板（Claude.ai / Linear / Stripe 三档光谱） | 不知道"做成什么样"时查锚点 |

简单记忆：
- **怎么做** → `skills/`
- **做成什么味道** → `design-references/`
- **deck-go 自己的事** → `project/`

---

## 文件清单（按用途分组）

### 🏗️ 项目专属方案与记录（`project/`）

| 文件 | 用途 |
|---|---|
| [`project/stack-decisions.md`](./project/stack-decisions.md) | ⭐ 当前技术栈决策（locked / defaulting / pending）。协议层不绑库——具体库选择记在这里。任何 agent 想知道"现在用什么 routing / state / i18n"先读这份。 |
| [`project/current-state.md`](./project/current-state.md) | ⭐ 项目代码现状人类可读快照——5 分钟入门读物。chat pilot done、36 atoms canonical、tokens 实际内容、24 legacy panel 列表。**它是快照，不是 journal**——过期 1-2 个版本不算 bug。 |
| [`project/design-system-implementation-plan.md`](./project/design-system-implementation-plan.md) | deck-go design-system 工程化方案——建 molecules、review canvas、README、收敛旧 token。可直接喂给 Claude Code 在仓库本地执行。 |
| [`project/codex-prototype-quality-assessment.md`](./project/codex-prototype-quality-assessment.md) | Codex agents 原型质量评估——问题定位 + 正确做法指南 + 质量检查清单。任何 agent 做 handoff 原型前必读。 |

> 以后这个目录会增加：`design-system-audit.md`（现状审计）、`api-contract.md`（API 契约）、各模块的设计 brief 和决策记录等。

---

### 🛠️ 设计与工作流 skill（`skills/`）

详见 [`skills/README.md`](./skills/README.md)。一句话索引：

**做新模块时按这个顺序看**
1. 需求模糊 → [`ui-requirements-elicitation`](./skills/ui-requirements-elicitation.md)（苏格拉底式提问，对比式选择）
2. 需求清楚要直接做 → 遵循 [`design-system-feedback-loop`](./skills/design-system-feedback-loop.md) 的自由度分层
3. 要探索多方向 → [`wireframe`](./skills/wireframe.md)（3-5 版低保真对比）
4. 要给团队看 → [`interactive-prototype`](./skills/interactive-prototype.md)
5. 想让 PM 边看边调 → [`make-tweakable`](./skills/make-tweakable.md)

**design system 相关**
- 从零搭建 DS → [`create-design-system`](./skills/create-design-system.md)
- 已有 DS 工程化整理 → [`frontend-design-system-engineering`](./skills/frontend-design-system-engineering.md)
- 持续演进 / 季度反哺 → [`design-system-feedback-loop`](./skills/design-system-feedback-loop.md)

**演示与交付**
- 做 PPT → [`make-a-deck`](./skills/make-a-deck.md)
- 做演示动画 → [`animated-video`](./skills/animated-video.md)
- 导出 PPTX / PDF / HTML / Canva → 见 `skills/export-*` 和 `skills/save-*`
- 给开发者打包交付 → [`handoff-to-claude-code`](./skills/handoff-to-claude-code.md)

**不适用于 deck-go 的**
- [`frontend-design`](./skills/frontend-design.md) 是为"无品牌系统"项目用的；deck-go 已有 DS，优先复用 tokens。

---

### 🎨 视觉参考卡（`design-references/`）

详见 [`design-references/README.md`](./design-references/README.md)。三张卡构成视觉光谱锚点：

| 文件 | 锚点 | 在光谱上的位置 |
|---|---|---|
| [`design-references/claude-ai.html`](./design-references/claude-ai.html) | Claude.ai | 浅暖 / L1-L2 宽松 / 衬线点缀 / 内容焦点 / 人文温度 |
| [`design-references/stripe.html`](./design-references/stripe.html) | Stripe | 浅冷 / L2-L3 中等 / Inter sans / 文档级精致 / 数据可信 |
| [`design-references/linear.html`](./design-references/linear.html) | Linear | 暗色 / L3-L4 紧凑 / sans-only / 命令面板 / 工程冷峻 |

**怎么用**：
- 做需求 elicitation 时，问"你要 Claude.ai / Stripe / Linear 哪一档密度"，比让用户描述快 10 倍
- 做新模块时，先指认味道锚点，再开工
- 看到新产品觉得"这个味道好"，告诉 Claude 加一张

---

## 给 Claude 的工作约定

1. **不要在 docs 根目录放新文件**。新建文档时按用途归到 `project/` / `skills/` / `design-references/` 之一。
2. **新增文档要更新本文件的清单**。让索引始终是真实的目录地图。
3. **`skills/` 里的文件是 skill 原文**，不要改它们的内容；要扩展工作方法应该写新文件并加到 `skills/README.md`。
4. **`project/` 里的文件是 deck-go 专属**，可以自由演进，加 audit、API 契约、模块 brief 等。
5. **三张视觉参考卡是"工业标杆复刻"**，是 deck-go 设计味道的光谱锚点，不轻易改动；要扩展应该新增第 4、5 张卡。

---

## 设计 Agent ↔ Claude Code 协作模式

deck-go 采用双 Agent 协作：

| 角色 | 工作目录 | 职责 |
|---|---|---|
| **设计 Agent**（当前 Claude） | `../frontend-handoff/` | 视觉、交互、状态机原型；产出 handoff 包；提议 token / atom 变更 |
| **Claude Code** | `../frontend-new/` | 真实工程实现；接 API；写 store；写测试；最终决策权 |
| **人类（你）** | 仲裁 | 拍板设计变体、token 变更；推动节奏 |

**流向**：设计 Agent 在 `frontend-handoff/modules/<module>/` 产出 6 件套（README / prototype.html / components.md / states.md / interactions.md / api-usage.md）→ Claude Code 读包 → 翻译到 `frontend-new/src/`。

详细协议见 [`../frontend-handoff/CLAUDE.md`](../frontend-handoff/CLAUDE.md)。

---

## Status — 当前 deck-go 工作进展

- ✅ **协议 v1 落定 + 经 chat 模块自我验证**（OpenSpec changes `deck-go-frontend-protocol-v1` + `deck-go-chat-protocol-pilot`）：三份 CLAUDE.md 互引、栈决策解耦到 `project/stack-decisions.md`、tokens 反向同步 + drift 防护脚本、协议加 8 条结构性增强；chat 模块作为协议第一个真实样本完成 6 件套反推 + 物理迁移到 `frontend-new/`，**协议在真模块复杂度下可执行已验证，可开放给其他模块**（agents / settings / models 等按 forward 流程依次进场）
- ✅ chat 模块设计开发完成（6 件套在 `../frontend-handoff/modules/chat/`；工程代码已迁移到 `../frontend-new/src/components/panels/chat/`；老 `../frontend/src/components/panels/chat/` 保留可运行）
- ✅ tokens 完成（44 个 `--ds-*` 变量，dark/light，老 `frontend/src/design-system/tokens/index.css`）
- ✅ 36 atoms 完成（扁平结构 `Badge.tsx + badge.css`，不是三件套）
- ✅ 5 hooks 完成（use-click-outside / use-escape-close / use-focus-trap / use-keyboard-nav / use-popover）
- ✅ 视觉光谱锚点确立（3 张参考卡）
- ⏳ **下一步**：24 个 legacy panel 协议化重做（agents / models / channels / sessions / logs / settings / etc.）—— 等 chat pilot 验证协议在真实复杂度下可执行后逐个开
- ⏳ molecules / review canvas / 收敛旧 token，方案见 [`project/design-system-implementation-plan.md`](./project/design-system-implementation-plan.md)

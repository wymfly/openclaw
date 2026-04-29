# Claude Design 工具评估 + deck-go 全模块重设计 program 优先级反转

**Status:** Decision-grade artifact (pilot retrospective)
**Date:** 2026-04-29
**Owner:** wangym
**Audience:** 任何后续准备做 deck-go 模块 UI 重设计的 session

---

## 0. 这份文档的位置

deck-go chat 页面是"全模块 UI 重设计 program"的 pilot。pilot 的目的**不是产出 chat 重设计本身**，而是回答：

> Claude Design（claude.ai/design 的 prompt-driven UI 原型生成器）能不能成为"AI 设计 + AI 实施"工作流的一环？什么前提下能？

本文档把 pilot 的实证、评估和**反直觉的结论**沉淀下来，让后续任何模块的重设计起步前先读一遍，避免重复走错。

---

## 1. Pilot 经过

| 阶段                          | 产出                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 准备 spec                     | `2026-04-29-chat-ui-redesign-design.md`（743 行，组件 + 状态清单。**有视觉处方倾向**——后被识别为越界）                         |
| 用户用 Claude Design 生成原型 | bundle 下载到 `https://api.anthropic.com/v1/design/h/-zkx5utSDiZVD8YjZt51zg`（gzipped tar，14 个文件，约 3000+ 行 jsx/css/js） |
| 评估输出                      | 本文档第 2 节                                                                                                                  |
| 反思工作流前提                | 第 3-5 节                                                                                                                      |

**关键时序**：用户在拿到 Claude Design 输出前就明确"Claude Design 输出不是给我原样照搬的"——这个判断在评估之后被实证证实，不是事后合理化。

---

## 2. Claude Design 输出评估

**总体评级：B+**——高于 1-shot 工具均线，但**未达可直接落地**。

### 2.1 强项（可直接利用的资产）

1. **状态覆盖动了真功夫**
   bundle 内 State Matrix 视图覆盖：SSE 3 态、ContextBar 3 档（30/72/96%）、Block 矩阵 17 张含 tool pair ok/error、Composer 7 态、Canvas 4 + Artifact 5 medium、sidebar 全/折叠、subagent 树、compaction notice。**没漏边缘态**——这是 1-shot 工具最容易翻车的地方。

2. **替用户拍板了 §13 三个待决项，且选择合理**
   - User 消息右对齐 IM bubble（不是含糊地"两版都给"）
   - Tool 卡 paired 单卡（split 留作 Tweak）
   - Result viewType 用 segmented control 替代 ShowRaw 按钮（**这个改进是 design 自己加的，spec 没让加**）
     有 UX opinion，不滑头。

3. **Token 系统分层成熟**
   bg-0..3 / text-1..4 / accent + dim + bg / success/warn/error 各带 bg 变体 / code/diff 独立色板 / density 通过 `[data-density="compact"]` 覆盖。和 Material/Radix 同级别的设计系统思路。

4. **Tool-pair 是真创新**
   合并 `tool_use + tool_result`，error 整卡红边——比当前两层 `<details>` 干净，且和 Linear / Vercel 内部工具的方向一致。

5. **Tweaks 面板是好交付方式**
   18 维 live 切换比 50 张静态稿更便于评审；30 秒内可验证某个边缘态。值得作为后续设计交付的标配。

6. **响应式断点逻辑做了非平凡决定**
   spec §13.1 提的"窄屏右抽屉浮窗化"它实现了——`@media (max-width: 1279px)` + `position: absolute` + `z-index: 30`，避免主区被挤压到不可读。

### 2.2 弱项（必须警惕的）

1. **完全没有 Gateway 真相基础**
   - `meta.cacheHit` 和 `meta.cost` 在 deck-go `RunMetadata` 里**根本不存在**
   - subagent tree 用 `children` 递归，但 store 里实际是 flat 列表带 `parentRunId`
   - `tool_result.forTool` 字段是它编的，真实字段是 `toolUseId`
   - `tool_use.input.cwd` 当前 ToolUseCard 不显示
     **它在猜数据模型**——这正是暂停 4-stream Gateway 研究后必然出现的债。

2. **i18n 完全缺席**
   所有文案硬编码英文：`"you"`, `"main"`, `"Allow once"`, `"Disconnected from gateway"`。spec 附录 A 列了所有 `chat.*` / `approvals.*` key，design **一个没用**。说明它把 spec 当 inspiration，不当 contract。

3. **a11y 有明显漏洞**
   - `.block-head.static`（tool_result header）用 `<div>` 不是 `<button>`，键盘不可达
   - `result-tabs` 有 `role="tablist"` 但子项没 `role="tab"` 也没 `aria-controls`
   - approval countdown 没 `aria-live`
   - `chip-toggle` 没 `aria-pressed`
   - 流式光标没 `aria-busy`
     review 会被打回的级别。

4. **最有信息量的视图——动画时间线——没做**
   spec §7 明确要 "Tool ladder T0-T10 8-10 帧动效"，design 给的是静态 grid。状态切换之间的过渡才是 chat 的 UX 命脉，光看截图无法评估。

5. **几个值得二次确认的视觉决定**
   - sidebar 用 `bg-0`（**比** main 的 `bg-1` **更暗**）——和大多数主流 IDE 反了
   - approval dialog 满宽塞进 composer-frame 内，把 textarea 完全顶走
   - `.bash-stream` 用 `padding-left: 80px` 让位给绝对定位标签，窄宽度下糊
   - 密度 `compact` 只改了行高/字号/几个 padding，**没改 button 高度、icon 尺寸**

6. **JSX 实现质量参差**
   `key={i}` 反 pattern；`useStateA/useStateT/useStateC` 别名（Babel-in-browser 多文件冲突 workaround）；`Object.assign(window, ...)` 暴露 globals。**全部不能直接搬到 deck-go**，要逐组件 TS 化重写。

7. **CSS 特异性脆弱**
   混用 data 属性 + class composition + 末尾 density 覆盖。chat 这种规模能撑住，但作为**全模块 pilot**——5 个面板共享后会出现不可预测的样式冲突。

8. **几处过度发明**
   composer 工具栏的 "canvas" / "artifact" chip-toggle 和右抽屉的 mode 控制是两套逻辑，会和现有 `CanvasToggle/ArtifactToggle` 行为冲突。

### 2.3 能力地图

```
Claude Design 擅长          Claude Design 不擅长
─────────────────────       ─────────────────────────
状态全集枚举                数据契约（自由发挥编字段）
Token 设计系统              i18n 集成
视觉 UX 决断                a11y
Tweaks live preview         动画/时间线
单页 prototype 输出         直接落地代码（必须重写）
非平凡响应式决定            源码兼容性
                            既有 store/类型系统贴合
```

---

## 3. 反直觉的关键洞察：什么时候 Claude Design 才能"直接落地"

用户在评估完后给出的 reframing：

> Claude Design 的输出不是给原样照搬的，**除非我们给它源代码作为上下文**——也就是说**除非 go 服务完全适配了 OpenClaw**，前端代码结构也已稳定，让 Claude Design 负责做视觉和 UX。

这个观察被 Claude Design 产品本身印证：

打开 claude.ai/design，左侧栏 "Start with context" 区域有四个上下文入口：

- **Design System**——拉一个已知 token 库
- **Add screenshot**——给基线截图
- **Attach codebase**——直接挂代码仓库
- **Drag in a Figma file**——挂现有设计源

`Attach codebase` 按钮**就是为这个未来状态设计的**。它的产品愿景是"喂代码 → 出可直接落地的设计"。但 attach 的前提是代码本身**足够规整、API 足够稳定、命名足够语义**——否则它读了等于没读。

### 3.1 当前 vs 目标态

| 维度               | 当前                                                                              | 目标态（Claude Design attach-ready）                           |
| ------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| go 服务            | 局部转发 OpenClaw RPC，字段缺漏（`cacheHit/cost/subagent.children/tool_use.cwd`） | 全镜像 OpenClaw 协议，所有 chat 能力在 deckapi 都有 typed 对应 |
| 前端组件粒度       | `MessageInput.tsx` 693 行融合 6 关注点，`ToolResultCard.tsx` 279 行               | 单文件 < 200 行，关注点单一，prop 接口稳定                     |
| 设计系统           | `theme.css` token + `deck-ui-*` ad hoc class                                      | 公共 `design-system/` 目录，token + utility + 原子组件分层     |
| 类型契约           | 部分 generated（`deckapi.generated.go/ts`）+ 部分手写 chat-types                  | 全 generated，hand-written 字段加注释说明                      |
| 喂入 Claude Design | spec 文档 + 截图                                                                  | spec + 截图 + **attach codebase**                              |
| 它的产出           | 视觉灵感 + UX 决定                                                                | **可直接 PR 的稿 + 实施提示**                                  |

### 3.2 鸡生蛋问题的破法

> 设计要真实字段才能落地——但后端不知道暴露什么字段才合适，除非 UI 先表达需求。

这个鸡生蛋的破法**不是同时做**，而是**反过来读这次 pilot 的产物**：

> Claude Design 的输出不是 UI 实施方案——是 **后端 API gap 报告**。

它列出的 18 个 tweak 维度 + 编出来的 mock 字段（`meta.cacheHit/cost`、subagent 递归、`tool_use.cwd`、`a2ui-bridge ready in 240ms` 等），**反向证明了 UI 想要、但 deckapi 当前没有的字段**。这才是这次实验的真资产。

---

## 4. 产物链反转

### 4.1 错误的链（不要走）

```
Spec 喂给 Claude Design
    ↓
Design 输出原型
    ↓
照搬 jsx/css 到 deck-go 重写组件
    ↓
被字段缺漏 + a11y + i18n + 类型不匹配反复打脸
    ↓
PR 烂尾或大量 hack
```

### 4.2 正确的链

```
Spec 喂给 Claude Design
    ↓
Design 输出原型（视觉 + UX 决定 + 编造的字段需求）
    ↓ 提取
"UI 想要的字段 / 状态机 / 交互" 清单
    ↓ 对齐
OpenClaw Gateway 真相（4-stream 研究产出 capability map）
    ↓ diff
"deckapi 缺失字段 + 前端结构债" 清单
    ↓ 输入到
后端 / 前端基础设施 roadmap
    ↓ 完工后
重新跑 Claude Design with codebase attach
    ↓
真正可实施的稿
```

---

## 5. 优先级反转

### 5.1 表面 vs 本质

| 表面                         | 本质                                   |
| ---------------------------- | -------------------------------------- |
| deck-go 全模块 UI 重设计项目 | **后端协议补齐 + 前端架构治理** 项目   |
| "改 UI 让 it 好看"           | "把平台改造到 Claude Design 能 attach" |
| chat 是 pilot 模块           | chat 是**平台成熟度探针**              |

### 5.2 因此 program 的第一步**不是**"开始重设计"

第一步应该是 platform readiness 三件事：

**S1. Backend API parity audit**

- 跑 4-stream Gateway 研究（OpenSpec / RPC / SSE / 数据契约）
- 输出 `chat-gateway-capability-map.md`
- diff 当前 deckapi → 列出缺失字段 issue 清单
- 按 chat → settings → models → channels 逐模块补齐

**S2. Frontend structural debt audit**

- 列出超过 300 行的 panel 文件（如 `MessageInput.tsx` 693、`SettingsPanel.tsx` 1072）
- 切分成单一职责子组件
- 抽公共 design-system 目录（不是 token 加 css，是 utility hook + 原子组件）

**S3. 命名 + 类型契约对齐**

- 删除 `deck-ui-*` ad hoc class（或决定保留并文档化）
- 让所有 panel 的 props 都来自 generated types

**完成 S1-S3 之后**，再跑下一轮 Claude Design——届时它的输出可以**接近**直接落地。

### 5.3 这次 pilot 的可保留资产

虽然不直接落地，但以下是**值得固化**的：

1. **三个 §13 UX 决定**（右对齐 IM、paired tool、segmented result tabs）—— 后续重设计可以默认采纳
2. **token 命名空间**（bg-0..3 / text-1..4 / accent 三档）—— 作为 design-system 的初稿
3. **State Matrix 交付方式**（Tweaks panel + 50 张稿）—— 作为后续设计交付标准
4. **"UI 想要的字段"清单**—— 输入到 deckapi gap report

不要保留：

- jsx 实现（不上 PR）
- 任何硬编码英文文案
- a11y 弱的部分

---

## 6. 当前 pilot 的产物提取作业

这是接下来这一轮 chat pilot 应该做的**唯一一件事**（不是实施 UI）：

| 产物                         | 路径建议                                                                |
| ---------------------------- | ----------------------------------------------------------------------- |
| Claude Design 编造的字段清单 | `docs/superpowers/specs/2026-04-29-deckapi-gap-from-design.md`          |
| §13 UX 决定固化              | append 到 `2026-04-29-chat-ui-redesign-design.md` 的 §13                |
| Token 命名空间初稿           | `deck-go/frontend/src/design-system/tokens.draft.css`（不引用，只占位） |
| 4-stream Gateway 研究启动    | `2026-04-29-chat-gateway-capability-map.md`（待跑）                     |

---

## 7. 后续模块的工作流推论

任何 deck-go 模块（settings / models / channels / sessions / gateway-panel）想用 Claude Design 重设计前，先跑这个 checklist：

- [ ] 该模块的后端 API（deckapi）字段是否覆盖该模块所有 UI 状态？如不，先补
- [ ] 该模块前端是否有单文件 > 300 行？如有，先拆
- [ ] i18n key 命名空间是否完整？如不，先补
- [ ] 设计系统 token 是否到位？如不，先用 chat pilot 沉淀的 token 初稿
- [ ] 4-stream Gateway 研究的 capability map 是否覆盖该模块？

**通过 checklist 后**，才进入 Claude Design 流程：

1. 用 capability map + i18n key + design-system token 写 prompt（不写视觉处方）
2. 让 Claude Design 出原型
3. **不是**照搬实施——而是再做一次"UI 想要 vs API 提供"的 diff
4. 如果 diff 几乎为零（说明平台已成熟）→ Attach codebase + 让 Claude Design 出贴合稿 → 落地
5. 如果 diff 不小 → 回到 platform readiness 工作

---

## 8. 待决问题

- [ ] **是否立刻启动 4-stream Gateway 研究**？（接续暂停的方案 A）
- [ ] **chat-pilot 的 4 个待提取产物（§6）什么时候做**？建议下一 session
- [ ] **deckapi gap 补齐的优先级**？是阻塞 UI 重设计的 hard prerequisite，还是与重设计并行的 long-running track？
- [ ] **design-system 目录是否独立 spec**？建议独立——它是全模块 program 的基础设施

---

## 附录 A — Claude Design bundle 落地路径

bundle 解开在 `/tmp/design-bundle/openclaw-deck/`，**已经落到本地不会丢失**。如果未来要重新参考：

```
/tmp/design-bundle/openclaw-deck/
├── README.md            # 官方 handoff 指南
├── chats/chat1.md       # 用户与 Claude Design 的全对话（含决策推理）
└── project/
    ├── tokens.css       # 设计 token（值得保留）
    ├── styles.css       # 1006 行布局/组件 css（参考）
    ├── app.jsx          # 入口 + Tweaks + State Matrix
    ├── transcript.jsx   # 顶部条 + MessageBubble + RunStatusBar
    ├── blocks.jsx       # 8 类 block + ToolPair
    ├── composer.jsx     # 完整输入区
    ├── right-panel.jsx  # Canvas 4 态 + Artifact 5 medium
    ├── sidebar.jsx      # session 列表
    ├── data.js          # mock fixture（注意：编造字段）
    └── icons.jsx        # 50+ stroke 图标
```

如果 `/tmp` 被清，从 `https://api.anthropic.com/v1/design/h/-zkx5utSDiZVD8YjZt51zg` 重新下载即可。

---

## 附录 B — Pilot 数据点（供后续模块参照）

| 维度                   | 数据                                                                             |
| ---------------------- | -------------------------------------------------------------------------------- |
| Spec 长度              | 743 行 markdown                                                                  |
| Claude Design 处理时间 | < 5 分钟（用户感知）                                                             |
| 输出 bundle 大小       | 87KB gzipped, ~3000+ 行 jsx/css/js                                               |
| 状态覆盖率             | spec 列出的 ~60 个状态变体，design 覆盖约 80%（漏：动画时间线、所有 i18n、a11y） |
| 字段虚构数             | ≥ 4 个（cacheHit / cost / forTool / subagent.children 递归）                     |
| 直接可用代码比例       | **0**（必须重写）                                                                |
| 真实可用资产           | token 命名空间 + 3 个 UX 决定 + State Matrix 交付方式 + a11y/i18n gap 暴露       |

# Deck Config UX Enhancement — Functional Test Plan

**Date:** 2026-03-25
**Design Spec:** `docs/plans/2026-03-25-deck-config-ux-enhancement-design.md`
**Implementation:** 10 commits on `enhanced` branch (e1712ef4bd..56f37bbbe9)

---

## 前置条件

- [ ] Gateway 从本地源码运行（`scripts/dev/deck-dev.sh` 或 `pnpm openclaw gateway run`）
- [ ] Dashboard 已启动（`cd dashboard && pnpm dev`）
- [ ] `NO_PROXY=localhost,127.0.0.1` 已设置
- [ ] 至少配置了 1 个 Agent（main agent 即可）
- [ ] 至少配置了 1 个 Channel（feishu/wecom/telegram 均可）
- [ ] Gateway 有有效的 config（`~/.openclaw/openclaw.json` 存在且非空）

---

## Group A: ConfigPanel 理解层

### A1: SectionIntroCard

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| A1.1 | 已知 section 显示 intro card | 打开 Config 面板 → 点击 "agents" section | 顶部显示 intro card：图标(Bot) + 标题"Agent 配置" + 描述 + "查看文档" 链接 |
| A1.2 | docs 链接正确跳转 | 点击 intro card 的"查看文档"链接 | 新标签页打开 `https://docs.openclaw.ai/configuration#agents` |
| A1.3 | 不同 section 显示不同内容 | 切换到 "tools"、"gateway"、"models" 等 section | 每个 section 显示对应的图标、标题、描述 |
| A1.4 | 未知 section 不显示 card | 如果存在非预定义的 section（如自定义扩展 section） | 不显示 intro card，直接展示字段表单 |
| A1.5 | i18n 中英文切换 | Settings → 切换语言为 English | intro card 标题和描述切换为英文 |
| A1.6 | 暗色模式 | Settings → 切换暗色主题 | intro card 背景色正确使用 CSS variable，无硬编码白色 |

### A2: FieldHelpPopover

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| A2.1 | 有 help 的字段显示 ? 图标 | 在 ConfigPanel 的 agents section 中查看字段 | 有 uiHints help 的字段在 label 旁显示灰色 `?` 图标 |
| A2.2 | 悬停显示 tooltip | 鼠标悬停在 `?` 图标上 | 弹出 tooltip 显示帮助文本（action-oriented 描述） |
| A2.3 | 无 help 的字段不显示图标 | 查看没有 uiHints help 的字段 | 字段 label 旁无 `?` 图标 |
| A2.4 | tooltip 文字可读 | 在不同宽度窗口下悬停 | tooltip 最大宽度 240px，长文本自动换行 |
| A2.5 | 暗色模式下图标可见 | 暗色主题下悬停 | 图标使用 `var(--muted-foreground)`，tooltip 背景对比清晰 |

### A3: Default Value Hint

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| A3.1 | 有 default 的字段显示默认值 | 在 ConfigPanel 查看有 schema default 的字段 | 字段 label 后显示 `(default: {value})`，灰色小字 |
| A3.2 | 无 default 的字段不显示 | 查看没有 schema default 的字段 | 无 default hint |
| A3.3 | boolean default 正确显示 | 查看 boolean 类型的 default | 显示 `default: true` 或 `default: false` |

### A4: Group-based Layout

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| A4.1 | 同 group 字段分组显示 | 在 ConfigPanel 查看有 uiHints group 的 section | 同一 group 的字段在共同的 group heading 下渲染 |
| A4.2 | 无 group 字段在 General 下 | 查看无 group tag 的字段 | 显示在 "General" 分组中或顶部无 heading 区域 |
| A4.3 | 多个 group 正确分隔 | section 包含多个不同 group | 每个 group 有清晰的视觉分隔（heading + 间距） |

### A5: Advanced Field Collapse

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| A5.1 | advanced 字段默认折叠 | 打开 ConfigPanel 的一个 section | 标记为 `advanced` 的字段不直接显示；显示 toggle "Show N advanced fields" |
| A5.2 | 点击展开 advanced | 点击 "Show N advanced fields" toggle | 折叠区域展开，显示 advanced 字段 |
| A5.3 | 再次点击折叠 | 点击 "Hide advanced fields" toggle | 字段重新折叠 |
| A5.4 | 无 advanced 字段时无 toggle | section 中无 advanced 标记的字段 | 不显示 collapse toggle |

### A6: 高级字段组件路由

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| A6.1 | sensitive 字段用 PasswordField | 导航到包含 API key 等 sensitive 字段的 section | 字段显示为密码输入框（可切换显示/隐藏） |
| A6.2 | union 字段用 UnionField | 导航到包含 oneOf/anyOf 的字段 | 显示 variant 选择器 + 对应子表单 |
| A6.3 | record 字段用 RecordField | 导航到 additionalProperties 类型的字段 | 显示 key-value 动态添加表单 |
| A6.4 | typed array 字段用 TypedArrayField | 导航到 items 有 schema 的 array 字段 | 显示类型化列表编辑器 |
| A6.5 | const union → enum 降级 | oneOf 全是 const 值（如 `{const:"a"}, {const:"b"}`） | 渲染为普通下拉选择器（enum），不是 union 编辑器 |
| A6.6 | discriminated union 正确路由 | schema 有 `discriminator.propertyName` | UnionField 走 discriminated union 路径，显示 variant 选择 + 子表单 |

### A7: SectionNav 增强

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| A7.1 | section 显示图标 | 查看 SectionNav 侧栏 | 每个已知 section 有对应的 lucide 图标 |
| A7.2 | 显示字段计数 | 查看 SectionNav | 每个 section 名称旁显示字段数量 badge |
| A7.3 | 未知 section 无图标 | 如有未知 section | 显示 section 名称但无图标 |

### A8: uiHints 基础设施

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| A8.1 | `[]` 路径匹配正常 | Gateway 返回 hint path `agents.list[].model` | 在 ConfigPanel 中 `agents.list.0.model` 字段正确获得 help text |
| A8.2 | section prefix 正确 | 在 agents section 下查看字段 | `applyUiHints` 使用 `agents.` prefix 匹配 Gateway hints |
| A8.3 | label/order/advanced 生效 | uiHints 包含这些字段的 section | label override、字段排序、advanced 标记正确应用 |

---

## Group B: Agent Config Editor

### B1: Tab 注册 & 导航

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| B1.1 | Config tab 可见 | 打开 Agents 面板 → 选择一个 agent → 查看 tab bar | "Config" tab 出现在 "Overview" 之后 |
| B1.2 | 点击切换到 Config | 点击 "Config" tab | 显示 4-card 网格布局 |
| B1.3 | 面板导航跳转 | 从其他面板通过 `navigateToAgent(id, "config")` 跳转 | 正确导航到该 agent 的 Config tab |
| B1.4 | i18n tab 名称 | 切换中英文 | tab 名称正确显示 "配置" / "Config" |

### B2: 数据加载 & 显示

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| B2.1 | 加载中状态 | 首次打开 Config tab（网络延迟时） | 显示 loading 指示器 |
| B2.2 | 数据正确显示 | Config tab 加载完成 | 4 张卡片显示当前配置值（model, thinking, temperature 等） |
| B2.3 | 有效值显示 | agent 未 override 某字段 | 显示 `agents.defaults.*` 的值 |
| B2.4 | override 值显示 | agent 在 list 中显式设置了某字段 | 显示 agent entry 中的 override 值 |

### B3: InheritBadge 系统

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| B3.1 | 继承字段显示 amber badge | 查看未 override 的字段 | 显示 `↑ 默认` amber badge |
| B3.2 | override 字段显示 blue badge | 查看已 override 的字段 | 显示 `✎ 覆盖` blue badge + `✕` reset 按钮 |
| B3.3 | hover 显示 title | 鼠标悬停在 badge 上 | inherit badge 的 title 解释继承语义 |
| B3.4 | reset 按钮功能 | 点击 override 字段的 `✕` 按钮 | 字段值回退为 defaults 值，badge 变为 amber `↑ 默认` |
| B3.5 | reset hover 变红 | 鼠标悬停在 `✕` 按钮上 | 按钮颜色变为 `var(--destructive)` |

### B4: Card 1 — Model & Inference

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| B4.1 | model 字段编辑 | 修改 model input 的值 | input 更新，badge 变为 `✎ 覆盖`，isDirty = true |
| B4.2 | thinkingDefault 枚举 | 点击 thinkingDefault select | 下拉显示 7 个选项：off/minimal/low/medium/high/xhigh/adaptive |
| B4.3 | temperature 范围 | 修改 temperature 为 1.5 | 数字 input 接受 0-2 范围的值，step=0.1 |
| B4.4 | temperature 超范围 | 输入 3.0 | input 限制在合理范围内（HTML min/max 或 clamp） |

### B5: Card 2 — Tools Profile

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| B5.1 | 4 个 pill 按钮 | 查看 Tools Profile 卡片 | 显示 minimal(1)/coding(18)/messaging(5)/full(30) 四个 pill |
| B5.2 | 选中状态 | 当前 profile 为 coding | coding pill 高亮（`var(--primary)` 背景） |
| B5.3 | 切换 profile | 点击 full pill | full pill 高亮，值更新，dirty 标记 |
| B5.4 | 键盘导航 | 用方向键在 pill 之间切换 | ← → 键循环选中不同 pill（roving tabindex） |
| B5.5 | 查看 policy trace 链接 | 点击 "View full policy trace" | 导航到 agent 的 Context tab（ToolPolicyViz 所在位置） |
| B5.6 | a11y 属性 | 检查 HTML 结构 | `role="radiogroup"` 包裹，每个 pill `role="radio"` + `aria-checked` |

### B6: Card 3 — Subagents

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| B6.1 | allowAgents 模式选择 | 点击 allowAgents select | 显示可用选项 |
| B6.2 | model override | 修改 subagent model override 值 | input 更新，dirty 标记 |

### B7: Card 4 — Delivery

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| B7.1 | blockStreaming checkbox | 勾选/取消 blockStreaming | checkbox 状态切换，dirty 标记 |
| B7.2 | eventStreams 多选 | 勾选/取消不同 event stream 类型 | 多个 checkbox 独立切换 |
| B7.3 | typingIndicator select | 选择不同的 typing indicator 选项 | select 更新 |

### B8: Save 流程

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| B8.1 | Save 按钮状态 | 未修改任何字段 | Save 按钮 disabled |
| B8.2 | 修改后启用 | 修改任意字段 | Save 按钮 enabled |
| B8.3 | 成功保存 | 修改字段 → 点击 Save | 保存成功，dirty 清除，badge 正确更新 |
| B8.4 | dot-path 嵌套保存 | 修改 `tools.profile` → Save | config 中 agent entry 正确写入 `{ tools: { profile: "..." } }` 而非字面量键 |
| B8.5 | Reset All | 有多个 override → 点击 "Reset All" | 所有字段回退为 defaults，badge 全变为 amber |
| B8.6 | 保存失败显示错误 | 模拟保存失败（如 baseHash 冲突） | 显示红色错误文字提示用户 |
| B8.7 | override/inherited 计数 | 有 3 个 override、5 个 inherited | Save bar 显示 "3 overrides, 5 inherited" |
| B8.8 | 并发冲突检测 | 两个标签页同时编辑同一 agent config | 第二个保存触发 conflict 检测 |
| B8.9 | 新 agent entry 创建 | agent 在 list 中无条目 → 修改字段 → Save | 自动创建新 entry 并 append 到 agents.list |

---

## Group C: Channel Settings

### C1: ChannelDetail 标签页

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| C1.1 | 3 个 tab 可见 | 选择一个 channel | 显示 Status / Bindings / Settings 三个 tab |
| C1.2 | 默认 tab | 首次打开 | Status tab 默认选中 |
| C1.3 | Status tab 内容完整 | 查看 Status tab | 原有功能完好：accounts 列表、enable/disable、logout |
| C1.4 | Tab 切换正常 | 点击 Bindings / Settings | 内容区域正确切换，无闪烁 |
| C1.5 | i18n tab 名称 | 切换语言 | "状态/绑定/设置" ↔ "Status/Bindings/Settings" |

### C2: BindingsTab 嵌入

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| C2.1 | 按 channelId 过滤 | 点击 Bindings tab | 仅显示当前 channel 的 binding 规则 |
| C2.2 | channel filter 隐藏 | 在 Bindings tab 中查看 | channel 下拉筛选器不显示（已由外层 scope 决定） |
| C2.3 | 切换 channel 后同步 | 从 channel A 切到 channel B → 打开 Bindings tab | 显示 channel B 的 bindings，不是 A 的 |
| C2.4 | 独立面板不受影响 | 从独立的 Channels → Bindings 面板访问 | BindingsTab 完整显示所有 channel 的 bindings + filter |

### C3: DmPolicySelector

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| C3.1 | 4 个策略卡片 | 打开 Settings tab | 显示 pairing/allowlist/open/disabled 四张 radio card |
| C3.2 | 当前值选中 | channel config 中 dmPolicy = "pairing" | pairing card 有选中样式（蓝色边框 + 浅蓝背景） |
| C3.3 | recommended badge | 查看 pairing card | 显示 "推荐" 小 badge |
| C3.4 | 切换策略 | 点击 "open" card | open card 选中，pairing card 取消选中 |
| C3.5 | 卡片描述可理解 | 阅读各卡片描述 | 非技术用户能理解每个策略的含义和适用场景 |
| C3.6 | a11y 结构 | 检查 HTML | `role="radiogroup"` + `role="radio"` + `aria-checked` |
| C3.7 | 键盘可达 | Tab 键导航 + 方向键 | 可以通过键盘选择不同策略 |

### C4: RetryStrategyEditor

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| C4.1 | 4 个输入字段 | 查看 Retry Strategy 区域 | 显示 Attempts / Min Delay / Max Delay / Jitter 四个 input |
| C4.2 | 当前值回显 | channel 有 retry 配置 | 字段显示当前配置值 |
| C4.3 | 默认值回显 | channel 无 retry 配置 | 字段显示默认值（attempts=3, min=1000, max=30000, jitter=0.2） |
| C4.4 | 时间线可视化 | 查看 retry fields 下方 | 显示圆圈+箭头的退避时间线，标注每次重试的延迟 |
| C4.5 | 实时更新可视化 | 修改 attempts 为 5 | 时间线立即更新为 5 个节点 |
| C4.6 | 修改 minDelay | 将 minDelayMs 改为 2000 | 时间线中的延迟值更新（2s → 4s → 8s...） |
| C4.7 | 指数退避正确 | 查看延迟计算 | `delay(n) = min(minDelay × 2^n, maxDelay)` 正确 |
| C4.8 | total time 显示 | 查看时间线末尾 | 显示总耗时估算 |
| C4.9 | a11y label | 检查时间线容器 | `aria-label` 包含文字描述（"N retries with exponential backoff, total ~Xs"） |

### C5: ChannelSettingsTab 整体

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| C5.1 | 加载中状态 | 首次打开 Settings tab | 短暂 loading → 数据显示 |
| C5.2 | 加载失败处理 | config 读取失败 | 不会永久 loading，显示错误提示或空状态 |
| C5.3 | Save/Reset bar 状态 | 未修改任何值 | Save disabled，Reset 无效果 |
| C5.4 | 修改后启用 Save | 修改 dmPolicy 或 retry 值 | Save 按钮启用 |
| C5.5 | 保存成功 | 修改 → Save | 保存成功，dirty 清除 |
| C5.6 | 条件 patch（仅变更字段） | 只修改 dmPolicy 不修改 retry → Save | patch 中仅包含 `dmPolicy`，不包含 `retry` |
| C5.7 | 保存失败显示错误 | 保存遇到错误 | 红色错误文字提示 |
| C5.8 | 暗色模式 | 切换暗色主题 | 所有卡片、badge、时间线颜色正确 |

---

## 跨组件 & 集成测试

### X1: i18n 完整性

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| X1.1 | 无硬编码文字 | 切换到 English | 所有 UI 文字切换为英文，无残留中文 |
| X1.2 | 切换回中文 | 切回中文 | 所有 UI 文字切换为中文，无残留英文 |
| X1.3 | 缺失 key 不崩溃 | 如有 i18n key 缺失 | 显示 key 名称（不崩溃） |

### X2: 主题兼容性

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| X2.1 | Light mode 全组件 | 逐个查看 ConfigPanel / Agent Config / Channel Settings | 颜色对比度正常，无白色/透明区域消失 |
| X2.2 | Dark mode 全组件 | 切暗色后逐个查看 | 颜色正确反转，badge/card/timeline 可辨 |

### X3: 响应式布局

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| X3.1 | Desktop (1024+) | 默认全屏查看 | Agent Config 2×2 网格，ConfigPanel sidebar + main |
| X3.2 | Tablet (768) | 调整窗口宽度到 768px | Agent Config 可能降为 1 列，SectionNav 仍可见 |
| X3.3 | Mobile (375) | 调整窗口宽度到 375px | Agent Config 1 列，Channel tabs 仍可切换 |

### X4: 并发与冲突

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| X4.1 | Agent config 并发修改 | Tab A 修改 agent → Tab B 修改同一 agent → A 保存 → B 保存 | B 保存时检测到 baseHash 不匹配，显示冲突提示 |
| X4.2 | Channel config 并发 | 同上，对 channel settings 操作 | 同样的 baseHash 冲突检测 |

### X5: Gateway 重启

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| X5.1 | config.patch 触发重启 | 通过 Agent Config 保存修改 | Gateway 收到 SIGUSR1 自动重启通知 |

### X6: 数据完整性

| # | 用例 | 步骤 | 预期结果 |
|---|------|------|----------|
| X6.1 | Agent config round-trip | 修改 model + temperature + profile → Save → 刷新页面 | 三个值均保持修改后的状态 |
| X6.2 | Channel config round-trip | 修改 dmPolicy + retry → Save → 刷新 | 两个值均保持 |
| X6.3 | Reset round-trip | override → Reset → Save → 刷新 | 字段回退为 defaults 值，agent entry 中该字段被删除 |
| X6.4 | 空 config 不崩溃 | config.get 返回空 JSON `{}` | 各组件显示空状态或默认值，不崩溃 |
| X6.5 | agent 不在 list 中 | agents.list 中无当前 agent 的条目 | AgentConfigTab 所有字段显示 defaults，badge 全为 inherit |

---

## 测试优先级

| 优先级 | 用例范围 | 原因 |
|--------|---------|------|
| **P0 — 必须通过** | B8.1-B8.4 (Save 核心流程), C5.5-C5.7 (Channel Save), A8.1-A8.2 (uiHints 基础), B3.1-B3.4 (InheritBadge) | 数据写入正确性，核心功能 |
| **P1 — 重要** | A1.1-A1.4, A2.1-A2.3, B4.1-B4.3, B5.1-B5.3, C3.1-C3.4, C4.1-C4.8, X6.1-X6.5 | 主要 UX 功能，数据完整性 |
| **P2 — 良好覆盖** | A3-A7, B6-B7, C1-C2, X1-X3 | 辅助功能、布局、i18n |
| **P3 — 边界情况** | X4 (并发), A6.5-A6.6 (union 边界), B8.8-B8.9 (冲突/新 entry) | 低频但重要的边界场景 |

---

## 自动化测试覆盖

### 已有（单元测试）
- `dashboard/src/lib/ui-hints.test.ts` — 28 cases: matchUiHint（精确/通配/[]规范化）+ applyUiHints（字段装饰、递归、新字段）
- `dashboard/src/lib/schema-parser.test.ts` — 23 cases: 基本类型、enum、validation、itemSchema、valueSchema、union variants、const→enum 提升、discriminator 传递

### 建议补充（集成/组件测试）
1. **AgentConfigTab save payload** — mock fetch，验证 `config.patch` 的 payload 结构（嵌套对象而非字面量键）
2. **ChannelSettingsTab conditional patch** — mock fetch，验证仅变更字段在 payload 中
3. **InheritBadge render modes** — render test for inherit/override/reset
4. **ToolProfileSelector keyboard navigation** — render + keyboard event test
5. **DmPolicySelector radio behavior** — render + click test
6. **SectionIntroCard known/unknown** — render test for known section + null for unknown

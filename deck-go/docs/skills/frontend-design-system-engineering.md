# Frontend Design System Engineering — 5 步法

> 作者：基于 deck-go 项目实战经验提炼
> 适用范围：从零开发或重构前端 UI 项目时，把"品牌字典"落地为可 import 的代码层
> 与 [`design-system-skill.md`](../design-system-skill.md) 的关系：那一份是**第 0 层（品牌字典）**，本文是**第 1 层（工程化代码层）**——前者跨技术栈，后者跟 React/CSS/TS 强绑定。

---

## 何时使用

- ✅ 已经做过至少一个核心模块（例如 chat / dashboard），想沉淀成可复用代码
- ✅ 项目从零开始，要先搭代码层 design-system 再做模块
- ✅ 老项目重构，想把散落各处的样式收敛
- ❌ 单页 demo / 一次性原型——不值得做这套

---

## 5 步法概览

| 步骤                    | 产出                               | 大概工作量     |
| ----------------------- | ---------------------------------- | -------------- |
| 1. 审计现状             | `design-system-audit.md`           | 0.5-1 天       |
| 2. 定目录结构 + 迁移    | tokens/ + atoms/ + molecules/ 骨架 | 1-2 天         |
| 3. 建 review canvas     | `preview.html` 或 `/preview` 路由  | 0.5 天         |
| 4. 按下一模块倒推补缺件 | 新 atoms/molecules                 | 跟着模块进度走 |
| 5. 写 README + 工作约定 | `design-system/README.md`          | 2 小时         |

**核心原则：不要一次补全所有"未来可能用到的组件"——那是过度设计。让真实需求拉动 design-system 的成长。**

---

## Step 1: 审计现状（产出 audit.md）

### 目标

不改一行代码，先把"已经有什么、缺什么、命名是否一致"摸清楚，写成一份独立文档。

### 操作清单

通读 `<project>/src/`，回答以下问题：

#### 1.1 Tokens 现状

- 在哪些文件里？（`tokens.css` / `theme.css` / `_variables.scss`）
- 命名规范是什么？是否有前缀（如 `--ds-*`）？
- 涵盖哪些类别：colors / typography / spacing / radius / shadow / motion / z-index？
- 缺哪些类别？特别检查：
  - **Motion 系统**（`--ease-*`、`--duration-*`）通常被忽略
  - **Z-index 体系**——很多项目散落 `z-index: 99999`
  - **语义颜色** vs **底色**是否分层（例如 `--color-fg-1` 应该映射到 `--gray-200`，而不是直接 `#e6e8ec`）

#### 1.2 隐式 atoms 清单

列出主模块代码里**已经存在、可以提取成 atom**的组件。常见嫌疑犯：

- Action: Button, IconButton
- Status: Badge, Chip, Tag, Banner, Spinner, ProgressBar
- Container: Card, Drawer, Modal
- Form: Input, Textarea, Select, Toggle, Checkbox, Radio, Slider
- Navigation: Tab, Breadcrumb, SegmentedControl
- Overlay: Tooltip, Popover, DropdownMenu, Toast, ContextMenu
- Text: Markdown, Code, DiffView, JsonTree
- Streaming/Loading: Skeleton, StreamingCursor, WaitingDots

#### 1.3 隐式 molecules 清单

- Card 组合（含 header/body/footer 结构）
- EmptyState（icon + title + description + action）
- ListItem / SidebarRow
- HeaderBar / Toolbar
- FormRow（Label + Field + Hint + Error）

#### 1.4 真实存在 vs 仅有 barrel 导出

**这是最容易出现的问题**：`atoms/index.ts` 的 barrel 文件可能 export 了一堆名字，但实际 .tsx 文件并不存在（可能在重构中被移走、或代码生成失败、或 path alias 指向别处）。

具体检查：

```bash
# 拿 barrel 里 export 的每个名字，确认对应文件在不在
ls src/design-system/atoms/Button.tsx
ls src/design-system/atoms/Chip.tsx
# ...
```

任何 barrel 名字找不到对应文件，但被外部 import 的，**都是潜在的运行时炸弹**——要么文件遗失需要恢复，要么有 path alias / 构建产物在别处。这必须搞清楚再做后续步骤。

#### 1.5 其他模块需要、但当前没有的

按规划中的下一个模块倒推：

| 下一个模块 | 通常需要的新组件                                            |
| ---------- | ----------------------------------------------------------- |
| 列表页     | DataTable, Pagination, SearchInput, FilterBar, EmptyState   |
| 设置页     | Tabs, FormRow, FormGroup, Switch, Avatar, FileUpload        |
| 编辑器     | Toolbar, Sidebar (collapsible), CommandPalette, ContextMenu |
| 仪表盘     | StatCard, Chart wrapper, KPI, TimeRange picker              |
| 模板/画廊  | Card grid, Tag, HoverPreview, AspectRatio                   |

#### 1.6 命名 / 实现不一致

- 有没有同一个东西两种实现？（如 `<Button>` 在 ds 里、又在某处自己写了一个）
- token 名字是否前后矛盾？（`--text-2` vs `--fg-2`）
- 是否 hardcode 了应当走 token 的值？（直接 `#fff` 或 `12px`）

### 产出格式

一份 markdown：

```markdown
# Design System Audit — <项目名>

## 一、Tokens 现状

（表格列出已有 token + 类别 + 缺失项）

## 二、Atoms 现状

| 组件 | 已抽出 | 仅 barrel | 散落各处 | 完全缺失 |
| ---- | ------ | --------- | -------- | -------- |

## 三、Molecules 现状

（同上）

## 四、缺件清单（按下一模块倒推）

## 五、命名 / 实现不一致

## 六、推荐下一步

- 必做（P0）
- 应做（P1）
- 可做（P2）
```

---

## Step 2: 定目录结构 + 迁移

### 推荐结构

```
src/design-system/
├── tokens/
│   ├── colors.css        # 颜色（base + semantic 分层）
│   ├── typography.css    # 字体 family + scale + 语义（h1/body/code）
│   ├── spacing.css       # --space-1..10
│   ├── radius.css
│   ├── shadow.css
│   ├── motion.css        # --ease-*、--duration-*
│   ├── z-index.css       # 层级表
│   └── index.css         # @import 全部
├── atoms/
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.css
│   │   └── index.ts
│   ├── Chip/
│   ├── Field/
│   └── index.ts          # barrel
├── molecules/
│   ├── Card/
│   ├── EmptyState/
│   ├── Dialog/
│   └── index.ts
├── icons/                # 图标 SVG/组件
├── preview/              # review canvas（见 Step 3）
└── README.md             # 工作约定（见 Step 5）
```

### 迁移原则

1. **一次只迁一个 atom**，配套迁移所有引用方的 import 路径
2. **保留 BEM class** 不变（`.button`、`.chip__icon`），只改文件位置
3. **不改组件 API** ——这是搬家不是重构
4. **每迁完一个跑一次 build** 验证

### 命名约定

- atom CSS class：BEM 风（`.button`、`.button--primary`、`.button__icon`）
- token 名：`--<前缀>-<类别>-<语义>`（如 `--ds-color-fg-1`）
- 不在 atom 外部覆盖 atom 的 BEM class——要变体就走 prop/variant

---

## Step 3: 建 review canvas（最关键的一步）

写一个 **一屏列出所有 token + 所有组件 + 状态矩阵** 的页面。

### 实现选项

**选项 A：独立 HTML（最简单）**

- `src/design-system/preview/index.html` + 静态引用 tokens.css
- 优点：跟产品代码完全解耦
- 缺点：组件逻辑要重写

**选项 B：开发路由（推荐）**

- 在 dev 环境加 `/design-system` 路由
- 直接 import 真实组件
- 优点：永远跟代码同步，零维护成本

**选项 C：Storybook（最重）**

- 每个 atom 一个 .stories.tsx
- 优点：状态矩阵丰富、可交互
- 缺点：基建重，维护成本高，多数项目过度

### canvas 应包含

#### 3.1 Token 展示

- 颜色：按语义分组的色板（fg / bg / border / accent / status）
- 字体：display / body / mono 各 3-4 个梯度
- 间距：尺规可视化
- 半径 / 阴影：方块示例

#### 3.2 Atom 状态矩阵

每个 atom 列出：default / hover / active / focus / disabled / loading / error 状态并排

#### 3.3 Molecule 用法示例

不是状态矩阵，是"在真实场景里长什么样"

### 为什么这步关键

**做新模块时，第一件事是打开这个页面对一遍**。任何视觉漂移（A 模块用 `--color-fg-2`、B 模块不小心用 `#999`）一眼能看出来。它是 design-system 的"健康仪表盘"。

---

## Step 4: 按下一模块倒推补缺件

### 反模式：一次补全所有"未来可能用到"的组件

这是过度设计，会产出大量 over-engineered 但没人用的 atom。

### 推荐做法

每次接到新模块需求时：

1. **列出该模块用到的组件清单**
2. **对照 design-system 现状**：哪些有、哪些缺、哪些要扩展现有 atom 的 prop
3. **缺的先在 design-system 里建**，再在新模块里 import 用
4. **建的时候就考虑通用性**——不要为了 deck-list 写一个 `<DeckListSearchInput>`，应该建通用 `<SearchInput>`

### 取舍标准

什么值得抽成 atom：

- ✅ 至少 2 个模块会用
- ✅ 有明确的 props API 边界
- ✅ 视觉一致性重要（按钮、输入框等"不能各家各画"的）

什么不值得：

- ❌ 强业务耦合（`<DeckCardForList>`）
- ❌ 一次性的（landing page 的某个 hero）
- ❌ 容器布局（应该用 css grid/flex 直接写）

---

## Step 5: 写 README + 工作约定

`src/design-system/README.md` 应包含：

### 5.1 Token 命名规范

- `--ds-color-fg-1` 表示一级前景文字（最深）
- `--ds-color-bg-elev` 表示浮起元素的背景
- 等等——把每条命名的"语义"写清

### 5.2 何时用语义 token vs 何时用 base token

- 一般组件 → 语义 token（`--color-fg-2`）
- 特殊单点视觉 → 直接 base（`--gray-700`）

### 5.3 atom / molecule 取舍标准

（见 Step 4）

### 5.4 反 slop 条款

继承自 `design-system-skill.md`：

- 不要蓝紫渐变
- 不要 emoji 卡片
- 不要"圆角 + 左侧 accent border"卡片
- 不自己画 SVG icon

### 5.5 给后续做新模块的 checklist

```markdown
做新模块前：

- [ ] 打开 /design-system 预览页对一遍 token 和组件
- [ ] 列出本模块用到的 atom/molecule
- [ ] 缺的先在 design-system 里加，再在模块里 import
- [ ] token 不够用，先加 token，不要 hardcode
- [ ] 完工前再次打开预览页看是否有漂移
```

---

## 在 deck-go 上的具体执行计划

### 现状关键发现

deck-go 的 design-system 已经走过头：

- `src/design-system/tokens/index.css` ✅ 完整（颜色、字体、间距、阴影、密度切换）
- `src/design-system/atoms/index.ts` ✅ barrel 文件 export 了 30+ atoms 名字
- `src/design-system/atoms/*.tsx` ❓ **实际文件状态待 audit 验证**

### 推荐顺序

1. **Step 1 必做**：先 audit 一遍——尤其要核实 barrel 里 export 的 30+ atom **是不是真的有对应文件**，因为 chat 代码 import 了它们；如果文件不在但 build 通了，可能存在 path alias 或别处的产物，要搞清楚
2. **Step 2 视情况**：如果 audit 发现结构已经基本合理，跳过；如果发现散乱再迁移
3. **Step 3 强烈推荐**：deck-go 现在缺一个 `/design-system` 预览页——这是后续做 deck list / settings 时的最大保险
4. **Step 4 按需**：等下个模块开做时再补
5. **Step 5 必做**：写 `src/design-system/README.md` 沉淀工作约定

---

## 通用项目（不只 deck-go）的执行清单

把上面 5 步翻译成"任何前端项目都能照做"的清单：

```
[ ] Step 1: 审计 → audit.md
[ ] Step 2: 定 tokens/ + atoms/ + molecules/ 三层结构
[ ] Step 3: 建 review canvas（独立 HTML 或 dev 路由）
[ ] Step 4: 按下一模块倒推补缺件（不要一次补全）
[ ] Step 5: 写 design-system/README.md 工作约定
```

每个项目都跑一遍这 5 步，半天到 3 天能完成（取决于项目规模），后续每个新模块的设计开发会快 30-50%，且视觉一致性显著提升。

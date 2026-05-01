# deck-go Design System 实施方案（给 Claude Code 用）

> 用途：把这份文档喂给 Claude Code，让它在 deck-go 仓库本地实施 design-system 工程化。
> 输入前提：Claude Code 能完整访问 `deck-go/` 仓库代码。
> 配套阅读：[`../skills/frontend-design-system-engineering.md`](../skills/frontend-design-system-engineering.md)（5 步法通用版）。
> 路径说明：本文档位于 `deck-go/docs/project/`，下面所有相对路径都假设你在 `deck-go/` 仓库根目录执行。（deck-go 现状审计）。

---

## 一、上下文给 Claude Code 的一段话（直接复制）

```
我在做 deck-go 项目（Next.js + TypeScript + CSS Modules + i18n via next-intl）。
仓库路径：deck-go/frontend/src/。

前置工作：chat 模块（src/components/panels/chat/）已经设计开发完成，
src/design-system/tokens/index.css 和 src/design-system/atoms/*.tsx 也已完成。

现在要做 design-system 工程化第二阶段：在已有 atoms 之上建 molecules 层、
建 review canvas、写 README、收敛旧 token。

请按以下方案执行，遇到决策点先问我。
```

---

## 二、当前已有（不要改）

- `src/design-system/tokens/index.css` —— 完整 tokens（颜色 / 字体 / 间距 / 半径 / 阴影 / 密度 / 暗黑明亮主题）
- `src/design-system/atoms/index.ts` —— barrel
- `src/design-system/atoms/*.tsx` —— 30+ atom，分 5 大类（Action/Status/Streaming/Container/Text/Form/Navigation/Overlay）
- `src/components/panels/chat/` —— chat 模块（生产可用，已 import 上述 atoms）

**不要改这些文件**（除非本方案明确要求）。

---

## 三、实施步骤

### Step 0: 先扫一遍，回我两个数字

在动手之前先告诉我：

1. **`pnpm build`（或对应构建命令）能否通过？** 如果有 type error，先修，再继续。
2. **`grep -r "var(--accent)" src/components` 命中多少处？**——这决定 Step 5 的工作量。

---

### Step 1: 补 tokens 缺件（P1）

#### 1.1 新建 `src/design-system/tokens/motion.css`

```css
:root {
  /* easing */
  --ds-ease-linear: linear;
  --ds-ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ds-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ds-ease-emphasized: cubic-bezier(0.05, 0.7, 0.1, 1);

  /* duration */
  --ds-dur-instant: 80ms;
  --ds-dur-fast: 140ms;
  --ds-dur-base: 200ms;
  --ds-dur-slow: 320ms;
  --ds-dur-deliberate: 480ms;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --ds-dur-instant: 0ms;
    --ds-dur-fast: 0ms;
    --ds-dur-base: 0ms;
    --ds-dur-slow: 0ms;
    --ds-dur-deliberate: 0ms;
  }
}
```

#### 1.2 新建 `src/design-system/tokens/z-index.css`

```css
:root {
  --ds-z-base: 0;
  --ds-z-elevated: 10;
  --ds-z-sticky: 100;
  --ds-z-dropdown: 1000;
  --ds-z-overlay: 1100;
  --ds-z-modal: 1200;
  --ds-z-popover: 1300;
  --ds-z-tooltip: 1400;
  --ds-z-toast: 1500;
  --ds-z-debug: 9999;
}
```

#### 1.3 把现有 `tokens/index.css` 拆分为分类文件（可选，建议做）

- 把颜色相关 var 移到 `tokens/colors.css`
- 把字体相关 var + @import 移到 `tokens/typography.css`
- 把 spacing/radius/shadow 各自移到 `tokens/spacing.css` / `radius.css` / `shadow.css`
- 改 `tokens/index.css` 只做 `@import`：

```css
@import "./typography.css";
@import "./colors.css";
@import "./spacing.css";
@import "./radius.css";
@import "./shadow.css";
@import "./motion.css";
@import "./z-index.css";
```

**风险**：拆分会改变 cascade 顺序。拆完后让 chat 页面跑一遍肉眼对照，确保视觉无差异。

---

### Step 2: 建 molecules/ 层（P1）

#### 2.1 目录结构

```
src/design-system/molecules/
├── EmptyState/
│   ├── EmptyState.tsx
│   ├── EmptyState.css
│   └── index.ts
├── FormRow/
├── Card/
├── index.ts
```

#### 2.2 三个必做 molecule

##### EmptyState

API：

```tsx
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode; // 通常是 <Button>
  size?: "sm" | "md" | "lg"; // sm 在 sidebar、md 在 panel、lg 在全屏
}
```

实现要点：

- 居中布局，icon 在上、title 中、description 下、action 底
- 间距走 `--ds-sp-*` token
- 色彩走 `--ds-text-2`（title）、`--ds-text-3`（description）
- 把 `src/components/panels/chat/EmptyState.tsx` 的视觉迁移过来当起点，但**不要直接搬业务文案**——做成 prop-driven

##### FormRow

API：

```tsx
interface FormRowProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  layout?: "stacked" | "horizontal"; // stacked 默认
  children: ReactNode; // 通常是 <Input> / <Select> / <Toggle>
}
```

实现要点：

- stacked 布局：label 在上、field 在中、hint/error 在下
- horizontal 布局：label 左、field 右，label 占 30%
- error 优先显示（覆盖 hint）；error 用 `--ds-error`；hint 用 `--ds-text-3`
- 必填时 label 后跟 `*`，色 `--ds-error`

##### Card

API：

```tsx
interface CardProps {
  surface?: "default" | "elevated" | "subtle";
  interactive?: boolean; // hover 态
  children: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
}

// 子组件
Card.Header;
Card.Body;
Card.Footer;
```

实现要点：

- `default`：`--ds-bg-1` 背景 + `--ds-border-subtle` 边框
- `elevated`：`--ds-bg-elev` + `--ds-shadow-md`
- `subtle`：透明背景 + dashed border
- `interactive`：hover 时 bg 变 `--ds-bg-hover`、cursor pointer
- 半径走 `--ds-radius-md`

#### 2.3 后续 molecule（先建好 stub，等用到再实现）

`Toolbar`、`SearchInput`、`Pagination`、`DataTable`、`FilterBar`——先建空目录或最小实现，等下个模块实际用到时补完。

---

### Step 3: 建 review canvas（P1，强烈推荐）

#### 3.1 选实现路径

**推荐路径 B：开发路由**——在 dev 环境加 `/design-system` 路由，import 真实组件。

理由：

- 永远跟代码同步，零维护成本
- Next.js 加路由零成本
- 可以条件渲染（仅 dev 环境暴露）

#### 3.2 路由结构

```
src/app/design-system/
├── layout.tsx        # 侧边目录导航
├── page.tsx          # 首页：tokens 总览
├── tokens/
│   ├── colors/page.tsx
│   ├── typography/page.tsx
│   ├── spacing/page.tsx
│   ├── radius-shadow/page.tsx
│   ├── motion/page.tsx
│   └── z-index/page.tsx
├── atoms/
│   ├── button/page.tsx       # 状态矩阵
│   ├── chip/page.tsx
│   └── ...                    # 一个 atom 一页
└── molecules/
    ├── empty-state/page.tsx
    ├── form-row/page.tsx
    └── card/page.tsx
```

#### 3.3 状态矩阵模板

每个 atom 页面用同一个 grid 布局展示：

```
default | hover | active | focus | disabled | loading | error
```

每个状态用 `data-state="..."` 强制触发，避免靠真实交互。

#### 3.4 仅 dev 环境暴露

`src/app/design-system/layout.tsx` 顶部：

```tsx
if (process.env.NODE_ENV === "production") {
  notFound();
}
```

#### 3.5 token 展示页关键内容

- `colors`: 按语义分组的色板（fg/bg/border/accent/status），每色显示 token 名 + 实际值 + 在亮暗主题下的样子
- `typography`: 各 fs 档位 + Inter/JetBrains Mono 实际样张 + 行高对照
- `spacing`: 8 档 sp 尺规可视化
- `radius-shadow`: 方块示例
- `motion`: 一个按钮 / 一个 drawer 实际跑各档 duration 的演示
- `z-index`: 表格列出每档名 + 数值

---

### Step 4: 写 `src/design-system/README.md`（P0）

按以下骨架写：

```markdown
# deck-go Design System

## 何时改这里 vs 改业务模块

- 改 token: 全产品视觉调整
- 改 atom: 跨多模块共用的元件视觉/行为变化
- 改 molecule: 跨多模块共用的复合视觉
- 改业务模块（如 chat/）: 业务逻辑、模块独有视觉

## Token 命名规范

- `--ds-color-fg-1`: 一级前景文字（最深）
- `--ds-color-fg-2`: 二级（次要、说明）
- `--ds-color-fg-3`: 三级（提示、disabled-ish）
- `--ds-color-fg-4`: 四级（最弱、装饰）
- `--ds-bg-0..3`: 由暗到亮的背景层级
- `--ds-bg-elev`: 浮起元素（modal/popover/card-elevated）
- `--ds-bg-hover` / `--ds-bg-active`: 交互态
- `--ds-border-subtle/normal/strong`: 边框三档
- `--ds-accent`: 主色，用于行动呼吁

（含主题切换说明、密度切换说明）

## Atom / Molecule 取舍标准

值得抽 atom：

- ✅ 至少 2 个模块会用
- ✅ 视觉一致性重要
- ✅ 有清晰 props API

不值得：

- ❌ 强业务耦合
- ❌ 一次性视觉
- ❌ 容器布局（直接 css grid/flex）

## 反 AI Slop 条款

- 不用蓝紫渐变 backgrounds
- 不用 emoji 卡片
- 不用 "圆角 + 左侧 accent border" 卡片
- 不自己画 SVG icon——用 deck-ui/icons 或 Lucide CDN
- 不在已有 token 之外 hardcode 颜色 / 间距 / 半径

## 做新模块前的 checklist

- [ ] 跑 dev、打开 /design-system，过一遍 token 和组件
- [ ] 列出本模块用到的 atom/molecule
- [ ] 缺的先在 design-system 里加，再在模块里 import
- [ ] token 不够用，先加 token，不要 hardcode
- [ ] 完工前再次打开 /design-system 看是否有漂移

## 已知技术债

- 旧 token (`--accent` / `--bg` / `--text-soft` 等) 与 `--ds-*` 双轨共存，渐进收敛中
- ……
```

---

### Step 5: 收敛旧 token（P2，可滚动进行）

#### 5.1 grep 现状

```bash
grep -rn "var(--accent)" src/components
grep -rn "var(--bg)" src/components
grep -rn "var(--text-soft)" src/components
# ... 列出所有旧 token
```

得到一份完整命中清单，按文件分组。

#### 5.2 建立映射表

例如：

```
--accent       →  --ds-accent
--bg           →  --ds-bg-1
--text-soft    →  --ds-text-2
--border-soft  →  --ds-border-subtle
（等）
```

#### 5.3 渐进替换

- 一次替换一个文件，跑视觉对照
- 不能一个 sed 全替换——某些场景旧 token 是有意为之（例如旧主题紫色 accent），要个案判断
- 替换后跑 chat 页面对照视觉

---

## 四、执行顺序建议

```
Day 1 上午:  Step 0 (扫描) + Step 4 (README)
Day 1 下午:  Step 1 (motion + z-index tokens)
Day 2:       Step 2 (3 个 molecules)
Day 3:       Step 3 (review canvas)
Day 4+:      Step 5 (token 收敛，可拉长)
```

---

## 五、Claude Code 执行约定

1. **不改既有 atoms 的 API**——只能加 prop、不能删
2. **每完成一个 step 跑一次 chat 页面**对照视觉
3. **遇到决策点先问**——例如"FormRow 的 horizontal 布局 label 占 30% 还是 fixed 200px"
4. **每个 commit 范围小**——一个 commit 一个 atom/molecule
5. **不引入新依赖**——除非本方案明确要求

---

## 六、产出 checklist

完成后这些应该存在：

- [ ] `src/design-system/tokens/motion.css`
- [ ] `src/design-system/tokens/z-index.css`
- [ ] `src/design-system/tokens/index.css` 更新（@import 新文件）
- [ ] `src/design-system/molecules/EmptyState/`
- [ ] `src/design-system/molecules/FormRow/`
- [ ] `src/design-system/molecules/Card/`
- [ ] `src/design-system/molecules/index.ts`
- [ ] `src/app/design-system/` 路由（review canvas）
- [ ] `src/design-system/README.md`
- [ ] 旧 token 替换 PR（可分批）

---

## 七、未来扩展（不在本方案内，等模块需求拉动）

- `Toolbar`、`SearchInput`、`Pagination`、`DataTable`、`FilterBar`、`Tabs (molecule 级，含 panel 联动)`、`Switch`、`Avatar`、`FileUpload`
- 国际化样张（中/英文字体表现差异）
- a11y 审计（focus-visible、screen reader、keyboard navigation 全覆盖）
- design-system 单元测试 / Visual regression（如 Playwright + Percy）

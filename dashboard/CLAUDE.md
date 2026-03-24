# Dashboard (openclaw-deck) Development Rules

## i18n — 零硬编码字符串

所有用户可见的文字（按钮、标签、标题、占位符、空状态、错误提示、tooltip）**必须**通过 `useTranslations()` 调用。

```tsx
// ✅ 正确
const t = useTranslations("routing");
<h3>{t("bindings")}</h3>
<Button>{t("addBinding")}</Button>

// ❌ 禁止
<h3>Binding Rules</h3>
<Button>Add Rule</Button>
```

- 翻译文件在 `src/i18n/zh.json`（中文）和 `src/i18n/en.json`（英文），两个文件必须同步更新
- 使用 `next-intl` 库，命名空间模式：`useTranslations("namespace")`
- 新增组件前先检查 `zh.json` 中是否已有对应 key，复用优先于新建
- `common` 命名空间包含通用文字（保存/取消/删除/加载中），优先使用

## 主题 — shadcn 标准 + 扩展令牌

### 架构

shadcn 标准变量是**唯一公共接口**。所有组件（`ui/` 和自定义）使用同一套命名，无翻译层。
扩展令牌只补充 shadcn 不覆盖的语义（状态色、品牌变体、三级文本等）。

### 速查表

**shadcn 标准（所有组件通用）：**

| 用途 | var() 写法 | Tailwind 写法 |
|------|-----------|--------------|
| 页面背景 | `var(--background)` | `bg-background` |
| 主文本 | `var(--foreground)` | `text-foreground` |
| 卡片/面板背景 | `var(--card)` | `bg-card` |
| 弹层背景 | `var(--popover)` | `bg-popover` |
| 次要文本/标签 | `var(--muted-foreground)` | `text-muted-foreground` |
| 静态灰底 | `var(--muted)` | `bg-muted` |
| 悬停/活跃态底 | `var(--accent)` | `bg-accent` |
| 品牌蓝/主按钮 | `var(--primary)` | `bg-primary` |
| 品牌前景（白字） | `var(--primary-foreground)` | `text-primary-foreground` |
| 边框 | `var(--border)` | `border-border` |
| 危险/删除 | `var(--destructive)` | `text-destructive` |
| 导航栏底 | `var(--sidebar)` | `bg-sidebar` |

**扩展令牌（shadcn 不覆盖）：**

| 类别 | 令牌 | 用途 |
|------|------|------|
| 三级文本 | `--text-tertiary` | 行号、时间戳、禁用态 |
| 边框变体 | `--border-subtle`, `--border-hover` | 细分割线、悬停边框 |
| 品牌变体 | `--primary-hover`, `--primary-muted`, `--primary-glow` | 悬停加深、浅蓝底、发光 |
| 状态指示 | `--status-connected/disconnected/reconnecting` | 连接状态 |
| 危险变体 | `--destructive-fg/muted/muted-text` | 白字、浅红底、红字 |
| 警告 | `--warning`, `--warning-fg/muted/muted-text` | 完整警告色系 |
| 成功 | `--success`, `--success-fg/muted/muted-text` | 完整成功色系 |
| 中性 | `--neutral-muted`, `--neutral-muted-text` | 灰色标签底 |
| 紫色 | `--purple`, `--purple-muted/muted-text` | 紫色强调 |
| 文档分类 | `--doc-summary/plan/spec/manual/draft` | 文档 badge |
| 技能警告 | `--skill-warning-bg/text` | 技能面板 |

### 常用代码模式

```tsx
// 蓝色主按钮（两种等价写法，选哪个都行）
className="bg-primary text-primary-foreground hover:bg-[var(--primary-hover)]"
style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}

// 活跃导航项
style={{ color: "var(--primary)", backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)" }}

// 浅蓝 badge
className="bg-[var(--primary-muted)] text-primary"

// 细微边框卡片
className="border border-[var(--border-subtle)] rounded-lg bg-card"

// 次要文本
className="text-muted-foreground"

// 三级文本（时间戳、行号）
className="text-[var(--text-tertiary)]"

// toggle 开关的白色圆点
className="bg-[var(--primary-foreground)]"
```

### 规则

1. **统一命名** — shadcn 标准名和扩展名均可在任何组件中使用，不区分 `ui/` 和自定义
2. **var() 和 Tailwind 等价** — `var(--muted-foreground)` = `text-muted-foreground`，选哪个都行
3. **新增令牌双定义** — `:root` 和 `.dark` 同时定义
4. **禁止硬编码** — 不使用 `#fff`, `bg-white`, `text-gray-*`（lightbox `bg-black/70` 除外）
5. **不存在的不引用** — 使用前确认 `globals.css` 中有定义

## HTML 合规 — 禁止交互元素嵌套

`<button>` 内不可包含 `<button>`、`<a>`、或其他交互元素。

常见陷阱及修复方式：

| 组件 | 默认渲染 | 嵌套时的修复 |
|------|---------|-------------|
| Base UI `TooltipTrigger` | `<button>` | 使用 `render={<span />}` prop |
| shadcn `AgentBadge` | `<span role="button">` | 已修复，不会嵌套 |
| Radix `CollapsibleTrigger` | `<button>` | 内部不放交互元素 |

## Gateway Allowlist — 新增 RPC 必须同步

当后端新增 Gateway RPC 方法时，**必须**同步更新 `dashboard/server/gateway-allowlist.ts`。

检查清单：
1. `src/gateway/server-methods/` 中注册了新方法 ✓
2. `src/gateway/method-scopes.ts` 中定义了作用域 ✓
3. `src/gateway/server-methods-list.ts` 中列入 ✓
4. **`dashboard/server/gateway-allowlist.ts` 中加入** ✓ ← 最容易遗漏

## 组件开发检查清单

新建或修改 dashboard 组件时，提交前确认：

- [ ] 所有用户可见文字使用 `t()` 调用（无硬编码中文或英文）
- [ ] `zh.json` 和 `en.json` 同步更新
- [ ] 颜色使用 shadcn 标准名或扩展令牌（无硬编码 `#fff`/`#000`、无 `bg-white`/`text-gray-*`）
- [ ] 使用的 CSS 变量在 `globals.css` 的 `:root` 和 `.dark` 中**均已定义**
- [ ] 无 `<button>` 嵌套（检查 Tooltip/Collapsible 内部）
- [ ] 新 Gateway RPC 已加入 allowlist
- [ ] `tsc --noEmit` 零错误

## Gateway Device Identity 认证

Dashboard 通过 Ed25519 device identity 认证连接 Gateway，获取 operator scope。

### 关键文件

- `dashboard/server/device-identity.ts` — 密钥生成、v3 签名 payload、持久化
- `dashboard/server/gateway-adapter.ts` — connect 握手（nonce 提取、签名、配对）
- `dashboard/migrations/008_device_identity.sql` — 密钥存储表

### 连接守则

1. **修改 `src/config/` schema/types 后必须 `pnpm build`** — Gateway 运行 `dist/` build output，schema 不一致会导致 config 校验失败
2. **签名 payload 的 `platform` 必须用 `CONNECT_CLIENT_PLATFORM`（"node"）** — 不是 `process.platform`（"darwin"）。Gateway 从 `connectParams.client.platform` 重建 payload 验证签名，两端必须一致
3. **Backend 模式不发 Origin header** — `shouldSkipBackendSelfPairing()` 要求 `!hasBrowserOriginHeader`，发 Origin 会导致 pairing-required 拒绝
4. **上游同步后连接失败的排查顺序**：
   - 查 Gateway 日志（`/tmp/openclaw-gateway.log` 或 `/tmp/openclaw/openclaw-YYYY-MM-DD.log`）
   - `reason: device-signature` → 签名 payload 不匹配（检查 v3 格式、platform、token 字段）
   - `reason: not-paired` → `shouldSkipBackendSelfPairing` 条件不满足（检查 Origin header、client.id/mode）
   - `missing scope: operator.read` → device identity 缺失或 scopes 被清空
   - `Unrecognized key` in config → schema 未同步，需要 `pnpm build`

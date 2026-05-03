## 1. Pre-flight checks

- [x] 1.1 Confirm `frontend-new/src/design-system/` 当前结构（atoms / hooks / tokens / dev/Gallery / index.ts）
- [x] 1.2 Confirm `pnpm test:deck-ui` baseline 全绿（实测 870/870；docs 写 240 已过时）
- [x] 1.3 Pre-existing tokens drift detected（mirror text-3 不同步 canonical）；4.3 一并修复
- [x] 1.4 列出 `frontend-handoff/modules/agents/` 已使用的所有 SVG icon 名（17 个）作为 lucide 映射的最小起点

## 2. design-system/icons/ 落地

- [x] 2.1 `lucide-react ^1.14.0` 已加到 `deck-go/frontend-new/package.json`
- [x] 2.2 `pnpm install` 通过；lucide-react 已安装到 node_modules
- [x] 2.3 创建 `frontend-new/src/design-system/icons/` 目录 + `README.md`（lucide → semantic 映射表 24 项）
- [x] 2.4 `icons/index.ts` 用 named re-export 24 个 icon（domain / action / nav / visibility / status 五组）
- [x] 2.5 `icons/__tests__/icons.test.tsx` 4 cases：barrel guard / forwardRef shape / README coverage / individual re-export 形式
- [x] 2.6 `icons/__tests__/icons-a11y.test.tsx` 5 cases：默认 aria-hidden / aria-label override / decorative 配 labeled control / informative axe / size 传递
- [x] 2.7 在 `dev/Gallery` 加 icons swatch grid（按字母排序，name + 视觉缩略；24 项 auto-fill grid）
- [x] 2.8 跑 `pnpm test:deck-ui` 全绿（879/879，+9 新增 cases）
- [x] 2.9 跑 `pnpm build` 成功；prod bundle 中 lucide content = 0 字节（Gallery 是 dev-only lazy import；面板未消费 icon 前 prod 不引入）；tree-shake 验证通过

## 3. design-system/patterns/ 落地

- [x] 3.1 创建 `frontend-new/src/design-system/patterns/` 目录 + `README.md`（含 6 patterns 列表 + 反哺 gate 引用）
- [x] 3.2 实现 `PageShell.tsx + page-shell.css`：max-width + padding + 进场动画 200ms cubic-bezier
- [x] 3.3 实现 `NavRail.tsx + nav-rail.css`：64px 宽 + brand slot + items（active aria-current）+ 760px 以下隐藏
- [x] 3.4 实现 `TopBar.tsx + top-bar.css`：brand 左 + actions 右 + ⌘K 入口 button（aria-keyshortcuts）
- [x] 3.5 实现 `EmptyState.tsx + empty-state.css`：icon 上 + title + description + action 下 + tone 三档（neutral/search/error）
- [x] 3.6 实现 `KbdHint.tsx + kbd-hint.css`：keys 数组 → kbd chip 序列，3px gap，无 + glyph
- [x] 3.7 实现 `SectionHeader.tsx + section-header.css`：h2 + hint mono + actions slot 右对齐
- [x] 3.8 创建 `patterns/index.ts` barrel + 类型导出
- [x] 3.9 顶级 `design-system/index.ts` 加 `export * from "./patterns"` + `export * from "./icons"`
- [x] 3.10 每个 pattern 写 `__tests__/<Pattern>.test.tsx`：渲染 + props 行为 + a11y（vitest-axe）
- [x] 3.11 在 `dev/Gallery` 加 patterns 展区（PageShell+NavRail+TopBar 组合 / EmptyState 三 tone / KbdHint sm+md / SectionHeader）
- [x] 3.12 跑 `pnpm test:deck-ui` 全绿（914/914，+35 新增 pattern 测试 cases）

## 4. CSS 合规自检

- [x] 4.1 grep `frontend-new/src/design-system/patterns/*.css` 内 hex 字面量（0）
- [x] 4.2 grep `frontend-new/src/design-system/patterns/*.css` 内 rgb()/hsl() 字面量（0，除 color-mix 外）
- [x] 4.3 同步 mirror tokens.css；`bash deck-go/scripts/check-tokens-drift.sh` exit 0
- [x] 4.4 `cd deck-go/frontend-new && pnpm exec tsc --noEmit` 全绿

## 5. 协议 + 决策更新

- [x] 5.1 更新 `docs/project/stack-decisions.md`：
  - 增加 Pattern 物理结构 / Icon 库（lucide-react ^1.14.0）/ Prototype 字符串规则三条进入 Locked
  - 移除 Pending 段图标库条目
  - 修订历史追加 2026-05-04 条目
  - Last reviewed 更新到 2026-05-04
- [x] 5.2 更新 `frontend-handoff/CLAUDE.md`：
  - Translation rules 表增加 hardcoded text / patterns / icons 行
  - 新增 "Prototype string rule" 子段（hardcoded / no t() / no next-intl / 工程实施一次性抽 i18n）
  - 新增 "Sourcing patterns and icons" 子段（cross-module shell 与 icon 必走 `@/design-system/patterns` + `@/design-system/icons`）
- [x] 5.3 更新 `frontend-new/CLAUDE.md`：Who maintains what 表格增加 `src/design-system/patterns/` 和 `src/design-system/icons/` 两行（Owner: Claude Code）

## 6. 反哺候选记录

- [x] 6.1 创建 `frontend-handoff/design-system/proposals/2026-05-04-agents-reflowback-candidates.md`（Avatar / ListRow / StatusPill / FileRow 四候选；每个含位置 / 形态 / 当前不促升原因 / 促升 criterion）
- [x] 6.2 创建 `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`（首次落地数据文件）：含 patterns × panel 矩阵 + icons × panel 概览 + 反哺候选 appendix（链接到 6.1）

## 7. 全量验证

- [x] 7.1 `cd deck-go/frontend-new && pnpm exec tsc --noEmit` 全绿（exit 0）
- [x] 7.2 `cd deck-go/frontend-new && pnpm test:deck-ui` 全绿（914/914；含 atoms 870 baseline + icons 9 + patterns 35）
- [x] 7.3 `cd deck-go && pnpm check`（lint + format）：本 change 触及文件 0 errors（workspace 总 1014 errors 全部 pre-existing 在 extensions/memory-lancedb 等）
- [x] 7.4 `bash deck-go/scripts/check-tokens-drift.sh` exit 0
- [x] 7.5 `cd deck-go/frontend-new && pnpm build` 成功（1.29s）；prod bundle lucide content = 0 字节（Gallery dev-only）
- [ ] 7.6 浏览器手动验证 `?dsGallery=1`：6 个 pattern 全可见 + 24 个 icon swatch 可见（**待用户手动验证**）

## 8. 文档与移交

- [x] 8.1 更新 `deck-go/docs/project/current-state.md`：Snapshot date → 2026-05-04；Design system canonical 段加 Patterns + Icons 行；OpenSpec change 表格加本 change 条目
- [x] 8.2 更新 `deck-go/docs/CLAUDE.md` Status 段：patterns + icons + 原型字符串规则三条 ✅；下一步指向 24 panel 量产
- [x] 8.3 验证 `openspec status --change deck-go-frontend-foundation-readiness` 4/4 artifacts complete + `openspec validate` 通过
- [x] 8.4 两个 commit 落地：`490caa24cd` (agents prototype + Codex assessment) + `3399898dfd` (foundation-readiness)

## 9. 收尾

- [ ] 9.1 等待用户审批后 archive change
- [ ] 9.2 archive 后通知：24 panel 量产可以开始，下一步推荐先做 channels（list/detail 同形态可验证 patterns）

## 1. 前置确认

- [x] 1.1 确认 change `deck-go-frontend-protocol-v1` 已 archive（`openspec list --json` 检查）— archive 完成 `2026-05-01-deck-go-frontend-protocol-v1`
- [x] 1.2 阅读现有 `deck-go/frontend/package.json` / `vite.config.ts` / `tsconfig.json` / `vitest.config.ts` / `index.html` / `scripts/`，确认这些是要迁移的项 — 发现 4 个偏离 cp 的决策点（详见 commit message）：删 `check-deck-ui-host.mjs`、删 `next-intl` alias（vite + tsconfig + vitest 三处）、`main.tsx` 替换 DeckGoApp/DeckRoot 为 placeholder App、不迁 `theme.css`

## 2. 创建 frontend-new/ 工程基础

- [x] 2.1 `mkdir -p deck-go/frontend-new/src/{design-system,components/panels}`
- [x] 2.2 cp `frontend/package.json` → `frontend-new/package.json`；修改 name 为 `deck-go-frontend-new`、dev 端口 5175、preview 端口 4175 — 同时移除 `check:deck-ui-host` 节点（legacy frontend-only guard）
- [x] 2.3 cp `frontend/package-lock.json` → `frontend-new/`（保 dep 版本一致）
- [x] 2.4 cp `frontend/vite.config.ts` / `tsconfig.json` / `tsconfig.tsbuildinfo` / `vitest.config.ts` / `index.html` → `frontend-new/`（必要时调整文件内的端口/路径引用）— 端口 5174→5175 / 4174→4175；删 next-intl alias（vite.config + tsconfig.paths + vitest.config 三处）；删 stale `tsconfig.tsbuildinfo`
- [x] 2.5 cp `frontend/scripts/`（如 `check-deck-ui-host.mjs` 等）→ `frontend-new/scripts/`；如脚本含 frontend/ 硬编码路径要修 — **未 cp**：该 guard 校验 `src/deck-ui/App.tsx` / 退役的 restoration 文件 / panel-readiness 等 frontend-only 结构，对 placeholder App 的 frontend-new 不适用；package.json `build` 脚本同步移除其调用
- [x] 2.6 写一份 `frontend-new/README.md`：说明这是 protocol-v1 下的干净工作区、与 frontend/ 双轨并存、未来切换日替代 frontend/

## 3. 迁移 design system 全套

- [x] 3.1 cp `frontend/src/design-system/tokens/` → `frontend-new/src/design-system/tokens/`
- [x] 3.2 cp `frontend/src/design-system/atoms/`（含 36 .tsx + .css + index.ts barrel + **tests**/）→ `frontend-new/src/design-system/atoms/` — 74 entries（36 .tsx + 36 .css + index.ts + **tests**/）
- [x] 3.3 cp `frontend/src/design-system/hooks/`（含 **tests**/）→ `frontend-new/src/design-system/hooks/` — 7 entries（5 hook + index.ts + **tests**/）
- [x] 3.4 cp `frontend/src/design-system/dev/`（Gallery）→ `frontend-new/src/design-system/dev/`
- [x] 3.5 cp `frontend/src/main.tsx` → `frontend-new/src/main.tsx`（保留 fontsource imports + dsGallery 逻辑）— 重写：保留 7 行 fontsource imports + dsGallery URL-param 逻辑；用 `import "./design-system/tokens/index.css"` 替代 `import "./theme.css"`；用 `<App/>` placeholder 替代 `<DeckGoApp/>` + `<DeckRoot>` wrapper

## 4. 占位 App 组件

- [x] 4.1 在 `frontend-new/src/` 创建占位 `App.tsx`：渲染一个简单 placeholder 文案"frontend-new scaffolded — modules pending"，含主题切换/density 切换最小演示（可选）— 含 theme（dark/light）+ density（comfortable/compact）双 toggle，演示 `--ds-*` token live 切换
- [x] 4.2 修改 `frontend-new/src/main.tsx` 让默认（无 dsGallery 参数）渲染该占位 App
- [x] 4.3 创建 `frontend-new/src/components/panels/.gitkeep` 让空目录被 git 追踪

## 5. 验证可启动可测试

- [x] 5.1 `cd frontend-new && npm install`（首次安装、可能耗时数分钟，用 run_in_background）— 107 packages added · 0 vulnerabilities · 4s
- [x] 5.2 `cd frontend-new && npm run dev` 启动到端口 5175，无错误 — Vite ready，端口 5175
- [x] 5.3 浏览器访问 `http://localhost:5175/` 看到占位 App — playwright snapshot：`heading "frontend-new scaffolded"` + theme/density radiogroup 渲染正确
- [x] 5.4 浏览器访问 `http://localhost:5175/?dsGallery=1` 看到 Gallery + 36 atom 样张 — playwright snapshot：8 大类（Action / Status / Streaming / Container / Text / Form / Navigation / Overlay）全部渲染
- [x] 5.5 `cd frontend-new && npm run test:deck-ui` 全绿 — `Test Files 41 passed (41) · Tests 240 passed (240)`
- [x] 5.6 `cd frontend-new && npx tsc --noEmit` 通过 — exit 0
- [x] 5.7 `cd ../ && bash scripts/check-tokens-drift.sh` exit 0 — drift 脚本自动适配（探测到 `frontend-new/src/design-system/tokens/index.css` 存在，自动改用此路径作为 canonical），exit 0

## 6. 双轨期标注

- [x] 6.1 在 `frontend/src/design-system/README.md`（如存在）顶部加一行"⚠️ frozen — see frontend-new/src/design-system/" — 该 README 不存在，已跳过
- [x] 6.2 确认 `frontend/CLAUDE.md` 顶部冻结提示在（来自 protocol-v1）— 在；本 change 期间增补一行"已 scaffolded 完整 design system canonical"指向新工作区

## 7. 验证 + 提交

- [x] 7.1 `openspec validate deck-go-frontend-new-scaffold` 通过 — `Change 'deck-go-frontend-new-scaffold' is valid`
- [x] 7.2 `git status` 确认仅 frontend-new/ 新增 + frontend/ 仅极小提示性修改 — 确认（frontend/CLAUDE.md 一行追加；其余全部 frontend-new/ 新增）
- [x] 7.3 用 `scripts/committer` 单 commit："scaffold frontend-new with full design system migration"
- [x] 7.4 在 `frontend-new/CLAUDE.md` Status 段更新：scaffolded + DS migrated；下一步 chat 迁移（change 3）

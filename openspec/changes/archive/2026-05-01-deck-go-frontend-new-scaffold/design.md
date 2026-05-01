## Context

protocol-v1 落定后，需要一个**物理上干净**的 deck-go 前端工作区让协议落地。当前 `deck-go/frontend/src/components/panels/` 下有 24 个从 legacy `dashboard/` 移植的占位 panel 与 chat pilot 真实代码混杂，设计 agent 读不出哪个是模式 anchor、哪个是历史遗物。但工程基础（package.json / Vite / TS / vitest / 36 atoms / tokens / hooks）都是稳定可用的，重写它们没意义。本 change 在 `frontend-new/` 复刻基础工程 + 完整 design system，不带 legacy panel 包袱，为 chat 模块的协议化迁移（change 3）做铺垫。

用户已明确授权"前端不可用一段时间"——这授权在本 change 期间体现为 frontend-new 是独立工作区（独立端口、独立测试），与现有 `frontend/` 双轨并存。

## Goals / Non-Goals

**Goals:**

- 在 `deck-go/frontend-new/` 建立完整可运行的 Vite + React + TS 工作区
- 整体迁移 design system canonical（tokens + 36 atoms + hooks + Gallery + 测试）
- 为 chat 模块进入留好"空 panels 目录 + 已就绪 DS"的 baseline
- 验证：dev server 能启动、所有 atom/hook 测试全绿、Gallery 路由 `?dsGallery=1` 可访问

**Non-Goals:**

- 不删除/修改现有 `deck-go/frontend/`（双轨期）
- 不迁移任何业务 panel（chat 在 change 3，其他在未来）
- 不迁移 legacy `theme.css` 8676 行老主题（彻底走 `--ds-*`）
- 不接入 frontend-new 的测试到主 CI 流水线（chat 落地后再考虑）
- 不做 frontend → frontend-legacy 的切换（独立 change，未来某次完成）
- 不修改任何上游/后端代码

## Decisions

### Decision 1: 用 cp 不用 git mv 做迁移

**选项**: (A) `git mv frontend/src/design-system/ frontend-new/src/design-system/` 让 git 识别为 rename / (B) `cp -r` 复制保留原文件

**选 B，理由**: 双轨期 `frontend/` 仍要可跑（其他 panel/route 仍 import design-system）。git mv 会破坏 frontend/ 的 import。代价：git 不会识别为 rename，但本 change 落定后我们不再修改原 design-system，未来切换日做 `git mv frontend → frontend-legacy` + `git mv frontend-new → frontend` 时整体 rename 会被识别。

### Decision 2: 端口选 5175（避开 frontend 的 5174）

`frontend/package.json` 用 `vite --port 5174`；`frontend-new` 用 `--port 5175`。preview 用 `--port 4175`（错开 4174）。

### Decision 3: package.json name 改为 `deck-go-frontend-new`

避免和 `deck-go-frontend` 名字冲突；切换日时改回 `deck-go-frontend`。

### Decision 4: 保留独立 node_modules

不共享 node_modules、不用 workspace 管理。理由：双轨期版本可能漂移；独立装最清爽。代价：磁盘 ~500MB 翻倍——可接受。

### Decision 5: 测试入口走 `npm run test:deck-ui` 沿用 frontend 同名

保持脚本签名不变，路径自动对到 frontend-new。这样未来切换日不用改 CI 调用方。

### Decision 6: Gallery 路由保留

`?dsGallery=1` URL 参数路由是设计系统活样张——design agent 可用浏览器看 36 atoms 视觉。Gallery 代码整体迁移过去。

## Risks / Trade-offs

- **风险**: cp 后 design-system 内部 import 路径（如果有 `from "../tokens"`）若用相对路径要看具体如何引用  
  **缓解**: 全部用 `@/` alias（已在 tsconfig.json 配置），cp 后 alias 仍指向 frontend-new/src/，无需改路径
- **风险**: `vitest-axe` / `@fontsource/*` 等 dep 重新装可能拉错版本  
  **缓解**: 整体复制 `package.json` + `package-lock.json`，确保版本锁
- **风险**: scripts/check-deck-ui-host.mjs 可能依赖 frontend/ 路径  
  **缓解**: 一并复制 scripts/ 子目录；如果有路径依赖，本 change 期内修复
- **风险**: 迁移完后两份 design-system 同时存在，未来若有人改其中一份会漂移  
  **缓解**: 在原 `frontend/src/design-system/` 加 README 标注"frozen — see frontend-new"

## Migration Plan

1. 创建 `deck-go/frontend-new/` 空目录
2. cp 工程基础：`package.json` / `package-lock.json` / `vite.config.ts` / `tsconfig.json` / `tsconfig.tsbuildinfo` / `vitest.config.ts` / `index.html` / `README.md` / `scripts/`
3. cp `src/main.tsx`（保持现有 fontsource imports + dsGallery 逻辑）
4. cp `src/design-system/`（整棵子树）
5. 修改 `frontend-new/package.json`：name 改为 `deck-go-frontend-new`，dev/preview 端口 5175/4175
6. 修改 `frontend-new/index.html`（如需）
7. cd `frontend-new && npm install`（验证依赖装好）
8. 创建空 `src/components/panels/`（chat 在 change 3 进）
9. 暂时为 main.tsx 提供一个最小 App 组件（仅占位，能让 dev server 启动而不报错）
10. 验证：`npm run dev` 启动到 5175、`npm run test:deck-ui` 全绿、`?dsGallery=1` 可访问
11. 在原 `frontend/src/design-system/README.md` 顶部加冻结提示（如果有 README）
12. commit：按 `scripts/committer` 提交

**回滚**: `git rm -r deck-go/frontend-new/` 单步回滚；老 frontend/ 完全未动。

## Open Questions

- main.tsx 的占位 App 组件用什么？建议：一个空 `<DeckRoot>` 包裹的 placeholder，显示"frontend-new scaffolded — modules pending"
- scripts/check-deck-ui-host.mjs 是否要保留？需读其内容判断
- README.md 是否有内容要保留还是新写一份说明 frontend-new 用途？倾向新写

## Why

按 protocol-v1 协议，deck-go 前端工程需要一个**干净 baseline**——但当前 `deck-go/frontend/src/components/panels/` 下有 24 个从 legacy `dashboard/` 移植的占位 panel 与 chat pilot 真实成果共存，设计 agent 读不出哪个是模式 anchor、哪个是历史遗物。用户已授权前端在过渡期可以不可用一段时间。本 change 在 `frontend-new/` 建立物理上干净、按协议组织的工程骨架，把 design system 整体平移过去（不重写），为下一步 chat 模块的协议化迁移做铺垫。

## What Changes

- 新建 `deck-go/frontend-new/` 工作区（不删除、不修改现有 `deck-go/frontend/`）
- 整体迁移工程基础：`package.json` / `vite.config.ts` / `tsconfig.json` / `vitest.config.ts` / `index.html` / `src/main.tsx` / `scripts/`（如需保留）
- 整体迁移 design system：`src/design-system/tokens/` + `atoms/` + `hooks/` + `dev/Gallery` 全套（含 **tests**）
- **不**迁移：24 legacy panel（agents/models/channels 等）、`theme.css` 8676 行老主题、与 dashboard/legacy 牵连代码
- 空 `src/components/panels/`（chat 模块在 change 3 迁移）
- 落定 `frontend-new/CLAUDE.md`（来自 protocol-v1）；`frontend-new/README.md` 简要说明这是新工作区
- 验证：`cd frontend-new && npm install && npm run dev` 启动成功、`npm run test:deck-ui` 全绿（Gallery 路由 `?dsGallery=1` 可访问）
- 切换日（**不在本 change 范围**）：未来某次 change 把 `frontend → frontend-legacy`、`frontend-new → frontend`，本 change 仅落 `frontend-new`

## Capabilities

### New Capabilities

- `frontend-new-workspace`: 按 protocol-v1 组织的 deck-go 前端干净工作区——含工程基础（Vite/TS/Vitest）、完整 design system canonical（tokens + 36 atoms + hooks + Gallery）、空模块目录、`frontend-new/CLAUDE.md` 入口。是后续所有新模块的物理着陆点

### Modified Capabilities

（无）

## Impact

- 文件：`deck-go/frontend-new/`（新建整棵树）；`deck-go/frontend/`（**完全不动**）
- 工程：新增独立 `npm install` 节点；运行端口可能与现有 `frontend` 冲突（建议错开如 5175）
- CI：暂不接入 `frontend-new` 的测试到主流水线（在 change 3 chat 迁移完成、验证可用后再考虑）
- 依赖：依赖 change 1 (`deck-go-frontend-protocol-v1`) archive 完成（CLAUDE.md 协议必须先就位）
- 解锁：change 3 (`deck-go-chat-protocol-pilot`) 迁 chat 进 `frontend-new/src/components/panels/chat/`

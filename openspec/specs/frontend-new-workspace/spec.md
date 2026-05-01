# frontend-new-workspace Specification

## Purpose

TBD - created by archiving change deck-go-frontend-new-scaffold. Update Purpose after archive.

## Requirements

### Requirement: frontend-new 必须独立于 frontend 共存

`deck-go/frontend-new/` SHALL 是完整、独立、可运行的 Vite + React + TS 工作区。本 change 完成后，`deck-go/frontend/` 和 `deck-go/frontend-new/` MUST 同时可用且互不影响（独立 node_modules、独立端口、独立 npm scripts）。

#### Scenario: 双轨同时启动

- **WHEN** 用户在两个终端分别 `cd frontend && npm run dev` 和 `cd frontend-new && npm run dev`
- **THEN** 两个 dev server MUST 都能启动，分别监听 5174 和 5175 端口

#### Scenario: 老 frontend 完全未受影响

- **WHEN** 检查 `deck-go/frontend/` 在本 change 前后的 git diff
- **THEN** 仅允许 `frontend/src/design-system/README.md` 顶部加一行冻结提示和 `frontend/CLAUDE.md` 顶部加冻结提示（如果未在 protocol-v1 加过），其余 MUST 完全未动

### Requirement: design system 完整迁移到 frontend-new

`deck-go/frontend-new/src/design-system/` MUST 包含完整的 design system canonical：

- `tokens/index.css`（与 `frontend/src/design-system/tokens/index.css` 字节级一致）
- `atoms/`（36 个 atom 的 `.tsx` + `.css` + `index.ts` barrel + `__tests__/`）
- `hooks/`（含 `__tests__/`）
- `dev/Gallery`（活样张）

#### Scenario: 检查 atom 数量与 frontend 一致

- **WHEN** `ls frontend-new/src/design-system/atoms/*.tsx | wc -l` 与 `ls frontend/src/design-system/atoms/*.tsx | wc -l`
- **THEN** 两者数字 MUST 相等

#### Scenario: tokens 字节一致

- **WHEN** `diff frontend/src/design-system/tokens/index.css frontend-new/src/design-system/tokens/index.css`
- **THEN** 输出 MUST 为空

### Requirement: frontend-new 必须可启动可测试

本 change 完成后，frontend-new SHALL 可以从干净 checkout 安装并启动 dev server、可以全量跑 vitest 测试套件、Gallery 路由可访问。

#### Scenario: dev server 启动

- **WHEN** `cd frontend-new && npm install && npm run dev`
- **THEN** Vite dev server MUST 在端口 5175 启动成功，无错误

#### Scenario: 测试套件全绿

- **WHEN** `cd frontend-new && npm run test:deck-ui`
- **THEN** 所有迁移的 atom/hook 测试 MUST 通过

#### Scenario: Gallery 路由可访问

- **WHEN** 浏览器访问 `http://localhost:5175/?dsGallery=1`
- **THEN** 设计系统画廊页面 MUST 渲染，所有 36 atom 的样张可见

### Requirement: panels/ 目录必须为空（等待 chat 迁移）

`deck-go/frontend-new/src/components/panels/` MUST 存在但为空目录（仅 .gitkeep 占位）。`main.tsx` MUST 渲染一个简单占位 App 组件，标识"frontend-new scaffolded — modules pending"。

#### Scenario: panels 目录是空的

- **WHEN** `ls frontend-new/src/components/panels/`
- **THEN** 仅 `.gitkeep` 一个文件（无 panel 子目录）

#### Scenario: 占位 App 显示

- **WHEN** 浏览器访问 `http://localhost:5175/` （不带 dsGallery 参数）
- **THEN** 页面 MUST 显示一个 placeholder 文案，明示当前为 scaffolded 状态、模块待迁入

### Requirement: 端口/包名必须避免与 frontend 冲突

`frontend-new/package.json` 字段 SHALL 满足：

- `name`: `deck-go-frontend-new`（区别于 `deck-go-frontend`）
- `scripts.dev`: 含 `--port 5175`
- `scripts.preview`: 含 `--port 4175`

#### Scenario: 同时启动 dev server 不冲突

- **WHEN** 双轨同时 `npm run dev`
- **THEN** 两个进程 MUST 都启动，端口 5174/5175 各自占用，无 EADDRINUSE 错误

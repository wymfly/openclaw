## Context

deck-go 前端目前共 3 份 CLAUDE.md（`docs/`、`frontend/`、`frontend-handoff/`）描述双 agent 协议，是基于 legacy `dashboard/`（Next.js）想象写成的——但真实 `frontend/` 是 Vite + React 19 + TS 5，已有 36 个 atom canonical、`tokens/index.css` 144 行成熟 token 集、chat 模块作为唯一 Claude Design pilot 落地。协议中关于 `next-intl` / `TanStack Query` / `Zustand` / `React Router` / `tokens/tokens.css` / `atoms/<Atom>/` 三件套结构等假设和真实不一致；同时缺乏"如何快速获悉当前状态"的 orientation 路径、token 漂移防护、atom 复用 gate 等结构性约束。

之前 brainstorm 已确认：状态发现**不引入 STATE.md / INVENTORY.md / CHANGELOG.md 等 journal 文件**，而是"目录树即状态、代码即真相"——协议只规定 agent 落地后按什么顺序读哪些目录，状态自然从树和 README Status 行涌现。

## Goals / Non-Goals

**Goals:**

- 三份 CLAUDE.md 修正到能被设计 agent 和 Claude Code 双方读完即可上手的水平
- 把"具体技术栈选择"从协议解耦到 `docs/project/stack-decisions.md`，让协议能跨栈复用
- 通过 orientation 路径，使 agent 落地不依赖记忆，只依赖当前目录树
- 加入 8 条结构性增强（lite handoff / 反向签收 / atom 复用 gate / pattern 层 / 后端契约协商 / 冲突分级 / token drift CI / version lock）填补协议漏洞
- 一次性反向同步 `frontend-handoff/design-system/tokens.css` 与真实 `frontend/.../tokens/index.css` 一致，并提供 drift 检测脚本

**Non-Goals:**

- 不修改任何 `frontend/src/` 工程代码（那是 change 2/3 的事）
- 不建 `frontend-new/`（change 2）
- 不迁移 chat（change 3）
- 不引入 STATE.md / INVENTORY.md / CHANGELOG.md（已被 brainstorm 否决）
- 不接 drift CI 进当前流水线（写脚本但不接入；切换到 frontend-new 后再接）

## Decisions

### Decision 1: `frontend-new/CLAUDE.md` 现在落，而不是切换日才落

**选项**: (A) 现在就在 `frontend-new/CLAUDE.md`（即将的真实位置）写定 / (B) 等切换日才把 `frontend/CLAUDE.md` 替换

**选 A，理由**: protocol-v1 一定要在 `frontend-new/` 真实工程里同步生效，否则 change 2 建骨架时无指引；切换日才落会导致 change 2 期间用错协议。代价：`frontend/CLAUDE.md` 老版本暂留不动，双轨持续到切换日，但其内容明确标注"see frontend-new/CLAUDE.md"，不会误导。

### Decision 2: 状态发现 = 目录树 + README Status 行

**选项**: (A) 引入显式 STATE.md / INVENTORY.md / CHANGELOG.md / (B) 仅靠目录树 + 每个 module README 的 `Status:` 行 + git log

**选 B，理由**: journal 文件 100% 会和真相分叉（agent 改了忘了 mirror）；目录树 `ls modules/` 永远是真相；`atoms/index.ts` barrel 因为是真实 import 表面，不会撒谎。协议只需在 CLAUDE.md 里写"orientation 路径"，让落地的 agent 按顺序读真实目录。

### Decision 3: 技术栈从协议解耦到 `stack-decisions.md`

**选项**: (A) 协议直接写"用 Zustand / TanStack Query" / (B) 协议只描述契约（"server state 与 UI state 分桶"），具体库由 stack-decisions.md 决定

**选 B，理由**: 协议绑库会导致换库就要改协议；协议绑契约则只管"职责正交"，库换不换由项目实际工程决定。落地时双方读契约 + 当前栈决议两份文件。

### Decision 4: tokens 双向同步用 CI 防漂移而非协议条款

**选项**: (A) 协议条款"双方记得同步" / (B) 写 `scripts/check-tokens-drift.sh` 脚本，未来接入 CI 强制阻断

**选 B，理由**: 软约束在协作中必然失败（必须同步的事忘记 100%）。脚本现在写，CI 接入推迟到 frontend-new 切换日，避免现阶段双轨期间脚本误报。

### Decision 5: 8 条结构性增强统一进 `frontend-handoff/CLAUDE.md`

新增 8 条（lite handoff / 反向签收 / atom 复用 gate / pattern 层 / 后端契约协商 / 冲突分级 / token drift CI / version lock）都写进 `frontend-handoff/CLAUDE.md` 而不是单独文件——一处可读。版本号 `protocol-v1` 写进文件顶部 frontmatter 风格的元数据行。

### Decision 6: `current-state.md` 是人类可读快照，不是 journal

**用途**: 帮 agent 第一次落地时快速理解项目；按需更新（每 1-2 月或大变动时）；不是状态记录系统。  
**内容**: chat 模块文件清单概要、36 atoms 清单、tokens 全集摘要、24 legacy panel 列表、字体 @fontsource 现状、Vite/React/TS 版本。

## Risks / Trade-offs

- **风险**: 双轨 CLAUDE.md（旧 `frontend/` + 新 `frontend-new/`）可能让 agent 困惑读哪份  
  **缓解**: 在旧 `frontend/CLAUDE.md` 顶部加一行"⚠️ 此目录已冻结，新工作 see ../frontend-new/CLAUDE.md"
- **风险**: `current-state.md` 会和真实代码分叉（journal 失效问题的变种）  
  **缓解**: 文件顶部明确标注"快照、按需手工更新、不是状态记录系统"；过期不算 bug
- **风险**: 8 条结构性增强写得太多，agent 读不完就跳过  
  **缓解**: CLAUDE.md 里 8 条加在末尾"扩展条款"段，前面正文保持原长；每条 1-2 句

## Migration Plan

1. 写 `docs/project/stack-decisions.md`、`docs/project/current-state.md`
2. 反向同步 `frontend-handoff/design-system/tokens.css` ← `frontend/src/design-system/tokens/index.css`
3. 改 `frontend-handoff/CLAUDE.md`（不改文件路径）
4. 改 `docs/CLAUDE.md`（不改文件路径）
5. 创建 `deck-go/frontend-new/CLAUDE.md`（仅 CLAUDE.md，不建其他目录）；同时在 `deck-go/frontend/CLAUDE.md` 顶部加冻结提示
6. 写 `deck-go/scripts/check-tokens-drift.sh`（可执行，不接 CI）
7. 单 commit："launch protocol-v1 + reverse-sync tokens"

**回滚**: `git revert` 单 commit 即可，无工程代码影响。

## Open Questions

（无重大未决项；brainstorm 阶段已锁定方案）

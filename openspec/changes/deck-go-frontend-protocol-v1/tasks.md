## 1. 支撑文档先行（解耦协议）

- [x] 1.1 创建 `deck-go/docs/project/stack-decisions.md`：列出当前已确定栈（React 19 / Vite 7 / TS 5 / vitest-axe / @fontsource）+ 待决议项（server-state / shared-state / routing / i18n）+ 决议方法说明
- [x] 1.2 创建 `deck-go/docs/project/current-state.md`：项目代码现状人类可读快照——chat pilot done、36 atoms canonical、tokens 实际内容摘要、24 legacy panel 列表、字体 fontsource 现状

## 2. tokens 反向同步 + drift 检测脚本

- [x] 2.1 用真实 `frontend/src/design-system/tokens/index.css` 整段覆盖 `frontend-handoff/design-system/tokens.css`（保留 handoff 文件顶部"design source mirror"注释段，仅替换 :root token 定义部分）
- [x] 2.2 创建 `deck-go/scripts/check-tokens-drift.sh`（可执行）：用 `diff` 比较两份 token 文件的 token 定义部分，一致 exit 0、不一致打印 diff 后 exit 1
- [x] 2.3 本地运行 `scripts/check-tokens-drift.sh` 验证 exit 0

## 3. 改写 frontend-handoff/CLAUDE.md（核心协议层）

- [x] 3.1 顶部加 protocol-v1 元数据行 + 链接到 docs/CLAUDE.md 和 frontend-new/CLAUDE.md
- [x] 3.2 删除 next-intl / TanStack Query / Zustand / React Router 等硬编码栈假设；翻译规则表的"具体库选择"列改为 `see docs/project/stack-decisions.md`
- [x] 3.3 加 orientation 段：双方落地后按什么顺序读哪些目录（不引入任何 journal 文件）
- [x] 3.4 加协作互惠原则段：双方互为对方下一轮输入
- [x] 3.5 加 8 条结构性增强条款（lite handoff / 反向签收 / atom 复用 gate / pattern 层 / 后端契约协商 / 冲突分级 / token drift CI / version lock）
- [x] 3.6 修正目录结构示例：tokens 路径改成 `tokens/index.css`；atoms 改成扁平风（Badge.tsx + badge.css）
- [x] 3.7 Status 段更新：标注 first pilot = chat（migration in change 3）

## 4. 创建 frontend-new/CLAUDE.md（新真实工程入口）

- [x] 4.1 创建 `deck-go/frontend-new/CLAUDE.md`（仅文件，不建其他目录——目录在 change 2 建）
- [x] 4.2 内容结构：顶部元数据 + 链接其他两份；目录结构（按真实风格：tokens/index.css + 扁平 atoms）；orientation 段；技术栈段指向 stack-decisions.md；不嵌入具体库；Status 段标注待 change 2 物理建立

## 5. 改写 docs/CLAUDE.md（项目导航）

- [x] 5.1 顶部三入口列表加 frontend-new/CLAUDE.md（与 frontend/CLAUDE.md 并列、标注后者为 frozen）
- [x] 5.2 docs 目录结构段加上 `project/stack-decisions.md` 和 `project/current-state.md`
- [x] 5.3 Status 段更新：✅ 协议 v1 落定；下一步 frontend-new scaffold + chat 迁移；24 legacy panel 待重做

## 6. 旧 frontend/ 加冻结提示

- [x] 6.1 在 `deck-go/frontend/CLAUDE.md` 顶部加一段冻结提示，引导读者切换到 `frontend-new/CLAUDE.md`
- [x] 6.2 在 `deck-go/frontend/src/design-system/README.md`（如存在）顶部加冻结提示；如不存在则跳过 — 文件不存在，已跳过

## 7. 验证 + 提交

- [x] 7.1 `openspec validate deck-go-frontend-protocol-v1` 通过 — `Change 'deck-go-frontend-protocol-v1' is valid`
- [x] 7.2 三份 CLAUDE.md 互引链接可点（人工核对）— grep 确认 docs/frontend-new/frontend-handoff 三方各自链接到另外两份 + stack-decisions + current-state + check-tokens-drift
- [x] 7.3 `scripts/check-tokens-drift.sh` 在最终 commit 后 exit 0 — 已验证 (`check-tokens-drift: ok`)
- [x] 7.4 用 `scripts/committer` 单 commit 落定："launch protocol-v1 + reverse-sync tokens"

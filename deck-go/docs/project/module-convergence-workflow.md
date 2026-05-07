---
title: deck-go 模块收敛开发流程
status: draft
created: 2026-05-07
tags:
  - deck-go
  - workflow
  - openspec
  - product-design
  - real-e2e
  - frontend-new
source_of_truth:
  - code
  - gateway-contracts
  - contracts/source
  - openspec
  - tests
related:
  - "./contract-chain-guide.md"
  - "../../frontend-new/CLAUDE.md"
  - "../../frontend-handoff/CLAUDE.md"
  - "../skills/README.md"
---

# deck-go 模块收敛开发流程

> [!important] 代码真相优先
> 这份文档记录的是协作流程和验收规范，不是功能真相。任何模块的真实状态仍以源码、Gateway 协议、`deck-go/contracts/source/*`、生成产物、测试和 real E2E 证据为准。发现文档与代码冲突时，先校准事实，再更新文档。

## 目标

deck-go 是 OpenClaw Gateway 的企业级 control 端。模块开发不能停留在“把 Gateway RPC 展示到页面上”，也不能只按高保真原型还原 UI。一个模块真正完成，必须同时收敛四件事：

1. Gateway 已有能力和协议事实。
2. deck-go 对前端暴露的产品级契约。
3. Go BFF / runtime adapter 的稳定适配路径。
4. frontend-new 的产品界面、mock 验证和 real E2E 证据。

Chat 页面的内容面、command、canvas、artifact、附件、real-stack 验证收敛之后，形成了可复用的模块流程。后续 Agents、Models、Sessions、Skills、Channels 等模块默认沿用这套流程。

## 总流程

```text
1. Explore 事实
   -> 2. 事实简报
   -> 3. Brainstorming 产品/方案决策
   -> 4. 方案设计稿
   -> 5. OpenSpec 提案
   -> 6. 分层实施
   -> 7. mock 视觉/交互验证
   -> 8. real-stack E2E 验证
   -> 9. evidence 写回 tasks
   -> 10. archive-ready
```

这套流程的关键点是：**OpenSpec 不是拿来替代产品讨论的**。OpenSpec 应该承接已经探索和讨论过的方案，而不是把未决策问题模糊写进 tasks。

## 1. Explore 事实

先只做事实梳理，不急着写提案，也不急着改 UI。

### 必查事实

| 层级 | 需要确认什么 | 常见文件/命令 |
| --- | --- | --- |
| Gateway | 方法、事件、schema、权限、运行时 describe、是否已有真实能力 | `src/gateway/`, `src/gateway/protocol/`, `gateway.describe` |
| deck-go Gateway 绑定 | generated TS/Go 是否包含该能力 | `deck-go/contracts/generated/ts/gateway/`, `deck-go/backend/internal/gateway/generated/`, `make protocol-check` |
| Deck-facing 契约 | 前端应该消费什么产品 DTO，而不是直接搬 Gateway shape | `deck-go/contracts/source/deck-api.contract.ts`, `deck-go/contracts/source/*.json` |
| Go BFF | route、adapter、projection、错误处理、写入安全 | `deck-go/backend/internal/server/`, `deck-go/backend/internal/runtime/` |
| frontend-new | API facade、store、panel、mock seed、i18n、测试 | `deck-go/frontend-new/src/api.ts`, `deck-go/frontend-new/src/components/panels/<module>/` |
| design/handoff | 原型是否存在、是否可信、是否与契约冲突 | `deck-go/frontend-handoff/modules/<module>/` |
| E2E | mock 是否足够，real-stack 是否能创造测试数据 | `deck-go/test/e2e/`, `deck-go/scripts/dev/run-stack-real.sh` |

### Explore 输出

Explore 结束后，先给用户一份事实简报，至少包含：

- 已确认事实。
- 不确定点。
- Gateway 支持但 deck-go 未适配的能力。
- deck-go UI 已实现但契约不稳的能力。
- 原型与契约冲突点。
- 推荐默认方案。
- 需要和用户一起决策的问题。

## 2. Brainstorming 决策

Explore 后，进入一次结构化头脑风暴。优先使用用户已安装且可用的 `$superpowers:brainstorming`；如果当前环境没有这个 skill，就使用同等结构的手动 brainstorming 流程。

### Brainstorming 讨论范围

| 主题 | 必须讨论的问题 |
| --- | --- |
| 产品目标 | 这个模块替代 CLI 的哪类 control 工作流？目标用户在页面上要完成什么？ |
| 信息架构 | 主页面、详情页、抽屉、modal、表格、侧栏、状态区怎么分配？ |
| 功能矩阵 | 哪些 Gateway 能力必须暴露？哪些隐藏？哪些需要 Deck 聚合？ |
| 契约边界 | 哪些字段来自 Gateway？哪些是 Deck 产品级 DTO？哪些是前端局部状态？ |
| 写操作安全 | create/update/delete/patch 是否需要确认、diff、baseHash、乐观更新、回滚？ |
| mock 验收 | mock 必须覆盖哪些状态：空态、加载、错误、详情、危险操作、中英文、深浅色？ |
| real E2E 验收 | 真实 Gateway 下至少验证哪些代表路径？如何 seed 隔离数据？ |
| circuit breaker | 哪些失败属于环境问题可跳过？哪些失败必须直接修？ |
| design system | 是否需要沉淀 token、atom、molecule、pattern？是否影响其他模块？ |

### Brainstorming 输出

Brainstorming 结束后，不直接开工。先输出一份方案设计稿，得到用户认可后再写 OpenSpec。

方案设计稿至少包含：

- 产品目标和非目标。
- 页面结构和关键交互。
- 能力矩阵。
- 契约链矩阵。
- 状态机：loading / empty / ready / dirty / saving / success / error / disconnected。
- mock 验收清单。
- real E2E 验收清单。
- 风险、降级、handoff 规则。

## 3. OpenSpec 提案

OpenSpec 的 `proposal.md`、`design.md`、`specs/**/*.md`、`tasks.md` 必须承接上一步的方案设计。

### 写提案时的硬性要求

- `Why` 要说明模块为什么需要收敛，不只写“重构 UI”。
- `What Changes` 要覆盖 Gateway、contracts、Go BFF、frontend-new、mock、real E2E。
- `design.md` 要记录已做决策和拒绝的替代方案。
- spec scenarios 要可验证，不能只写主观视觉目标。
- tasks 每一项都要有验收标准。
- tasks 不能把“待讨论”伪装成“实施项”；未决策内容必须在提案前讨论清楚，或明确写成 handoff。

### 模块能力矩阵模板

| 功能点 | Gateway truth | Deck-facing DTO | Go BFF route/adapter | Frontend surface | Mock evidence | Real evidence | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| list |  |  |  |  |  |  | planned |
| detail |  |  |  |  |  |  | planned |
| create/update/delete |  |  |  |  |  |  | planned |
| config patch |  |  |  |  |  |  | planned |
| errors/empty/loading |  |  |  |  |  |  | planned |

状态只能是：

- `complete`
- `skipped-safe`
- `degraded`
- `handoff-blocked`
- `out-of-scope`

不能留下未分类状态。

## 4. 实施规则

实施时使用 `$openspec-apply-change`，每次恢复或 compact 后先重读 OpenSpec 产物。

### 分层实施顺序

1. Gateway / protocol source。
2. Generated Gateway artifacts。
3. Deck-facing contract source。
4. Generated Deck DTOs / docs / metadata。
5. Go BFF / runtime adapter / projection。
6. frontend-new API facade / store / panel。
7. mock seed / visual state。
8. tests / browser evidence。
9. tasks 证据写回。

如果 Explore 或实施中发现确定性问题，直接修，不只记录。例如：

- 测试 harness 顺序敏感。
- dev script 默认环境错误。
- Go BFF proxy token 不正确。
- UI 显示成功但后端实际失败。
- mock seed 掩盖了 real Gateway 不支持的能力。

有争议或高风险的问题才记录为 handoff。

## 5. mock 验证标准

mock 用于稳定验证视觉和交互，不用于证明 Gateway 真实支持。

每个模块至少覆盖：

- 导航能进入模块。
- 主页面 ready 状态。
- 空态。
- loading 状态。
- 错误态。
- 至少一个详情/编辑/抽屉/子页面。
- 中英文。
- 深浅色。
- 关键危险操作的确认/取消/失败。
- 视觉截图和 DOM snapshot。

mock evidence 应该保存到可追溯位置，并在 OpenSpec tasks 里引用。

## 6. real E2E 标准

real E2E 使用隔离测试环境，而不是污染用户全局环境。

基本要求：

- 从全局 `openclaw.json` 复制一份测试配置。
- 复制对应 workspace 到测试 workspace。
- 修改测试配置里的 workspace/data 路径，避免影响全局。
- 使用 `deck-go/scripts/dev/run-stack-real.sh` 启动 Gateway、Go backend、Vite dev。
- 环境变量写入 env 文件，不改系统环境变量。
- 用 Playwright 打开可视页面，让用户和 Codex 可以在同一页面协作验证。

real E2E 不要求全量跑所有危险操作，但必须跑代表路径：

- read path：list/detail/search/filter。
- safe mutation：可回滚或低风险更新。
- unsafe mutation：如果不执行，必须记录 skip 原因和 UI 是否有保护。
- error path：Gateway 断连、权限失败、validation 失败至少覆盖一类。
- refresh/reload：刷新后状态不能假成功或丢失关键数据。

## 7. 验收门禁

按模块风险选择最小充分验证。标准模块至少需要：

```bash
cd deck-go && make protocol-check
cd deck-go && make contract-gate
cd deck-go && make backend-test
cd deck-go && make frontend-build
openspec validate --type change <change-name> --strict
```

如果触碰 Gateway TypeScript 源码，还要跑 focused `pnpm test`。

如果触碰 frontend-new 模块，还要跑 focused `npm run test:deck-ui -- ...`。

如果触碰 real-stack 或 runtime 行为，还要记录 `run-stack-real.sh status` 和浏览器证据。

## 8. 任务勾选规范

OpenSpec `tasks.md` 里的每个 checkbox 只有满足下面条件才能勾选：

- 代码已实现。
- 相关测试已通过，或有明确的 bounded handoff。
- mock / real evidence 已记录到任务旁边。
- 如果有跳过项，写明是 `skipped-safe`、`degraded` 还是 `handoff-blocked`。
- 没有把环境失败伪装成代码完成。

## 9. 质量反馈和流程反思

用户在 E2E 或视觉验证中反馈质量问题时，先做流程反思，再做代码修改：

1. 问题属于事实 explore 不足、产品决策不清、OpenSpec 验收不严、mock evidence 不足、real E2E 未覆盖，还是实现偏差？
2. 如果是流程问题，更新对应文档或 OpenSpec 验收规则。
3. 如果某个已安装 skill 明显能提升质量，把它加入下一轮默认流程。
4. 如果某条规则反复有效，后续再固化到 `AGENTS.md`。

### 候选固化到 AGENTS.md 的规则

- 模块级重构必须先 Explore，再 Brainstorming，再写 OpenSpec。
- OpenSpec 不承载未决策产品问题；未决策问题必须先通过方案设计收敛。
- mock 视觉验证和 real E2E 验证是两层不同证据，不能互相替代。
- 发现确定性工程问题直接修复；只有事实不足或高风险问题进入 handoff。
- 使用有效 skill 后，如果明显提升质量，要把触发条件记录进流程文档，并在成熟后固化到 `AGENTS.md`。

## 10. 常用 skill 路由建议

| 场景 | 优先使用 |
| --- | --- |
| 事实梳理、代码链路不清 | `$openspec-explore` 或等价 explore |
| 产品设计和方案细节需要共创 | `$superpowers:brainstorming`；不可用时使用本文的 Brainstorming 结构 |
| 创建可实施提案 | `$openspec-propose` |
| 按提案实施 | `$openspec-apply-change` |
| 收尾归档 | `$openspec-archive-change` |
| 视觉质量不稳定 | 高保真原型 skill、设计参考卡、Playwright 视觉证据 |
| 前端工程质量收敛 | `frontend-design-system-engineering`、focused frontend tests、`make frontend-build` |

这张表不是强制列表。真正的规则是：如果某个 skill 能显著降低漂移、补足决策或提高验证质量，就应该优先使用，并把经验写回本文。

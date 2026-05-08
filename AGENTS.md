# Repository Guidelines

- Repo: https://github.com/openclaw/openclaw
- In chat replies, file references must be repo-root relative only (example: `src/telegram/index.ts:80`); never absolute paths or `~/...`.
- Do not edit files covered by security-focused `CODEOWNERS` rules unless a listed owner explicitly asked for the change.

## Project Structure

- Workspace map:
  - `src/` — OpenClaw Node/TypeScript core (CLI, commands, infra, media, Gateway, agents, channels, plugin runtime).
  - `extensions/` — bundled plugins. Treat these as third-party plugins that happen to live in-tree.
  - `packages/` — internal workspace packages.
  - `ui/` — Control UI workspace.
  - `apps/` and `Swabble/` — native app surfaces.
  - `dashboard/`, `deck-e2e/`, and `deploy/` — legacy Deck surfaces kept for reference and maintenance only.
  - `deck-go/` — current second-development mainline. It has its own Go backend, React/Vite frontend, contracts, and local guide in `deck-go/AGENTS.md`.
- Tests: colocated `*.test.ts` for the TypeScript core, with additional scoped test conventions under local guides. Docs: `docs/`. Built output: `dist/`.
- Nomenclature: use "plugin" / "plugins" in docs, UI, changelogs.
- Plugins: live in the bundled workspace plugin tree. Keep plugin-only deps in the extension `package.json`.
- Import boundaries: extensions use `openclaw/plugin-sdk/*` plus local `api.ts` / `runtime-api.ts` as public surface. Do not import core `src/**` from extension code.
- Messaging channels: consider **all** built-in + extension channels when refactoring shared logic.
- When adding channels/plugins/apps/docs, update `.github/labeler.yml` and create matching GitHub labels.

## Architecture Boundaries

Repo map:

- `src/plugin-sdk/*` = public plugin contract
- `src/channels/*` = core channel implementation
- `src/plugins/*` = plugin discovery, loader, registry
- `src/gateway/protocol/*` = typed Gateway wire protocol

**Detailed rules live in scoped AGENTS.md files** — read only those relevant to your current task:

- `extensions/AGENTS.md` — extension/plugin boundary
- `src/plugin-sdk/AGENTS.md` — public SDK contract
- `src/channels/AGENTS.md` — core channel boundary
- `src/plugins/AGENTS.md` — plugin loading, registry, manifest
- `src/gateway/protocol/AGENTS.md` — typed Gateway protocol
- `test/helpers/AGENTS.md` — shared test helper boundary

Core principles (apply everywhere):

- Core must stay extension-agnostic. No hardcoded extension/provider/channel id lists in core.
- Extensions cross into core only through `openclaw/plugin-sdk/*` and manifest metadata.
- Protocol changes are contract changes. Prefer additive evolution.
- New plugin seams must be documented, backwards-compatible, versioned contracts.

Workflow hygiene:

- Do not grep or existence-check every guide path before starting work.
- Read only the guides directly relevant to the files you are touching.

## Scoped Workflow Guides

- `docs/AGENTS.md` — Mintlify docs, docs links, docs i18n
- `ui/AGENTS.md` — Control UI i18n and generated locale
- `scripts/AGENTS.md` — script-runner, local-check lock, test/lint wrappers
- `deck-go/AGENTS.md` — deck-go runtime-mode, contracts, Go backend, frontend-new, and stack-specific checks

## OpenSpec 前置头脑风暴规则

中大型开发任务、跨模块改动、契约/API/配置写入改动、前端产品模块重构、真实 E2E 能力收敛、运行时/安全/部署路径调整，默认需要先经过头脑风暴再创建或修正 OpenSpec 提案。不要把 OpenSpec 当作临场规划工具；OpenSpec 应固化已经澄清的产品、契约、架构和验收决策。

头脑风暴应遵守 Superpowers `brainstorming` 的基本流程：先探索项目上下文，逐个问题澄清目的/约束/成功标准，提出 2-3 个方案及取舍，分段呈现设计并获得用户确认，然后再写可审查的设计材料。对于可能进入 OpenSpec 的任务，还必须额外澄清并记录以下内容，作为 `proposal.md`、`design.md`、`spec.md` 和 `tasks.md` 的输入。

### 通用必答问题

- **目标和非目标**：本次要解决的用户问题是什么，明确不解决什么，哪些属于后续 handoff。
- **事实来源**：代码真相、配置真相、Gateway/RPC/API 真相、生成契约、真实运行环境、现有测试和历史提案分别在哪里。
- **范围边界**：涉及哪些模块，哪些模块只展示/跳转/预览，哪些模块拥有写入权，是否需要拆成多个子提案。
- **数据和状态**：核心数据结构、状态机、读写路径、错误/空/loading/degraded 状态、并发或 base-hash 冲突行为。
- **迁移和兼容**：是否需要兼容已有配置、已有用户数据、旧 mock、旧 DTO、旧视觉或旧接口。
- **验收证据**：单元/组件/契约/后端/前端 build/mock E2E/real E2E/人工视觉验证分别证明什么，哪些可以熔断，熔断后必须记录什么。
- **风险和护栏**：危险操作、不可逆操作、权限/安全边界、外部环境依赖、回滚方式。

### 前端产品模块

前端产品模块的头脑风暴不能只讨论“对接契约”。必须先形成目标产品蓝图：

- 目标用户、核心任务、最高频路径和危险路径。
- 页面信息架构：导航入口、主列表/详情/抽屉/dialog/空态/错误态的结构。
- 字段到 UI 决策矩阵：每个关键字段或配置项是展示、普通编辑、guarded edit、预览、跳转到 owning module，还是不做。
- 模块边界矩阵：本模块、相邻模块、全局设置、原始配置编辑之间的职责划分。
- 关键交互流：create/edit/delete/import/export/default/enable/disable/preview/save/cancel/conflict 等具体行为。
- 视觉和设计系统要求：使用哪些现有 tokens/components/patterns，是否需要高保真原型，哪些截图状态必须对齐。
- Mock 与 real 验收矩阵：mock 证明视觉和交互收敛，real 证明契约链和真实数据路径可用，两者不得互相替代。

### 契约链 / Gateway / deck-go 控制端

涉及 OpenClaw Gateway、`openclaw.json`、deck-go Go BFF、contracts、`frontend-new` 的任务，头脑风暴必须先梳理契约链：

- Gateway 源头能力：RPC 方法、schema、handler、配置读写语义、保护规则、错误行为。
- `openclaw.json` 反推：本次 UI 或服务功能最终会创建、修改、删除或预览哪些配置域。
- Deck-facing 产品契约：哪些字段应作为产品 DTO 暴露，哪些保持 raw/dynamic，哪些不得伪造。
- 生成链路：contract source、generated TS/Go、BFF adapter、frontend api/store/component、mock fixture、E2E fixture 的同步点。
- 真实验证：隔离测试配置和 workspace 如何构造，哪些 mutation 可以安全造数，哪些只能做负向或只读验证。

### OpenSpec 写作门槛

创建或修正 OpenSpec 提案前，必须确认头脑风暴已经产出足够清晰的上下文。提案至少应包含：

- `proposal.md`：为什么做、做什么、不做什么、影响面。
- `design.md`：目标架构或目标产品蓝图、关键决策、替代方案和拒绝理由、数据流/状态流、跨模块边界、迁移/回滚、风险。
- `spec.md`：可验证的 requirements 和 scenarios，覆盖核心行为、边界、失败路径和验收状态。
- `tasks.md`：按依赖顺序拆解，每个任务有明确文件/行为范围和完成证据；不要只写“实现 UI”“补测试”这类不可验收任务。

如果头脑风暴尚未回答足以防止“实现者建错东西”的问题，不要进入实施。应先补头脑风暴或修正 OpenSpec，而不是在 implementation 阶段临场发明产品设计。

## OpenSpec 完成闭环规则

OpenSpec completion discipline 不绑定具体协作方式。无论任务是否经过头脑风暴、是否使用 `/goal`、是否拆成多个提案，只要使用 OpenSpec，就必须按任务复杂度完成对应闭环后才能宣称完成。

### 单 OpenSpec change

任何单个 OpenSpec change 在宣称完成或归档前，必须满足：

- 已读取并遵守该 change 的 `proposal.md`、`design.md`、`specs/**/*.md`、`tasks.md`，以及存在时的 `verification.yaml`。
- task 勾选必须有本轮 fresh evidence；不能只凭历史记忆、旧归档或口头结论勾选。
- 若 change 需要场景级闭环，应使用 `$openspec-closure-workflow` 的语义维护或检查 `verification.yaml`，确认 `archiveReady` 和 gaps。
- 必须运行 `openspec validate <change> --type change --strict`，并按触达面运行相关测试、build、contract 或 E2E 验证。
- accepted spec deltas 必须同步到 `openspec/specs/**`，被触达的 accepted specs 必须 strict validate。
- 未提交代码、未归档 change、未验证场景、已知失败或 circuit-breaker handoff 必须在最终报告中明确列出；不能用“完成”掩盖交付风险。

### 多 OpenSpec change / program matrix

如果一个设计方案、目标、模块收敛、架构重构或连续工作流拆成多个 OpenSpec changes，则每个子 change 必须先满足单 change 闭环；在宣称整个 program 完成前，还必须执行 program-level closure，可使用 `$openspec-program-closure`。

Program-level closure 至少检查：

- 设计文档、goal 或用户约定中的 change matrix 是否全部创建、实施、验证、归档或明确 handoff。
- 每个子 change 的 tasks、`verification.yaml`、OpenSpec strict validation、accepted spec sync 和 archive 状态是否自洽。
- 后续 change 抽出的 shared abstraction、governance rule、contract rule、test helper 是否反哺早期 reference change，避免跨 change 漂移。
- 所有 deferred、rejected-for-now、needs-redesign、circuit-breaker handoff 和 external review findings 是否形成统一 follow-up matrix。
- 相关代码是否可安全分组提交；若 worktree 混有非本 program 改动，必须报告 commit-readiness 风险而不是混提交。

### OpenSpec follow-up inbox

实施和验证后允许出现偏离原设计、更优设计、环境熔断、外部审查争议或明确 deferred 项。为了真正闭环，这些 follow-up 必须落到专用 inbox，而不是只留在聊天、review prose 或归档 change 里。

- OpenSpec 相关 follow-up 默认记录在 `openspec/follow-ups/`。
- follow-up 文件不是 active proposal，也不是完成声明；它是后续创建 OpenSpec 提案、小 plan 或 backlog 决策的候选输入。
- 每条 follow-up 至少包含：来源、事实证据、分类、建议下一步、是否需要新 OpenSpec、验收线索、当前状态。
- Program-level closure 若产生 follow-up matrix，必须同步或链接到 `openspec/follow-ups/` 中的 tracked 文件。
- 后续真正创建 OpenSpec change 时，应从 follow-up 条目复制或引用事实来源，并把该条目标记为 `promoted`、`resolved` 或保留 `deferred`。

### 外部审查输入

Claude Code、其他 agent、人工 review、设计复查或外部报告都只能作为输入，不是任务真相。处理外部审查时必须先建立事实基线，把 finding 分成 `accepted` / `corrected` / `rejected` / `deferred-uncertain`，并用代码引用或可重跑命令支撑结论。确认成立且范围清楚的问题应直接修复；有争议或会改变设计边界的问题进入 follow-up matrix。

## 通用验收标准矩阵

验收标准矩阵是实施和审查时的提示面，不是所有任务都必须机械满足的硬门槛。使用时必须基于当前技术栈、OpenSpec 范围、触达文件、风险等级和用户目标筛选合理项；不适用的项可以跳过，不要为了满足矩阵而引入过度设计、无关测试、新依赖、虚假 E2E 或额外流程。真正的规则是：用工程判断选择能证明本次交付正确性的证据，并在不确定时说明取舍。

创建或修正 OpenSpec 提案时，应从下表选择本 change 相关的验收维度，并把它们转化为 `spec.md` scenarios、`tasks.md` 完成证据或 `verification.yaml` 场景。小修复不必创建完整矩阵，但最终报告仍应覆盖与本次改动相关的关键验收点。

| 验收维度              | 适用场景                                                 | 应思考/验证的问题                                                                                                    | 常见证据                                                          |
| --------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 事实来源与契约        | API、RPC、DTO、配置、协议、生成代码、跨端链路            | 真相来自哪里；是否改了源头契约；生成物是否同步；前端是否消费产品级契约而不是伪造字段                                 | contract check、protocol check、代码引用、真实 payload、生成 diff |
| 数据状态可解释性      | 数据列表、详情页、仪表盘、搜索/筛选、刷新                | 是否区分 loading、error、true-empty、filtered-empty、degraded、权限/配置缺失；有数据但被筛选为空时用户能否理解和恢复 | 组件测试、mock 状态截图、real API 状态、空态/清筛选交互           |
| 用户关键路径          | 新建、编辑、删除、保存、刷新、导航、详情、回退、批量操作 | 高频路径是否顺畅；危险路径是否有确认和回滚；跨模块跳转是否到达正确上下文                                             | Playwright/mock E2E、组件交互测试、人工视觉验证                   |
| 写入与一致性          | 表单、配置修改、mutation、保存草稿、base-hash/并发       | 校验是否足够；失败后是否保留输入；成功后是否刷新正确数据；冲突和并发如何处理                                         | mutation 单测、后端测试、real safe mutation、错误路径测试         |
| 安全与权限            | token、密钥、审批、删除、外部回调、文件/命令操作         | 是否泄露敏感值；是否误放行危险操作；是否需要确认、审计或权限检查；测试是否使用隔离数据                               | 安全单测、日志脱敏检查、负向测试、隔离 real fixture               |
| UI/UX 与设计系统      | 前端页面、视觉重构、组件新增、主题/语言/响应式           | 是否使用现有 tokens/atoms/patterns；深浅色、中英文、移动/桌面是否可读；信息密度和空态是否合理                        | 组件截图、视觉对比、a11y 检查、手动/浏览器验证                    |
| 可访问性与输入体验    | 表单、菜单、弹窗、键盘快捷键、列表选择                   | label、focus、键盘、关闭、禁用态、aria 是否合理；长文本是否溢出                                                      | RTL/Vitest、axe、键盘路径 smoke                                   |
| 错误处理与可观测性    | 网络请求、后台任务、日志、实时流、外部服务               | 错误是否可解释；是否保留旧数据；是否有重试/熔断边界；日志是否足够定位且不泄密                                        | 错误路径测试、日志片段、SSE/WS reconnect smoke                    |
| Mock 与 real 验证分层 | 有 mock、real gateway、外部服务、隔离环境的模块          | mock 证明视觉/交互；real 证明真实契约链；两者不得互相替代；real 失败是否可熔断并记录事实                             | mock E2E、real smoke、fixture 创建/清理证据、handoff              |
| 兼容与迁移            | 旧数据、旧配置、旧接口、历史 mock、渐进重构              | 是否兼容已有用户数据；迁移失败怎么恢复；是否保留旧入口或 shims                                                       | 迁移测试、旧 fixture 测试、回滚说明                               |
| 性能与稳定性          | 大列表、轮询、实时流、缓存、构建产物                     | 是否避免无界刷新、重复请求、大量重渲染；缓存/失效策略是否符合数据新鲜度                                              | profiler/计数测试、请求日志、build 输出、Data Fabric 策略检查     |
| 工程质量              | 类型、lint、测试、构建、模块边界、依赖                   | 类型是否收敛；是否复用既有模式；是否新增不必要抽象或依赖；生成/快照是否有来源                                        | narrow tests、build/typecheck、lint、diff review                  |

选择规则：

- **按触达面选择**：只选本次改动影响的维度。纯文案改动通常不需要后端 real E2E；契约改动通常不能只跑前端截图。
- **按风险加深**：安全、写入、契约、跨模块、真实环境路径需要更强证据；纯展示、小 CSS 修复可以轻量验证。
- **按技术栈落地**：使用仓库已有测试、脚本、Data Fabric、OpenSpec、设计系统和 E2E 基础设施；不要为一次任务临时发明重型流程。
- **按用户目标取舍**：如果用户当前只要求 mock 视觉收敛，应明确 real 验证 deferred；如果用户要求 real E2E，则不能用 mock 结果替代。
- **显式记录缺口**：适用但因环境、权限、外部账号或 fixture 风险无法验证的项，必须记录为 gap/handoff/follow-up，而不是静默跳过。
- **避免过度约束**：矩阵用于提醒 agent 深度思考，不用于制造形式主义。若某项会导致过度设计，应说明为什么不采用，并选择更贴近目标的证明方式。

## 流程缺陷反思规则

开发中遇到阻碍、返工或明显实施偏差时，先区分普通实现缺陷和流程/规范缺陷。普通实现缺陷来自局部代码错误、类型/测试失败、遗漏边界或实现疏忽，按常规 debug、修复、验证即可，不必升级成流程问题。流程/规范缺陷是指现有开发流程、OpenSpec、验收标准、skill 使用、测试环境、工程脚本或文档规范没有覆盖问题，或被实施过程绕过，导致缺陷重复出现或质量无法收敛。

触发反思闭环的典型信号：

- 同类阻碍第二次出现，或一次阻碍已经暴露出规范空洞。
- OpenSpec task 已勾选，但验收证据无法证明对应 requirement/scenario。
- 外部审查发现的是由设计、提案、验证或协作流程导致的系统性偏差。
- 实施阶段临场发明产品设计、契约设计或验收标准，而这些本应在头脑风暴或 OpenSpec 中澄清。
- 为了推进而临时绕过既有流程、测试、真实环境、mock/real 验证矩阵、提交规范或 contract gate。
- 测试环境、启动脚本、E2E 脚本、mock fixture、real fixture 与实际开发/验证路径不一致。

触发后必须完成反思闭环：

- 记录事实：发生了什么，在哪里暴露，相关文件/命令/页面/日志是什么，是否可复现。
- 分类根因：归入 `brainstorming`、`proposal`、`design`、`spec`、`tasks`、`verification`、`contract-chain`、`skill-routing`、`AGENTS.md`、`dev-script`、`mock-fixture`、`real-e2e`、`review`、`commit` 或 `handoff` 等类别。
- 即时处理：事实清楚且范围安全的问题直接修复；不确定、跨边界或需要用户决策的问题进入 follow-up。
- 讨论前置：若根因是流程/规范缺陷，先记录到 `openspec/follow-ups/` 或当前 change 的 handoff/verification 记录，并在最终报告中提出待讨论的规范调整建议；不要直接修改 `AGENTS.md`、skill、OpenSpec 模板、验证清单或工程流程，除非用户明确要求实施该规范改动。
- 复发防护：补充测试、检查命令、验收项、脚本约束或明确的人工检查点，让同类问题下次能被流程覆盖。
- 最终报告：明确说明该问题是普通实现缺陷还是流程/规范缺陷；若属于后者，说明记录在哪里、建议如何调整规范，以及等待用户讨论/确认的事项。

## Build, Test, and Development Commands

- Runtime: Node **>=22.14.0** for the OpenClaw TypeScript workspace; `deck-go/backend` uses Go **1.24**.
- Install deps: `pnpm install` (also supported: `bun install`)
- If deps are missing, run `pnpm install` then retry the command once.
- Prefer existing `package.json`, `Makefile`, or wrapper scripts. Use Bun when an existing script uses Bun, or for a standalone TypeScript utility that is not already wrapped.
- Run CLI in dev: `pnpm openclaw ...` or `pnpm dev`.

**OpenClaw TypeScript core commands:**

| Command                    | Purpose                              |
| -------------------------- | ------------------------------------ |
| `pnpm build`               | Type-check + build                   |
| `pnpm tsgo`                | TypeScript checks only               |
| `pnpm check`               | Lint + format check (local dev gate) |
| `pnpm format:fix`          | Auto-fix formatting                  |
| `pnpm test`                | Run tests (vitest)                   |
| `pnpm test:coverage`       | Tests with coverage                  |
| `FAST_COMMIT=1 git commit` | Skip hook's format + check           |

**deck-go commands:**

| Command                             | Purpose                                                            |
| ----------------------------------- | ------------------------------------------------------------------ |
| `cd deck-go && make verify`         | deck-go contracts check, host check, backend tests, frontend build |
| `cd deck-go && make contract-gate`  | deck-go contract governance gate                                   |
| `cd deck-go && make protocol-check` | Verify generated Gateway protocol artifacts                        |
| `cd deck-go && make backend-test`   | Go backend tests                                                   |
| `cd deck-go && make frontend-build` | Build the active deck-go frontend workspace                        |

**Verification gates:**

- Local OpenClaw TS dev gate: `pnpm check` (normal edit loop).
- Local deck-go dev gate: choose the narrowest relevant `make` target from `deck-go/AGENTS.md`; use `cd deck-go && make verify` for broad deck-go changes.
- Landing gate for OpenClaw TS changes: `pnpm check` + `pnpm test` + `pnpm build` when touching build, packaging, or module boundaries.
- Landing gate for deck-go contract/runtime changes: include the relevant `make contract-gate`, `make protocol-check`, `make backend-test`, and/or `make frontend-build` evidence.
- Do not land changes with failing checks caused by or plausibly related to the touched surface.

**Drift detection** (run gen + commit `.sha256` when changing these surfaces):

- Config schema: `pnpm config:docs:gen` / `pnpm config:docs:check`
- Plugin SDK API: `pnpm plugin-sdk:api:gen` / `pnpm plugin-sdk:api:check`
- deck-go contracts: run the source-specific sync target in `deck-go/` (`make contracts-sync`, `make protocol-update`, `make ui-metadata-sync`, etc.) and verify with the matching check target.

**Type error triage:** group by package/module/type or contract authority, fix the source-of-truth type first, rerun before widening. Check `origin/main` before broad cleanup.

## Prompt Cache Stability

- Treat prompt-cache stability as correctness/perf-critical.
- Make ordering deterministic for any code assembling model/tool payloads from maps, sets, registries, or network results.
- Prefer mutating newest/tail content first so cached prefix stays byte-identical.
- Cache-sensitive changes require a regression test proving prefix stability.

## TypeScript Coding Style

- Language: TypeScript (ESM / NodeNext in the OpenClaw workspace). Strict typing; avoid `any`.
- Formatting/linting: Oxlint + Oxfmt. Never add `@ts-nocheck` or inline lint suppressions by default.
- Prefer `zod` at external boundaries. Prefer discriminated unions and `Result<T, E>` for recoverable decisions.
- Do not use freeform strings for internal branching; prefer closed code unions.
- Dynamic imports: do not mix `await import("x")` and static `import from "x"` for the same module. Use `*.runtime.ts` boundaries for lazy loading.
- Circular deps: keep `pnpm check:import-cycles` and `pnpm check:madge-import-cycles` green.
- Extension imports: use `openclaw/plugin-sdk/<subpath>` as the only cross-package contract. Internal extension imports go through local barrels (`./api.ts`, `./runtime-api.ts`).
- No prototype mutation for sharing class behavior. Use explicit inheritance/composition.
- Keep files compact; ~700 LOC is a reviewability ceiling, while `pnpm check:loc` is a stricter optional guard for TypeScript surfaces.
- Naming: **OpenClaw** for product headings; `openclaw` for CLI/package/paths.
- Written English: American spelling (color, behavior, analyze).

For non-TypeScript surfaces, prefer the local guide and native toolchain first: `deck-go/AGENTS.md` for Go/React/contracts, app-specific guides for native code, and scoped `AGENTS.md` files for docs, UI, scripts, extensions, and protocol areas.

## Release / Advisory Workflows

- Use `$openclaw-release-maintainer` at `.agents/skills/openclaw-release-maintainer/SKILL.md` for release workflows.
- Use `$openclaw-ghsa-maintainer` at `.agents/skills/openclaw-ghsa-maintainer/SKILL.md` for GHSA advisories.
- Release and publish require explicit approval.

## Testing Guidelines

- Framework: Vitest, V8 coverage (70% threshold). Naming: `*.test.ts`, e2e: `*.e2e.test.ts`.
- Model constants in tests: prefer `sonnet-4.6` and `gpt-5.4`.
- Run `pnpm test` before pushing when you touch logic.
- Clean up timers, env, globals, mocks, sockets, temp dirs so `--isolate=false` stays green.
- Test performance: avoid `vi.resetModules()` + `await import(...)` per test for heavy modules. Prefer static/`beforeAll` imports with mock resets in `beforeEach`. Use narrow SDK subpaths and `*.runtime.ts` seams over broad barrel mocks. Treat import-dominated test time as a boundary bug.
- Run tests via `pnpm test <path-or-filter> [vitest args...]`; do not use raw `pnpm vitest run`.
- Workers: max 16. Memory pressure: `OPENCLAW_VITEST_MAX_WORKERS=1 pnpm test`.
- Live tests: `OPENCLAW_LIVE_TEST=1 pnpm test:live`. Full kit: `docs/help/testing.md`.
- Agents MUST NOT modify baseline/inventory/snapshot files to silence checks without approval.
- Changelog: user-facing changes only. Append to end of section. No changelog for pure test changes.

## Commit & PR Guidelines

- Use `$openclaw-pr-maintainer` at `.agents/skills/openclaw-pr-maintainer/SKILL.md` for PR workflows.
- Create commits with `scripts/committer "<msg>" <file...>`; avoid manual `git add`/`git commit`.
- Concise, action-oriented commit messages (e.g., `CLI: add verbose flag to send`).
- Group related changes; avoid bundling unrelated refactors.
- Agents MUST NOT create or push merge commits on `main`. Rebase onto `origin/main` before pushing.

## Security & Safety

- Never commit real phone numbers, videos, or live config values. Use fake placeholders.
- Do not change version numbers or run npm publish without explicit consent.
- Any dependency with `pnpm.patchedDependencies` must use exact version (no `^`/`~`).
- Patching dependencies requires explicit approval.

## Multi-agent Safety

- Do **not** create/drop `git stash`, switch branches, or modify `git worktree` unless explicitly requested.
- "commit" = scope to your changes only. "commit all" = everything in grouped chunks. "push" = may `git pull --rebase` first.
- Focus on your changes; ignore unrecognized files from other agents.
- Formatting-only diffs: auto-resolve without asking. Only ask for semantic changes.

## Collaboration Notes

- When working on a GitHub Issue or PR, print the full URL at the end.
- Verify answers in code; do not guess.
- Tool schema guardrails: avoid `Type.Union` in tool input schemas; use `stringEnum`/`optionalStringEnum`. Avoid raw `format` property names.
- Never send streaming/partial replies to external messaging surfaces (WhatsApp, Telegram); only final replies.
- Bug investigations: read source code of relevant npm dependencies before concluding.

---

## 二次开发主目标 (current focus)

本仓库的二次开发工作分为「上一代」和「当前主目标」两条线，并存于同一棵代码树中。

### 当前主目标 — `deck-go/`

`deck-go/` 是 OpenClaw 之上新建的企业管理/运维平台（Go 后端 + React 前端），按 `RUNTIME_MODE` 在 bundled / remote 两种模式下运行：bundled 模式下 deck-go 本机 spawn Gateway；remote 模式下连接远程 Gateway。新工作均以此目录为主线。

- 详细开发规范：`deck-go/AGENTS.md`
- 完整设计：`docs/superpowers/specs/2026-04-28-runtime-mode-decoupling-design.md`
- 现状：runtime-mode 解耦正在按 `openspec/changes/runtime-mode-decoupling/tasks.md` 实施
- 本地后端启动脚本：`deck-go/scripts/dev/run-bundled.sh` / `deck-go/scripts/dev/run-remote.sh`
- 真 Gateway 全栈一键脚本：`deck-go/scripts/dev/run-stack-real.sh`
- 契约链路：`deck-go/contracts/` + `cd deck-go && make contract-gate`
- 独立于 `deploy/` 的 deck-go 部署产物后续单独规划

### 已归档参考 — 上一代 Deck 客户端

下列内容**保留可用、不再迭代**，仅作为历史决策与代码模式的参考：

| 路径                                                      | 性质                                                            |
| --------------------------------------------------------- | --------------------------------------------------------------- |
| `dashboard/`                                              | Next.js 实现的上一代 Deck 客户端（`openclaw-deck` v0.1.0）      |
| `deck-e2e/`                                               | 上一代 Deck 视觉基线截图                                        |
| `deploy/`                                                 | 上一代 Deck + Gateway 部署产物（`openclaw-deploy-*.tar.gz` 等） |
| `scripts/dev/deck-dev.sh`                                 | 上一代 Gateway+Dashboard 开发启动脚本                           |
| `scripts/protocol-gen*.ts` / `protocol-coverage-check.ts` | 为 `dashboard/src/types/` 生成 typed client 的 codegen          |
| `scripts/deck-gap-report.ts`                              | 上一代 Deck 能力差距报告                                        |
| `scripts/deck-visual-comparison-scaffold.mjs`             | 上一代视觉 parity 脚手架                                        |
| 根目录 `deck-chat-visual-parity-*.png/.md`                | 上一代视觉 parity 历史快照                                      |

新功能、新需求、新 bug 修复**不要进上面的目录**。下面 "Enhanced Fork" 一节里 `Deck 客户端三层架构定位` / `Deck 开发环境` / `Gateway Protocol SDK` 三个子节均针对 `dashboard/`，已统一标记 (legacy)。

---

## Enhanced Fork — 上游同步流程

本项目是 OpenClaw 的增强 fork（`wymfly/openclaw`）。`enhanced` 分支包含所有增量改动，`main` 分支跟踪上游。

### 同步步骤

```bash
# 1. 获取上游最新代码
git fetch upstream main

# 2. 切换到增强分支
git checkout enhanced

# 3. 将我们的 commit 叠到最新上游之上
git rebase upstream/main

# 4. 解决冲突（如果有），逐 commit 处理
# git rebase --continue

# 5. Protocol SDK 同步（如果上游改了 Gateway 方法/schema）
#    详见下方「Gateway Protocol SDK → 上游 rebase 后的 Protocol 同步流程」
pnpm protocol:gen:ts
pnpm tsc --noEmit  # 检查 Deck 类型是否需要修复

# 6. 验证
pnpm install
pnpm check
pnpm test

# 7. 推送
git push --force-with-lease origin enhanced
```

### Commit 规范

- 前缀：`[enhanced]` 标识增量 commit
- 示例：`[enhanced] feat: add SSRF dual-phase protection`
- 对上游文件的修改限制在最小插入点（一两行 import + 调用）
- 新功能优先以新文件形式添加

### 增强模块

本 fork 移植自 MindGate 的优质增量，包含：

1. **安全加固** — SSRF 双阶段防护、Fetch Guard、外部内容 Unicode 防护、Windows ACL、环境变量安全
2. **渠道稳定性** — 统一重试框架（指数退避）、Discord HELLO 超时、Telegram IPv4-first DNS、Signal JSON 解析防护
3. **Windows 适配** — 全平台条件分支、icacls 解析、WSL2 检测
4. **测试增强** — 环境隔离、安全扫描测试（temp-path-guard、weak-random）、覆盖率修正

设计文档：`docs/plans/2026-02-28-openclaw-migration-design.md`
实施计划：`docs/plans/2026-02-28-openclaw-migration-plan.md`

### Deck 客户端三层架构定位 (legacy: 针对 `dashboard/`)

| 层             | 数据源                                   | 核心工作                                 | 典型模块                              |
| -------------- | ---------------------------------------- | ---------------------------------------- | ------------------------------------- |
| **实时交互层** | Gateway RPC（WebSocket/SSE）             | 渲染优化、流式响应、状态同步             | Chat、Session、Agent 运行态           |
| **配置管理层** | `openclaw.json`（通过 Gateway RPC 读写） | 对齐源码校验逻辑，设计交互友好的配置界面 | Models、Channels、Hooks、Agent 配置   |
| **状态监控层** | Gateway RPC（只读）                      | 可视化展示运行状态                       | Device 状态、Channel 连接、Usage 统计 |

### Deck 开发环境 (legacy: 针对 `dashboard/`)

> **新主目标 deck-go 的开发环境见 `deck-go/AGENTS.md`。**

**强制规则：Gateway 必须从本地源码运行，不得使用全局安装的 `openclaw` 命令。**

原因：增强 fork 包含自定义 RPC handlers（Channel Event Filter 等），全局安装版本不包含这些代码。

启动脚本：`scripts/dev/deck-dev.sh`

```bash
# 启动 Gateway + Dashboard（推荐）
scripts/dev/deck-dev.sh

# 单独启动
scripts/dev/deck-dev.sh gateway   # Gateway only（从本地源码构建+运行）
scripts/dev/deck-dev.sh deck      # Dashboard only
scripts/dev/deck-dev.sh stop      # 停止所有
```

手动启动：

- Gateway：`NO_PROXY=localhost,127.0.0.1 pnpm openclaw gateway run --bind loopback --port 18789 --force`
- Dashboard：`cd dashboard && NO_PROXY=localhost,127.0.0.1 pnpm dev`

**检查清单**（功能测试前）：

- [ ] `NO_PROXY=localhost,127.0.0.1` 已设置（否则 Squid 代理拦截 localhost 请求）
- [ ] Gateway 从本地源码运行（`pnpm openclaw`，不是全局 `openclaw`）
- [ ] 验证：`curl -s http://localhost:3000/api/deck/agents -X POST -H 'Content-Type: application/json' -d '{"action":"eventStreams.get","agentId":"main"}'` 应返回 JSON

### Gateway Protocol SDK (legacy: `dashboard/` typed client)

> deck-go 走自己的契约链路（`deck-go/contracts/` + `deckapi.generated.go`），与本节描述的 `dashboard/src/types/gateway-*.generated.ts` 流水线**无关**。本节保留供 `dashboard/` 维护参考。

Deck 通过 typed client（`gw.*`）调用 Gateway RPC，类型从 TypeBox schema 自动生成。

设计文档：`docs/plans/2026-03-27-gateway-protocol-sdk-design.md`

```
ProtocolSchemas (TypeBox) + Result Schemas → MethodRegistry
    ↓ scripts/protocol-gen-ts.ts           ↓ gateway.describe RPC
dashboard/src/types/gateway-*.generated.ts  运行时 API 发现
    ↓
GatewayClient (typed) → Deck stores/routes
```

**开发规则**：

- Deck 必须通过 typed client (`gw.*`) 调用 Gateway，**禁止** `gatewayRequest()` 字符串调用
- `dashboard/src/types/gateway-*.generated.ts` 是自动生成的，**不要手工编辑**
- 新增 Gateway RPC 方法时必须同步四处：handler → result schema → methodDefs → `pnpm protocol:gen:ts`
- `pnpm protocol:gen:check` 必须通过才能 push enhanced 分支

**上游 rebase 后的 Protocol 同步流程**：

```bash
# 1. 检测上游新增/修改的方法
git diff upstream/main~1..upstream/main -- src/gateway/server-methods-list.ts
git diff upstream/main~1..upstream/main -- src/gateway/protocol/schema/

# 2. 对新增方法：
#    Deck 需要 → 补 result schema + methodDefs 元数据
#    Deck 不需要 → 标记 result: undefined（P2 层级）

# 3. 重新生成 typed client
pnpm protocol:gen:ts

# 4. 修复 Deck 消费侧类型错误
pnpm tsc --noEmit
```

**关键文件**：

| 文件                                                | 角色                                                     |
| --------------------------------------------------- | -------------------------------------------------------- |
| `src/gateway/method-registry.ts`                    | MethodRegistry 核心（method → handler + schema + scope） |
| `src/gateway/server-methods/describe.ts`            | `gateway.describe` introspection RPC                     |
| `scripts/protocol-gen-ts.ts`                        | TypeScript codegen 脚本                                  |
| `dashboard/src/types/gateway-protocol.generated.ts` | 生成的类型定义（不要手编）                               |
| `dashboard/src/types/gateway-client.generated.ts`   | 生成的 typed client + allowlist（不要手编）              |
| `scripts/deck-gap-report.ts`                        | Deck 能力差距检测（typed/partial/untyped 三级分类）      |

**上游同步 Skill**：使用 `$deck-upstream-sync`（`.agents/skills/deck-upstream-sync/SKILL.md`）完成完整的 rebase → protocol sync → gap 检测 → Deck 适配工作流。

**Method Registry 元数据模式**：

```typescript
// src/gateway/server-methods/deck/agents.ts
export const deckAgentsHandlers: GatewayRequestHandlers = { ... };
export const deckAgentsMethodDefs: Record<string, Omit<MethodDefinition, "handler">> = {
  "deck.agents.detail": {
    params: DeckAgentsDetailParamsSchema,
    result: DeckAgentsDetailResultSchema,
    scope: "operator.read",
  },
};
```

**Result Schema 优先级**：P0（`deck.*` 全部）+ P1（Deck 已用的上游方法）必须有 result schema；P2（Deck 未用的）标记 `result: undefined`。

---

## Deck-go 开发环境（新主目标）

`deck-go/` 是当前二次开发主目标，与上一代 `dashboard/` 共存但完全独立。详细规则已经下沉到 `deck-go/AGENTS.md`，包括 runtime-mode、contracts、Go backend、`frontend-new/`、E2E 基础设施和验证命令。

根目录只保留两条约束：

- 新功能、新需求、新 bug 修复默认进入 `deck-go/`，不要回到 `dashboard/`、`deck-e2e/` 或 `deploy/` 做新迭代。
- 上游 rebase 流程仍然走 "Enhanced Fork — 上游同步流程"；其中 legacy Protocol SDK 同步只针对 `dashboard/`，对 `deck-go/` 无影响。

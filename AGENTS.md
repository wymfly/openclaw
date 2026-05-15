# OpenClaw 项目规则

核心引用：

- 仓库: https://github.com/openclaw/openclaw
- 项目上下文权威: `CONTEXT.md`

## Project Context Rules

- 修改 OpenClaw / Gateway / deck-go / runtime / control / bundled / remote / `deck.*` RPC 等长效术语前先读 `CONTEXT.md`。
- `CONTEXT.md` 是核心实体、关系、Rule R1、Rule R2、模块优先级、长效歧义的权威。
- 实施过程中发现长效上下文缺口或新概念时，用 `mattpocock-skills:grill-with-docs` 在 `CONTEXT.md` 内补充。不要在代码或 plan 里发明 one-off 术语。
- 除非用户明确说"已记录的决策错了"，否则不要重写 `CONTEXT.md` 已落定的条目。

来自 `CONTEXT.md` 的项目硬规则:

- **Rule R1:** 新增 `deck.*` RPC 时，分类为 type 1 wrapper/transform、type 2 newly exposed kernel capability、或 type 3 pure deck product logic，并在 PR 描述、commit message 或对应 handoff 里记录分类 + tradeoff。
- **Rule R2:** deck-go 在 backend runtime facade 之上的 control 代码必须 mode-agnostic。`contracts/`、`frontend-new/`、以及 control 业务逻辑不能 branch on `RUNTIME_MODE`。Bundled-only 行为属于 BFF runtime facade 之后，或标记为 A3 debt。

## Project Structure

主线 / 边界标记（其他显然目录不在此重复，agent 看一眼仓库就知道）:

- `deck-go/` — **当前二次开发主线**（Go backend + React/Vite frontend + contracts + e2e）。新 feature / 需求 / bug 修复默认进 `deck-go/`，除非用户明确说要做 legacy 维护。本地 guide: `deck-go/AGENTS.md`。frontend 当前 `frontend/` / `frontend-new/` / `frontend-handoff/` **三个分支并存**，改前先看 `deck-go/AGENTS.md` 确认动哪个。
- `extensions/` — bundled plugins。当作恰好住在仓库里的第三方插件处理；plugin-only 依赖留在该 extension 的 `package.json`。
- `dashboard/` / `deck-e2e/` / `deploy/` / `Swabble/` 以及根目录 `deck-chat-visual-parity-*` artifact 是 **legacy**，仅作参考与维护用。不要把 legacy 实现细节复制到 deck-go 里。
- 文档 / UI / changelog 措辞统一为 "plugin" / "plugins"。
- 新增 channels / plugins / apps / docs 时同步 `.github/labeler.yml`，并在最终报告里列出对应 GitHub label（label 创建本身需 owner 批准）。

## Architecture Boundaries

只在你要动相关文件时读对应的 scoped guide:

- `extensions/AGENTS.md` — extension / plugin 边界
- `extensions/acpx/AGENTS.md` — ACP extension
- `src/plugin-sdk/AGENTS.md` — public SDK contract
- `src/channels/AGENTS.md` — core channel 边界
- `src/plugins/AGENTS.md` — plugin loading / registry / manifest
- `src/gateway/protocol/AGENTS.md` — typed Gateway protocol
- `test/helpers/AGENTS.md` — 共享测试 helper 边界
- `docs/AGENTS.md` — Mintlify 文档、文档链接、i18n
- `ui/AGENTS.md` — Control UI i18n / 生成的 locale
- `scripts/AGENTS.md` — script-runner / local-check 锁 / 测试 lint wrapper
- `deck-go/AGENTS.md` — deck-go runtime mode / contracts / Go backend / frontend-new / stack 专属 check
- `deck-go/docs/AGENTS.md` — deck-go 文档规则
- `deck-go/frontend/AGENTS.md` — 主 frontend 分支
- `deck-go/frontend-new/AGENTS.md` — 新 frontend 分支
- `deck-go/frontend-handoff/AGENTS.md` — frontend handoff 分支
- `deploy/AGENTS.md` — legacy 部署基础设施
- `dashboard/AGENTS.md` — legacy Deck 客户端（archived 2026-04-28）
- `vendor/ClawX/AGENTS.md` — vendored: ClawX
- `vendor/hermes-agent/AGENTS.md` — vendored: Hermes agent
- `vendor/openclaw-china/AGENTS.md` — vendored: OpenClaw China fork
- `vendor/openclaw-studio/AGENTS.md` — vendored: OpenClaw Studio

核心原则:

- Core 保持 extension-agnostic。Core 里不允许硬编码 extension / provider / channel id 列表。
- Extensions 跨入 core 只能通过 `openclaw/plugin-sdk/*` 和 manifest metadata。
- Extension 代码不能 import core `src/**`；用 `openclaw/plugin-sdk/*` + 本地 `api.ts` / `runtime-api.ts`。
- Messaging 重构必须考虑所有内置和 extension channel。
- 协议改动 = contract 改动。Prefer additive evolution。
- 新 plugin seam 必须文档化、向后兼容、versioned contract。
- 永远不要给外部 messaging surface（WhatsApp、Telegram）发流式或部分回复；只发最终回复。

## Verification Gates

- Local OpenClaw TS dev gate: `pnpm check`
- OpenClaw TS landing gate（动了 logic / packaging / 模块边界）: `pnpm check` + `pnpm test` + `pnpm build`
- Local deck-go dev gate: 从 `deck-go/AGENTS.md` 挑最窄的 `make` target；改动面广用 `cd deck-go && make verify`
- deck-go contract / runtime 改动: 跑相关的 `make contract-gate` / `make protocol-check` / `make backend-test` / `make frontend-build`

## Project Tooling

- 提交: `scripts/committer "<msg>" <file...>`（避免手动 `git add` / `git commit`）。
- PR 流程: `$openclaw-pr-maintainer` at `.agents/skills/openclaw-pr-maintainer/SKILL.md`。
- Release 流程: `$openclaw-release-maintainer` at `.agents/skills/openclaw-release-maintainer/SKILL.md`。版本号变更、`npm publish` 必须 owner 明示同意。
- GHSA advisory: `$openclaw-ghsa-maintainer` at `.agents/skills/openclaw-ghsa-maintainer/SKILL.md`。
- 依赖规则: 任何 `pnpm.patchedDependencies` 条目必须用精确版本（不带 `^` / `~`）。

## Git Add 规则

**绝对不要 `git add` 的文件类型**（即使不在 .gitignore 里）：

- 截图 / 图片（`*.png`, `*.jpg` 等，除 `assets/` 下的产品资源外）
- 调试日志（`*.log`, `console-*.log`）
- 临时 JSON/YAML 调试数据（`*-snapshot.md`, `*-console.md`, `*-eval.json`, `*-evidence.json`, `*-metrics*.json`, `*-network*.txt`）
- deploy 快照目录或 tar.gz 包
- HTML 原型文件（根目录下的 `*.html`）
- 临时测试文件（`test-*.bin`, `test-*.csv`, `test-*.txt`）

**git add 前必须询问 owner 确认的场景**：

- 根目录下新增的非配置文件（不在 `src/`, `extensions/`, `packages/`, `ui/`, `test/`, `scripts/`, `docs/` 内的文件）
- 新增的二进制文件
- 超过 500KB 的单个文件

对于 `src/`, `extensions/`, `test/`, `ui/` 等明显的源码目录内的代码变更，正常 add 即可，无需询问。

## Drift Detection

改动以下 surface 时跑 gen，commit `.sha256` artifact:

- Config schema: `pnpm config:docs:gen` / `pnpm config:docs:check`
- Plugin SDK API: `pnpm plugin-sdk:api:gen` / `pnpm plugin-sdk:api:check`
- deck-go contracts: 在 `deck-go/` 跑 source-specific sync target（`make contracts-sync` / `make protocol-update` / `make ui-metadata-sync` 等），用对应 check target 验证

## Prompt Cache Stability

- 把 prompt cache 稳定性视为 correctness / perf-critical。
- 拼装 model / tool payload 时，从 map / set / registry / 网络结果产生顺序必须 deterministic。
- 优先 mutate 最新 / 尾部内容，让 cached prefix 保持 byte-identical。
- Cache-sensitive 改动需要 regression test 证明 prefix 稳定。

## TypeScript Coding Style

- Prefer `zod` 在外部边界。
- Prefer discriminated unions 和 `Result<T, E>` 用于可恢复决策。
- 内部分支不要用 freeform string；prefer closed code union。
- Dynamic imports: 同一 module 不要混用 `await import("x")` 和静态 `import from "x"`。lazy loading 用 `*.runtime.ts` 边界。
- 保持 `pnpm check:import-cycles` 和 `pnpm check:madge-import-cycles` 绿色。
- Internal extension imports 走本地 barrel（`./api.ts`、`./runtime-api.ts`）。
- 文件保持紧凑；~700 LOC 是 reviewability ceiling（advisory），`pnpm check:loc` 是更严格的 TS 可选护栏。
- Tool schema 护栏: 工具 input schema 里避免 `Type.Union`；用 `stringEnum` / `optionalStringEnum`。避免 raw `format` property name。
- 命名: **OpenClaw** 用作产品标题；`openclaw` 用作 CLI / 包名 / 路径。

非 TS surface 优先看本地 guide + 该 stack 原生工具链。

## Testing Rules

- 测试通过 `pnpm test <path-or-filter> [vitest args...]` 跑；不要直接 `pnpm vitest run`。
- Workers max 16。内存压力: `OPENCLAW_VITEST_MAX_WORKERS=1 pnpm test`。
- Live tests: `OPENCLAW_LIVE_TEST=1 pnpm test:live`。完整套装见 `docs/help/testing.md`。
- 测试里的 model 常量: prefer `sonnet-4.6` 和 `gpt-5.4`。
- 清理 timer / env / global / mock / socket / temp dir，保持 `--isolate=false` 绿色。
- 避免对重 module 做 per-test `vi.resetModules()` + `await import(...)`。Prefer static / `beforeAll` 导入 + `beforeEach` 里 mock reset。
- 用窄 SDK subpath 和 `*.runtime.ts` 接缝代替宽 barrel mock。
- Import-dominated test time 视为边界 bug。
- Agent 不允许擅自改 baseline / inventory / snapshot 文件来让 check 闭嘴。需要 owner 批准。
- Changelog 只用于 user-facing 改动。追加在 section 末尾。纯测试改动不写 changelog。

## Enhanced Fork Upstream Sync

本仓库是 OpenClaw 的 enhanced fork。`enhanced` 装本地增量；`main` 跟踪上游。

只在用户要求 upstream sync / rebase 时走这套 SOP:

```bash
git fetch upstream main
git checkout enhanced
git rebase upstream/main
pnpm install
pnpm check
pnpm test
git push --force-with-lease origin enhanced
```

Fork 规则:

- Upstream-sync 期间，enhanced commit 用 `[enhanced]` 前缀。
- 改动 upstream 文件时插入点尽量小。
- Enhanced 功能 prefer 走新文件。
- 上游改了 Gateway method 或 schema → 推送前跑相关的 protocol 生成 / check flow。

Legacy `dashboard/` Protocol SDK 细节留在 `AGENTS-backup-2026-05-12.md` 作历史参考。deck-go 用自己的 contract chain，在 `deck-go/contracts/` 下。

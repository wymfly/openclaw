# Repository Guidelines

- Repo: https://github.com/openclaw/openclaw
- In chat replies, file references must be repo-root relative only (example: `src/telegram/index.ts:80`); never absolute paths or `~/...`.
- Do not edit files covered by security-focused `CODEOWNERS` rules unless a listed owner explicitly asked for the change or is already reviewing it with you. Treat those paths as restricted surfaces, not drive-by cleanup.

## Project Structure & Module Organization

- Source code: `src/` (CLI wiring in `src/cli`, commands in `src/commands`, web provider in `src/provider-web.ts`, infra in `src/infra`, media pipeline in `src/media`).
- Tests: colocated `*.test.ts`.
- Docs: `docs/` (images, queue, Pi config). Built output lives in `dist/`.
- Nomenclature: use "plugin" / "plugins" in docs, UI, changelogs, and contributor guidance. The bundled workspace plugin tree remains the internal package layout to avoid repo-wide churn from a rename.
- Bundled plugin naming: for repo-owned workspace plugins, keep the canonical plugin id aligned across `openclaw.plugin.json:id`, the default workspace folder name, and package names anchored to the same id (`@openclaw/<id>` or approved suffix forms like `-provider`, `-plugin`, `-speech`, `-sandbox`, `-media-understanding`). Keep `openclaw.install.npmSpec` equal to the package name and `openclaw.channel.id` equal to the plugin id when present. Exceptions must be explicit and covered by the repo invariant test.
- Plugins: live in the bundled workspace plugin tree (workspace packages). Keep plugin-only deps in the extension `package.json`; do not add them to the root `package.json` unless core uses them.
- Plugins: install runs `npm install --omit=dev` in plugin dir; runtime deps must live in `dependencies`. Avoid `workspace:*` in `dependencies` (npm install breaks); put `openclaw` in `devDependencies` or `peerDependencies` instead (runtime resolves `openclaw/plugin-sdk` via jiti alias).
- Import boundaries: extension production code should treat `openclaw/plugin-sdk/*` plus local `api.ts` / `runtime-api.ts` barrels as the public surface. Do not import core `src/**`, `src/plugin-sdk-internal/**`, or another extension's `src/**` directly.
- Installers served from `https://openclaw.ai/*`: live in the sibling repo `../openclaw.ai` (`public/install.sh`, `public/install-cli.sh`, `public/install.ps1`).
- Messaging channels: always consider **all** built-in + extension channels when refactoring shared logic (routing, allowlists, pairing, command gating, onboarding, docs).
  - Core channel docs: `docs/channels/`
  - Core channel code: `src/telegram`, `src/discord`, `src/slack`, `src/signal`, `src/imessage`, `src/web` (WhatsApp web), `src/channels`, `src/routing`
  - Bundled plugin channels: the workspace plugin tree (for example Matrix, Zalo, ZaloUser, Voice Call)
- When adding channels/plugins/apps/docs, update `.github/labeler.yml` and create matching GitHub labels (use existing channel/plugin label colors).

## Architecture Boundaries

- Start here for the repo map:
  - bundled workspace plugin tree = bundled plugins and the closest example surface for third-party plugins
  - `src/plugin-sdk/*` = the public plugin contract that extensions are allowed to import
  - `src/channels/*` = core channel implementation details behind the plugin/channel boundary
  - `src/plugins/*` = plugin discovery, manifest validation, loader, registry, and contract enforcement
  - `src/gateway/protocol/*` = typed Gateway control-plane and node wire protocol
- Progressive disclosure lives in local boundary guides:
  - repo root `AGENTS.md`
  - bundled-plugin-tree `extensions/AGENTS.md`
  - `src/plugin-sdk/AGENTS.md`
  - `src/channels/AGENTS.md`
  - `src/plugins/AGENTS.md`
  - `src/gateway/protocol/AGENTS.md`
- Workflow hygiene:
  - Do not grep or existence-check every `docs/*.md`, `AGENTS.md`, or guide path mentioned in this file before starting work.
  - Read only the guides and docs that are directly relevant to the files or boundary you are touching.
  - Only do full broken-link or missing-guide sweeps when the task is explicitly about docs or repo-instruction maintenance.
- Plugin and extension boundary:
  - Public docs: `docs/plugins/building-plugins.md`, `docs/plugins/architecture.md`, `docs/plugins/sdk-overview.md`, `docs/plugins/sdk-entrypoints.md`, `docs/plugins/sdk-runtime.md`, `docs/plugins/manifest.md`, `docs/plugins/sdk-channel-plugins.md`, `docs/plugins/sdk-provider-plugins.md`
  - Definition files: `src/plugin-sdk/plugin-entry.ts`, `src/plugin-sdk/core.ts`, `src/plugin-sdk/provider-entry.ts`, `src/plugin-sdk/channel-contract.ts`, `scripts/lib/plugin-sdk-entrypoints.json`, `package.json`
  - Invariant: core must stay extension-agnostic. Adding a bundled or third-party extension should not require unrelated core edits just to teach core that the extension exists.
  - Rule: extensions must cross into core only through `openclaw/plugin-sdk/*`, manifest metadata, and documented runtime helpers. Do not import `src/**` from extension production code.
  - Rule: core code and tests must not deep-import bundled plugin internals such as a plugin's `src/**` files or `onboard.js`. If core needs a bundled plugin helper, expose it through that plugin's `api.ts` and, when it is a real cross-package contract, through `src/plugin-sdk/<id>.ts`.
  - Rule: do not add hardcoded bundled extension/provider/channel/capability id lists, maps, or named special cases in core when a manifest, capability, registry, or plugin-owned contract can express the same behavior.
  - Rule: extension-owned compatibility behavior belongs to the owning extension. Core may orchestrate generic doctor/config flows, but extension-specific legacy repairs, detection rules, onboarding, auth detection, and provider defaults should live in plugin-owned contracts.
  - Rule: for legacy config specifically, prefer doctor-owned repair paths over startup/load-time core migrations. Do not add new plugin-specific legacy migration logic to shared core/runtime surfaces when `openclaw doctor --fix` can own it.
  - Rule: when a test is asserting extension-specific behavior, keep that coverage in the owning extension when feasible. Core tests should assert generic contracts and registry/capability behavior, not extension internals.
  - Refactor trigger: if you encounter core code or tests that name a specific extension/provider/channel for extension-owned behavior, refactor toward a generic registry/capability/plugin-owned seam instead of adding another special case.
  - Compatibility: new plugin seams are allowed, but they must be added as documented, backwards-compatible, versioned contracts. We have third-party plugins in the wild and do not break them casually.
- Channel boundary:
  - Public docs: `docs/plugins/sdk-channel-plugins.md`, `docs/plugins/architecture.md`
  - Definition files: `src/channels/plugins/types.plugin.ts`, `src/channels/plugins/types.core.ts`, `src/channels/plugins/types.adapters.ts`, `src/plugin-sdk/core.ts`, `src/plugin-sdk/channel-contract.ts`
  - Rule: `src/channels/**` is core implementation. If plugin authors need a new seam, add it to the Plugin SDK instead of telling them to import channel internals.
- Provider/model boundary:
  - Public docs: `docs/plugins/sdk-provider-plugins.md`, `docs/concepts/model-providers.md`, `docs/plugins/architecture.md`
  - Definition files: `src/plugins/types.ts`, `src/plugin-sdk/provider-entry.ts`, `src/plugin-sdk/provider-auth.ts`, `src/plugin-sdk/provider-catalog-shared.ts`, `src/plugin-sdk/provider-model-shared.ts`
  - Rule: core owns the generic inference loop; provider plugins own provider-specific behavior through registration and typed hooks. Do not solve provider needs by reaching into unrelated core internals.
  - Rule: avoid ad hoc reads of `plugins.entries.<id>.config` from unrelated core code. If core needs plugin-owned auth/config behavior, add or use a generic seam (`resolveSyntheticAuth`, public SDK/helper facades, manifest metadata, plugin auto-enable hooks) and honor plugin disablement plus SecretRef semantics.
  - Rule: vendor-owned tools and settings belong in the owning plugin. Do not add provider-specific tool config, secret collection, or runtime enablement to core `tools.*` surfaces unless the tool is intentionally core-owned.
- Gateway protocol boundary:
  - Public docs: `docs/gateway/protocol.md`, `docs/gateway/bridge-protocol.md`, `docs/concepts/architecture.md`
  - Definition files: `src/gateway/protocol/schema.ts`, `src/gateway/protocol/schema/*.ts`, `src/gateway/protocol/index.ts`
  - Rule: protocol changes are contract changes. Prefer additive evolution; incompatible changes require explicit versioning, docs, and client/codegen follow-through.
- Config contract boundary:
  - Canonical public config lives in exported config types, zod/schema surfaces, schema help/labels, generated config metadata, config baselines, and any user-facing gateway/config payloads. Keep those surfaces aligned.
  - When a legacy config key is retired from the public contract, remove it from every public config surface above. Keep backward compatibility only through raw-config migration/doctor seams unless explicit product policy says otherwise.
  - Do not reintroduce removed legacy aliases into public types/schema/help/baselines “for convenience”. If old configs still need to load, handle that in `legacy.migrations.*`, config ingest, or `openclaw doctor --fix`.
  - `hooks.internal.entries` is the canonical public hook config model. `hooks.internal.handlers` is compatibility-only input and must not be re-exposed in public schema/help/baseline surfaces.
- Bundled plugin contract boundary:
  - Public docs: `docs/plugins/architecture.md`, `docs/plugins/manifest.md`, `docs/plugins/sdk-overview.md`
  - Definition files: `src/plugins/contracts/registry.ts`, `src/plugins/types.ts`, `src/plugins/public-artifacts.ts`
  - Rule: keep manifest metadata, runtime registration, public SDK exports, and contract tests aligned. Do not create a hidden path around the declared plugin interfaces.
- Extension test boundary:
  - Keep extension-owned onboarding/config/provider coverage under the owning bundled plugin package when feasible.
  - If core tests need bundled plugin behavior, consume it through public `src/plugin-sdk/<id>.ts` facades or the plugin's `api.ts`, not private extension modules.
  - Shared helpers under `test/helpers/**` are part of that same boundary. Do not hardcode repo-relative `extensions/**` imports there, and do not keep plugin-local deep mocks in shared helpers just because multiple tests use them.
  - When core tests or shared helpers need bundled plugin public surfaces, use `src/test-utils/bundled-plugin-public-surface.ts` for `api.ts`, `runtime-api.ts`, `contract-api.ts`, `test-api.ts`, plugin entrypoint `index.js`, and resolved module ids for dynamic import or mocking.
  - If a core test is asserting extension-specific behavior instead of a generic contract, move it to the owning extension package.
- Scoped guides still matter:
  - `extensions/AGENTS.md` expands extension/plugin boundary rules.
  - `src/channels/AGENTS.md` expands core channel boundary and hot-path rules.
  - `src/plugin-sdk/AGENTS.md` expands public SDK contract rules.
  - `src/plugins/AGENTS.md` expands plugin loading, registry, and manifest rules.
  - `src/gateway/protocol/AGENTS.md` expands typed Gateway protocol rules.
  - `test/helpers/AGENTS.md` and `test/helpers/channels/AGENTS.md` expand shared test helper boundary rules.
- Plugin architecture direction:
  - Keep a manifest-first control plane: discovery, validation, enablement, setup hints, and activation planning should stay metadata-driven by default.
  - Keep runtime execution separate: actual provider/channel/tool execution should resolve through narrow targeted loaders, not broad registry materialization.
  - Host loads plugins; plugins do not load host internals. Prefer a small versioned host/kernel seam plus documented SDK entrypoints over ambient reachability.
  - Treat broad runtime registries and mutable global plugin state as transitional compatibility surfaces, not the target architecture.
  - If a setup or config flow truly needs plugin runtime, make that explicit instead of silently importing runtime code on the cold path.

## Scoped Workflow Guides

- `docs/AGENTS.md` owns Mintlify docs, docs links, and docs i18n rules.
- `ui/AGENTS.md` owns Control UI i18n and generated locale rules.
- `scripts/AGENTS.md` owns script-runner, local-check lock, and test/lint wrapper rules.

## exe.dev VM ops (general)

- Access: stable path is `ssh exe.dev` then `ssh vm-name` (assume SSH key already set).
- SSH flaky: use exe.dev web terminal or Shelley (web agent); keep a tmux session for long ops.
- Update: `sudo npm i -g openclaw@latest` (global install needs root on `/usr/lib/node_modules`).
- Config: use `openclaw config set ...`; ensure `gateway.mode=local` is set.
- Discord: store raw token only (no `DISCORD_BOT_TOKEN=` prefix).
- Restart: stop old gateway and run:
  `pkill -9 -f openclaw-gateway || true; nohup openclaw gateway run --bind loopback --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &`
- Verify: `openclaw channels status --probe`, `ss -ltnp | rg 18789`, `tail -n 120 /tmp/openclaw-gateway.log`.

## Build, Test, and Development Commands

- Runtime baseline: Node **22+** (keep Node + Bun paths working).
- Install deps: `pnpm install`
- If deps are missing (for example `node_modules` missing, `vitest not found`, or `command not found`), run the repo’s package-manager install command (prefer lockfile/README-defined PM), then rerun the exact requested command once. Apply this to test/build/lint/typecheck/dev commands; if retry still fails, report the command and first actionable error.
- Pre-commit hooks: `prek install`. The hook runs the repo verification flow, including `pnpm check`.
- `FAST_COMMIT=1` skips the repo-wide `pnpm format` and `pnpm check` inside the pre-commit hook only. Use it when you intentionally want a faster commit path and are running equivalent targeted verification manually. It does not change CI and does not change what `pnpm check` itself does.
- Also supported: `bun install` (keep `pnpm-lock.yaml` + Bun patching in sync when touching deps/patches).
- Prefer Bun for TypeScript execution (scripts, dev, tests): `bun <file.ts>` / `bunx <tool>`.
- Run CLI in dev: `pnpm openclaw ...` (bun) or `pnpm dev`.
- Node remains supported for running built output (`dist/*`) and production installs.
- Mac packaging (dev): `scripts/package-mac-app.sh` defaults to current arch.
- Type-check/build: `pnpm build`
- TypeScript checks: `pnpm tsgo`
- Lint/format: `pnpm check`
- Local agent/dev shells default to host-aware `OPENCLAW_LOCAL_CHECK=1` behavior for `pnpm tsgo` and `pnpm lint`; set `OPENCLAW_LOCAL_CHECK_MODE=throttled` to force the lower-memory profile, `OPENCLAW_LOCAL_CHECK_MODE=full` to keep lock-only behavior, or `OPENCLAW_LOCAL_CHECK=0` in CI/shared runs.
- Format check: `pnpm format` (oxfmt --check)
- Format fix: `pnpm format:fix` (oxfmt --write)
- Terminology:
  - "gate" means a verification command or command set that must be green for the decision you are making.
  - A local dev gate is the fast default loop, usually `pnpm check` plus any scoped test you actually need.
  - A landing gate is the broader bar before pushing `main`, usually `pnpm check`, `pnpm test`, and `pnpm build` when the touched surface can affect build output, packaging, lazy-loading/module boundaries, or published surfaces.
  - A CI gate is whatever the relevant workflow enforces for that lane (for example `check`, `check-additional`, `build-smoke`, or release validation).
- Local dev gate: prefer `pnpm check` for the normal edit loop. It keeps the repo-architecture policy guards out of the default local loop.
- CI architecture gate: `check-additional` enforces architecture and boundary policy guards that are intentionally kept out of the default local loop.
- Formatting gate: the pre-commit hook runs `pnpm format` before `pnpm check`. If you want a formatting-only preflight locally, run `pnpm format` explicitly.
- If you need a fast commit loop, `FAST_COMMIT=1 git commit ...` skips the hook’s repo-wide `pnpm format` and `pnpm check`; use that only when you are deliberately covering the touched surface some other way.
- Tests: `pnpm test` (vitest); coverage: `pnpm test:coverage`
- Generated baseline drift detection uses SHA-256 hash files under `docs/.generated/` (`.sha256` files tracked in git; full JSON baselines are gitignored, generated locally for inspection).
- Config schema drift uses `pnpm config:docs:gen` / `pnpm config:docs:check`.
- Plugin SDK API drift uses `pnpm plugin-sdk:api:gen` / `pnpm plugin-sdk:api:check`.
- If you change config schema/help or the public Plugin SDK surface, run the matching gen command and commit the updated `.sha256` hash file. Keep the two drift-check flows adjacent in scripts/workflows/docs guidance rather than inventing a third pattern.
- When `pnpm tsgo` fails, triage by coherent surface instead of by raw error count: rerun the gate, group failures by package/module/type contract, open the source-of-truth type or export file first, fix the root mismatch, then rerun `pnpm tsgo` before widening into downstream consumers. Check `origin/main` before doing broad cleanup because some apparent type debt is already fixed upstream.
- For narrowly scoped changes, prefer narrowly scoped tests that directly validate the touched behavior. If no meaningful scoped test exists, say so explicitly and use the next most direct validation available.
- Verification modes for work on `main`:
  - Default mode: `main` is relatively stable. Count pre-commit hook coverage when it already verified the current tree, avoid rerunning the exact same checks just for ceremony, and prefer keeping CI/main green before landing.
  - Fast-commit mode: `main` is moving fast and you intentionally optimize for shorter commit loops. Prefer explicit local verification close to the final landing point, and it is acceptable to use `--no-verify` for intermediate or catch-up commits after equivalent checks have already run locally.
- Preferred landing bar for pushes to `main`: in Default mode, favor `pnpm check` and `pnpm test` near the final rebase/push point when feasible. In fast-commit mode, verify the touched surface locally near landing without insisting every intermediate commit replay the full hook.
- Scoped tests prove the change itself. `pnpm test` remains the default `main` landing bar; scoped tests do not replace full-suite gates by default.
- Hard gate: if the change can affect build output, packaging, lazy-loading/module boundaries, or published surfaces, `pnpm build` MUST be run and MUST pass before pushing `main`.
- Default rule: do not land changes with failing format, lint, type, build, or required test checks when those failures are caused by the change or plausibly related to the touched surface. Fast-commit mode changes how verification is sequenced; it does not lower the requirement to validate and clean up the touched surface before final landing.
- For narrowly scoped changes, if unrelated failures already exist on latest `origin/main`, state that clearly, report the scoped tests you ran, and ask before broadening scope into unrelated fixes or landing despite those failures.
- Do not use scoped tests as permission to ignore plausibly related failures.

## Prompt Cache Stability

- Treat prompt-cache stability as correctness/perf-critical, not cosmetic.
- Any code that assembles model or tool payloads from maps, sets, registries, plugin lists, MCP catalogs, filesystem reads, or network results must make ordering deterministic before building the request.
- Do not rewrite older transcript/history bytes on every turn unless you intentionally want to invalidate the cached prefix. Legacy cleanup, pruning, normalization, and migration logic should preserve recent prompt bytes when possible.
- If truncation or compaction is required, prefer mutating newest or tail content first so the cached prefix stays byte-identical for as long as possible.
- For cache-sensitive changes, require a regression test that proves turn-to-turn prefix stability or deterministic request assembly; helper-local tests alone are not enough.

## Coding Style & Naming Conventions

- Language: TypeScript (ESM). Prefer strict typing; avoid `any`.
- Formatting/linting via Oxlint and Oxfmt.
- Never add `@ts-nocheck` and do not add inline lint suppressions by default. Fix root causes first; only keep a suppression when the code is intentionally correct, the rule cannot express that safely, and the comment explains why.
- Do not disable `no-explicit-any`; prefer real types, `unknown`, or a narrow adapter/helper instead. Update Oxlint/Oxfmt config only when required.
- Prefer `zod` or existing schema helpers at external boundaries such as config, webhook payloads, CLI/JSON output, persisted JSON, and third-party API responses.
- Prefer discriminated unions when parameter shape changes runtime behavior.
- Prefer `Result<T, E>`-style outcomes and closed error-code unions for recoverable runtime decisions.
- Keep human-readable strings for logs, CLI output, and UI; do not use freeform strings as the source of truth for internal branching.
- Avoid `?? 0`, empty-string, empty-object, or magic-string sentinels when they can change runtime meaning silently.
- If introducing a new optional field or nullable semantic in core logic, prefer an explicit union or dedicated type when the value changes behavior.
- New runtime control-flow code should not branch on `error: string` or `reason: string` when a closed code union would be reasonable.
- Dynamic import guardrail: do not mix `await import("x")` and static `import ... from "x"` for the same module in production code paths. If you need lazy loading, create a dedicated `*.runtime.ts` boundary (that re-exports from `x`) and dynamically import that boundary from lazy callers only.
- Dynamic import verification: after refactors that touch lazy-loading/module boundaries, run `pnpm build` and check for `[INEFFECTIVE_DYNAMIC_IMPORT]` warnings before submitting.
- Circular dependencies: keep both `pnpm check:import-cycles` and `pnpm check:madge-import-cycles` green; do not reintroduce runtime import cycles or madge-detected import loops.
- Extension SDK self-import guardrail: inside an extension package, do not import that same extension via `openclaw/plugin-sdk/<extension>` from production files. Route internal imports through a local barrel such as `./api.ts` or `./runtime-api.ts`, and keep the `plugin-sdk/<extension>` path as the external contract only.
- Extension package boundary guardrail: inside a bundled plugin package, do not use relative imports/exports that resolve outside that same package root. If shared code belongs in the plugin SDK, import `openclaw/plugin-sdk/<subpath>` instead of reaching into `src/plugin-sdk/**` or other repo paths via `../`.
- Extension API surface rule: `openclaw/plugin-sdk/<subpath>` is the only public cross-package contract for extension-facing SDK code. If an extension needs a new seam, add a public subpath first; do not reach into `src/plugin-sdk/**` by relative path.
- Never share class behavior via prototype mutation (`applyPrototypeMixins`, `Object.defineProperty` on `.prototype`, or exporting `Class.prototype` for merges). Use explicit inheritance/composition (`A extends B extends C`) or helper composition so TypeScript can typecheck.
- If this pattern is needed, stop and get explicit approval before shipping; default behavior is to split/refactor into an explicit class hierarchy and keep members strongly typed.
- In tests, prefer per-instance stubs over prototype mutation (`SomeClass.prototype.method = ...`) unless a test explicitly documents why prototype-level patching is required.
- Add brief code comments for tricky or non-obvious logic.
- Keep files concise; extract helpers instead of “V2” copies. Use existing patterns for CLI options and dependency injection via `createDefaultDeps`.
- Aim to keep files under ~700 LOC; guideline only (not a hard guardrail). Split/refactor when it improves clarity or testability.
- Naming: use **OpenClaw** for product/app/docs headings; use `openclaw` for CLI command, package/binary, paths, and config keys.
- Written English: use American spelling and grammar in code, comments, docs, and UI strings (e.g. "color" not "colour", "behavior" not "behaviour", "analyze" not "analyse").

## Release / Advisory Workflows

- Use `$openclaw-release-maintainer` at `.agents/skills/openclaw-release-maintainer/SKILL.md` for release naming, version coordination, release auth, and changelog-backed release-note workflows.
- Use `$openclaw-ghsa-maintainer` at `.agents/skills/openclaw-ghsa-maintainer/SKILL.md` for GHSA advisory inspection, patch/publish flow, private-fork checks, and GHSA API validation.
- Release and publish remain explicit-approval actions even when using the skill.

## Testing Guidelines

- Framework: Vitest with V8 coverage thresholds (70% lines/branches/functions/statements).
- Naming: match source names with `*.test.ts`; e2e in `*.e2e.test.ts`.
- When tests need example Anthropic/OpenAI model constants, prefer `sonnet-4.6` and `gpt-5.4`; update older Anthropic/GPT examples when you touch those tests.
- Run `pnpm test` (or `pnpm test:coverage`) before pushing when you touch logic.
- Write tests to clean up timers, env, globals, mocks, sockets, temp dirs, and module state so `--isolate=false` stays green.
- Test performance guardrail: do not put `vi.resetModules()` plus `await import(...)` in `beforeEach`/per-test loops for heavy modules unless module state truly requires it. Prefer static imports or one-time `beforeAll` imports, then reset mocks/runtime state directly.
- Test performance guardrail: if a test file uses stable `vi.mock(...)` hoists or other static module mocks, do not pair them with `vi.resetModules()` and a fresh `await import(...)` in every `beforeEach`. Import the heavy module once in `beforeAll`, then reset/prime mocks in `beforeEach` so Browser/Matrix-style hotspot tests do not pay the module graph cost per case.
- Test performance guardrail: inside an extension package, prefer a thin local seam (`./api.ts`, `./runtime-api.ts`, or a narrower local `*.runtime-api.ts`) over direct `openclaw/plugin-sdk/*` imports for internal production code. Keep local seams curated and lightweight; only reach for direct `plugin-sdk/*` imports when you are crossing a real package boundary or when no suitable local seam exists yet.
- Test performance guardrail: keep expensive runtime fallback work such as snapshotting, migration, installs, or bootstrap behind dedicated `*.runtime.ts` boundaries so tests can mock the seam instead of accidentally invoking real work.
- Test performance guardrail: for import-only/runtime-wrapper tests, keep the wrapper lazy. Do not eagerly load heavy verification/bootstrap/runtime modules at module top level if the exported function can import them on demand.
- Test performance guardrail: prefer explicit mock factories over `importOriginal()` for broad modules. Reserve `importOriginal()` for narrow modules where partial-real behavior is genuinely needed.
- Test performance guardrail: do not partial-mock broad `openclaw/plugin-sdk/*` barrels in hot tests. Add a plugin-local `*.runtime.ts` seam and mock that seam instead.
- Test performance guardrail: when production code already accepts `deps`, callbacks, or runtime injection, use that seam in tests before adding module-level mocks.
- Test performance guardrail: prefer narrow public SDK subpaths such as `models-provider-runtime`, `skill-commands-runtime`, and `reply-dispatch-runtime` over older broad helper barrels when both expose the needed helper.
- Test performance guardrail: treat import-dominated test time as a boundary bug. Refactor the import surface before adding more cases to the slow file.
- Agents MUST NOT modify baseline, inventory, ignore, snapshot, or expected-failure files to silence failing checks without explicit approval in this chat.
- For targeted/local debugging, use the native root-project entrypoint: `pnpm test <path-or-filter> [vitest args...]` (for example `pnpm test src/commands/onboard-search.test.ts -t "shows registered plugin providers"`); do not default to raw `pnpm vitest run ...` because it bypasses the repo's default config/profile/pool routing.
- Do not set test workers above 16; tried already.
- Vitest now defaults to native root-project `threads`, with hard `forks` exceptions for `gateway`, `agents`, and `commands`. Keep new pool changes explicit and justified; use `OPENCLAW_VITEST_POOL=forks` for full local fork debugging.
- If local Vitest runs cause memory pressure, the default worker budget now derives from host capabilities (CPU, memory band, current load). For a conservative explicit override during land/gate runs, use `OPENCLAW_VITEST_MAX_WORKERS=1 pnpm test`.
- Live tests (real keys): `OPENCLAW_LIVE_TEST=1 pnpm test:live` (OpenClaw-only) or `LIVE=1 pnpm test:live` (includes provider live tests). Docker: `pnpm test:docker:live-models`, `pnpm test:docker:live-gateway`. Onboarding Docker E2E: `pnpm test:docker:onboard`.
- `pnpm test:live` defaults quiet now. Keep `[live]` progress; suppress profile/gateway chatter. Full logs: `OPENCLAW_LIVE_TEST_QUIET=0 pnpm test:live`.
- Full kit + what’s covered: `docs/help/testing.md`.
- Changelog: user-facing changes only; no internal/meta notes (version alignment, appcast reminders, release process).
- Changelog placement: in the active version block, append new entries to the end of the target section (`### Changes` or `### Fixes`); do not insert new entries at the top of a section.
- Changelog attribution: use at most one contributor mention per line; prefer `Thanks @author` and do not also add `by @author` on the same entry.
- Pure test additions/fixes generally do **not** need a changelog entry unless they alter user-facing behavior or the user asks for one.
- Mobile: before using a simulator, check for connected real devices (iOS + Android) and prefer them when available.

## Commit & Pull Request Guidelines

- Use `$openclaw-pr-maintainer` at `.agents/skills/openclaw-pr-maintainer/SKILL.md` for maintainer PR triage, review, close, search, and landing workflows.
- This includes auto-close labels, bug-fix evidence gates, GitHub comment/search footguns, and maintainer PR decision flow.
- For the repo's end-to-end maintainer PR workflow, use `$openclaw-pr-maintainer` at `.agents/skills/openclaw-pr-maintainer/SKILL.md`.

- `/landpr` lives in the global Codex prompts (`~/.codex/prompts/landpr.md`); when landing or merging any PR, always follow that `/landpr` process.
- Create commits with `scripts/committer "<msg>" <file...>`; avoid manual `git add`/`git commit` so staging stays scoped.
- Follow concise, action-oriented commit messages (e.g., `CLI: add verbose flag to send`).
- Group related changes; avoid bundling unrelated refactors.
- PR submission template (canonical): `.github/pull_request_template.md`
- Issue submission templates (canonical): `.github/ISSUE_TEMPLATE/`

## Git Notes

- If `git branch -d/-D <branch>` is policy-blocked, delete the local ref directly: `git update-ref -d refs/heads/<branch>`.
- Agents MUST NOT create or push merge commits on `main`. If `main` has advanced, rebase local commits onto the latest `origin/main` before pushing.
- Bulk PR close/reopen safety: if a close action would affect more than 5 PRs, first ask for explicit user confirmation with the exact PR count and target scope/query.

## Security & Configuration Tips

- Web provider stores creds at `~/.openclaw/credentials/`; rerun `openclaw login` if logged out.
- Pi sessions live under `~/.openclaw/sessions/` by default; the base directory is not configurable.
- Environment variables: see `~/.profile`.
- Never commit or publish real phone numbers, videos, or live configuration values. Use obviously fake placeholders in docs, tests, and examples.
- Release flow: use the private [maintainer release docs](https://github.com/openclaw/maintainers/blob/main/release/README.md) for the actual runbook, `docs/reference/RELEASING.md` for the public release policy, and `$openclaw-release-maintainer` for the maintainership workflow.

## Local Runtime / Platform Notes

- Vocabulary: "makeup" = "mac app".
- Rebrand/migration issues or legacy config/service warnings: run `openclaw doctor` (see `docs/gateway/doctor.md`).
- Use `$openclaw-parallels-smoke` at `.agents/skills/openclaw-parallels-smoke/SKILL.md` for Parallels smoke, rerun, upgrade, debug, and result-interpretation workflows across macOS, Windows, and Linux guests.
- For the macOS Discord roundtrip deep dive, use the narrower `.agents/skills/parallels-discord-roundtrip/SKILL.md` companion skill.
- Never edit `node_modules` (global/Homebrew/npm/git installs too). Updates overwrite. Skill notes go in `tools.md` or `AGENTS.md`.
- If you need local-only `.agents` ignores, use `.git/info/exclude` instead of repo `.gitignore`.
- When adding a new `AGENTS.md` anywhere in the repo, also add a `CLAUDE.md` symlink pointing to it (example: `ln -s AGENTS.md CLAUDE.md`).
- Signal: "update fly" => `fly ssh console -a flawd-bot -C "bash -lc 'cd /data/clawd/openclaw && git pull --rebase origin main'"` then `fly machines restart e825232f34d058 -a flawd-bot`.
- CLI progress: use `src/cli/progress.ts` (`osc-progress` + `@clack/prompts` spinner); don’t hand-roll spinners/bars.
- Status output: keep tables + ANSI-safe wrapping (`src/terminal/table.ts`); `status --all` = read-only/pasteable, `status --deep` = probes.
- Gateway currently runs only as the menubar app; there is no separate LaunchAgent/helper label installed. Restart via the OpenClaw Mac app or `scripts/restart-mac.sh`; to verify/kill use `launchctl print gui/$UID | grep openclaw` rather than assuming a fixed label. **When debugging on macOS, start/stop the gateway via the app, not ad-hoc tmux sessions; kill any temporary tunnels before handoff.**
- macOS logs: use `./scripts/clawlog.sh` to query unified logs for the OpenClaw subsystem; it supports follow/tail/category filters and expects passwordless sudo for `/usr/bin/log`.
- If shared guardrails are available locally, review them; otherwise follow this repo's guidance.
- SwiftUI state management (iOS/macOS): prefer the `Observation` framework (`@Observable`, `@Bindable`) over `ObservableObject`/`@StateObject`; don’t introduce new `ObservableObject` unless required for compatibility, and migrate existing usages when touching related code.
- Connection providers: when adding a new connection, update every UI surface and docs (macOS app, web UI, mobile if applicable, onboarding/overview docs) and add matching status + configuration forms so provider lists and settings stay in sync.
- Version locations: `package.json` (CLI), `apps/android/app/build.gradle.kts` (versionName/versionCode), `apps/ios/Sources/Info.plist` + `apps/ios/Tests/Info.plist` (CFBundleShortVersionString/CFBundleVersion), `apps/macos/Sources/OpenClaw/Resources/Info.plist` (CFBundleShortVersionString/CFBundleVersion), `docs/install/updating.md` (pinned npm version), and Peekaboo Xcode projects/Info.plists (MARKETING_VERSION/CURRENT_PROJECT_VERSION).
- "Bump version everywhere" means all version locations above **except** `appcast.xml` (only touch appcast when cutting a new macOS Sparkle release).
- **Restart apps:** “restart iOS/Android apps” means rebuild (recompile/install) and relaunch, not just kill/launch.
- **Device checks:** before testing, verify connected real devices (iOS/Android) before reaching for simulators/emulators.
- Mobile pairing: `ws://` (cleartext) is allowed for private LAN addresses (RFC 1918, link-local, mDNS `.local`) and loopback. Private LAN hosts typically lack PKI-backed identity, so requiring TLS there adds complexity without meaningful security gain. `wss://` is required for Tailscale and public endpoints.
- Security report scope: reports that treat cleartext `ws://` mobile pairing over private LAN as a vulnerability are out of scope unless they demonstrate a trust-boundary bypass beyond passive network observation on the same LAN.
- iOS Team ID lookup: `security find-identity -p codesigning -v` → use Apple Development (…) TEAMID. Fallback: `defaults read com.apple.dt.Xcode IDEProvisioningTeamIdentifiers`.
- A2UI bundle hash: `src/canvas-host/a2ui/.bundle.hash` is auto-generated; ignore unexpected changes, and only regenerate via `pnpm canvas:a2ui:bundle` (or `scripts/bundle-a2ui.sh`) when needed. Commit the hash as a separate commit.
- Release signing/notary credentials are managed outside the repo; maintainers keep that setup in the private [maintainer release docs](https://github.com/openclaw/maintainers/tree/main/release).
- Lobster palette: use the shared CLI palette in `src/terminal/palette.ts` (no hardcoded colors); apply palette to onboarding/config prompts and other TTY UI output as needed.
- When asked to open a “session” file, open the Pi session logs under `~/.openclaw/agents/<agentId>/sessions/*.jsonl` (use the `agent=<id>` value in the Runtime line of the system prompt; newest unless a specific ID is given), not the default `sessions.json`. If logs are needed from another machine, SSH via Tailscale and read the same path there.
- Do not rebuild the macOS app over SSH; rebuilds must be run directly on the Mac.
- Voice wake forwarding tips:
  - Command template should stay `openclaw-mac agent --message "${text}" --thinking low`; `VoiceWakeForwarder` already shell-escapes `${text}`. Don’t add extra quotes.
  - launchd PATH is minimal; ensure the app’s launch agent PATH includes standard system paths plus your pnpm bin (typically `$HOME/Library/pnpm`) so `pnpm`/`openclaw` binaries resolve when invoked via `openclaw-mac`.

## Collaboration / Safety Notes

- When working on a GitHub Issue or PR, print the full URL at the end of the task.
- When answering questions, respond with high-confidence answers only: verify in code; do not guess.
- Carbon version edits are owner-only: do not change `@buape/carbon` version pins unless you are Shadow (@thewilloftheshadow) as verified by gh.
- Any dependency with `pnpm.patchedDependencies` must use an exact version (no `^`/`~`).
- Patching dependencies (pnpm patches, overrides, or vendored changes) requires explicit approval; do not do this by default.
- **Multi-agent safety:** do **not** create/apply/drop `git stash` entries unless explicitly requested (this includes `git pull --rebase --autostash`). Assume other agents may be working; keep unrelated WIP untouched and avoid cross-cutting state changes.
- **Multi-agent safety:** when the user says "push", you may `git pull --rebase` to integrate latest changes (never discard other agents' work). When the user says "commit", scope to your changes only. When the user says "commit all", commit everything in grouped chunks.
- **Multi-agent safety:** prefer grouped `commit` / `pull --rebase` / `push` cycles for related work instead of many tiny syncs.
- **Multi-agent safety:** do **not** create/remove/modify `git worktree` checkouts (or edit `.worktrees/*`) unless explicitly requested.
- **Multi-agent safety:** do **not** switch branches / check out a different branch unless explicitly requested.
- **Multi-agent safety:** running multiple agents is OK as long as each agent has its own session.
- **Multi-agent safety:** when you see unrecognized files, keep going; focus on your changes and commit only those.
- Lint/format churn:
  - If staged+unstaged diffs are formatting-only, auto-resolve without asking.
  - If commit/push already requested, auto-stage and include formatting-only follow-ups in the same commit (or a tiny follow-up commit if needed), no extra confirmation.
  - Only ask when changes are semantic (logic/data/behavior).
- **Multi-agent safety:** focus reports on your edits; avoid guard-rail disclaimers unless truly blocked; when multiple agents touch the same file, continue if safe; end with a brief “other files present” note only if relevant.
- Bug investigations: read source code of relevant npm dependencies and all related local code before concluding; aim for high-confidence root cause.
- Code style: add brief comments for tricky logic; keep files under ~700 LOC when feasible (split/refactor as needed).
- Tool schema guardrails (google-antigravity): avoid `Type.Union` in tool input schemas; no `anyOf`/`oneOf`/`allOf`. Use `stringEnum`/`optionalStringEnum` (Type.Unsafe enum) for string lists, and `Type.Optional(...)` instead of `... | null`. Keep top-level tool schema as `type: "object"` with `properties`.
- Tool schema guardrails: avoid raw `format` property names in tool schemas; some validators treat `format` as a reserved keyword and reject the schema.
- Never send streaming/partial replies to external messaging surfaces (WhatsApp, Telegram); only final replies should be delivered there. Streaming/tool events may still go to internal UIs/control channel.
- For manual `openclaw message send` messages that include `!`, use the heredoc pattern noted below to avoid the Bash tool’s escaping.
- Release guardrails: do not change version numbers without operator’s explicit consent; always ask permission before running any npm publish/release step.
- Beta release guardrail: when using a beta Git tag (for example `vYYYY.M.D-beta.N`), publish npm with a matching beta version suffix (for example `YYYY.M.D-beta.N`) rather than a plain version on `--tag beta`; otherwise the plain version name gets consumed/blocked.

## NPM + 1Password (publish/verify)

- Use the 1password skill; all `op` commands must run inside a fresh tmux session.
- Sign in: `eval "$(op signin --account my.1password.com)"` (app unlocked + integration on).
- OTP: `op read 'op://Private/Npmjs/one-time password?attribute=otp'`.
- Publish: `npm publish --access public --otp="<otp>"` (run from the package dir).
- Verify without local npmrc side effects: `npm view <pkg> version --userconfig "$(mktemp)"`.
- Kill the tmux session after publish.

## Plugin Release Fast Path (no core `openclaw` publish)

- Release only already-on-npm plugins. Source list is in `docs/reference/RELEASING.md` under "Current npm plugin list".
- Run all CLI `op` calls and `npm publish` inside tmux to avoid hangs/interruption:
  - `tmux new -d -s release-plugins-$(date +%Y%m%d-%H%M%S)`
  - `eval "$(op signin --account my.1password.com)"`
- 1Password helpers:
  - password used by `npm login`:
    `op item get Npmjs --format=json | jq -r '.fields[] | select(.id=="password").value'`
  - OTP:
    `op read 'op://Private/Npmjs/one-time password?attribute=otp'`
- Fast publish loop (local helper script in `/tmp` is fine; keep repo clean):
  - compare local plugin `version` to `npm view <name> version`
  - only run `npm publish --access public --otp="<otp>"` when versions differ
  - skip if package is missing on npm or version already matches.
- Keep `openclaw` untouched: never run publish from repo root unless explicitly requested.
- Post-check for each release:
  - per-plugin: `npm view @openclaw/<name> version --userconfig "$(mktemp)"` should be `2026.2.17`
  - core guard: `npm view openclaw version --userconfig "$(mktemp)"` should stay at previous version unless explicitly requested.

## Changelog Release Notes

- When cutting a mac release with beta GitHub prerelease:
  - Tag `vYYYY.M.D-beta.N` from the release commit (example: `v2026.2.15-beta.1`).
  - Create prerelease with title `openclaw YYYY.M.D-beta.N`.
  - Use release notes from `CHANGELOG.md` version section (`Changes` + `Fixes`, no title duplicate).
  - Attach at least `OpenClaw-YYYY.M.D.zip` and `OpenClaw-YYYY.M.D.dSYM.zip`; include `.dmg` if available.

- Keep top version entries in `CHANGELOG.md` sorted by impact:
  - `### Changes` first.
  - `### Fixes` deduped and ranked with user-facing fixes first.
- Before tagging/publishing, run:
  - `node --import tsx scripts/release-check.ts`
  - `pnpm release:check`
  - `pnpm test:install:smoke` or `OPENCLAW_INSTALL_SMOKE_SKIP_NONROOT=1 pnpm test:install:smoke` for non-root smoke path.

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

### Deck 客户端三层架构定位

| 层             | 数据源                                   | 核心工作                                 | 典型模块                              |
| -------------- | ---------------------------------------- | ---------------------------------------- | ------------------------------------- |
| **实时交互层** | Gateway RPC（WebSocket/SSE）             | 渲染优化、流式响应、状态同步             | Chat、Session、Agent 运行态           |
| **配置管理层** | `openclaw.json`（通过 Gateway RPC 读写） | 对齐源码校验逻辑，设计交互友好的配置界面 | Models、Channels、Hooks、Agent 配置   |
| **状态监控层** | Gateway RPC（只读）                      | 可视化展示运行状态                       | Device 状态、Channel 连接、Usage 统计 |

- 实时交互层：后端逻辑已成熟，Deck 专注前端体验（消息渲染、流式加载、键盘快捷键等）
- 配置管理层：必须深入理解源码中的校验规则、字段依赖、默认值逻辑，才能设计正确的表单约束和交互引导
- 状态监控层：纯读取展示，关注数据刷新频率和可视化效果

### Deck 开发环境

**强制规则：Gateway 必须从本地源码运行，不得使用全局安装的 `openclaw` 命令。**

原因：增强 fork 包含自定义 RPC handlers（Channel Event Filter 等），全局安装版本不包含这些代码。使用全局版本会导致 `unknown method` 错误。

启动脚本：`scripts/dev/deck-dev.sh`

```bash
# 启动 Gateway + Dashboard（推荐）
scripts/dev/deck-dev.sh

# 单独启动
scripts/dev/deck-dev.sh gateway   # Gateway only（从本地源码构建+运行）
scripts/dev/deck-dev.sh deck      # Dashboard only
scripts/dev/deck-dev.sh stop      # 停止所有
```

手动启动时的命令（脚本内部逻辑）：

- Gateway：`NO_PROXY=localhost,127.0.0.1 pnpm openclaw gateway run --bind loopback --port 18789 --force`（注意 `pnpm openclaw` 不是 `openclaw`）
- Dashboard：`cd dashboard && NO_PROXY=localhost,127.0.0.1 pnpm dev`

**检查清单**（功能测试前）：

- [ ] `NO_PROXY=localhost,127.0.0.1` 已设置（否则 Squid 代理拦截 localhost 请求）
- [ ] Gateway 从本地源码运行（`pnpm openclaw`，不是全局 `openclaw`）
- [ ] Gateway 和 Dashboard 启动后验证：`curl -s http://localhost:3000/api/deck/agents -X POST -H 'Content-Type: application/json' -d '{"action":"eventStreams.get","agentId":"main"}'` 应返回 JSON（非 HTML 错误页）

### Gateway Protocol SDK

Deck dashboard 通过 typed client（`gw.*`）调用 Gateway RPC，类型和 client wrapper 从 Gateway 的 TypeBox schema 自动生成。

设计文档：`docs/plans/2026-03-27-gateway-protocol-sdk-design.md`

**架构**：

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
# 在常规 rebase + 冲突解决之后：

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

# 5. 完整验证（接续常规 rebase 验证步骤）
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

**上游同步 Skill**：使用 `$deck-upstream-sync`（`.agents/skills/deck-upstream-sync/SKILL.md`）完成完整的 rebase → protocol sync → gap 检测 → Deck 适配 → 新功能发现工作流。

**Method Registry 元数据模式**：每个 handler 文件导出并行的 `methodDefs`：

```typescript
// src/gateway/server-methods/deck/agents.ts
export const deckAgentsHandlers: GatewayRequestHandlers = { ... };  // 现有 handler
export const deckAgentsMethodDefs: Record<string, Omit<MethodDefinition, "handler">> = {
  "deck.agents.detail": {
    params: DeckAgentsDetailParamsSchema,
    result: DeckAgentsDetailResultSchema,
    scope: "operator.read",
  },
};
```

**Result Schema 优先级**：P0（`deck.*` 全部）+ P1（Deck 已用的上游方法）必须有 result schema；P2（Deck 未用的）标记 `result: undefined`。

**上游改动热区参考**（近 4 个月 commit 频率）：

| 文件                         | 频率  | 冲突风险                                      |
| ---------------------------- | ----- | --------------------------------------------- |
| `server-methods/chat.ts`     | 92    | 高（但 methodDefs 是追加，不改 handler 逻辑） |
| `server-methods/agent.ts`    | 82    | 同上                                          |
| `server-methods/sessions.ts` | 56    | 同上                                          |
| `server-methods.ts`          | 56    | 中（尾部 spread 追加，通常自动合并）          |
| `protocol/schema/`           | 141   | 中（schema 追加，偶有字段修改）               |
| `server-methods/deck/*`      | **0** | **无冲突**——完全是 fork 自有代码              |

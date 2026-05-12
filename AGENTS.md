# Repository Guidelines

## Role

This file is the long-lived agent entry point for this repository. It provides:

- Accurate project context routing.
- Development rules that are specific to this repo.
- Skill routing that lets installed skills own the development workflow.

Do not put one-off task trackers, temporary realignment plans, or session
handoff state in this file.

Core references:

- Repo: https://github.com/openclaw/openclaw
- Project context authority: `CONTEXT.md`
- Historical pre-rewrite reference: `AGENTS-backup-2026-05-12.md`
- In chat replies, file references must be repo-root relative only, for example
  `src/telegram/index.ts:80`; never use absolute paths or `~/...`.
- Default to Chinese for user-facing replies unless the user requests another
  language or the artifact itself should be written in another language.
- Do not edit files covered by security-focused `CODEOWNERS` rules unless a
  listed owner explicitly asked for the change.

## Skill Routing

Skills are the workflow authority. Use the relevant skill instead of copying
or inventing parallel process rules in this file.

Use full skill names in planning and reports; aliases are listed only to help
match installed local names.

| Situation                                                                                                 | Required route                                                                                                                             |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| New feature, component, behavior, RPC, product decision, or architecture change                           | `superpowers:brainstorming` (alias: `brainstorming`) before implementation                                                                 |
| Unclear term, durable project concept, or context gap                                                     | `grill-with-docs`; update `CONTEXT.md` as the durable context record                                                                       |
| UI, interaction, state-machine, or logic uncertainty where seeing/trying options would clarify the answer | `prototype`                                                                                                                                |
| Bug, test failure, regression, or unexpected behavior                                                     | `diagnose`; add regression coverage with `superpowers:test-driven-development` when fixing                                                 |
| Multi-step implementation after design is agreed                                                          | `superpowers:writing-plans` (alias: `writing-plans`)                                                                                       |
| Production behavior change or bug fix                                                                     | `superpowers:test-driven-development` (alias: `test-driven-development`) unless the change is docs-only or mechanically generated          |
| Independent parallel implementation tasks                                                                 | `superpowers:subagent-driven-development` (alias: `subagent-driven-development`) when it improves throughput and write scopes are disjoint |
| Architecture boundary review or periodic simplification pass                                              | `improve-codebase-architecture`                                                                                                            |
| Before claiming work is complete, fixed, or passing                                                       | `superpowers:verification-before-completion` (alias: `verification-before-completion`) and report exact commands and observed results      |
| Large architecture design, cross-module contract/API/config-source changes, or long-lived governance work | OpenSpec proposal/spec/tasks, then implementation planning                                                                                 |

OpenSpec is not the default path for ordinary feature work, bug fixes, module
cleanup, or UI iteration. Use it only when the work needs a durable proposal,
formal spec deltas, or multi-change governance.

Do not duplicate skill internals in repo rules. If a skill already defines the
brainstorm, debug, TDD, plan, review, or verification flow, follow that skill.

## Project Context Rules

- Read `CONTEXT.md` before using or changing durable terms such as OpenClaw,
  Gateway, deck-go, runtime, control, bundled, remote, or `deck.*` RPC.
- `CONTEXT.md` is the authority for core entities, relationships, Rule R1,
  Rule R2, module priorities, and durable ambiguities.
- If implementation reveals a durable context gap or a new concept, use
  `grill-with-docs` and update `CONTEXT.md` inline. Do not invent one-off
  terminology in code or plans.
- Do not rewrite resolved context entries in `CONTEXT.md` unless the user
  explicitly says the recorded decision is wrong.

Hard project rules from `CONTEXT.md`:

- **Rule R1:** before adding a new `deck.*` RPC, classify it as type 1
  wrapper/transform, type 2 newly exposed kernel capability, or type 3 pure
  deck product logic. Type 2 and type 3 require surfacing the tradeoff to the
  user before implementation.
- **Rule R2:** deck-go control code above the backend runtime facade must be
  mode-agnostic. `contracts/`, `frontend-new/`, and control business logic must
  not branch on `RUNTIME_MODE`. Bundled-only behavior belongs behind the BFF
  runtime facade or is marked as A3 debt.

## Project Structure

- `src/` — OpenClaw Node/TypeScript core: CLI, commands, infra, media, Gateway,
  agents, channels, plugin runtime, sessions.
- `extensions/` — bundled plugins. Treat these as third-party plugins that
  happen to live in-tree.
- `packages/` — internal workspace packages.
- `ui/` — Control UI workspace.
- `apps/` and `Swabble/` — native app surfaces.
- `deck-go/` — current second-development mainline. It has its own Go backend,
  React/Vite frontend, contracts, and local guide in `deck-go/AGENTS.md`.
- `dashboard/`, `deck-e2e/`, and `deploy/` — legacy Deck surfaces kept for
  reference and maintenance only.
- Tests are colocated `*.test.ts` for the TypeScript core, with additional
  scoped conventions under local guides. Docs live in `docs/`. Built output is
  `dist/`.
- Use "plugin" / "plugins" in docs, UI, and changelogs.
- Plugins live in the bundled workspace plugin tree. Keep plugin-only deps in
  the extension `package.json`.
- When adding channels, plugins, apps, or docs, update `.github/labeler.yml`
  and create matching GitHub labels.

## Architecture Boundaries

Read scoped guides only for the files you are touching.

Repo map:

- `src/plugin-sdk/*` = public plugin contract.
- `src/channels/*` = core channel implementation.
- `src/plugins/*` = plugin discovery, loader, registry.
- `src/gateway/protocol/*` = typed Gateway wire protocol.

Scoped guides:

- `extensions/AGENTS.md` — extension/plugin boundary.
- `src/plugin-sdk/AGENTS.md` — public SDK contract.
- `src/channels/AGENTS.md` — core channel boundary.
- `src/plugins/AGENTS.md` — plugin loading, registry, manifest.
- `src/gateway/protocol/AGENTS.md` — typed Gateway protocol.
- `test/helpers/AGENTS.md` — shared test helper boundary.
- `docs/AGENTS.md` — Mintlify docs, docs links, docs i18n.
- `ui/AGENTS.md` — Control UI i18n and generated locale.
- `scripts/AGENTS.md` — script-runner, local-check lock, test/lint wrappers.
- `deck-go/AGENTS.md` — deck-go runtime mode, contracts, Go backend,
  frontend-new, and stack-specific checks.

Core principles:

- Core must stay extension-agnostic. No hardcoded extension/provider/channel id
  lists in core.
- Extensions cross into core only through `openclaw/plugin-sdk/*` and manifest
  metadata.
- Extension code must not import core `src/**`; use `openclaw/plugin-sdk/*`
  plus local `api.ts` / `runtime-api.ts`.
- Messaging refactors must consider all built-in and extension channels.
- Protocol changes are contract changes. Prefer additive evolution.
- New plugin seams must be documented, backwards-compatible, versioned
  contracts.

## Current Mainline

`deck-go/` is the current second-development mainline: an enterprise management
and operations platform on top of OpenClaw with a Go backend, React/Vite
frontend, and contract generation chain.

New features, requirements, and bug fixes default to `deck-go/` unless the user
explicitly asks for legacy maintenance.

Authoritative deck-go guide: `deck-go/AGENTS.md`.

Legacy surfaces are reference-only for new work:

- `dashboard/`
- `deck-e2e/`
- `deploy/`
- `scripts/dev/deck-dev.sh`
- root `deck-chat-visual-parity-*` artifacts

Do not copy legacy Deck implementation details into deck-go by default.

## Build, Test, and Development Commands

- Runtime: Node **>=22.14.0** for the OpenClaw TypeScript workspace;
  `deck-go/backend` uses Go **1.24**.
- Install deps: `pnpm install` (also supported: `bun install`).
- If deps are missing, run `pnpm install` then retry the command once.
- Prefer existing `package.json`, `Makefile`, or wrapper scripts. Use Bun when
  an existing script uses Bun, or for a standalone TypeScript utility that is
  not already wrapped.
- Run CLI in dev: `pnpm openclaw ...` or `pnpm dev`.

OpenClaw TypeScript core:

| Command              | Purpose                |
| -------------------- | ---------------------- |
| `pnpm build`         | Type-check + build     |
| `pnpm tsgo`          | TypeScript checks only |
| `pnpm check`         | Lint + format check    |
| `pnpm format:fix`    | Auto-fix formatting    |
| `pnpm test`          | Run Vitest tests       |
| `pnpm test:coverage` | Tests with coverage    |

deck-go:

| Command                             | Purpose                                                    |
| ----------------------------------- | ---------------------------------------------------------- |
| `cd deck-go && make verify`         | contracts check, host check, backend tests, frontend build |
| `cd deck-go && make contract-gate`  | contract governance gate                                   |
| `cd deck-go && make protocol-check` | generated Gateway protocol artifacts                       |
| `cd deck-go && make backend-test`   | Go backend tests                                           |
| `cd deck-go && make frontend-build` | active frontend build                                      |

Verification gates:

- Local OpenClaw TS dev gate: `pnpm check`.
- OpenClaw TS landing gate when touching logic, packaging, or module
  boundaries: `pnpm check` + `pnpm test` + `pnpm build`.
- Local deck-go dev gate: choose the narrowest relevant `make` target from
  `deck-go/AGENTS.md`; use `cd deck-go && make verify` for broad deck-go
  changes.
- deck-go contract/runtime changes: include relevant `make contract-gate`,
  `make protocol-check`, `make backend-test`, and/or `make frontend-build`.
- Do not land changes with failing checks caused by or plausibly related to the
  touched surface.

## Drift Detection And Type Triage

Run gen and commit `.sha256` artifacts when changing these surfaces:

- Config schema: `pnpm config:docs:gen` / `pnpm config:docs:check`.
- Plugin SDK API: `pnpm plugin-sdk:api:gen` / `pnpm plugin-sdk:api:check`.
- deck-go contracts: run the source-specific sync target in `deck-go/`
  (`make contracts-sync`, `make protocol-update`, `make ui-metadata-sync`,
  etc.) and verify with the matching check target.

Type error triage:

- Group by package, module, type, or contract authority.
- Fix the source-of-truth type first.
- Rerun before widening the change.
- Check `origin/main` before broad cleanup.

## Prompt Cache Stability

- Treat prompt-cache stability as correctness/perf-critical.
- Make ordering deterministic for code assembling model/tool payloads from
  maps, sets, registries, or network results.
- Prefer mutating newest/tail content first so cached prefix stays
  byte-identical.
- Cache-sensitive changes require a regression test proving prefix stability.

## TypeScript Coding Style

- TypeScript is ESM / NodeNext in the OpenClaw workspace.
- Strict typing; avoid `any`.
- Oxlint + Oxfmt govern formatting/linting.
- Do not add `@ts-nocheck` or inline lint suppressions by default.
- Prefer `zod` at external boundaries.
- Prefer discriminated unions and `Result<T, E>` for recoverable decisions.
- Do not use freeform strings for internal branching; prefer closed code
  unions.
- Dynamic imports: do not mix `await import("x")` and static `import from "x"`
  for the same module. Use `*.runtime.ts` boundaries for lazy loading.
- Keep `pnpm check:import-cycles` and `pnpm check:madge-import-cycles` green.
- Internal extension imports go through local barrels (`./api.ts`,
  `./runtime-api.ts`).
- No prototype mutation for sharing class behavior. Use explicit
  inheritance/composition.
- Keep files compact; ~700 LOC is a reviewability ceiling, while
  `pnpm check:loc` is a stricter optional guard for TypeScript surfaces.
- Naming: **OpenClaw** for product headings; `openclaw` for CLI/package/paths.
- Written English: American spelling (color, behavior, analyze).

For non-TypeScript surfaces, prefer the local guide and native toolchain first.

## Testing Rules

- Framework: Vitest, V8 coverage (70% threshold).
- Test naming: `*.test.ts`; e2e naming: `*.e2e.test.ts`.
- Model constants in tests: prefer `sonnet-4.6` and `gpt-5.4`.
- Run `pnpm test` before pushing when you touch logic.
- Clean up timers, env, globals, mocks, sockets, and temp dirs so
  `--isolate=false` stays green.
- Avoid `vi.resetModules()` + `await import(...)` per test for heavy modules.
  Prefer static or `beforeAll` imports with mock resets in `beforeEach`.
- Use narrow SDK subpaths and `*.runtime.ts` seams over broad barrel mocks.
- Treat import-dominated test time as a boundary bug.
- Run tests via `pnpm test <path-or-filter> [vitest args...]`; do not use raw
  `pnpm vitest run`.
- Workers: max 16. Memory pressure: `OPENCLAW_VITEST_MAX_WORKERS=1 pnpm test`.
- Live tests: `OPENCLAW_LIVE_TEST=1 pnpm test:live`. Full kit:
  `docs/help/testing.md`.
- Agents must not modify baseline, inventory, or snapshot files to silence
  checks without approval.
- Changelog entries are for user-facing changes only. Append to the end of the
  section. No changelog for pure test changes.

## Commit And PR Rules

- Create commits with `scripts/committer "<msg>" <file...>`; avoid manual
  `git add` / `git commit`.
- Commit only your changes unless the user explicitly says "commit all".
- Group related changes; avoid bundling unrelated refactors.
- Agents must not create or push merge commits on `main`.
- Rebase onto `origin/main` before pushing.
- Use `$openclaw-pr-maintainer` at
  `.agents/skills/openclaw-pr-maintainer/SKILL.md` for PR workflows when
  available.
- When working on a GitHub Issue or PR, print the full URL at the end.

Lore commit protocol:

- First line states why the change was made, not what changed.
- Body records context, constraints, and rationale when useful.
- Use git-native trailers when they add value:
  `Constraint:`, `Rejected:`, `Confidence:`, `Scope-risk:`,
  `Reversibility:`, `Directive:`, `Tested:`, `Not-tested:`, `Related:`.
- `Not-tested:` is required when meaningful verification was skipped or could
  not be run.

## Security And Safety

- Never commit real phone numbers, videos, live config values, secrets, or
  credentials. Use fake placeholders.
- Do not change version numbers or run npm publish without explicit consent.
- Release and publish require explicit approval.
- Any dependency with `pnpm.patchedDependencies` must use exact version, no
  `^` or `~`.
- Patching dependencies requires explicit approval.
- Use `$openclaw-release-maintainer` at
  `.agents/skills/openclaw-release-maintainer/SKILL.md` for release workflows
  when available.
- Use `$openclaw-ghsa-maintainer` at
  `.agents/skills/openclaw-ghsa-maintainer/SKILL.md` for GHSA advisories when
  available.

## Multi-Agent Safety

- Do not create/drop `git stash`, switch branches, or modify `git worktree`
  unless explicitly requested.
- Focus on your changes; ignore unrelated files from other agents.
- If unrelated changes are in files you must edit, read carefully and work with
  them instead of reverting.
- Formatting-only diffs can be resolved without asking. Ask only for semantic
  conflicts that make the task unsafe.
- For parallel work, split by disjoint write scopes and tell workers they are
  not alone in the codebase.

## Editing Discipline

- Prefer deletion over addition.
- Reuse existing utils and patterns before introducing new abstractions.
- No new dependencies without explicit request.
- Keep diffs small, reviewable, and reversible.
- Touch only files and lines required by the request and verification.
- Do not clean adjacent code, comments, formatting, or dead code unless directly
  caused by your change.
- Match existing project style.
- Remove imports, variables, functions, and tests that your own change made
  obsolete.
- Bug investigations should read relevant dependency source before concluding.
- Tool schema guardrails: avoid `Type.Union` in tool input schemas; use
  `stringEnum` / `optionalStringEnum`. Avoid raw `format` property names.
- Never send streaming or partial replies to external messaging surfaces
  (WhatsApp, Telegram); only final replies.

## OpenSpec

OpenSpec is for large architecture design, cross-module contract/API/config
source changes, accepted spec evolution, and long-lived governance.

When an active OpenSpec change governs the work:

- Treat its `proposal.md`, `design.md`, `tasks.md`, `specs/**/*.md`, and
  `verification.yaml` as the source of truth.
- Do not create parallel planning artifacts unless explicitly requested.
- Mark tasks complete only after implementation and fresh verification.
- Run `openspec validate <change> --type change --strict` before claiming the
  OpenSpec work is complete.

For ordinary features, bug fixes, and module cleanup, follow skill routing
instead of forcing OpenSpec.

## Enhanced Fork Upstream Sync

This repository is an enhanced fork of OpenClaw. `enhanced` contains local
incremental work; `main` tracks upstream.

Use this SOP only when the user asks for upstream sync/rebase work:

```bash
git fetch upstream main
git checkout enhanced
git rebase upstream/main
pnpm install
pnpm check
pnpm test
git push --force-with-lease origin enhanced
```

Fork rules:

- Prefix enhanced commits with `[enhanced]` when doing upstream-sync work.
- Keep modifications to upstream files at the smallest insertion point.
- Prefer new files for enhanced functionality.
- If upstream changed Gateway methods or schemas, run the relevant protocol
  generation/check flow before pushing.

Legacy `dashboard/` Protocol SDK details remain in
`AGENTS-backup-2026-05-12.md` for historical reference. deck-go uses its own
contract chain under `deck-go/contracts/`.

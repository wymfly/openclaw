---
summary: "Installable Codex and Claude bundles for OpenSpec closure checks"
read_when:
  - Installing the OpenSpec closure bundle in a new project
  - Activating closure workflow through Codex or Claude bundles
  - Bootstrapping .openspec-closure.yaml in a fresh repository
title: "OpenSpec Closure Plugin"
---

# OpenSpec closure plugin

The OpenSpec closure plugin is the installable bundle form of the closure companion.

Use it when you want the same closure workflow across multiple OpenSpec plus superpowers projects without copying the checker source into each repository.

The pluginized model keeps responsibilities split:

- **bundle** provides the closure executable plus `openspec-closure-workflow`
- **project** provides `.openspec-closure.yaml`, plan `covers.id`, and change-local `verification.yaml`

## What gets installed

The current distribution model provides two product-facing bundles:

- **Codex bundle** with `.codex-plugin/plugin.json`
- **Claude bundle** with `.claude-plugin/plugin.json`

Both bundles expose the same workflow entrypoint:

- `openspec-closure-workflow`

Both bundles run the same lifecycle:

1. `init`
2. `report`
3. `check`

## Manual activation

After installing the bundle, you can explicitly ask the agent to use:

- `openspec-closure-workflow`

That entrypoint should guide the agent to:

- inspect the active OpenSpec change
- initialize `verification.yaml` when needed
- run `report`
- run `check`
- block archive when `archiveReady` is false

Workflow wrappers such as `codex-workflow`, `codex-dev-workflow`, `dev-workflow`, and
`openspec-workflow` may route into this skill, but they should only delegate to
`openspec-closure-workflow`. They should not reimplement closure rules.

## Project bootstrap

A new project should only need a thin adapter surface:

- `.openspec-closure.yaml`
- stable `scenario_id` fields in active specs
- machine-readable `covers.id` in plans
- `openspec/changes/<change>/verification.yaml`

Minimal adapter example:

```yaml
planGlobs:
  - docs/plans/*.md
blockingStatuses:
  - pending
  - blocked
  - deferred
  - spec-fix-required
verificationFileName: verification.yaml
```

The project does **not** need to vendor the closure parser, checker, or report formatter.

## Bundled lifecycle execution

Both bundles are expected to provide the full closure lifecycle through bundled assets:

1. `init` creates `verification.yaml` from `scenario_id` plus plan `covers.id`
2. `report` renders human-readable closure state from the project adapter files
3. `check` emits machine-readable readiness, including `archiveReady`

That contract is the same whether the agent was activated manually or routed through a
wrapper workflow skill.

The executable path should resolve its runtime from the installed bundle itself, not from
the target project's dependency tree. That keeps the same installed bundle usable from a
new project or a second worktree even when that project has not vendored closure code.

## Bootstrap guidance

When the bundle is activated in a project that has not adopted the adapter contract yet, the closure executable should guide the user to:

1. create `.openspec-closure.yaml`
2. add `covers.id` to the implementation plan
3. initialize `openspec/changes/<change>/verification.yaml`

Bootstrap failures should surface these next steps directly instead of only showing raw missing-file errors.

## Recommended workflow

Use the plugin alongside the normal OpenSpec lifecycle:

1. `propose`
2. `plan`
3. `apply`
4. `closure report/check`
5. `archive`

Closure readiness is not a replacement for repo landing bars such as tests, lint, type checks, or build. It proves scenario-level spec convergence only.

## Worktrees and new projects

Once the bundle is installed in the user environment:

- a new worktree of the same repository should reuse it immediately
- a new project only needs the thin adapter files and change artifacts

In both cases, the project should still only own:

- `.openspec-closure.yaml`
- change-local `verification.yaml`
- plan `covers.id`

That is the key difference from the earlier repo-local companion model, which required each project to carry its own checker scripts.

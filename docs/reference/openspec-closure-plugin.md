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

That is the key difference from the earlier repo-local companion model, which required each project to carry its own checker scripts.

# modules/ — Finished handoff packages

> One subdirectory per business module. Each contains everything Codex needs to
> implement or redesign that module into `../../frontend-new/src/components/panels/<module>/`.
>
> Preserved modules restored from frozen `../frontend/` are not missing handoff
> work. They are production baselines in `../frontend-new/`; create a handoff
> package only when a future redesign intentionally changes that preserved
> behavior.

## What "ready" looks like

A module is in `modules/` only when **all of these exist**:

```
modules/<name>/
├── README.md            ← entry point, status, dependencies
├── prototype.html       ← runnable high-fidelity prototype, single file
├── components.md        ← component tree + props contracts
├── states.md            ← state machine + edge cases
├── interactions.md      ← keyboard / hover / focus / a11y / empty / error / loading
├── api-usage.md         ← endpoints + payload shapes
└── tokens-proposal.md   ← (optional) if new tokens needed
```

If any are missing, the module is **not ready** — move it to `../explorations/` until it is.

## Status vocabulary

In each module's `README.md`, the `Status:` line uses one of these values:

| Status                                | Meaning                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `ready-for-implementation`            | Design complete, Claude Code can pick up                                     |
| `in-implementation (claude-code)`     | Claude Code is actively working on this                                      |
| `implemented (commit <sha>)`          | Shipped to `../../frontend-new/src/`                                         |
| `implemented in frontend-new`         | Shipped to active `../../frontend-new/src/` before a commit SHA is available |
| `preserved in frontend-new`           | Restored from frozen `../frontend/` as baseline product behavior             |
| `revised vN — pending implementation` | Re-design after first ship; re-implement                                     |
| `blocked: <reason>`                   | Waiting on something (API contract, design call, …)                          |

## Adding a new module

When the design agent finishes a new module, it creates the directory with all six files. Then it:

1. Adds the module to this README's table below
2. Updates `../README.md` (handoff root) status section
3. Notifies the human

## Current modules

| Module   | Status                      | Last updated |
| -------- | --------------------------- | ------------ |
| `chat`   | migrated                    | 2026-05-01   |
| `agents` | implemented in frontend-new | 2026-05-02   |

Preserved baseline modules currently live in `../../frontend-new/src/components/panels/`:
`gateway`, `models`, `usage`, `sessions`, `memory`, `logs`, `activity`,
`threads`, `api-explorer`, `cron`, `webhooks`, `approvals`, `skills`, `budget`,
`alerts`, `channels`, `plugins`, `routing`, `subagents`, `identity`, `config`,
`nodes`, `docs`, and `settings`.

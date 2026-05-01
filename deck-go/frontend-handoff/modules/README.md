# modules/ — Finished handoff packages

> One subdirectory per business module. Each contains everything Claude Code needs to implement that module into `../../frontend/src/components/panels/<module>/`.

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

| Status                                | Meaning                                             |
| ------------------------------------- | --------------------------------------------------- |
| `ready-for-implementation`            | Design complete, Claude Code can pick up            |
| `in-implementation (claude-code)`     | Claude Code is actively working on this             |
| `implemented (commit <sha>)`          | Shipped to `../../frontend/src/`                    |
| `revised vN — pending implementation` | Re-design after first ship; re-implement            |
| `blocked: <reason>`                   | Waiting on something (API contract, design call, …) |

## Adding a new module

When the design agent finishes a new module, it creates the directory with all six files. Then it:

1. Adds the module to this README's table below
2. Updates `../README.md` (handoff root) status section
3. Notifies the human

## Current modules

| Module                                        | Status | Last updated |
| --------------------------------------------- | ------ | ------------ |
| _none yet — chat module package coming first_ | —      | —            |

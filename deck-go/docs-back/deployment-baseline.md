# Deployment Baseline

This document is the controlled evidence source for the primary migration success metric:

> install / deploy / upgrade must become materially simpler than the legacy Deck

## Supported environments for phase 1

- Linux local/private deployment
- macOS local/private deployment

## Counted-step rule

- One explicit human action equals one counted step
- Failure retries count as additional steps
- Preinstalled system packages are excluded
- Deck-specific setup/runtime actions are counted

## Procedures to compare

1. Fresh install
2. Upgrade existing install
3. Restart and recover after stop

## Legacy baseline

| Procedure                | Environment | Baseline Steps | Source/Notes                                                                                     |
| ------------------------ | ----------- | -------------- | ------------------------------------------------------------------------------------------------ |
| Fresh install            | Linux       | 2              | `deck-go/docs/rollback-runbook.md`: canonical legacy launch remains `cd dashboard` -> `pnpm dev` |
| Fresh install            | macOS       | 2              | same repo-local legacy launch path; no extra platform-specific step in current rollback target   |
| Upgrade existing install | Linux       | 2              | legacy local/private operator recovery still restarts through `cd dashboard` -> `pnpm dev`       |
| Upgrade existing install | macOS       | 2              | same local/private restart path                                                                  |
| Restart and recover      | Linux       | 2              | same manual rollback launch path                                                                 |
| Restart and recover      | macOS       | 2              | same manual rollback launch path                                                                 |

## Current `deck-go` baseline

For phase-1 supported environments, the counted operator path is the managed
foreground stack plus Codex Playwright plugin verification. The former
repo-root Stage 3 host smoke wrappers are disabled for Codex/Ralph validation
because they launch Chrome/Chromium from the shell.

| Procedure                | Environment | Current Steps | Source/Notes                                                                         |
| ------------------------ | ----------- | ------------- | ------------------------------------------------------------------------------------ |
| Fresh install            | Linux       | 1             | managed foreground stack plus Codex Playwright plugin artifact proof                 |
| Fresh install            | macOS       | 1             | same plugin-backed local/private path; shell browser smoke wrappers are disabled     |
| Upgrade existing install | Linux       | 1             | plugin E2E revalidates the active Stage 3 host end-to-end                            |
| Upgrade existing install | macOS       | 1             | same plugin-backed path                                                              |
| Restart and recover      | Linux       | 1             | managed runtime start/stop plus plugin-visible `Gateway Healthy` / `Runtime running` |
| Restart and recover      | macOS       | 1             | same plugin-backed path                                                              |

## Current comparison

| Procedure                | Environment | Legacy Steps | `deck-go` Steps | Reduction | Status       |
| ------------------------ | ----------- | ------------ | --------------- | --------- | ------------ |
| Fresh install            | Linux       | 2            | 1               | 50%       | meets target |
| Fresh install            | macOS       | 2            | 1               | 50%       | meets target |
| Upgrade existing install | Linux       | 2            | 1               | 50%       | meets target |
| Upgrade existing install | macOS       | 2            | 1               | 50%       | meets target |
| Restart and recover      | Linux       | 2            | 1               | 50%       | meets target |
| Restart and recover      | macOS       | 2            | 1               | 50%       | meets target |

Current interpretation:

- phase-1 supported environments are still only Linux/macOS local/private deployment
- on those supported environments, the managed foreground stack plus Codex
  Playwright plugin path is now at least `30%` shorter than the legacy
  local/private launch path
- this does **not** claim a broader production rollout simplification beyond the currently supported environments

## Target threshold

`deck-go/` passes the primary simplification goal only if both supported environments
show at least `30%` fewer operator steps on the comparable procedures above.

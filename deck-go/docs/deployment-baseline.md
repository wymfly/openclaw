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

Fill this section before implementation starts:

| Procedure                | Environment | Baseline Steps | Source/Notes |
| ------------------------ | ----------- | -------------- | ------------ |
| Fresh install            | Linux       | TBD            |              |
| Fresh install            | macOS       | TBD            |              |
| Upgrade existing install | Linux       | TBD            |              |
| Upgrade existing install | macOS       | TBD            |              |
| Restart and recover      | Linux       | TBD            |              |
| Restart and recover      | macOS       | TBD            |              |

## Target threshold

`deck-go/` passes the primary simplification goal only if both supported environments
show at least `30%` fewer operator steps on the comparable procedures above.

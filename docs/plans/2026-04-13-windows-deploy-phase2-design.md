# Windows Native Deploy Phase 2 Design

## Goal

Replace the Windows bare-metal runtime in `deploy/` from PM2 to a Windows-native service model built from:

- a single Node supervisor process
- Scheduled Task as the preferred launch/install mechanism
- Startup-folder login item as the fallback when Scheduled Task creation is denied

## Scope

This phase only changes the **Windows bare-metal PowerShell path** introduced in Phase 1.

- `install.ps1` / `update.ps1` / `start.ps1` / `stop.ps1` / `status.ps1` switch away from PM2
- Docker-on-Windows remains on the existing shell path
- Linux/macOS shell deploy paths remain unchanged

## Runtime model

A new `deploy/scripts/windows/supervisor.mjs` process will own two child processes:

1. Gateway: `node openclaw.mjs gateway run --bind loopback --port ... --force`
2. Deck: `node .next/standalone/dashboard/standalone-entry.mjs`

The supervisor will:

- read `.env`
- derive runtime env for both children
- write a runtime state JSON file with current PIDs
- append logs for supervisor/gateway/deck
- restart crashed children after a delay

A generated launcher `.cmd` script wraps the supervisor in a restart loop, mirroring the core `schtasks.ts` gateway pattern.

## Service install model

Preferred: create a Scheduled Task (`ONLOGON`, `LIMITED`) that runs the launcher script.

Fallback: if Scheduled Task creation fails with permission/availability issues, create a Startup-folder login item that launches the same launcher script hidden.

## Operational behavior

- `install.ps1`: build if needed, seed state, install service, stop legacy PM2 apps, start service, write installed state
- `update.ps1`: preserve `.env` / `data/` / `.backup/`, sync new source, rebuild if needed, rewrite launcher, reinstall service, restart runtime, keep rollback
- `start.ps1`: start registered task or launch fallback startup runtime
- `stop.ps1`: stop task/login item runtime via runtime state PIDs and `taskkill /T /F`
- `status.ps1`: show task/login-item registration plus health probes and runtime state

## Key files

- Create: `deploy/scripts/windows/service.ps1`
- Create: `deploy/scripts/windows/supervisor.mjs`
- Modify: `deploy/scripts/windows/install-or-upgrade.ps1`
- Modify: `deploy/scripts/windows/common.ps1`
- Modify: `deploy/docs/INSTALL-Windows.md`
- Modify: `deploy/INSTALL.md`
- Modify: `deploy/README.md`
- Modify: `deploy/CLAUDE.md`

## Out of scope

- `%LOCALAPPDATA%` versioned app directories
- winget/MSIX/MSI
- replacing the shell/Docker flows on Windows

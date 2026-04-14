# Windows Native Deploy Phase 1 Design

## Goal

Introduce a Windows-native PowerShell install/update path for `deploy/` that removes the current Git Bash requirement, preserves user data during updates, and reuses the existing deploy manifest/seed/rollback mechanics.

## Scope

Phase 1 intentionally does **not** replace the runtime model yet. It keeps the current PM2-managed bare-metal runtime, but changes the Windows entrypoints from `install.bat -> bash` to `install.ps1` and companion PowerShell management/update scripts.

This slice is explicitly **Windows bare-metal only**. Docker-on-Windows remains on the existing shell path for now.

## Why this slice first

- It delivers immediate value to Windows users.
- It is compatible with the current package format.
- It reuses existing `seed.js`, `generate-ecosystem.js`, `write-installed.js`, and manifest-based upgrade logic.
- It creates the native PowerShell foundation needed before a later switch away from PM2.

## In scope

- `deploy/install.ps1` native Windows entrypoint
- Windows helper scripts under `deploy/scripts/windows/`
- Native `start.ps1`, `stop.ps1`, `status.ps1`, `update.ps1`
- Windows docs updated to prefer PowerShell over Git Bash
- Existing `.bat` wrappers may remain for double-click convenience, but should target PowerShell first where practical
- Package output must include top-level PowerShell forwarders so extracted deploy bundles work without Git Bash
- Offline dependency docs must treat Git for Windows as optional fallback, not a prerequisite

## Out of scope

- Replacing PM2 with Scheduled Task / Startup supervisor
- Versioned app directories under `%LOCALAPPDATA%`
- Hosted remote manifest/bootstrap package delivery
- winget/MSI/MSIX distribution
- Docker-on-Windows PowerShell orchestration

## Architecture

PowerShell becomes the orchestrator on Windows. It will:

1. Detect package-vs-repo layout.
2. Ensure `.env` exists from `.env.example`.
3. Auto-install Node/pnpm/PM2 where possible.
4. Run existing Node deploy helpers for seed, PM2 ecosystem generation, and installed-state tracking.
5. On upgrade, preserve `.env` and `data/`, compare manifest/installed state, back up the previous install, replace app files, rerun additive seed, restart services, and preserve rollback.

## Files expected in this slice

- Create: `deploy/install.ps1`
- Create: `deploy/start.ps1`
- Create: `deploy/stop.ps1`
- Create: `deploy/status.ps1`
- Create: `deploy/update.ps1`
- Create: `deploy/scripts/windows/common.ps1`
- Create: `deploy/scripts/windows/install-or-upgrade.ps1`
- Modify: `deploy/install.bat`
- Modify: `deploy/start.bat`
- Modify: `deploy/stop.bat`
- Modify: `deploy/status.bat`
- Modify: `deploy/docs/INSTALL-Windows.md`
- Modify: `deploy/README.md`
- Modify: `deploy/CLAUDE.md`

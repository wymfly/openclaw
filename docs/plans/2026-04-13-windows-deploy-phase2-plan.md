# Windows Native Deploy Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Windows bare-metal deploy runtime with a Scheduled Task / Startup fallback-managed supervisor instead of PM2.

**Architecture:** A generated launcher `.cmd` runs a new Node supervisor process. The supervisor owns Gateway + Deck child processes, logs them, persists runtime state, and restarts crashed children. PowerShell install/start/stop/status scripts manage that runtime via Scheduled Tasks first and a Startup-folder login item fallback second.

**Tech Stack:** PowerShell 5+, Node.js 22+, existing deploy JS helpers, Windows `schtasks`, Startup folder, `taskkill`

---

## Chunk 1: Windows service helper layer

### Task 1: Add a service helper module

**Files:**

- Create: `deploy/scripts/windows/service.ps1`
- Modify: `deploy/scripts/windows/common.ps1`

- [ ] Implement task name, launcher path, startup entry path, runtime state path, and log path resolution.
- [ ] Implement `schtasks` query/create/run/end wrappers.
- [ ] Implement Scheduled Task install with Startup fallback.
- [ ] Implement runtime tree termination with `taskkill /T /F` using supervisor state PIDs.
- [ ] Implement service registration/status inspection for task vs startup-entry mode.

## Chunk 2: Single supervisor runtime

### Task 2: Add the Node supervisor

**Files:**

- Create: `deploy/scripts/windows/supervisor.mjs`

- [ ] Read `.env` from deploy dir and derive Gateway + Deck runtime env.
- [ ] Spawn Gateway and Deck children with hidden windows.
- [ ] Write runtime state JSON with supervisor/gateway/deck PIDs.
- [ ] Append logs to deploy data log files.
- [ ] Restart crashed children after a delay unless shutdown is intentional.

## Chunk 3: Swap PowerShell flow from PM2 to native service runtime

### Task 3: Rework install/update/start/stop/status to use service helpers

**Files:**

- Modify: `deploy/scripts/windows/install-or-upgrade.ps1`
- Modify: `deploy/start.ps1`
- Modify: `deploy/stop.ps1`
- Modify: `deploy/status.ps1`
- Modify: `deploy/install.ps1`

- [ ] Remove PM2 as the runtime dependency for the Windows PowerShell path.
- [ ] On install, stop legacy PM2 OpenClaw apps if present, then install/start the Windows-native service.
- [ ] On upgrade, preserve data, sync source, rebuild if needed, rewrite launcher, reinstall service, restart runtime.
- [ ] On rollback, restore source, reinstall service, restart runtime.
- [ ] Status output should report Scheduled Task vs Startup fallback plus health probes.

## Chunk 4: Docs and verification

### Task 4: Update docs to reflect the new runtime

**Files:**

- Modify: `deploy/docs/INSTALL-Windows.md`
- Modify: `deploy/INSTALL.md`
- Modify: `deploy/README.md`
- Modify: `deploy/CLAUDE.md`

- [ ] Remove PM2-first language from Windows PowerShell docs.
- [ ] Document Scheduled Task / Startup fallback behavior.
- [ ] Keep Docker-on-Windows shell flow explicitly out of scope.

### Task 5: Run available verification

**Files:**

- Test: `deploy/scripts/windows/service.ps1`
- Test: `deploy/scripts/windows/supervisor.mjs`
- Test: `deploy/scripts/windows/install-or-upgrade.ps1`

- [ ] Run shell syntax checks on touched bash scripts.
- [ ] Run `git diff --check`.
- [ ] Rebuild a source-only deploy package and confirm top-level PowerShell forwarders still exist.
- [ ] Summarize unverified Windows-only behaviors because this macOS host lacks PowerShell 5.1 / Windows task runtime.

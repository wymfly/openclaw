# Deploy Handoff

This file is the quickest starting point for the next agent/operator who needs to continue Windows deploy work.

> **Deployment source of truth**: read `deploy/STATUS.md` first. If this file and `deploy/STATUS.md` disagree, `deploy/STATUS.md` wins.
>
> **Maintenance rule**: after any deployment, publish, verification, or rollback step that changes reality, update `deploy/STATUS.md` before handoff.
>
> **Agent context chain**: after reading this file, also read the following before starting any deploy work:
>
> 1. `deploy/STATUS.md` — current live/publish status
> 2. `.agents/skills/openclaw-deploy-release/SKILL.md` — release workflow
> 3. `.agents/skills/openclaw-deploy-release/references/validated-release-flow.md` — commands and checklists
> 4. `deploy/CLAUDE.md` — file index and evolution contracts

## Current validated state

### Server

- Host: `60.204.148.217`
- Working root: `D:\openclaw`

### Live app

- Deck URL: `http://60.204.148.217:3340`
- Gateway health:
  - external via Deck: `http://60.204.148.217:3340/api/gateway/health`
  - local loopback: `http://localhost:19040/healthz`
- Current app root:
  - `D:\openclaw\selftest-data-verify\openclaw-deploy-20260413-174911`
- Current Windows task:
  - `OpenClaw Deploy Current`

### Release install/update entrypoint

- Release HTTP port: `8088`
- Release directory:
  - `D:\openclaw\publish\final-taskfix3`
- User install/update command:

```powershell
iwr -useb http://60.204.148.217:8088/final-taskfix3/install.ps1 | iex
```

### Release HTTP server

- Script:
  - `deploy/scripts/windows/serve-release-http.mjs`
- Windows launcher:
  - `deploy/serve-release-http.cmd`
- Purpose:
  - serve `deploy/publish/` on an independent static HTTP port
- Rule:
  - do **not** reuse Deck `3340`
  - do **not** assume `80/443`

## What is implemented

- Windows PowerShell install/update/start/stop/status flow
- Windows self-contained packaging path
- Scheduled Task-first runtime model
- independent release HTTP port for install assets
- docs and local skill updated for the `:8088` release flow
- Deck SSE reconnect fix landed in:
  - `dashboard/src/lib/deck-client.ts`

## Known operational notes

### 1. Gateway is usually not the real problem

If Deck shows a connection warning, first verify:

- `3340/api/gateway/health`
- `3340/api/gateway/status`

If both are `200`, the issue is likely browser-side SSE status or Deck runtime state, not Gateway liveness.

### 2. Do not hot-replace Deck standalone assets

If you need to refresh Deck runtime files on the live server:

1. stop the Windows task
2. stop matching Node/cmd processes
3. replace:
   - `source/dashboard/.next/standalone`
   - `source/dashboard/.next/static`
   - `source/dashboard/.next/standalone/dashboard/standalone-entry.mjs`
4. start the Windows task again

Trying to overwrite these while Deck is running caused `EBUSY` and stale-bundle issues.

### 3. Browser hard refresh matters

After Deck frontend fixes, ask the user to:

- hard refresh (`Ctrl + F5`)
- or reopen the page in a fresh/private window

Otherwise old browser bundles can make a fixed server still look broken.

## Where the next agent should start

### If the task is “continue deploy/release work”

Start here, in order:

1. `deploy/STATUS.md`
2. `deploy/HANDOFF.md`
3. `deploy/README.md`
4. `deploy/CLAUDE.md`
5. local skill:
   - `~/.codex/skills/openclaw-deploy-release/SKILL.md`
   - `~/.codex/skills/openclaw-deploy-release/references/validated-release-flow.md`

### If the task is “continue fixing chat disconnect warnings”

Start here:

1. `dashboard/src/lib/deck-client.ts`
2. `dashboard/src/lib/deck-client.test.ts`
3. `dashboard/src/components/panels/chat/useChatSSE.ts`
4. `dashboard/src/components/panels/chat/SSEStatusBanner.tsx`
5. `dashboard/src/app/api/stream/route.ts`

Then verify on the server:

- `http://60.204.148.217:3340/api/stream`
- `http://60.204.148.217:3340/api/gateway/health`
- `http://60.204.148.217:3340/api/gateway/status`

### If the task is “continue packaging a new release”

Local:

```bash
deploy/scripts/package.sh --with-prebuilt --bootstrap-base-url http://<host>:8088/<release-label> --output /tmp/openclaw-deploy-release
```

Windows self-contained augmentation:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\package-self-contained.ps1 `
  -BasePackage D:\openclaw\publish\latest\openclaw-deploy-<stamp>.tar.gz `
  -NodeModulesPath D:\openclaw\source\node_modules `
  -OutputDir D:\openclaw\publish\<release-label> `
  -BootstrapBaseUrl http://<host>:8088/<release-label> `
  -Force
```

## Quick verification checklist

### Live app

- Deck home `200`
- `api/gateway/health` `200`
- `api/gateway/status` `200`

### Release endpoint

- `http://<host>:8088/<release-label>/install.ps1` `200`
- `windows-latest.json` `200`
- package tarball downloadable

### Windows task

- task exists
- task launches the intended app root
- app root still contains user data under:
  - `data\.openclaw`
  - `data\openclaw-deck`

## Status-file discipline

Before ending a deploy session, update `deploy/STATUS.md` with at least:

- latest backup path
- latest live app root
- latest publish directory
- whether the public install/update package is fully current or still pending refresh
- the latest external verification results

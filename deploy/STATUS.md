# Deploy Status

This file is the current deployment source of truth for the Windows release host.

- If this file disagrees with `deploy/HANDOFF.md`, this file wins.
- After every deploy, release, publish, verification, or rollback-related operation that changes reality, update this file before stopping.

## Last updated

- Date: `2026-04-16`
- Scope: Windows release host `60.204.148.217`
- Updated during: live-service upgrade from latest local source build

## Current live deployment

### Server

- Host: `60.204.148.217`
- Working root: `D:\openclaw`

### Live app

- App root:
  - `D:\openclaw\selftest-data-verify\openclaw-deploy-20260413-174911`
- Windows task:
  - `OpenClaw Deploy Current`
- Ports:
  - Deck: `3340`
  - Gateway: `19040`
  - Release HTTP: `8088`
- External URLs:
  - Deck: `http://60.204.148.217:3340`
  - Gateway health via Deck: `http://60.204.148.217:3340/api/gateway/health`
  - Gateway status via Deck: `http://60.204.148.217:3340/api/gateway/status`
  - Release bootstrap: `http://60.204.148.217:8088/final-taskfix3/install.ps1`

### Verification result for the current live app

Verified from outside the server on `2026-04-16`:

- `GET /` → `200`
- `GET /api/gateway/health` → `200`
- `GET /api/gateway/status` → `200`
- `GET /api/stream` returns SSE events
- `GET http://60.204.148.217:8088/final-taskfix3/install.ps1` → `200`
- `GET http://60.204.148.217:8088/final-taskfix3/windows-latest.json` → `200`

### Config and backup

- Backup created before the latest live upgrade:
  - `D:\openclaw\backups\upgrade-current-20260416-004235`
- `openclaw.json` SHA-256 before and after upgrade:
  - `ED86321AD4BB54152F965C0EB3B94CEA4D8D904A9E956C275F1EC994236728BD`

## What was completed in the latest upgrade

- Built the latest local source with:
  - `cd dashboard && DECK_GATEWAY_URL='ws://localhost:18789' npx next build --webpack`
  - `pnpm build`
- Deployed fresh runtime files into the live app root:
  - `source/dist`
  - `source/src`
  - `source/extensions`
  - `source/dashboard/.next/standalone`
  - `source/dashboard/.next/static`
  - `source/deploy/scripts`
- Fixed bundled legacy channel loading so the configured WeCom channel no longer disappears during startup:
  - `src/channels/plugins/bundled.ts`
- Fixed Windows supervisor behavior for slow Gateway startup:
  - `deploy/scripts/windows/supervisor.mjs`
  - Deck now connects to `ws://127.0.0.1:<gatewayPort>`
  - Deck starts only after Gateway health becomes ready
- Restarted and revalidated the independent release HTTP service on `8088`
- Corrected the bootstrap and manifest URLs in the current publish directory so they include `:8088`

## Current release/install status

### Release HTTP service

- Release HTTP task:
  - `OpenClawReleaseHTTP`
- Release HTTP root:
  - `D:\openclaw\publish`
- Current published release directory:
  - `D:\openclaw\publish\final-taskfix3`

### Important current gap

The **live service** is already upgraded to the latest local source build, but the **user-facing Windows self-contained package has not yet been regenerated from that latest source build**.

Current published manifest still points to:

- Version: `2026.3.23`
- Package file:
  - `openclaw-deploy-20260414-123224-windows-selfcontained.tar.gz`

That means:

- current live server runtime is newer than the published install/update package
- the install bootstrap is reachable and corrected to `:8088`
- but the next deployment pass still needs to publish a fresh self-contained package before declaring the public install/update artifact fully current

## Operational notes to preserve

### 1. Supervisor startup behavior matters

The Windows supervisor now intentionally:

1. starts Gateway first
2. waits for `http://127.0.0.1:<gatewayPort>/healthz`
3. starts Deck afterwards

Do not revert this to parallel startup unless you re-prove that Deck can reliably recover from slow Gateway startup.

### 2. Use `127.0.0.1`, not `localhost`, for Deck -> Gateway

Current Windows deploy runtime uses:

```text
DECK_GATEWAY_URL=ws://127.0.0.1:<gatewayPort>
```

This avoids the `localhost` IPv4/IPv6 ambiguity that previously caused intermittent Deck control-plane connection failures.

### 3. Long-path stale directory remains but is not active

There is a non-runtime leftover directory from older recursive extension content:

```text
D:\openclaw\selftest-data-verify\openclaw-deploy-20260413-174911\source\extensions.stale-20260416-010014
```

It is not on the active runtime path. It can be cleaned later with a dedicated long-path deletion step if desired, but it is not blocking current service health.

## Next deployment checklist

The next agent/operator should do the following in order:

1. Read:
   - `deploy/STATUS.md`
   - `deploy/HANDOFF.md`
   - `.agents/skills/openclaw-deploy-release/SKILL.md`
2. Build a fresh base tarball from the desired source revision.
3. Generate a fresh Windows self-contained package on the Windows host.
4. Publish that package into a release directory under `D:\openclaw\publish\...`.
5. Verify:
   - bootstrap URL `200`
   - manifest `200`
   - package downloadable
   - fresh install works
   - repeated bootstrap call performs update successfully
   - user data survives update
6. Update this file with:
   - new publish directory
   - new package file/version
   - latest backup path
   - latest app root if it changed
   - latest verification result
   - any remaining deployment gap

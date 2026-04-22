# Windows Live Deploy Notes

This note captures the practical guardrails for updating the validated Windows live host.

Current target:

- Host: `60.204.148.217`
- Live root: `D:\openclaw\selftest-data-verify\openclaw-deploy-20260413-174911`
- Deck: `:3340`
- Gateway: `:19040`
- Release HTTP: `:8088`

## Pre-flight

Before touching the live service:

1. Read `deploy/STATUS.md` first.
2. Verify current health externally:
   - `GET http://60.204.148.217:3340/`
   - `GET http://60.204.148.217:3340/api/gateway/health`
   - `GET http://60.204.148.217:3340/api/gateway/status`
3. Verify the live config hash before and after risky operations:
   - `data\.openclaw\openclaw.json`
4. Preserve the current install tree or at minimum:
   - `data/`
   - `source/deploy/.env`
   - `source/node_modules`

## Tooling reality

The current Windows host does not have a reliable native `tar` toolchain for the validated self-contained flow.

Implications:

- `install.ps1 -UpgradePackage ...` and `package-self-contained.ps1` may fail until `tar` is fixed.
- If you must recover live service before fixing packaging, prefer a controlled live-root promotion while preserving user data.

Do not declare the Windows self-contained release flow healthy again until a real `tar`-backed end-to-end run succeeds.

## Deck Hotfix Rules

If you are replacing Deck runtime files only:

1. Stop the Windows task.
2. Kill any remaining `node.exe`, `cmd.exe`, or `powershell.exe` processes holding the live root.
3. Replace all of the following together:
   - `source/dashboard/.next/standalone`
   - `source/dashboard/.next/static`
   - `source/dashboard/.next/standalone/dashboard/.next/static`
   - `source/dashboard/.next/standalone/dashboard/standalone-entry.mjs`
4. Start the Windows task again.

Observed failure modes when this is done incompletely:

- missing `standalone-entry.mjs` -> Deck loops with `MODULE_NOT_FOUND`
- missing `standalone/dashboard/.next/static` -> external page shell returns `200` but browser gets `/_next/static/*` `404`
- overwriting while live -> `EBUSY` / stale bundle behavior

## Runtime Re-seed Rule

After Deck-only restart or live-root promotion, if:

- `GET /` is `200`
- but `GET /api/gateway/health` is `502`

then Deck server runtime likely lost its in-process Gateway attachment.

Replay:

```bash
curl -X POST http://60.204.148.217:3340/api/onboarding/save-settings \
  -H 'Content-Type: application/json' \
  --data '{"gatewayUrl":"ws://localhost:19040","gatewayToken":"<token>"}'
```

This reinitializes Deck runtime from the persisted settings path.

## Browser Verification Notes

Two browser-specific realities matter:

1. Old tabs can keep stale bundles.
2. The header connection pill may briefly show `Disconnected` until the first `/api/gateway/health` poll completes.

Recommended verification:

- hard refresh (`Ctrl + F5`) or use a fresh/private window
- confirm `/_next/static/*` assets return `200`
- wait through one health poll cycle before judging the header connection state

## WeCom Acceptance Notes

Known-good live evidence after the latest Deck diagnostics fix:

- `api/channels` reports for `wecom/default`:
  - `connected=true`
  - `running=true`
  - `health=healthy`
- browser WeCom detail shows:
  - `WECOM PAGES`
  - `Overview`
  - `Onboarding`
  - `Access`
  - `Healthy`
  - `This account is linked and connected.`

The live WeCom configuration is agent-based, not a separate bot block.

## Playwright Caveat

Current repo live specs under `dashboard/e2e/live-*.spec.ts` are not a production-ready acceptance gate yet.

Reason:

- they depend on `window.__TEST_UI_STORE__`
- that hook is exposed only in `NODE_ENV === "development"`

Use real browser interaction or production-safe Playwright selectors for standalone validation.

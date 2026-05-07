# Deploy Status

This file is the current deployment source of truth for the Windows release host.

- If this file disagrees with `deploy/HANDOFF.md`, this file wins.
- After every deploy, release, publish, verification, or rollback-related operation that changes reality, update this file before stopping.

## Last updated

- Date: `2026-05-07`
- Scope: Windows release host `60.204.148.217`
- Updated during: WeCom plugin hot update for official smart table API alignment and Gateway restart verification

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

Verified from outside the server on `2026-04-20`:

- `GET /` → `200`
- `GET /api/gateway/health` → `200`
- `GET /api/gateway/status` → `200`
- `GET /api/stream` not re-verified in this pass
- `GET http://60.204.148.217:8088/final-taskfix3/install.ps1` → `200`
- `GET http://60.204.148.217:8088/final-taskfix3/windows-latest.json` → `200`

Additional `2026-04-20` live validation notes:

- `openclaw.json` SHA-256 remained:
  - `ED86321AD4BB54152F965C0EB3B94CEA4D8D904A9E956C275F1EC994236728BD`
- Remote Gateway local probe:
  - `GET http://localhost:19040/healthz` → `200`
- Browser-level Playwright validation against the deployed service confirms:
  - page shell loads
  - `Channels` panel renders
  - `WeCom` row is visible in the live `Channels` panel
  - WeCom detail renders the WeCom-specific shell and pages:
    - `Overview`
    - `Onboarding`
    - `Access`
  - WeCom detail renders `WECOM PAGES`
  - WeCom diagnostics report:
    - `Healthy`
    - `This account is linked and connected.`
- sampled external `/_next/static/*` assets now return `200`
- the previous false warning:
  - `Enabled but not linked`
    no longer appears in the live browser evidence
- Current committed `dashboard` live specs are not a reliable production acceptance gate yet because they wait on the dev-only `window.__TEST_UI_STORE__` hook exposed only when `NODE_ENV === "development"`.

Additional `2026-05-06` live configuration validation notes:

- `openclaw.json` SHA-256 after the agent PDF/email/doc tool-chain update:
  - `12C0A93132C62D7C1DE621FF85B7FB34C104757397B289AC0EE12CFCBD7E48E4`
- `openclaw.json` SHA-256 after activating the email account:
  - `6AAC5667770772BABB7FE60DC229A1C2B12B94B40BEA0EF5FEBCF2CADDC75DA6`
- Model routing for the live WeCom-bound `main` agent is CPA-only:
  - `agents.defaults.model.primary`: `cpa/gpt-5.4`
  - `agents.defaults.imageModel.primary`: `cpa/gpt-5.4`
  - `agents.defaults.pdfModel.primary`: `cpa/gpt-5.4`
  - config check confirmed no `codex/gpt-5.4` reference remains.
- Email account activation was applied without storing the mailbox password in `openclaw.json`:
  - `plugins.entries.email.config.defaultAccountId`: `main`
  - `plugins.entries.email.config.accounts[0].user`: `yiming.wang@falcontech.com.cn`
  - IMAP endpoint: `imap.exmail.qq.com:993`
  - SMTP endpoint: `smtp.exmail.qq.com:587`
  - password source: `env:default:OPENCLAW_EMAIL_PASSWORD`
  - download root: `D:\openclaw\selftest-data-verify\openclaw-deploy-20260413-174911\data\email-downloads`
  - remote IMAP login probe returned `imapLoginOk=true`
- WeCom routing and tool access were verified through the live Gateway:
  - `bindings[]` routes `wecom/default` to agent `main`
  - `agents.list[].tools.profile` for `main` is `full`
  - `tools.effective` for `agent:main:main` includes `pdf`
  - `tools.effective` includes email tools:
    `email_list`, `email_search`, `email_read`,
    `email_download_attachments`, `email_download_matching_attachments`,
    `email_send`
  - `tools.effective` includes WeCom document tool `wecom_doc`
- `GET http://localhost:19040/healthz` returned healthy after restart.
- `GET http://localhost:3340/api/gateway/health` returned healthy after restart.
- `GET http://localhost:3340/api/channels` reported WeCom:
  - `running=true`
  - `health=healthy`
  - `connected=true`
  - `authenticated=true`
  - `transport=agent-callback`

Additional `2026-05-07` WeCom plugin hot-update validation notes:

- Live WeCom plugin source and built runtime were hot-replaced from the local build that aligns smart table record creation/deletion payloads with the official WeCom API.
- Runtime metadata for `source\dist\extensions\wecom` was restored before the final restart:
  - `openclaw.plugin.json`
  - `package.json`
  - `skills`
- The WeCom dist dependency closure was copied into live `source\dist`; `fetch-guard-Clyd8fLh.js` is present at:
  - `D:\openclaw\selftest-data-verify\openclaw-deploy-20260413-174911\source\dist\fetch-guard-Clyd8fLh.js`
- `GET http://localhost:19040/healthz` returned:
  - `200 {"ok":true,"status":"live"}`
- `GET http://localhost:3340/api/gateway/health` returned `200` and reported WeCom configured with successful probe:
  - `probe.ok=true`
  - `agentId=1000048`
  - `transport=agent-callback`
- `GET http://localhost:3340/api/channels` returned `200` and reported WeCom:
  - `running=true`
  - `health=healthy`
  - `connected=true`
  - `authenticated=true`
  - `transport=agent-callback`
  - `webhookPath=/plugins/wecom/agent/default`
- Gateway log for the final restart includes:
  - `ready (7 plugins: acpx, browser, device-pair, email, phone-control, talk-voice, wecom; 50.9s)`
  - `wecom-http ... gettoken status=200`
  - `wecom agent agent-callback started`
  - `runtime status health=healthy ... connected=true authenticated=true`

### Config and backup

- Backup created before the latest live upgrade:
  - `D:\openclaw\backups\upgrade-current-20260416-004235`
- Backup used during the `2026-04-19` live recovery:
  - `D:\openclaw\backups\live-manual-upgrade-20260419-0105`
- Backup created before the `2026-05-06` agent PDF/email/doc tool-chain update:
  - `D:\openclaw\backups\agent-pdf-email-wecom-chain-20260506-104634`
- Backup created before correcting model routing to CPA-only:
  - `D:\openclaw\backups\agent-pdf-email-wecom-chain-cpa-correction-20260506-104905`
- Backup created before activating the email account:
  - `D:\openclaw\backups\email-config-20260506-110746`
- Backups created during the `2026-05-07` WeCom plugin hot update:
  - `D:\openclaw\backups\wecom-plugin-api-align-20260507-174043`
  - `D:\openclaw\backups\wecom-dist-runtime-manifest-fix-20260507-174855`
  - `D:\openclaw\backups\wecom-dist-chunks-fix-20260507-175339`
  - `D:\openclaw\backups\wecom-dist-chunks-copy-fix-20260507-175839`
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
- `2026-04-19` / `2026-04-20` follow-up work:
  - packaged latest local source revision into `openclaw-deploy-20260419-005535.tar.gz`
  - uploaded and staged release metadata under:
    - `D:\openclaw\publish\final-20260419-deck-e2e`
  - remote Windows host still lacks a usable native `tar`, so the built-in package upgrade flow could not run unchanged
  - a temporary Node-backed `tar` shim was used to recover the live service path
  - the automatic package-upgrade backup tarball step proved too heavy for that shim, so the live root was promoted manually while preserving:
    - `data`
    - `source\deploy\.env`
    - `source\node_modules`
  - Deck runtime settings then had to be re-seeded via `POST /api/onboarding/save-settings` to restore `GET /api/gateway/health` to `200`
  - after the Deck-only restart, `POST /api/onboarding/save-settings` had to be replayed again to reattach the Deck server runtime to the local Gateway
  - a follow-up Deck-only hot update replaced:
    - `source\dashboard\.next\standalone`
    - `source\dashboard\.next\static`
  - `source\dashboard\.next\standalone\dashboard\standalone-entry.mjs` had to be copied explicitly because the supervisor launch path depends on it
  - `source\dashboard\.next\static` also had to be copied into:
    - `source\dashboard\.next\standalone\dashboard\.next\static`
      so production `_next/static/*` assets would stop returning `404`
  - hot-replaced Deck standalone assets, including:
    - `source\dashboard\.next\standalone`
    - `source\dashboard\.next\static`
    - `source\dashboard\.next\standalone\dashboard\.next\static`
    - `source\dashboard\.next\standalone\dashboard\standalone-entry.mjs`
  - deployed a frontend diagnostics fix so a connected WeCom account is no longer mislabeled as `Enabled but not linked` when the optional backend `linked` field is omitted

## Current release/install status

### Release HTTP service

- Release HTTP task:
  - `OpenClawReleaseHTTP`
- Release HTTP root:
  - `D:\openclaw\publish`
- Current published release directory:
  - `D:\openclaw\publish\final-taskfix3`
- New staged-but-not-finalized release directory from the latest pass:
  - `D:\openclaw\publish\final-20260419-deck-e2e`

### Important current gaps

The **live service** is already upgraded to the latest local source build, but the **user-facing Windows self-contained package has not yet been regenerated from that latest source build**.

Current published manifest still points to:

- Version: `2026.3.23`
- Package file:
  - `openclaw-deploy-20260414-123224-windows-selfcontained.tar.gz`

That means:

- current live server runtime is newer than the published install/update package
- the install bootstrap is reachable and corrected to `:8088`
- but the next deployment pass still needs to publish a fresh self-contained package before declaring the public install/update artifact fully current
- remote Windows host still needs a supported `tar` toolchain (or an officially supported alternative) before the validated self-contained package flow can be re-run end-to-end
- current live browser evidence is healthy for WeCom diagnostics, but the repo's existing `dashboard/e2e/live-*.spec.ts` files are still dev-only biased and should not be treated as a production acceptance gate yet
- live WeCom browser validation is now healthy:
  - channel entry is present
  - server health endpoints are healthy
  - the backend `api/channels` payload reports `connected=true`, `running=true`, and `health=healthy` for `wecom/default`
  - browser-side WeCom detail reports `Healthy`
  - remaining gap is package/release tooling, not the current live WeCom diagnostics path

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

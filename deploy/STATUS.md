# Deploy Status

This file is the current deployment source of truth for the Windows release host.

- If this file disagrees with `deploy/HANDOFF.md`, this file wins.
- After every deploy, release, publish, verification, or rollback-related operation that changes reality, update this file before stopping.

## Last updated

- Date: `2026-05-14`
- Scope: Windows release host `60.204.148.217`
- Updated during: current deployment status documentation and live port verification

## Quick current-state document

- Current quick handoff: `deploy/CURRENT-DEPLOYMENT.md`
- Last verified: `2026-05-14`
- Active public app endpoint: `http://60.204.148.217:3340/`
- Active local Gateway endpoint: `http://127.0.0.1:19040/healthz`
- Release HTTP `:8088` is **not currently running**; the release directory exists, but public `GET http://60.204.148.217:8088/final-taskfix3/install.ps1` returned `502`.
- Direct public Gateway `:19040` is **not exposed for use**; public `GET http://60.204.148.217:19040/healthz` returned `502`.

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
  - Gateway: `19040` loopback only
  - Release HTTP: `8088` expected release port, currently inactive
- External URLs:
  - Deck: `http://60.204.148.217:3340`
  - Gateway health via Deck: `http://60.204.148.217:3340/api/gateway/health`
  - Gateway status via Deck: `http://60.204.148.217:3340/api/gateway/status`
  - Release bootstrap: `http://60.204.148.217:8088/final-taskfix3/install.ps1` (currently inactive / `502`)

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

Additional `2026-05-07` WeCom Markdown transport hotfix validation notes:

- Live WeCom plugin source and built runtime were hot-replaced from the local build that sends application callback replies through the official WeCom application message `markdown` type.
- `openclaw.json` was not changed during this hotfix; existing CPA provider, email account, WeCom bot/agent credentials, and agent tool routing were preserved.
  - Current live SHA-256 after the hotfix: `60039BBFEA69AAA33E9E1F6047604BB1E1039C398480FB3D80C79150DE97C578`
- The application API path now sends `cgi-bin/message/send` payloads with:
  - `msgtype=markdown`
  - `markdown.content`
- The Bot/WS markdown path is intentionally unchanged and still owns the `markdown_v2` compatibility fallback.
- Remote dist verification after deployment:
  - `source\dist\agent-Cys7tWiQ.js` contains `msgtype:"markdown"`
  - `source\dist\agent-Cys7tWiQ.js` does not contain the old `markdown_v2 rejected` app-message retry branch
- `GET http://127.0.0.1:19040/healthz` returned:
  - `200 {"ok":true,"status":"live"}`
- `GET http://127.0.0.1:3340/api/channels` returned `200` and reported WeCom:
  - `running=true`
  - `health=healthy`
  - `connected=true`
  - `authenticated=true`
  - `transport=agent-callback`
  - `webhookPath=/plugins/wecom/agent/default`
- Public `GET http://60.204.148.217:3340/api/channels` returned `200` with the same WeCom healthy/running state.
- Gateway log window after the final restart (`2026-05-07T18:49+08:00` onward) reported:
  - `ready (7 plugins: acpx, browser, device-pair, email, phone-control, talk-voice, wecom; 155.6s)`
  - `wecom agent agent-callback started`
  - `runtime status health=healthy ... connected=true authenticated=true`
  - no `errcode=40008`, `invalid message type`, or `wecom-agent-api` errors in the checked window

Additional `2026-05-07` WeCom Markdown rendering cleanup validation notes:

- Live WeCom plugin source and built runtime were hot-replaced from the local build that:
  - disables block streaming for Agent callback replies (`disableBlockStreaming=true`)
  - downgrades WeCom-hostile Markdown constructs before send:
    - fenced code block markers
    - blockquote prefixes
    - inline-code backticks
  - keeps WeCom outbound chunking in `markdown` mode with a WeCom-specific UTF-8 byte limit
- The email plugin runtime was refreshed with the local build that restores the missing attachment filename sanitizer import used by send attachments.
- `openclaw.json` was not changed during this hotfix; existing CPA provider, email account, WeCom bot/agent credentials, and agent tool routing were preserved.
  - Current live SHA-256 after the hotfix: `60039BBFEA69AAA33E9E1F6047604BB1E1039C398480FB3D80C79150DE97C578`
- Remote dist verification after deployment:
  - `source\dist\extensions\wecom\index.js` reports `chunkerMode="markdown"`
  - `source\dist\extensions\wecom\index.js` contains final-only Agent callback reply dispatch
  - `source\dist\agent-CsuWLK5Y.js` contains `WECOM_MARKDOWN_DEFAULT_BYTES`
  - `source\dist\extensions\email\index.js` contains `sanitizeAttachmentFilename`
- `GET http://127.0.0.1:19040/healthz` returned:
  - `200 {"ok":true,"status":"live"}`
- Public `GET http://60.204.148.217:3340/api/channels` returned `200` and reported WeCom:
  - `running=true`
  - `health=healthy`
  - `connected=true`
  - `authenticated=true`
  - `transport=agent-callback`
  - `webhookPath=/plugins/wecom/agent/default`

Additional `2026-05-08` WeCom MCP/media interceptor deployment validation notes:

- Before deployment, the live Windows task was already terminated and both local probes were offline:
  - `GET http://127.0.0.1:19040/healthz` could not connect
  - `GET http://127.0.0.1:3340/api/channels` could not connect
  - Windows task last result was `-1073741510`
- Live WeCom/email plugin source and built runtime were hot-replaced from the local build that includes:
  - WeCom MCP before/after-call interceptors for smartsheet local image/file paths
  - `get_msg_media` base64 response offload to local media storage
  - smartpage local file expansion/export offload
  - additional WeCom MCP business cache-clear codes
  - outbound media attachment handling for local files
  - email attachment filename sanitizer import
  - official WeCom plugin migration plan documentation
- `openclaw.json` was not changed during this hotfix.
  - Current live SHA-256 after the hotfix: `60039BBFEA69AAA33E9E1F6047604BB1E1039C398480FB3D80C79150DE97C578`
- Remote dist verification after deployment:
  - `source\dist\extensions\wecom\index.js` contains MCP interceptor markers:
    - `image_path`
    - `get_msg_media`
  - `source\dist\extensions\email\index.js` contains `sanitizeAttachmentFilename`
  - `source\extensions\wecom\docs\official-plugin-migration-plan.md` exists
- `GET http://127.0.0.1:19040/healthz` returned:
  - `200 {"ok":true,"status":"live"}`
- Public `GET http://60.204.148.217:3340/api/gateway/health` returned `200`.
- Public `GET http://60.204.148.217:3340/api/channels` returned `200` and reported WeCom:
  - `running=true`
  - `health=healthy`
  - `connected=true`
  - `authenticated=true`
  - `transport=agent-callback`
  - `webhookPath=/plugins/wecom/agent/default`
- Gateway log after restart reported:
  - `ready (7 plugins: acpx, browser, device-pair, email, phone-control, talk-voice, wecom; 41.3s)`
  - `wecom-http ... gettoken status=200`
  - `wecom agent agent-callback started`
  - `runtime status health=healthy ... connected=true authenticated=true`
- Temporary upload directory `D:\openclaw\publish\hotfix-wecom-20260508` was removed after deployment so release HTTP does not expose the hotfix archive.

Additional `2026-05-08` WeCom doc API hotfix validation notes:

- Live WeCom plugin source, skills, built runtime, and required dist dependency chunks were hot-replaced from the local build that aligns WeCom doc/smartsheet tool payloads with the current official WeCom API.
- The deployed hotfix package was:
  - local archive: `/tmp/openclaw-wecom-doc-hotfix-20260508-141108.zip`
  - SHA-256: `42c8e0080a8fd32f3d98a72a4a4c54e189df1b109d927be4c6e54b7f2c80a00e`
- `openclaw.json` was not changed during this hotfix.
  - Current live SHA-256 after the hotfix: `60039BBFEA69AAA33E9E1F6047604BB1E1039C398480FB3D80C79150DE97C578`
- Remote dist verification after deployment:
  - `source\dist\extensions\wecom\index.js` contains the external-record endpoint guard
  - `source\dist\extensions\wecom\index.js` contains `property_number` field creation normalization
  - `source\dist\extensions\wecom\index.js` contains field group child normalization
- `GET http://127.0.0.1:19040/healthz` returned:
  - `200 {"ok":true,"status":"live"}`
- Public `GET http://60.204.148.217:3340/` returned `200`.
- Public `GET http://60.204.148.217:3340/api/channels` returned `200` and reported WeCom:
  - `running=true`
  - `health=healthy`
  - `connected=true`
  - `authenticated=true`
  - `transport=agent-callback`
  - `webhookPath=/plugins/wecom/agent/default`
- Windows task/process verification after restart:
  - `OpenClaw Deploy Current` state: `Running`
  - Gateway listens on `127.0.0.1:19040` and `::1:19040`
  - Deck listens on `0.0.0.0:3340`
- Gateway log after restart reported:
  - `ready (7 plugins: acpx, browser, device-pair, email, phone-control, talk-voice, wecom; 41.6s)`
  - `wecom runtime start bot=disabled agent=callback/api`
  - `runtime status health=healthy ... connected=true authenticated=true`
  - WeCom smartsheet calls such as `get_fields`, `get_records`, `add_field_group`, `add_records`, and `update_records` returned HTTP `200` in the sampled window.
- Non-blocking log noise observed in the checked window:
  - `model-pricing` bootstrap timeout
  - embedded `acpx` runtime backend probe failure
  - Deck `NOT_PAIRED` control-plane attempts
    These were not on the WeCom runtime path and did not prevent `/api/channels` from reporting WeCom healthy/running.

Additional `2026-05-08` WeCom doc regression hotfix validation notes:

- The uploaded agent report `wecom_doc_test_report_2026-05-08.csv` showed:
  - `smartsheet_add_group` is now fixed
  - `smartsheet_get_records` still returned empty `values`
  - `smartsheet_get_sheet_priv` still failed for the tested shape
  - `create_collect` still needed better request alias handling
  - `external_records` now fails with the intended explicit non-Wedoc-endpoint message
- Live WeCom plugin source, skills, built runtime, and required dist dependency chunks were hot-replaced from the local build that:
  - stops sending empty `field_titles`, `field_ids`, `record_ids`, and `sort` arrays in default `smartsheet_get_records` requests
  - defaults `smartsheet_get_sheet_priv` to `type=1` when omitted
  - rejects `type=2` sheet-privilege reads without non-empty `rule_id_list` before calling WeCom
  - accepts `create_collect` input as `request.form_title + request.items/questions` and normalizes it to official `form_info.form_question.items`
  - documents the multi-step permission flow and the no-empty-field-filter rule in WeCom skills
- The deployed hotfix package was:
  - local archive: `/tmp/openclaw-wecom-regression-hotfix-20260508-150000.zip`
  - SHA-256: `dfa86ac57cd62b1ca2d224a7f062e9f4f13d02d77b5218f8b6ab675512d3fd8d`
- `openclaw.json` was not changed during this hotfix.
  - Current live SHA-256 after the hotfix: `60039BBFEA69AAA33E9E1F6047604BB1E1039C398480FB3D80C79150DE97C578`
- Remote dist verification after deployment:
  - `source\dist\extensions\wecom\index.js` contains `type=2 requires non-empty rule_id_list`
  - `source\dist\extensions\wecom\index.js` contains `not a WeCom Wedoc API endpoint`
  - `source\dist\extensions\wecom\index.js` contains `property_number`
  - `source\dist\extensions\wecom\index.js` contains `form_question`
  - `source\extensions\wecom\skills\wecom-smartsheet-data\SKILL.md` contains the warning not to send empty field-filter arrays
- `GET http://127.0.0.1:19040/healthz` returned:
  - `200 {"ok":true,"status":"live"}`
- Public `GET http://60.204.148.217:3340/` returned `200`.
- Public `GET http://60.204.148.217:3340/api/channels` returned `200` and reported WeCom:
  - `running=true`
  - `health=healthy`
  - `connected=true`
  - `authenticated=true`
  - `transport=agent-callback`
  - `webhookPath=/plugins/wecom/agent/default`
- Public `GET http://60.204.148.217:3340/api/gateway/health` returned `200` with WeCom probe:
  - `probe.ok=true`
  - `agentId=1000048`
  - `transport=agent-callback`
- Gateway log after restart reported:
  - `ready (7 plugins: acpx, browser, device-pair, email, phone-control, talk-voice, wecom; 42.8s)`
  - `wecom-http ... gettoken status=200`
  - `wecom runtime start bot=disabled agent=callback/api`
  - `runtime status health=healthy ... connected=true authenticated=true`
- A short restart-window `/api/channels`/`api/gateway/health` `500` was observed immediately after Deck came up, then both endpoints recovered to `200`; this matched Deck control-plane reconnection timing and did not persist.
- Non-blocking log noise observed in the checked window:
  - `model-pricing` bootstrap timeout
  - embedded `acpx` runtime backend probe failure
    These were not on the WeCom runtime path.

Additional `2026-05-08` WeCom doc record normalization hotfix validation notes:

- Live WeCom plugin source and built runtime were hot-replaced from the local build that:
  - normalizes `smartsheet_add_records` / `smartsheet_update_records` values using live `get_fields` metadata before writing records
  - converts common agent-style text cells like `{type:"text",text:"..."}` to the persisted WeCom text array shape
  - converts common agent-style number cells like `{type:"number",number:11.1}` to primitive numeric values
  - lets `smartsheet_create_rule` accept optional privilege/member initialization parameters and applies them with official follow-up APIs
- The deployed hotfix package was:
  - local archive: `/tmp/openclaw-wecom-doc-record-normalize-20260508.zip`
  - SHA-256: `60558787505169abf69fbf3fe8ea24a2f8fb6a7c8072adfc3afbffe2312718ea`
- `openclaw.json` was not changed during this hotfix.
  - Config SHA-256 before and after deployment:
    `60039BBFEA69AAA33E9E1F6047604BB1E1039C398480FB3D80C79150DE97C578`
- Local verification before deployment:
  - `pnpm test extensions/wecom/src/capability/doc/client.test.ts` → `21 passed`
  - `pnpm test extensions/wecom/src/capability/doc/client.test.ts extensions/wecom/src/capability/doc/tool.test.ts extensions/wecom/src/capability/mcp/tool.test.ts extensions/wecom/src/outbound.test.ts extensions/wecom/src/transport/agent-api/core.test.ts extensions/wecom/src/enhanced/mcp-config.test.ts` → `6 passed / 55 passed`
  - `pnpm tsgo` → passed
  - `pnpm build` → passed
- Remote dist verification after deployment:
  - `source\dist\extensions\wecom\index.js` contains `normalizeSmartTableRecordCellValue`
  - `source\dist\extensions\wecom\index.js` contains `smartsheet_create_rule response missing rule_id`
- `GET http://127.0.0.1:19040/healthz` returned:
  - `200 {"ok":true,"status":"live"}`
- Public `GET http://60.204.148.217:3340/` returned `200`.
- Public `GET http://60.204.148.217:3340/api/gateway/health` returned `200`.
- Public `GET http://60.204.148.217:3340/api/channels` returned `200` and reported WeCom:
  - `running=true`
  - `health=healthy`
  - `connected=true`
  - `authenticated=true`
  - `transport=agent-callback`
  - `webhookPath=/plugins/wecom/agent/default`
- Windows task/process verification after restart:
  - `OpenClaw Deploy Current` state: `Running`
  - Gateway listens on `127.0.0.1:19040` and `::1:19040`
  - Deck listens on `0.0.0.0:3340`
- Gateway log after restart reported:
  - `ready (7 plugins: acpx, browser, device-pair, email, phone-control, talk-voice, wecom; 40.7s)`
  - `wecom-http ... gettoken status=200`
  - `wecom agent agent-callback started`
  - `runtime status health=healthy ... connected=true authenticated=true`
- Temporary upload artifacts were removed from `D:\openclaw\publish` after deployment so release HTTP does not expose the hotfix archive or helper scripts.

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
- Backup created before the `2026-05-07` WeCom Markdown transport hotfix:
  - `D:\openclaw\backups\wecom-markdown-hotfix-20260507-104456`
- Backup created before the `2026-05-07` WeCom Markdown rendering cleanup:
  - primary rollback backup: `D:\openclaw\backups\wecom-markdown-render-20260507-195406`
  - additional retry backups from validation-script reruns:
    - `D:\openclaw\backups\wecom-markdown-render-20260507-195440`
    - `D:\openclaw\backups\wecom-markdown-render-20260507-195523`
    - `D:\openclaw\backups\wecom-markdown-render-20260507-195608`
- Backup created before the `2026-05-08` WeCom MCP/media interceptor deployment:
  - `D:\openclaw\backups\wecom-mcp-media-port-20260508-131023`
- Backup created before the `2026-05-08` WeCom doc API hotfix:
  - `D:\openclaw\backups\wecom-doc-api-hotfix-20260508-142739`
- Backup created before the `2026-05-08` WeCom doc regression hotfix:
  - `D:\openclaw\backups\wecom-regression-hotfix-20260508-150000`
- Backup created before the `2026-05-08` WeCom doc record normalization hotfix:
  - `D:\openclaw\backups\wecom-doc-record-normalize-20260508-154107`
- Backup created before the `2026-05-08` WeCom `create_collect` minimal-form hotfix:
  - `D:\openclaw\backups\wecom-create-collect-minimal-20260508-170457`
- Backup created before the `2026-05-08` WeCom tool-contract convergence hotfix:
  - `D:\openclaw\backups\wecom-tool-contract-convergence-20260508-1723`
- Backup created before the `2026-05-08` WeCom doc OpenSpec contract-convergence deployment:
  - `D:\openclaw\backups\wecom-doc-contract-20260508-233248`
- Backup created before the `2026-05-09` WeCom agent-facing contract cleanup deployment:
  - `D:\openclaw\backups\wecom-agent-contract-20260509-125429`
- Backup created before the `2026-05-09` WeCom doc v5 regression fixes deployment:
  - `D:\openclaw\backups\wecom-doc-v5-fixes-20260509-1730`
- Backup created before the `2026-05-11` WeCom doc statistic object-body fix deployment:
  - `D:\openclaw\backups\wecom-doc-statistic-object-20260511-1108`
- Historical `2026-04` `openclaw.json` SHA-256 before and after upgrade:
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

## 2026-05-08 WeCom doc rerun2 hotfix

- Latest test report reviewed:
  - `wecom_doc_test_report_2026-05-08_rerun2.csv`
- Confirmed fixed by the previous pass:
  - `smartsheet_get_records` now returns `values` for both `FIELD_ID` and `FIELD_TITLE`
  - `smartsheet_get_sheet_priv` remains usable
  - `smartsheet_add_group` remains usable
- Remaining issues addressed in this pass:
  - `smartsheet_create_rule`/`smartsheet_update_sheet_priv` now normalize `priv_list[].priv` aliases before MCP calls, so agent-shaped values such as `{ "value": "VIEW" }` are converted to the WeCom integer privilege value (`3`)
  - `create_collect` accepted `docName`, `formTitle`, or `form_title` as title aliases in this pass, but live retest later proved the empty `form_question.items` fallback was rejected by WeCom with `640027 Invalid param`; this is superseded by the minimal-form hotfix below
  - WeCom doc skill guidance now tells agents to prefer integer `priv` values
- Local verification:
  - `pnpm test extensions/wecom/src/capability/doc/client.test.ts extensions/wecom/src/capability/mcp/tool.test.ts` passed: 2 files, 32 tests
  - `pnpm test extensions/wecom/src/capability/doc/client.test.ts extensions/wecom/src/capability/doc/tool.test.ts extensions/wecom/src/capability/mcp/tool.test.ts` passed: 3 files, 34 tests
  - `pnpm tsgo` passed
  - `pnpm build` passed
  - `pnpm check` still fails on existing repo-wide lint debt; touched WeCom files also contain pre-existing lint debt in adjacent code, but the targeted tests/type/build gates pass
- Remote deployment:
  - Live root unchanged:
    - `D:\openclaw\selftest-data-verify\openclaw-deploy-20260413-174911`
  - Backup:
    - `D:\openclaw\backups\wecom-doc-rerun2-hotfix-20260508-1613`
  - Config hash preserved:
    - `60039BBFEA69AAA33E9E1F6047604BB1E1039C398480FB3D80C79150DE97C578`
  - Restarted via bundled `stop.ps1` / `start.ps1`
  - Post-restart status:
    - Gateway `:19040` healthy
    - Deck `:3340` healthy
    - `/api/channels` reports WeCom `running=true`, `connected=true`, `authenticated=true`, `health=healthy`
- Remaining validation gap:
  - The next WeCom chat regression should specifically retry `smartsheet_create_rule` with object privilege aliases and `create_collect` with title-only input to confirm live agent behavior matches the plugin-level fix.

## 2026-05-08 WeCom create_collect minimal-form hotfix

- Live retest result reviewed:
  - `smartsheet_create_rule` with `priv_list[].priv={ "value": "VIEW" }` no longer failed local/schema privilege validation; the request reached WeCom and failed first on `errcode 301085 invalid docid`, so this still needs a valid `docId` to prove full API success
  - `create_collect` with only `docName` failed against WeCom with `errcode 640027 Invalid param`, proving that WeCom currently rejects title-only/empty-question collect form creation
- Official WeCom plugin reference:
  - `vendor/OpenClaw-Wechat/src/wecom/doc-schema.js` requires `formInfo` for `create_collect`
  - `vendor/OpenClaw-Wechat/src/wecom/doc-client.js` submits `form_info` as provided and does not implement a `docName` blank-form shortcut
- Local fix:
  - Direct `wecom_doc.create_collect` and session `wecom_mcp` both normalize title-only aliases to official `form_info.form_title`
  - Instead of sending `form_question.items: []`, the plugin now inserts one non-required default text question:
    - `question_id=1`
    - `title="内容"`
    - `pos=1`
    - `status=1`
    - `reply_type=1`
    - `must_reply=false`
  - Validation now rejects any final `form_question.items` array that is still empty before calling WeCom
  - WeCom doc skill guidance now states that title-only collect creation creates a minimal collect form, not a blank form
- Local verification:
  - First ran the updated direct-client regression and observed the expected failure against the old `items: []` implementation
  - `pnpm test extensions/wecom/src/capability/doc/client.test.ts -t "minimal collect form"` passed
  - `pnpm test extensions/wecom/src/capability/mcp/tool.test.ts -t "create_collect title aliases"` passed
  - `pnpm test extensions/wecom/src/capability/doc/client.test.ts extensions/wecom/src/capability/doc/tool.test.ts extensions/wecom/src/capability/mcp/tool.test.ts` passed: 3 files, 34 tests
  - `pnpm tsgo` passed
  - `pnpm build` was interrupted after `dist/extensions/wecom/index.js` was regenerated and verified because the unrelated `whatsapp` runtime fallback dependency install stalled; do not count full build as passed for this pass
- Remote deployment:
  - Hotfix archive:
    - `/tmp/openclaw-wecom-create-collect-minimal-20260508.zip`
    - SHA-256: `a79af13912b70a36623eb45f3105475e34256fceaebe60c6780f703033d8a642`
  - Live root unchanged:
    - `D:\openclaw\selftest-data-verify\openclaw-deploy-20260413-174911`
  - Backup:
    - `D:\openclaw\backups\wecom-create-collect-minimal-20260508-170457`
  - Config hash preserved:
    - `60039BBFEA69AAA33E9E1F6047604BB1E1039C398480FB3D80C79150DE97C578`
  - Remote dist verification:
    - `source\dist\extensions\wecom\index.js` contains `createDefaultCollectQuestion`
    - `source\dist\extensions\wecom\index.js` contains the fallback-items marker
  - Restarted via bundled `stop.ps1` / `start.ps1`
  - Post-restart probes returned:
    - Gateway `GET http://127.0.0.1:19040/healthz` -> `200 {"ok":true,"status":"live"}`
    - Deck `GET http://127.0.0.1:3340/api/channels` -> `200`
    - WeCom channel reports `running=true`, `connected=true`, `authenticated=true`, `health=healthy`, `transport=agent-callback`, `webhookPath=/plugins/wecom/agent/default`
    - Gateway probe reports `ok=true`, `agentId=1000048`, `transport=agent-callback`
  - Gateway log after restart reported:
    - `wecom runtime start bot=disabled agent=callback/api`
    - `session account=default transport=agent-callback running=true owner=default:agent-callback connected=true authenticated=true error=none`
    - `runtime status health=healthy ... connected=true authenticated=true`
    - inbound WeCom text was received after restart
  - Non-blocking log noise observed:
    - embedded `acpx` runtime backend probe failure; not on the WeCom path

## 2026-05-08 WeCom tool-contract convergence hotfix

- Convergence rule applied:
  - public tool schemas and skill guidance should only advertise capabilities that are aligned with the official WeCom plugin/API shape or have live proof
  - runtime compatibility can remain defensive, but unverified aliases must not be presented as formal Agent-facing usage
- Official plugin comparison:
  - `vendor/OpenClaw-Wechat/src/wecom/doc-schema.js` exposes `create_collect` with required `formInfo`
  - `vendor/OpenClaw-Wechat/src/wecom/doc-client.js` forwards `form_info` as provided and does not synthesize a title-only collect form
- Public contract changes:
  - `create_collect` no longer exposes top-level `docName`, `formTitle`, or `form_title` as valid public tool inputs
  - `create_collect` public schema now requires `formInfo`, `form_info`, or `request`
  - `form_info.form_question.items` is schema-constrained to `minItems=1` and each question requires `question_id`, `title`, `pos`, `reply_type`, and `must_reply`
  - `request.form_title + request.items/questions` remains as the Agent-friendly shorthand because it deterministically maps to official `form_info.form_question.items`
  - `priv_list[].priv` public schema now exposes only integer enum values: `1`, `2`, `3`, `4`
  - `{ "value": "VIEW" }` and other object/string privilege aliases are no longer advertised or accepted by the public `wecom_doc` schema
- Runtime behavior:
  - direct `wecom_doc.create_collect` rejects title-only input before calling WeCom
  - `wecom_mcp` no longer auto-synthesizes `form_info` from `docName`-only args
  - existing defensive `priv` normalization in runtime/MCP remains for legacy or stale-session calls, but it is not part of the public support contract
- Local verification:
  - first ran updated regressions and observed failures against the old behavior:
    - direct client still accepted `docName` title-only
    - public schema still accepted object privilege aliases
    - public schema still accepted `docName` title-only
    - MCP still synthesized `form_info` from `docName` title-only
  - after the fix:
    - `pnpm test extensions/wecom/src/capability/doc/client.test.ts -t "title-only|object aliases|integer create_rule|docName-only"` passed
    - `pnpm test extensions/wecom/src/capability/mcp/tool.test.ts -t "create_collect"` passed
    - `pnpm test extensions/wecom/src/capability/doc/client.test.ts extensions/wecom/src/capability/doc/tool.test.ts extensions/wecom/src/capability/mcp/tool.test.ts` passed: 3 files, 37 tests
    - `pnpm tsgo` passed
    - `node scripts/tsdown-build.mjs` passed
  - Dist verification:
    - `dist/extensions/wecom/index.js` contains the integer privilege schema description
    - `dist/extensions/wecom/index.js` contains the no-`docName` collect-form error hint
    - `dist/extensions/wecom/index.js` no longer contains `createDefaultCollectQuestion`
- Remote deployment:
  - Hotfix archive:
    - `/tmp/openclaw-wecom-tool-contract-convergence-20260508.zip`
    - SHA-256: `16c571c3a7f51657edd15fa87c387765253001887b32ae0300d1df63d9de1579`
  - Live root unchanged:
    - `D:\openclaw\selftest-data-verify\openclaw-deploy-20260413-174911`
  - Backup:
    - `D:\openclaw\backups\wecom-tool-contract-convergence-20260508-1723`
  - Config hash preserved:
    - `60039BBFEA69AAA33E9E1F6047604BB1E1039C398480FB3D80C79150DE97C578`
  - Remote dist verification:
    - `source\dist\extensions\wecom\index.js` no longer contains `createDefaultCollectQuestion`
    - `source\dist\extensions\wecom\index.js` contains `fallbackItems`
  - Restarted via bundled `stop.ps1` / `start.ps1`
  - Post-restart probes returned:
    - Gateway `GET http://127.0.0.1:19040/healthz` -> `{"ok":true,"status":"live"}`
    - WeCom channel reports `running=true`, `connected=true`, `authenticated=true`, `health=healthy`, `transport=agent-callback`
    - Gateway probe reports `ok=true`, `agentId=1000048`, `transport=agent-callback`
  - Gateway log after restart reported:
    - `ready (7 plugins: acpx, browser, device-pair, email, phone-control, talk-voice, wecom; 46.6s)`
    - `wecom runtime start bot=disabled agent=callback/api`
    - `session account=default transport=agent-callback running=true owner=default:agent-callback connected=true authenticated=true error=none`
    - `runtime status health=healthy ... connected=true authenticated=true`
  - Non-blocking log noise observed:
    - `model-pricing` bootstrap timeout
    - embedded `acpx` runtime backend probe failure

## 2026-05-08 WeCom doc OpenSpec contract-convergence deployment

- OpenSpec change deployed:
  - `wecom-doc-tool-contract-convergence`
- Deployed hotfix archive:
  - local archive: `/tmp/openclaw-wecom-doc-contract-20260508-233248.zip`
  - SHA-256: `8dc332f3e571d592550c16a8372d64a155f1c57d6a6d74dd03467c863f3c59b3`
  - remote rollback copy: `D:\openclaw\backups\wecom-doc-contract-20260508-233248\deployed-artifact.zip`
- Live root unchanged:
  - `D:\openclaw\selftest-data-verify\openclaw-deploy-20260413-174911`
- Backup:
  - `D:\openclaw\backups\wecom-doc-contract-20260508-233248`
- `openclaw.json` was not changed during this deployment.
  - Config SHA-256 before copy, after copy, and after restart:
    `60039BBFEA69AAA33E9E1F6047604BB1E1039C398480FB3D80C79150DE97C578`
- Remote contract verification after deployment:
  - `source\extensions\wecom\docs\wecom-doc-tool-support-matrix.md` exists
  - `source\extensions\wecom\docs\wecom-doc-tool-support-matrix.md` contains `Tool Support Matrix`
  - `source\extensions\wecom\src\capability\doc\schema.ts` no longer contains `smartsheet_add_external_records` or `smartsheet_update_external_records`
  - `source\dist\extensions\wecom\index.js` SHA-256:
    `C75FD6F0D85BD4E3D120334D67E40577BDC1B05B7F5E3608A996C1ADAA864A74`
- Restarted the live Windows task:
  - `OpenClaw Deploy Current`
- Post-restart probes returned:
  - `GET http://127.0.0.1:19040/healthz` -> `200 {"ok":true,"status":"live"}`
  - Public `GET http://60.204.148.217:3340/` -> `200`
  - Public `GET http://60.204.148.217:3340/api/gateway/health` -> `200`
  - Public `GET http://60.204.148.217:3340/api/channels` -> `200`
  - `/api/channels` reports WeCom:
    - `running=true`
    - `health=healthy`
    - `connected=true`
    - `authenticated=true`
    - `transport=agent-callback`
    - `webhookPath=/plugins/wecom/agent/default`
  - `/api/gateway/health` reports the WeCom probe as successful:
    - `probe.ok=true`
    - `agentId=1000048`
    - `transport=agent-callback`
    - Note: this endpoint's embedded channel snapshot still showed `running=false/health=idle`, while `/api/channels` and Gateway runtime logs showed the active channel as healthy.
- Gateway log after restart reported:
  - `ready (7 plugins: acpx, browser, device-pair, email, phone-control, talk-voice, wecom; 40.9s)`
  - `wecom-http ... gettoken status=200`
  - `wecom runtime start bot=disabled agent=callback/api`
  - `wecom agent agent-callback started`
  - `runtime status health=healthy ... connected=true authenticated=true`
- Temporary upload artifacts were removed from `D:\openclaw\publish` after deployment so release HTTP does not expose the hotfix archive or helper script.
- Remaining validation gap:
  - Real WeCom chat E2E for `wecom-doc-tool-contract-convergence` has not been completed in this deploy pass. The next manual WeCom conversation should verify the Agent-visible tool contract after restart, especially that external-record actions are absent and direct smart-table reads/writes still work through the channel-bound agent session.

## 2026-05-09 WeCom agent-facing contract cleanup deployment

- Deployed the latest local WeCom source/skills/docs/runtime build that keeps support-tier, OpenSpec, deployment, and evidence wording out of Agent-facing `wecom_doc` schema and skill guidance while preserving the internal support matrix documentation.
- Deployed hotfix archive:
  - local archive: `/tmp/openclaw-wecom-agent-contract-20260509-125429.zip`
  - SHA-256: `dbb61b03a858ab37089cf694a78fbf48010311f77c2e9aca042a5f1e2d76d5d8`
  - remote rollback copy: `D:\openclaw\backups\wecom-agent-contract-20260509-125429\deployed-artifact.zip`
- Live root unchanged:
  - `D:\openclaw\selftest-data-verify\openclaw-deploy-20260413-174911`
- Backup:
  - `D:\openclaw\backups\wecom-agent-contract-20260509-125429`
- `openclaw.json` was not changed during this deployment.
  - Config SHA-256 after remote verification:
    `60039BBFEA69AAA33E9E1F6047604BB1E1039C398480FB3D80C79150DE97C578`
- Local verification before deployment:
  - `pnpm test extensions/wecom/src/capability/doc/client.test.ts extensions/wecom/src/capability/doc/tool.test.ts extensions/wecom/src/capability/mcp/tool.test.ts` passed: 3 files, 51 tests
  - `pnpm tsgo` passed
  - `node scripts/tsdown-build.mjs` passed
  - `openspec validate wecom-doc-tool-contract-convergence --strict` passed
  - `git diff --check -- extensions/wecom openspec/changes/wecom-doc-tool-contract-convergence deploy/STATUS.md` passed
- Remote contract verification after deployment:
  - `source\extensions\wecom\src\capability\doc\schema.ts` no longer exposes `smartsheet_add_external_records` or `smartsheet_update_external_records`
  - Agent-facing schema/skill files are clean of support-tier, OpenSpec, deployment, and evidence markers
  - `source\dist\extensions\wecom\index.js` contains the external-record endpoint guard
  - `source\dist\extensions\wecom\index.js` contains the create-collect `form_question.items` contract marker
  - `source\dist\extensions\wecom\index.js` no longer contains `createDefaultCollectQuestion`
  - `source\dist\extensions\wecom\index.js` SHA-256:
    `3280410DB4F882791D2548659E8AC3404F2334C923F28C43FBAFBA9B19AEAA3C`
- Deployment note:
  - the first restart exposed a packaging-script gap: replacing `source\dist\extensions\wecom` from local `dist` removed runtime metadata (`openclaw.plugin.json`, `package.json`, `skills`)
  - this caused a transient `plugin manifest not found` / `Config invalid` loop between `2026-05-09T12:57+08:00` and `2026-05-09T12:59+08:00`
  - fixed by restoring `openclaw.plugin.json`, `package.json`, and `skills` from `source\extensions\wecom` into `source\dist\extensions\wecom`, then restarting the live task again
- Final post-restart probes returned:
  - Public `GET http://60.204.148.217:3340/` -> `200`
  - Public `GET http://60.204.148.217:3340/api/gateway/health` -> `200`
  - Public `GET http://60.204.148.217:3340/api/channels` -> `200`
  - `/api/gateway/health` reports the WeCom probe as successful:
    - `probe.ok=true`
    - `agentId=1000048`
    - `transport=agent-callback`
  - `/api/channels` reports WeCom:
    - `running=true`
    - `health=healthy`
    - `connected=true`
    - `authenticated=true`
    - `transport=agent-callback`
    - `webhookPath=/plugins/wecom/agent/default`
- Gateway log after the final restart reported:
  - `ready (7 plugins: acpx, browser, device-pair, email, phone-control, talk-voice, wecom; 40.6s)`
  - `wecom-http ... gettoken status=200`
  - `wecom runtime start bot=disabled agent=callback/api`
  - `wecom agent agent-callback started`
  - `runtime status health=healthy ... connected=true authenticated=true`
- Temporary upload and helper scripts were removed from `C:\Windows\Temp`; the rollback artifact remains in the backup directory.
- Remaining validation gap:
  - Real WeCom chat E2E remains pending. The next regression should verify the Agent-visible tool contract in a fresh or restarted WeCom-bound session, especially that hidden external-record actions are absent and official smart-table read/write actions remain callable.

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

## 2026-05-09 WeCom doc failure-summary fix deployment

Deployed a WeCom-only hotfix from local source to the current Windows target:

- Artifact: `/tmp/openclaw-wecom-doc-failure-fixes-20260509-135924.zip`
- SHA-256: `a06d21e03ba77cdf45b534f7512b6f38b283d494e7bc2a82142208d8d06a51b6`
- Remote backup: `D:\openclaw\backups\wecom-doc-failure-fixes-20260509-135924`
- Remote artifact copy: `D:\openclaw\backups\wecom-doc-failure-fixes-20260509-135924\deployed-artifact.zip`
- Config hash after deploy: `60039BBFEA69AAA33E9E1F6047604BB1E1039C398480FB3D80C79150DE97C578`

Scope:

- `create` text-only `init_content` now uses one `insert_text` request with newline-separated content instead of paragraph append requests that can trigger `ParagraphValidator cannot find p's parent`.
- `create` default join rule now uses `corp_internal_auth: 1` because `mod_doc_join_rule` rejects write auth for this surface.
- `set_join_rule` strips auth fields from disabled internal/external branches before sending to WeCom.
- `get_form_statistic` and `get_form_answer` accept `formId` only as ignored context while preserving official request bodies.
- `get_auth` diagnosis counts `doc_member_list` entries with `auth=2/7` as collaborators if `co_auth_list` is empty.

Verification:

- Local: `pnpm test extensions/wecom/src/capability/doc/client.test.ts extensions/wecom/src/capability/doc/tool.test.ts` passed.
- Local: `pnpm tsgo` passed.
- Local touched-file lint: `pnpm exec oxlint extensions/wecom/src/capability/doc/client.ts extensions/wecom/src/capability/doc/schema.ts extensions/wecom/src/capability/doc/tool.ts extensions/wecom/src/capability/doc/client.test.ts extensions/wecom/src/capability/doc/tool.test.ts` passed.
- Local build: `node scripts/tsdown-build.mjs` passed.
- Local OpenSpec: `openspec validate wecom-doc-tool-contract-convergence --strict` passed.
- Remote: `OpenClaw Deploy Current` restarted; `GET /api/gateway/health` returns `200`.
- Remote: `GET /api/channels` reports WeCom `running=true`, `health=healthy`, `connected=true`, `authenticated=true`, `transport=agent-callback`.

Notes:

- During this deployment, the first script checked the old config path `...\openclaw.json`; the real config is `...\data\.openclaw\openclaw.json`. The deploy touched only WeCom source/dist paths. The real config hash was checked afterward and matched the known live hash above.
- `GET /api/gateway/health` may show a stale WeCom `idle` channel snapshot even while the live channel status endpoint and gateway log report `running=true`; `GET /api/channels` was used as the final live channel status source.
- The recent log still contains older `plugin manifest not found` entries from the previous deployment attempt; after this hotfix, `source\dist\extensions\wecom` has `openclaw.plugin.json`, `package.json`, `skills`, and `docs`.

## 2026-05-09 WeCom doc MCP schema flatten deployment

Deployed the follow-up Gateway MCP loopback schema fix required by the latest agent rerun summary:

- Artifact: `/tmp/openclaw-wecom-doc-mcp-schema-20260509-144502.zip`
- SHA-256: `93fdb0a3771047541af922df074b29afefc9332b6cc5d57a14c19df4ead5e471`
- Remote backup: `D:\openclaw\backups\wecom-doc-mcp-schema-20260509-144502`
- Remote support-matrix follow-up backup: `D:\openclaw\backups\wecom-doc-mcp-schema-20260509-144502\source\wecom-doc-tool-support-matrix.before-followup.md`
- Config hash before deploy: `60039BBFEA69AAA33E9E1F6047604BB1E1039C398480FB3D80C79150DE97C578`
- Config hash after deploy: `60039BBFEA69AAA33E9E1F6047604BB1E1039C398480FB3D80C79150DE97C578`
- Deployed MCP chunk: `source\dist\mcp-http-BVC-zlbt.js`
- Deployed MCP chunk SHA-256: `4B30381DD20D75CACAEFBD08A9B9833D9E2E65EEB3B7BE42CA6A99B7F677321A`
- Remote support matrix SHA-256 after follow-up sync: `94792824EE14B08634F1EDE4CCBCCB74D00829F757B42432B17CF4F448AFA6B9`

Scope:

- `src/gateway/mcp-http.schema.ts` now merges duplicate union properties safely when exposing OpenClaw tools through MCP loopback.
- Duplicate literal action properties are merged into a full enum instead of keeping only the first union arm.
- Conflicting duplicate payload properties such as `requests` are exposed as `anyOf` variants instead of inheriting the first action's schema.
- This specifically fixes the latest `get_form_statistic` failure where the tool layer validated `requests` against `update_content`'s batch request schema before the request could reach the WeCom API.

Verification:

- Local: `pnpm exec oxlint src/gateway/mcp-http.schema.ts src/gateway/mcp-http.schema.test.ts` passed.
- Local: `openspec validate wecom-doc-tool-contract-convergence --strict` passed.
- Local: `pnpm test extensions/wecom/src/capability/doc/client.test.ts extensions/wecom/src/capability/doc/tool.test.ts extensions/wecom/src/capability/mcp/tool.test.ts src/gateway/mcp-http.schema.test.ts` passed (`4 files`, `57 tests`).
- Local: `pnpm tsgo` passed.
- Local: `node scripts/tsdown-build.mjs` passed.
- Local schema smoke: deployed-source schema exposes `wecom_doc` `action` with `get_form_statistic` present and validates `{ action: "get_form_statistic", formId, requests: [{ repeated_id, req_type: 2 }] }`.
- Remote: `OpenClaw Deploy Current` restarted and Gateway reached `ready` after about `50.9s`.
- Remote: `GET http://127.0.0.1:19040/healthz` returned `200 {"ok":true,"status":"live"}` after startup completed.
- Remote: public `GET http://60.204.148.217:3340/api/gateway/health` returned `200`.
- Remote: public `GET http://60.204.148.217:3340/api/channels` returned `200` and reported WeCom:
  - `running=true`
  - `health=healthy`
  - `connected=true`
  - `authenticated=true`
  - `transport=agent-callback`
- Remote log after restart reported:
  - `gateway ready (7 plugins: acpx, browser, device-pair, email, phone-control, talk-voice, wecom; 50.9s)`
  - `wecom runtime start bot=disabled agent=callback/api`
  - `session account=default transport=agent-callback running=true owner=default:agent-callback connected=true authenticated=true error=none`

Notes:

- A health check issued during the long Gateway startup window returned `502`; this cleared after Gateway finished plugin/channel startup.
- `/api/gateway/health` still may show the known stale WeCom `idle` channel snapshot, while `/api/channels` and Gateway runtime logs show the active WeCom channel as healthy.
- The latest CSV still marks `get_auth_collaborator_visibility` as partial. The current code already counts `co_auth_list` and `doc_member_list auth=2/7`; the rerun summary did not include the raw `doc_get_auth` response, so no further safe mapping change was made in this deployment.

## 2026-05-09 WeCom doc v4 focus-regression deployment

Reviewed the latest focused rerun report:

- Source CSV: `wecom_doc_focus_regression_20260413_v4.csv`
- Remaining reported cases:
  - `get_form_statistic` still failed at tool-schema validation, with `requests` being validated as `update_content.requests`.
  - `get_auth` remained partial; this time the raw `doc_get_auth` response showed `doc_member_list=[{type:1, userid:"WangYiMing", auth:1}]` and no collaborator/co-auth entry after `grant_access(viewers=[same user], collaborators=[same user])`.

Root cause and scope:

- `get_form_statistic`: the previous fix covered Gateway MCP loopback schema flattening, but the channel-bound Agent path also runs through `src/agents/pi-tools.schema.ts`. That shared model tool normalizer had the same bug: when flattening root `oneOf`/`anyOf`, it merged enum-like properties such as `action` but kept the first non-enum duplicate property such as `requests`. It now preserves conflicting duplicate properties as `anyOf` variants.
- `get_auth`: the raw response showed the server-side state was actually viewer-only (`auth=1`), not a read-summary miss of `auth=2/7`. `grant_access` now treats collaborator entries as higher priority and filters the same member out of same-request viewer writes, avoiding `update_file_member_list` overriding `update_co_auth_list`.

Deployed artifact:

- Artifact: `/tmp/openclaw-wecom-doc-v4-regression-20260509-160533.zip`
- SHA-256: `fd7100fc72b050143d5e4d085398b619ab301e92606c8ac0a1c52e5eaac7a7c4`
- Remote backup: `D:\openclaw\backups\wecom-doc-v4-regression-20260509-160533`
- Config hash before deploy: `60039BBFEA69AAA33E9E1F6047604BB1E1039C398480FB3D80C79150DE97C578`
- Config hash after deploy: `60039BBFEA69AAA33E9E1F6047604BB1E1039C398480FB3D80C79150DE97C578`
- Deployed model tool schema chunk: `source\dist\pi-tools.schema-HQC51tMS.js`
- Deployed model tool schema chunk SHA-256: `F811C0A85C53C908B1F7F56E3582AC1676ACED579B1AD7FA1D6350587A1F507A`
- Deployed WeCom bundle SHA-256: `C283AD5D29C9B66A408A38E9ECE0BFDC51881A34B61A1FB70455A3F3BDCBB4E8`

Verification:

- Local: `pnpm test src/agents/pi-tools.schema.test.ts src/gateway/mcp-http.schema.test.ts extensions/wecom/src/capability/doc/client.test.ts extensions/wecom/src/capability/doc/tool.test.ts extensions/wecom/src/capability/mcp/tool.test.ts` passed (`5 files`, `73 tests`).
- Local: `pnpm exec oxlint src/agents/pi-tools.schema.ts src/agents/pi-tools.schema.test.ts src/gateway/mcp-http.schema.ts src/gateway/mcp-http.schema.test.ts extensions/wecom/src/capability/doc/client.ts extensions/wecom/src/capability/doc/client.test.ts` passed.
- Local: `pnpm tsgo` passed.
- Local: `node scripts/tsdown-build.mjs` passed.
- Local: `openspec validate wecom-doc-tool-contract-convergence --strict` passed.
- Local schema smoke: `normalizeToolParameterSchema(wecomDocToolSchema)` now exposes `requests.anyOf` and validates `{ action: "get_form_statistic", formId, requests: [{ repeated_id, req_type: 2 }] }`.
- Remote: `OpenClaw Deploy Current` restarted and Gateway reached `ready` after about `55.2s`.
- Remote: `GET http://127.0.0.1:19040/healthz` returned `200 {"ok":true,"status":"live"}`.
- Remote: public `GET http://60.204.148.217:3340/api/gateway/health` returned `200`; WeCom probe reported `ok=true`, `agentId=1000048`, `transport=agent-callback`.
- Remote: public `GET http://60.204.148.217:3340/api/channels` returned `200` and reported WeCom:
  - `running=true`
  - `health=healthy`
  - `connected=true`
  - `authenticated=true`
  - `transport=agent-callback`
- Remote log after restart reported:
  - `gateway ready (7 plugins: acpx, browser, device-pair, email, phone-control, talk-voice, wecom; 55.2s)`
  - `wecom runtime start bot=disabled agent=callback/api`
  - `session account=default transport=agent-callback running=true owner=default:agent-callback connected=true authenticated=true error=none`

Notes:

- Short `502/503` responses were observed during the normal Gateway startup window and cleared after channel startup completed.
- `/api/gateway/health` still may show the known stale WeCom `idle` channel snapshot, while `/api/channels` and Gateway runtime logs show the active WeCom channel as healthy.
- The next focused rerun should retest only:
  - `get_form_statistic` no longer blocked by schema.
  - `grant_access(viewers=[same user], collaborators=[same user])` followed by `get_auth` returns collaborator-visible state, or at least raw output no longer shows the user demoted to `auth=1` because of a same-request viewer write.

## 2026-05-09 WeCom bot-ws MCP reference enablement

Change:

- Remote runtime config updated only at `D:\openclaw\selftest-data-verify\openclaw-deploy-20260413-174911\data\.openclaw\openclaw.json`.
- Backup before edit: `D:\openclaw\backups\wecom-bot-ws-reference-20260509-170000\openclaw.json`.
- Config hash changed from `60039BBFEA69AAA33E9E1F6047604BB1E1039C398480FB3D80C79150DE97C578` to `F834BA7FFFBEDB5478DDB5E5088CDF0DDB3321B803192528FD3FDCE14DB97DDD`.
- `channels.wecom.accounts.default.bot.ws` was added with `primaryTransport=ws`; existing `agent` fields were preserved.
- `channels.wecom.accounts.default.bot.dm.policy=pairing`.

Verification:

- `OpenClaw Deploy Current` restarted and Gateway reached `ready` after about `36.2s`.
- Remote local `GET http://127.0.0.1:19040/healthz` returned `200 {"ok":true,"status":"live"}`.
- Public `GET http://60.204.148.217:3340/api/channels` returned WeCom:
  - `running=true`
  - `health=healthy`
  - `transport=bot-ws`
  - `connected=true`
  - `authenticated=true`
  - `transportSessions=["agent-callback running ... authenticated=true","bot-ws running ... authenticated=true"]`
- Runtime log confirmed:
  - `wecom runtime start bot=ws agent=callback/api`
  - `wecom bot bot-ws started: ws:primary`
  - `wecom agent agent-callback started: /plugins/wecom/agent/default, /wecom/agent/default, /plugins/wecom/agent, /wecom/agent`
  - `wecom-ws Authentication successful`
  - `wecom-mcp MCP config saved to C:\Users\Administrator\.openclaw\wecomConfig\default\config.json`
- Saved MCP config summary:
  - path: `C:\Users\Administrator\.openclaw\wecomConfig\default\config.json`
  - `mcpConfig.doc.type=streamable-http`
  - `mcpConfig.doc.is_authed=false`
  - URL present but not recorded here because it contains a live API key.
- Direct `tools/list` probe against the saved MCP URL succeeded:
  - initialize: `200`
  - tools/list: `200`
  - tool count: `20`
  - tool names: `create_doc`, `edit_doc_content`, `smartpage_create`, `upload_doc_image`, `upload_doc_file`, `get_doc_content`, `smartpage_export_task`, `smartpage_get_export_result`, `smartsheet_add_sheet`, `smartsheet_get_sheet`, `smartsheet_add_fields`, `smartsheet_update_fields`, `smartsheet_get_fields`, `smartsheet_add_records`, `smartsheet_update_sheet`, `smartsheet_delete_sheet`, `smartsheet_get_records`, `smartsheet_delete_fields`, `smartsheet_update_records`, `smartsheet_delete_records`.
- Full non-secret schema snapshot saved locally at `extensions/wecom/docs/official-mcp-doc-tools-2026-05-09.json`.
- Secret scan for that snapshot checked for bot id, bot secret, API key, and MCP URL markers; none were present.

## 2026-05-09 WeCom doc v5 regression fixes deployment

Reviewed the latest focused rerun report:

- Source CSV: `wecom_doc_focus_regression_20260413_v5.csv`
- Remaining reported cases:
  - `get_form_statistic` reached WeCom but failed with `errcode=93017 invalid json request, wrong json format` when called with `formId + requests=[{ repeated_id: <formId>, req_type: 2 }]`.
  - `grant_access(viewers=[same user], collaborators=[same user])` followed by `get_auth` still showed no collaborator visibility in the agent diagnosis.

Root cause and scope:

- `get_form_statistic` now treats top-level `formId` as context: if a request omits `repeated_id` or mistakenly passes the same value as `formId`, the plugin fetches `get_form_info` and uses the official `form_info.repeated_id` before calling `get_form_statistic`.
- `get_form_statistic` now adds safe defaults for list-style statistics:
  - `req_type=2` defaults to the current local day `start_time` / `end_time` when omitted.
  - `req_type=2` and `req_type=3` default `limit=100` when omitted.
- `grant_access` now uses the official document member API shape for collaborator grants:
  - collaborators are written through `update_file_member_list`
  - collaborator default `auth` is `7`
  - same-user viewer/collaborator inputs are de-duplicated so the viewer write does not demote the collaborator grant.

Deployed artifact:

- Artifact: `/tmp/openclaw-wecom-doc-v5-fixes-20260509-1730.zip`
- SHA-256: `4e70616a7799658244722947c55bd0d629dc3f134dbe06c10fa236ac0f700dd7`
- Remote backup: `D:\openclaw\backups\wecom-doc-v5-fixes-20260509-1730`
- Remote artifact copy: `D:\openclaw\backups\wecom-doc-v5-fixes-20260509-1730\deployed-artifact.zip`
- Config hash after deploy and after final restart:
  `F834BA7FFFBEDB5478DDB5E5088CDF0DDB3321B803192528FD3FDCE14DB97DDD`
- Deployed WeCom bundle SHA-256:
  `09015571B67C1B0DE6A35A224313566FE7E27EEDCE5AE00BA180F766F262F48D`

Verification:

- Local: first ran the targeted new regressions and observed failures against the old behavior:
  - same member viewer/collaborator grant still used `update_co_auth_list` with `auth=2`
  - form-statistic calls did not resolve `formId` context through `get_form_info`
- Local: `pnpm test extensions/wecom/src/capability/doc/client.test.ts -t "same member|formId context|official request array|existing viewer"` passed.
- Local: `pnpm test extensions/wecom/src/capability/doc/client.test.ts extensions/wecom/src/capability/doc/tool.test.ts extensions/wecom/src/capability/mcp/tool.test.ts` passed (`3 files`, `67 tests`).
- Local: `pnpm tsgo` passed.
- Local: `pnpm exec oxlint extensions/wecom/src/capability/doc/client.ts extensions/wecom/src/capability/doc/client.test.ts extensions/wecom/src/capability/doc/schema.ts extensions/wecom/src/capability/doc/tool.ts extensions/wecom/docs/wecom-doc-tool-support-matrix.md` passed.
- Local: `node scripts/tsdown-build.mjs` passed.
- Local: `pnpm openspec validate wecom-doc-tool-contract-convergence --strict` passed.
- Local: `git diff --check` passed for the touched WeCom/deploy files.
- Remote source and dist verification after deployment:
  - source client contains collaborator `auth=7`
  - source client contains `normalizeFormStatisticRequestDefaults`
  - source client and dist bundle contain `update_file_member_list`
  - dist bundle contains `repeated_id required`
  - dist bundle contains `start_time`, `end_time`, and `limit` markers for statistic defaults
- Remote artifact backup hash matched the local archive hash.

Restart and runtime status:

- During verification on `2026-05-11`, the task was found stopped before fresh restart:
  - `OpenClaw Deploy Current` state was `Ready`
  - no listeners existed on `19040` or `3340`
  - previous task result was `3221225786`
- `start.ps1` failed in its `schtasks` wrapper path, so the task was started directly with `Start-ScheduledTask`.
- Final task state:
  - `OpenClaw Deploy Current` state: `Running`
  - last run time: `2026-05-11T10:49:49+08:00`
- Final probes:
  - `GET http://127.0.0.1:19040/healthz` -> `200 {"ok":true,"status":"live"}`
  - Public `GET http://60.204.148.217:3340/api/gateway/health` -> `200`
  - Public `GET http://60.204.148.217:3340/api/channels` -> `200`
  - `/api/channels` reports WeCom:
    - `running=true`
    - `health=healthy`
    - `connected=true`
    - `authenticated=true`
    - `transport=bot-ws`
    - `transportSessions` includes both `agent-callback` and `bot-ws`, both connected/authenticated
    - latest WeCom runtime start: `2026-05-11T10:51:27+08:00`
- Gateway log after restart reported:
  - `ready (7 plugins: acpx, browser, device-pair, email, phone-control, talk-voice, wecom; 39.2s)`
  - `wecom runtime start bot=ws agent=callback/api`
  - `wecom bot bot-ws started: ws:primary`
  - `wecom agent agent-callback started`
  - `wecom-ws Authentication successful`
  - `wecom-mcp MCP config fetched ... is_authed=false`
- Temporary upload artifacts were removed from `C:\Windows\Temp`; the rollback artifact remains in the backup directory.

Notes:

- A channel status check issued before asynchronous WeCom startup completed briefly showed `running=false/health=idle`; later logs and `/api/channels` confirmed WeCom became healthy after Bot WS authentication.
- Non-blocking log noise remains:
  - `model-pricing` bootstrap timeout
  - embedded `acpx` runtime backend probe failure
    These are not on the WeCom doc path.
- Remaining validation gap:
  - The next WeCom chat regression should retest only:
    - `get_form_statistic` with `formId + repeated_id=formId + req_type=2`, expecting no `93017 invalid json request`.
    - `grant_access(viewers=[same user], collaborators=[same user])` followed by `get_auth`, expecting collaborator-visible membership or raw `doc_member_list` with collaborator auth.

## 2026-05-11 WeCom doc statistic object-body fix deployment

Follow-up evidence from the v5 regression showed both v5 cases were still not closed:

- `get_form_statistic(formId + repeated_id=formId + req_type=2)` still returned `errcode=93017 invalid json request, wrong json format`.
- `grant_access(viewers=[same user], collaborators=[same user])` returned success, but the subsequent Agent-reported `get_auth` diagnosis still showed zero viewers and zero collaborators.

Root cause evidence:

- A direct Node 22 probe on the Windows host used the live application access token and the same reported `formId`.
- For `get_form_statistic`, the current live WeCom API returned:
  - array body such as `[{ repeated_id, req_type: 1 }]` -> `errcode=93017`
  - array body such as `[{ repeated_id, req_type: 2, start_time, end_time, limit }]` -> `errcode=93017`
  - object body such as `{ repeated_id, req_type: 2, start_time, end_time, limit, cursor }` -> `errcode=0`
- This contradicts the public Apifox/Tencent sample that shows an array body. The plugin now keeps the Agent-facing `requests[]` input, but fans out each item as one single-object API call.
- For `grant_access`, the same direct probe showed the current write shape is valid:
  - `mod_doc_member` with `update_file_member_list: [{ userid: "WangYiMing", auth: 7 }]` -> `errcode=0`
  - subsequent `doc_get_auth` returned `doc_member_list: [{ type: 1, userid: "WangYiMing", auth: 7 }]`
- Therefore the permission write path was not changed in this pass; the local regression was tightened so `auth=7` in `doc_member_list` is treated as collaborator-visible state.

Deployed artifact:

- Artifact: `/tmp/openclaw-wecom-doc-statistic-object-20260511-1108.zip`
- SHA-256: `f70c531153ce341d9105ba718f21ab8d484e413bfb419e6753cd45566d81a5bd`
- Remote backup: `D:\openclaw\backups\wecom-doc-statistic-object-20260511-1108`
- Remote artifact copy: `D:\openclaw\backups\wecom-doc-statistic-object-20260511-1108\deployed-artifact.zip`
- Config hash after deploy and after restart:
  `F834BA7FFFBEDB5478DDB5E5088CDF0DDB3321B803192528FD3FDCE14DB97DDD`
- Deployed WeCom bundle SHA-256:
  `C8746210E6BF348F18136DE99834A420987E748BEB8733748916228A38B6E896`

Local verification:

- First ran the new targeted `get_form_statistic` regressions and confirmed they failed against the old implementation because it still posted the full array body.
- `pnpm test extensions/wecom/src/capability/doc/client.test.ts -t "get_form_statistic"` passed after the fix.
- `pnpm test extensions/wecom/src/capability/doc/client.test.ts extensions/wecom/src/capability/doc/tool.test.ts extensions/wecom/src/capability/mcp/tool.test.ts` passed (`3 files`, `68 tests`).
- `pnpm tsgo` passed.
- `pnpm exec oxlint extensions/wecom/src/capability/doc/client.ts extensions/wecom/src/capability/doc/client.test.ts extensions/wecom/src/capability/doc/schema.ts extensions/wecom/src/capability/doc/tool.ts extensions/wecom/src/capability/doc/tool.test.ts extensions/wecom/docs/wecom-doc-tool-support-matrix.md` passed.
- `node scripts/tsdown-build.mjs` passed.

Remote verification:

- Remote source verification:
  - `source\extensions\wecom\src\capability\doc\client.ts` contains the `get_form_statistic` fan-out loop.
  - `source\extensions\wecom\src\capability\doc\client.ts` submits `body: item` for each statistic request.
  - `source\extensions\wecom\src\capability\doc\client.ts` still contains collaborator default `auth=7`.
- Remote runtime verification:
  - `GET http://127.0.0.1:19040/healthz` -> `200`
  - `GET http://127.0.0.1:3340/api/gateway/health` -> `200`
  - `GET http://127.0.0.1:3340/api/channels` -> `200`
  - `OpenClaw Deploy Current` state: `Running`
  - last task run time: `2026-05-11T11:08:08+08:00`
  - `/api/channels` reports WeCom:
    - `running=true`
    - `health=healthy`
    - `connected=true`
    - `authenticated=true`
    - `transport=bot-ws`
    - `transportSessions` includes both `agent-callback` and `bot-ws`, both connected/authenticated
    - latest WeCom runtime start: `2026-05-11T11:09:56+08:00`
- Gateway log after restart reported:
  - `ready (7 plugins: acpx, browser, device-pair, email, phone-control, talk-voice, wecom; 41.7s)`
  - `wecom runtime start bot=ws agent=callback/api`
  - `wecom bot bot-ws started: ws:primary`
  - `wecom agent agent-callback started`
  - `wecom-ws Authentication successful`

Notes:

- A status check during asynchronous channel startup briefly showed WeCom `idle`; this cleared after Bot WS authentication.
- The direct API probe file was removed from `C:\Windows\Temp` after deployment.
- Remaining validation gap:
  - Re-run the same WeCom conversation in a fresh/restarted Agent session. The expected `get_form_statistic` behavior is no `93017`; for the same document used in the report, direct `doc_get_auth` now shows `doc_member_list auth=7`, so if the Agent still reports zero collaborators, the next investigation should focus on stale session/tool-result interpretation rather than the WeCom member API write path.

## 2026-05-09 WeCom official MCP sheet-properties compatibility deployment

Deployed the follow-up WeCom-only hotfix that aligns direct `wecom_doc`
child-sheet actions with the live official MCP schema while preserving existing
legacy call shapes:

- `smartsheet_add_sheet` now accepts the official optional `properties` object
  and still accepts legacy flat `title` / `index`.
- `smartsheet_update_sheet` now accepts the official
  `properties={sheet_id,title}` object and still accepts legacy flat
  `sheetId` / `title`.
- The official MCP schema snapshot and support-matrix docs were synced to the
  target source tree.

Deployed artifact:

- Artifact: `/tmp/openclaw-wecom-official-sheet-props-20260509-1706.zip`
- SHA-256: `f0509d21bb0edae02bae7072305e407ad92e71875048cfddff60971ea12bec29`
- Remote backup: `D:\openclaw\backups\wecom-official-sheet-props-20260509-1706`
- Remote rollback artifact:
  `D:\openclaw\backups\wecom-official-sheet-props-20260509-1706\deployed-artifact.zip`
- Config hash before copy, after copy, and after restart:
  `F834BA7FFFBEDB5478DDB5E5088CDF0DDB3321B803192528FD3FDCE14DB97DDD`
- Deployed WeCom bundle SHA-256:
  `09015571B67C1B0DE6A35A224313566FE7E27EEDCE5AE00BA180F766F262F48D`

Verification:

- Local: `pnpm test extensions/wecom/src/capability/doc/client.test.ts extensions/wecom/src/capability/doc/tool.test.ts` passed (`2 files`, `54 tests`).
- Local: `pnpm tsgo` passed.
- Local: `pnpm openspec validate wecom-doc-tool-contract-convergence --strict` passed.
- Local: `node scripts/tsdown-build.mjs` passed.
- Local: touched-file `git diff --check` passed.
- Local: secret/API-key marker scan across the official MCP snapshot and
  updated WeCom docs passed.
- Remote: `source\extensions\wecom\src\capability\doc\client.ts` contains the
  official `properties.sheet_id` compatibility path.
- Remote: `source\dist\extensions\wecom\index.js` contains the
  `smartsheet_update_sheet properties.sheet_id required` runtime guard.
- Remote: `GET http://127.0.0.1:19040/healthz` returned
  `200 {"ok":true,"status":"live"}` after startup.
- Remote public: `GET http://60.204.148.217:3340/` returned `200`.
- Remote public: `GET http://60.204.148.217:3340/api/gateway/health` returned
  `200`.
- Remote public: `GET http://60.204.148.217:3340/api/channels` returned `200`
  and reported WeCom:
  - `running=true`
  - `health=healthy`
  - `transport=bot-ws`
  - `connected=true`
  - `authenticated=true`
  - `transportSessions` count: `2`
- Windows task:
  - `OpenClaw Deploy Current` state: `Running`

Gateway log after restart confirmed, with sensitive values omitted here:

- `gateway ready (7 plugins: acpx, browser, device-pair, email, phone-control, talk-voice, wecom; 40.0s)`
- `wecom runtime start bot=ws agent=callback/api`
- `wecom bot bot-ws started: ws:primary`
- `wecom agent agent-callback started`
- `wecom-ws Authentication successful`
- `wecom-mcp MCP config saved`

Notes:

- A first immediate post-start status probe still showed Gateway/Deck
  temporarily unreachable; this was the known startup window and cleared after
  Gateway completed plugin/channel startup.
- `api/gateway/health` can still include the known stale WeCom idle snapshot;
  `/api/channels` and Gateway runtime logs remain the live channel status source
  for WeCom.
- Temporary upload files and helper scripts were removed from `C:\Windows\Temp`.
  The rollback artifact remains in the backup directory.

Notes:

- The official doc MCP config currently reports `is_authed=false`. Tool schemas can be listed, but mutating or content-access calls may still require the enterprise-side MCP authorization flow.
- `/api/gateway/health` still reports the known stale channel snapshot, but its WeCom probe now reports `ok=true`, `agentId=1000048`, `transport=ws`; `/api/channels` is the more accurate runtime channel source.
- Public direct `http://60.204.148.217:19040/healthz` returned `502`; use the Deck/BFF public endpoint on `3340` or SSH-local `127.0.0.1:19040` for Gateway checks.

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

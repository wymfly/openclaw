# WeCom Upstream Porting Notes

This plugin is an enhanced fork of the official Tencent WeCom OpenClaw plugin, not a direct copy.
Use this file to keep future upstream syncs explicit and reviewable.

## Upstream Source

- GitHub: https://github.com/WecomTeam/wecom-openclaw-plugin
- npm package: `@wecom/wecom-openclaw-plugin`
- Latest npm version checked during this port: `2026.5.7`
- Local reference clone: `vendor/wecom-openclaw-plugin`

`vendor/` is ignored by the repository. It is a local reference only and must not be treated as an installed plugin.

## 2026-05-08 Port

Ported selectively:

- MCP before/after-call interception shape from upstream `src/mcp/interceptors/*`.
- Smartsheet local media cell values:
  - `image_path` is uploaded through `upload_doc_image` and replaced with `image_url`.
  - `file_path` is uploaded through `upload_doc_file` and replaced with `file_id`.
- `get_msg_media` response slimming:
  - `base64_data` is saved through OpenClaw media storage.
  - The agent receives `local_path`, size, and content type instead of raw base64.
- `smartpage_create` local `page_filepath` expansion.
- `smartpage_get_export_result` large markdown content offload to a local file.
- Additional MCP business cache-clear codes: `850001`, `850002`, `851014`.
- Agent-facing skills for smartsheet schema/data/media usage.

## 2026-05-08 Tool Contract Convergence

The direct `wecom_doc` tool now has an explicit support matrix:

- `extensions/wecom/docs/wecom-doc-tool-support-matrix.md`

Use that matrix before adding, removing, or renaming any WeCom document action.
It records all direct actions exposed as of 2026-05-08, the Tencent official
plugin reference, official API evidence, public/hidden status, and live CSV
evidence.

Important convergence decisions:

- `smartsheet_add_external_records` and `smartsheet_update_external_records`
  are not Wedoc direct endpoints. They remain compatibility runtime errors only
  and must not be exposed in public `wecom_doc` schema or skills.
- Direct `wecom_doc` uses local aliases such as `smartsheet_get_sheets`,
  `smartsheet_del_sheet`, `smartsheet_del_fields`, and
  `smartsheet_del_records`. Tencent `wecom_mcp` skills use the canonical names
  `smartsheet_get_sheet`, `smartsheet_delete_sheet`,
  `smartsheet_delete_fields`, and `smartsheet_delete_records`.
- Direct `smartsheet_add_records` has live evidence for `FIELD_ID` key writes.
  Tencent official `wecom_mcp` skill docs still describe add-records as
  field-title keyed; do not transfer the direct extension claim to `wecom_mcp`
  unless live MCP schema evidence proves it.
- `create_collect` must include real `form_info.form_question.items`; title-only
  or `docName`-only creation is not supported.
- Permission/rule actions are local extensions until the live MCP schema or
  official docs prove otherwise. Public privilege values are integer enums.

## 2026-05-09 Live MCP Schema Capture

The deployed `default` WeCom account was configured with Bot WS and used to
capture the live official doc MCP `tools/list` schema. The sanitized snapshot is
stored at:

- `extensions/wecom/docs/official-mcp-doc-tools-2026-05-09.json`

The live schema returned 20 tools. Direct `wecom_doc` now aligns the child-sheet
write shapes with that snapshot by accepting:

- `smartsheet_add_sheet.properties.title` in addition to the legacy flat
  `title`.
- `smartsheet_update_sheet.properties={sheet_id,title}` in addition to the
  legacy flat `sheetId/title`.

The snapshot also confirms that `smartpage_*` and `upload_doc_file` are official
MCP helpers, not direct `wecom_doc` actions today. Keep them on the `wecom_mcp`
surface unless a separate direct REST implementation is added with tests and
live evidence.

Kept local by design:

- Channel runtime, Bot/Agent transport, account resolution, routing, status, and delivery architecture.
- MCP transport/session cache implementation.
- Command authorization config shape.
- Agent API delivery fallback for outbound media.

Deferred:

- Upstream `doc-auth-error` authorization-card interceptor. It depends on upstream state-manager behavior and case-sensitive chat id preservation. Port only after validating the local session context can provide original WeCom `chatid` and `chatType` to the MCP tool context.

## Conflict Rules

When syncing from upstream:

- Do not wholesale replace `extensions/wecom/src`.
- Diff upstream by capability first, then port the smallest behavior slice.
- Keep local tests around every ported behavior before adapting code.
- If upstream changes `src/mcp/interceptors/*`, compare it against `extensions/wecom/src/capability/mcp/interceptors.ts`.
- If upstream changes `skills/*`, update local skills only after converting examples to the local `wecom_mcp` tool parameter shape.
- Preserve local deployment compatibility for existing `openclaw.json` configs.
- If replacing this enhanced plugin with Tencent's official plugin instead of porting behavior, follow `extensions/wecom/docs/official-plugin-migration-plan.md`.

## Verification

For MCP interceptor changes, run at least:

```bash
pnpm test extensions/wecom/src/capability/mcp/tool.test.ts
pnpm test extensions/wecom/src/outbound.test.ts extensions/wecom/src/capability/agent/delivery-service.test.ts extensions/wecom/src/transport/agent-api/core.test.ts extensions/wecom/src/markdown/render.test.ts
pnpm tsgo
```

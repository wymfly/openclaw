## 1. Baseline And Matrix

- [x] 1.1 Create `extensions/wecom/docs/wecom-doc-tool-support-matrix.md` listing every direct `wecom_doc` action, every relevant Tencent official `wecom_mcp` doc/smartsheet skill method, the canonical name, support tier, evidence source, and public/hidden status.
- [x] 1.2 Record that `vendor/wecom-openclaw-plugin` is the only local official WeCom plugin reference for this change; explicitly exclude `vendor/OpenClaw-Wechat` from the matrix.
- [x] 1.3 Capture current live MCP schema when possible with `wecom_mcp list doc`; if unavailable locally, record the deployment-only command and mark live MCP schema evidence pending.
- [x] 1.4 Reconcile recent CSV reports into the matrix: 2026-05-07, 2026-05-08, and 2026-05-08 rerun2.
- [x] 1.5 Generate or manually verify the direct `wecom_doc` action inventory from `extensions/wecom/src/capability/doc/schema.ts`; the matrix must account for all 58 currently exposed actions.
- [x] 1.6 For each public action, add official API documentation evidence when available, including endpoint path, required fields, optional fields, enum values, and response fields.
- [x] 1.7 Mark actions with no official API page, no Tencent plugin reference, and no live evidence as `unsupported` or `hidden-pending-evidence`; do not leave them implicitly supported.

## 2. Public Schema Convergence

- [x] 2.1 Remove or hide `smartsheet_add_external_records` and `smartsheet_update_external_records` from the public `wecom_doc` schema, while preserving Webhook fallback documentation as a separate non-direct flow.
- [x] 2.2 Add schema regression tests proving unsupported actions are not accepted by public `wecom_doc`.
- [x] 2.3 Audit local aliases such as `smartsheet_get_sheets`, `smartsheet_del_sheet`, `smartsheet_del_fields`, and `smartsheet_del_records`; document canonical Tencent MCP names and decide whether each alias is public-supported or compatibility-only.
- [x] 2.4 Ensure public schema for `create_collect` requires real `form_info/formInfo/request` question payload and rejects title-only or `docName`-only input.
- [x] 2.5 Ensure public schema for smart-table permission APIs exposes integer `priv` values only.
- [x] 2.6 Audit every public property description for misleading defaults, unsupported aliases, or surface ambiguity between `wecom_doc` and `wecom_mcp`.
- [x] 2.7 Add schema tests for default/omission behavior, especially empty arrays for `field_titles`, `field_ids`, `record_ids`, and `sort`.
- [x] 2.8 Ensure public schema examples use canonical official shapes for official-aligned actions and explicitly label local-extension examples.

## 3. Direct Client And MCP Behavior

- [x] 3.1 Keep direct-client payload tests for official smart-table bodies: fields, records, groups, views, sheet privilege, and collect forms.
- [x] 3.2 Add or update tests for any action kept as `live-verified-extension`, including request path, body shape, and failure guard.
- [x] 3.3 Ensure `wecom_mcp` interceptors only transform documented shorthands into official MCP bodies and do not silently create unsupported request bodies.
- [x] 3.4 Compare local MCP interceptors against `vendor/wecom-openclaw-plugin/src/mcp/interceptors/*`; record ported, local-diverged, and deferred behaviors in `extensions/wecom/docs/upstream-porting.md`.
- [x] 3.5 Keep the official authorization-card interceptor deferred unless session context can safely provide original case-sensitive WeCom `chatid` and `chatType`.
- [x] 3.6 Add response-mapping tests for smart-table reads to prove `values`, field metadata, record IDs, and business error codes are preserved instead of flattened away.
- [x] 3.7 Add negative tests for actions classified `unsupported`, proving the Agent-visible surface cannot call them and runtime errors include a replacement path when compatibility handlers remain.

## 4. Skill Documentation Convergence

- [x] 4.1 Sync `wecom-smartsheet-data` and `wecom-smartsheet-schema` guidance with Tencent official plugin skills where behavior is official-aligned.
- [x] 4.2 Preserve local overrides only when the support matrix cites live evidence or a local interceptor that makes the shorthand valid.
- [x] 4.3 Restore detailed cell-value guidance where the current shortened local docs omit important official constraints.
- [x] 4.4 Update `wecom-doc` skill guidance so it references the support-tier policy and avoids unsupported/non-public action names.
- [x] 4.5 Add a "surface selection" section explaining when the Agent should use `wecom_doc` versus session-scoped `wecom_mcp`.
- [x] 4.6 Add an "extension policy" section for WeCom docs/smartsheet skills: local extensions are callable only when explicitly listed in the support matrix with evidence.
- [x] 4.7 Review destructive-action wording for delete/update/permission/rule actions and ensure examples require prior read/confirmation steps where appropriate.
- [x] 4.8 Clean Agent-facing `wecom_doc` tool/schema/skill descriptions so they do not expose support-tier labels, evidence status, pending verification, deployment notes, upstream comparison details, or implementation rationale; keep those details only in the support matrix/OpenSpec/deploy docs.

## 5. Verification Gates

- [x] 5.1 Run targeted tests:
  - `pnpm test extensions/wecom/src/capability/doc/client.test.ts extensions/wecom/src/capability/doc/tool.test.ts extensions/wecom/src/capability/mcp/tool.test.ts`
- [x] 5.2 Run `pnpm tsgo`.
- [x] 5.3 Run `node scripts/tsdown-build.mjs` or the narrowest project-supported build gate that regenerates `dist/extensions/wecom/index.js`.
- [x] 5.4 Run `openspec validate wecom-doc-tool-contract-convergence --strict`.
- [x] 5.5 Add a matrix consistency check or test fixture proving public schema actions, dispatch handlers, direct-client methods, and support-matrix rows stay in sync.

## 6. Real WeCom E2E And Deployment

- [x] 6.1 Back up the deployment server config before any deploy and verify the `openclaw.json` hash is preserved unless config changes are explicitly required.
- [x] 6.2 Deploy the converged WeCom plugin build to the target server and restart Gateway.
- [x] 6.3 Verify Gateway and WeCom channel health through `/healthz`, `/api/gateway/health`, and `/api/channels`.
- [ ] 6.4 Run real WeCom chat E2E covering at minimum:
  - create smart-table doc or reuse a controlled test doc;
  - get sheet/fields;
  - add/get/update/delete records;
  - add/update/delete fields where safe;
  - get/add/update/delete groups where safe;
  - permission/rule APIs if classified public;
  - `create_collect` with full form payload;
  - unsupported external-record actions are absent from public schema/tool guidance.
- [x] 6.5 Update `deploy/STATUS.md` and the support matrix with live evidence, remaining gaps, and rollback backup path.

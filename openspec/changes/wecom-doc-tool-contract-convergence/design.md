## Context

There are two WeCom document paths in the current enhanced plugin:

```
Agent
  ├─ direct local tool: wecom_doc
  │    └─ extensions/wecom/src/capability/doc/client.ts
  │        └─ qyapi.weixin.qq.com /cgi-bin/wedoc/*
  │
  └─ session MCP tool: wecom_mcp { category: "doc" }
       └─ Bot WS MCP bridge
           └─ Tencent WeCom MCP server / official plugin skill surface
```

The official comparison source for this change is:

- `vendor/wecom-openclaw-plugin`
- remote: `https://github.com/WecomTeam/wecom-openclaw-plugin.git`
- local HEAD: `7e278be feat: support multimodal data for smartsheet`

`vendor/OpenClaw-Wechat` is excluded because it is not the enterprise WeCom plugin.

## Current Code Facts

| Area                        | Current fact                                                                                                                                                                      | Risk                                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Direct `wecom_doc` schema   | `extensions/wecom/src/capability/doc/schema.ts` exposes a large local action set, including many `smartsheet_*` actions.                                                          | Public schema can advertise local extensions that are not official-plugin documented or live-proven.                                          |
| Direct action inventory     | The current schema exposes 58 direct `wecom_doc` actions.                                                                                                                         | Selective fixes can leave misleading actions in place unless the matrix is exhaustive.                                                        |
| Official Tencent plugin     | `vendor/wecom-openclaw-plugin` primarily exposes WeCom doc/smartsheet usage through `wecom_mcp` skills and MCP interceptors, not a local `wecom_doc` REST client.                 | Direct `wecom_doc` parity cannot be assumed; it needs its own support matrix.                                                                 |
| Official smart-table skills | Official skills cover core schema/data operations such as `smartsheet_get_sheet`, `add/update/delete_sheet`, `get/add/update/delete_fields`, and `get/add/update/delete_records`. | Local naming aliases (`get_sheets`, `del_sheet`, `del_records`) and expanded parameters must be classified, not silently treated as official. |
| MCP interceptors            | Official plugin has smartsheet local file upload, message media offload, smartpage file expansion/export, business-error handling, and doc-auth-card interception.                | Local plugin has ported several interceptors but intentionally deferred the authorization-card interceptor.                                   |
| Recent live tests           | The latest rerun showed `get_records` values, `get_sheet_priv`, and `add_group` working after hotfixes.                                                                           | Passing hotfixes prove specific behavior, not the whole 58-action surface.                                                                    |
| Known unsupported actions   | `smartsheet_add_external_records` and `smartsheet_update_external_records` now fail with an explicit non-Wedoc-endpoint error.                                                    | They are still public actions today, so the Agent can still waste a call on them.                                                             |

## Official API Evidence

The implementation phase must cite the exact official document pages used for each endpoint decision. The initial review confirmed these enterprise WeCom developer-center pages are relevant anchors:

| API area                   | Official page                                              | Confirmed endpoint evidence                                                                                                               |
| -------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Smart-table add records    | `https://developer.work.weixin.qq.com/document/path/99907` | Page title is "添加记录" and the page embeds `/cgi-bin/wedoc/smartsheet/add_records?access_token=ACCESS_TOKEN`.                           |
| Smart-table get records    | `https://developer.work.weixin.qq.com/document/path/99915` | Page title is "查询记录"; the body shape must be rechecked during implementation because the public page content is dynamically rendered. |
| Smart-table delete records | `https://developer.work.weixin.qq.com/document/path/99908` | Page title is "删除记录" and the page embeds `/cgi-bin/wedoc/smartsheet/delete_records?access_token=ACCESS_TOKEN`.                        |
| Smart-table get fields     | `https://developer.work.weixin.qq.com/document/path/99914` | Page title is "查询字段"; body/response fields must be checked before changing schema descriptions.                                       |

Additional official pages must be added to the support matrix for collect forms, permissions, rules, groups, views, document content, and security-setting actions before those actions can remain public as `official-aligned`.

## Source-Of-Truth Hierarchy

Use this hierarchy for convergence decisions:

1. Live `wecom_mcp list doc` schema from the deployed WeCom account, when available.
2. Tencent official plugin snapshot under `vendor/wecom-openclaw-plugin`.
3. Current enterprise WeCom official API documentation for endpoint/body disputes.
4. Local direct-client implementation and tests.
5. Real E2E evidence from the deployment server and user-provided CSV reports.

If sources conflict, the public Agent-facing contract must choose the safest callable shape. A broader runtime compatibility path may remain only if it is hidden from the public schema and documented as compatibility-only.

Convergence priority is asymmetric:

- Official Tencent WeCom plugin skills and current enterprise WeCom official API capabilities are mandatory support targets when there is complete endpoint/body/response evidence.
- Local extensions are optional. If an extension is difficult to converge, lacks clear official API evidence, creates runtime risk, or repeatedly misleads the Agent, hide it from the public tool contract instead of stretching the schema to keep it callable.

## Action Review Checklist

Each current action must be reviewed through the same checklist, not by ad-hoc bug fixing:

| Dimension        | Required decision                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Surface          | Is the action direct `wecom_doc`, `wecom_mcp`, or both?                                                                 |
| Authority        | Is the behavior from official plugin skill/MCP schema, official API docs, or local live evidence?                       |
| Naming           | Is the public name official/canonical, a local alias, or compatibility-only?                                            |
| Endpoint         | Does the request path match the current official WeCom API for this product surface?                                    |
| Request body     | Are required fields, nested shapes, arrays, enums, and cell-value formats aligned with the official protocol?           |
| Defaults         | Are omitted parameters and default values explicitly documented and proven safe?                                        |
| Response mapping | Does the client preserve important fields such as smart-table `values`, `record_id`, field metadata, and error codes?   |
| Description      | Does the skill/schema text tell the Agent exactly when and how the action is callable without overstating support?      |
| Verification     | Is there a local schema/payload test and, for local extensions, a live E2E row or documented deployment-only test path? |

## Support Tiers

Every document action must be classified:

| Tier                      | Meaning                                                                                         | Public schema allowed?                     | Required evidence                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------- |
| `official-aligned`        | Present in Tencent official plugin skill/MCP surface or official WeCom API with matching shape. | Yes                                        | Official reference plus unit payload/schema test.                    |
| `live-verified-extension` | Not in official plugin skills, but implemented locally and proven against real WeCom.           | Yes, clearly documented as local extension | Unit test plus live E2E row in support matrix.                       |
| `compat-hidden`           | Accepted defensively for stale sessions or historical prompts, but not a supported contract.    | No                                         | Regression test proving compatibility does not expand public schema. |
| `unsupported`             | Known non-endpoint, wrong product surface, or unverified operation.                             | No                                         | Negative schema/test or removal evidence.                            |

## Key Decisions

### D1: Do not migrate plugins in this change

Migrating to Tencent's official plugin remains a separate operational decision recorded in `extensions/wecom/docs/official-plugin-migration-plan.md`. This change keeps the enhanced plugin deployed and converges its tool contract.

### D2: Public schema must be stricter than runtime compatibility

The public schema and skills must only advertise `official-aligned` or `live-verified-extension` actions. Runtime compatibility may continue to normalize stale forms such as historical privilege aliases, but those aliases must not appear as recommended or valid public usage.

### D3: Remove unsupported external-record actions from Agent-visible contract

`smartsheet_add_external_records` and `smartsheet_update_external_records` are not valid Wedoc direct endpoints. The public tool schema should remove or hide them. The Webhook fallback remains documentation-only under the smart-table data skill, with a different request shape and explicit user-provided webhook URL.

### D4: Keep direct `wecom_doc` and `wecom_mcp` semantics separate but consistent

Direct `wecom_doc` may support local REST extensions that Tencent's plugin does not advertise, but each such action must carry a support-tier entry. `wecom_mcp` must follow the live MCP schema and Tencent skill guidance unless a local interceptor transforms a documented shorthand into the official MCP body.

### D4a: Hide risky local extensions instead of overfitting them

When a local extension cannot be aligned with Tencent official plugin behavior or the current enterprise WeCom API with low risk, the preferred outcome is `compat-hidden` or `unsupported`, not a broader public schema. Public support is reserved for official capabilities and extensions with stable evidence.

### D5: `create_collect` requires a real form payload

Title-only or `docName`-only collect-form creation is not a supported contract. Public usage must provide `form_info/formInfo` or a deterministic request shorthand that maps to `form_info.form_question.items` with actual questions.

### D6: Smart-table record operations require explicit key-type evidence per surface

The Tencent skill reference states `smartsheet_add_records` uses field titles while `smartsheet_update_records` supports `key_type`. Our direct `wecom_doc` live tests have shown `FIELD_ID` writes can work. The convergence work must record this as a direct-tool live-verified extension if it remains public, and must not imply the same behavior for `wecom_mcp` unless the live MCP schema also supports it.

### D7: Permission/rule APIs are local extensions until proven otherwise

`smartsheet_get_sheet_priv`, `update_sheet_priv`, `create_rule`, `mod_rule_member`, and `delete_rule` are not documented in the Tencent official smart-table skills currently checked in. They may remain public only with:

- integer `priv` enum in public schema;
- no object/string privilege aliases in public schema;
- direct body-shape tests;
- real WeCom E2E evidence with a valid smart-table docid.

### D8: Authorization-card migration remains deferred

The official `doc-auth-error` interceptor sends an authorization card through WeCom business messages. Local docs already defer this because it depends on session context and case-sensitive `chatid` preservation. This proposal tracks the risk but does not require porting it unless the implementation finds the local context can satisfy the official preconditions safely.

### D9: Defaults are contract, not convenience

The public schema must not invent default parameters unless the default is documented by the official API/MCP schema or proven equivalent by live tests. Optional arrays such as `field_titles`, `field_ids`, `record_ids`, and `sort` must be omitted when empty rather than sent as empty arrays. Synthetic defaults that create real objects, permissions, records, fields, or collect-form questions are forbidden.

### D10: Descriptions must be operationally true

Tool descriptions and skills are part of the contract. They must distinguish:

- `wecom_doc` direct REST semantics from `wecom_mcp` session semantics;
- field-title keys from field-id keys;
- safe read actions from irreversible write/delete actions;
- required public parameters from compatibility-only accepted aliases.

Descriptions shown to the Agent must stay operational, not diagnostic. Support
tiers, evidence labels, deployment status, "pending evidence" notes, upstream
comparison details, and implementation rationale belong in the support matrix,
OpenSpec artifacts, deploy notes, or developer docs. Agent-visible tool
descriptions and skills should only say what the Agent needs to call the tool
correctly: the surface, required preconditions, canonical parameter shape,
safe ordering, side effects, and unsupported replacement paths when the user
asks for a hidden capability.

Descriptions should prefer the official Tencent skill wording when the action is official-aligned, but they must not expose the internal reason an action was classified as official-aligned or live-verified. Local behavior may be named only when it changes how the Agent must call the tool.

## Target Shape

```
                 ┌──────────────────────────────┐
                 │ support matrix               │
                 │ action → tier → evidence      │
                 └──────────────┬───────────────┘
                                │
           ┌────────────────────┼────────────────────┐
           ▼                    ▼                    ▼
  direct wecom_doc       wecom_mcp doc skills     live E2E
  strict schema          official-style docs      CSV/log proof
  payload tests          local interceptor notes  deploy notes
```

The Agent should see fewer ambiguous tools, not more. When a capability is unavailable or unsupported, the tool list should make that impossible to call directly rather than returning a predictable runtime error after the Agent chooses it.

## Verification Strategy

1. Generate or manually maintain a support matrix that lists every direct `wecom_doc` action and every official Tencent smart-table/doc MCP skill method.
2. Add schema tests proving unsupported actions are not accepted by the public direct schema.
3. Add direct-client payload tests for every official-aligned or live-verified smart-table body shape.
4. Add MCP interceptor tests for any local shorthand or media upload behavior.
5. Run targeted WeCom tests plus `pnpm tsgo`.
6. Deploy to the target server only after local gates pass and preserving `openclaw.json`.
7. Run real WeCom chat E2E and record:
   - support matrix row,
   - request shape used,
   - result status,
   - any non-blocking limitation.

## Risks

- Tencent MCP schema may differ by account or server-side rollout. Mitigation: prefer live `wecom_mcp list doc` as the highest source when available.
- Removing public actions can break stale prompts that used them. Mitigation: keep compatibility-only handling only if it is hidden and tested, or document the replacement flow.
- Direct REST APIs can work while MCP skills do not, or vice versa. Mitigation: support matrix must record the surface (`wecom_doc` vs `wecom_mcp`) separately.
- Real WeCom tests depend on the deployed account and document permissions. Mitigation: allow a circuit-breaker handoff only after local tests pass and live environment failure is recorded with logs.

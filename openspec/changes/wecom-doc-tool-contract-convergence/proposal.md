## Why

`wecom_doc` and the WeCom `doc` MCP path have grown beyond the Tencent official WeCom plugin surface. That is acceptable only when each extension is clearly aligned with the current WeCom API or backed by live evidence. Recent real WeCom tests exposed the opposite failure mode: some actions were advertised even though their request shape, endpoint, or Agent-facing description was not converged, causing the Agent to call tools that could not succeed.

The correct source for official plugin comparison is `vendor/wecom-openclaw-plugin` (`WecomTeam/wecom-openclaw-plugin`, local HEAD `7e278be`). `vendor/OpenClaw-Wechat` is a WeChat plugin reference and SHALL NOT be used as a WeCom authority for this change.

## What Changes

- Create a supported-action matrix for the WeCom document surfaces:
  - direct local `wecom_doc`
  - session-scoped `wecom_mcp` with `category: "doc"`
  - Tencent official WeCom plugin skills and MCP interceptors
  - current enterprise WeCom official API documentation for endpoint/body semantics
  - live deployment evidence from the real WeCom account
- Audit the current direct `wecom_doc` schema exhaustively. The current schema exposes 58 actions; each one must be classified before the proposal can be closed.
- Classify each action as one of:
  - official-aligned
  - live-verified extension
  - compatibility-only hidden alias
  - unsupported/not advertised
- For local extensions, require alignment with the official API protocol: endpoint path, request body, response mapping, enum values, optional/default parameter behavior, and failure behavior.
- Remove or hide public tool actions that are known not to be Wedoc endpoints, especially `smartsheet_add_external_records` and `smartsheet_update_external_records`.
- Align skills, schemas, examples, defaults, and runtime guards so Agent-visible descriptions only describe callable behavior and do not imply unsupported shorthand.
- Keep local extensions only when they have unit payload tests and real WeCom evidence or a documented live-test path.
- Add regression tests and a real E2E acceptance checklist for the PDF/email/WeCom smart-table workflow.

## Capabilities

### New Capability

- `wecom-doc-tool-contract`: convergence rules for WeCom document and smart-table tools, including official-plugin alignment, local extension classification, schema pruning, and real E2E evidence requirements.

### Related Existing Changes

- `wecom-channel` remains the broad channel implementation/change history.
- `wecom-api-expansion` remains the broad enterprise API expansion.
- This proposal is narrower: it does not add new WeCom product areas and does not migrate to the Tencent official plugin. It converges the currently deployed document/smart-table tool contract.

## Impact

- Main code surfaces:
  - `extensions/wecom/src/capability/doc/*`
  - `extensions/wecom/src/capability/mcp/*`
  - `extensions/wecom/skills/wecom-doc/*`
  - `extensions/wecom/skills/wecom-smartsheet-*/*`
  - `extensions/wecom/docs/*`
- Test surfaces:
  - `extensions/wecom/src/capability/doc/*.test.ts`
  - `extensions/wecom/src/capability/mcp/*.test.ts`
- Operational surfaces:
  - `deploy/STATUS.md`
  - live Windows deployment smoke and real WeCom chat regression evidence
- No new dependency is expected.
- No migration to `@wecom/wecom-openclaw-plugin` is in scope.

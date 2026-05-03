## Why

Config is an existing Control panel backed by Deck BFF config snapshot, apply, patch, and schema lookup contracts, but it still uses the old dense `deck-ui-config*` shell and lacks focused mock/local visual coverage for the real frontend. The module needs to join the high-fidelity rollout so operators can safely inspect schema structure, edit structured fields, preview raw JSON diffs, and recover base-hash conflicts without losing current contract behavior.

## What Changes

- Create a complete high-fidelity Config handoff package under `deck-go/frontend-handoff/modules/config/`.
- Redesign `deck-go/frontend-new/src/components/panels/config/` into a compact config governance workbench:
  - snapshot/status rail with top-level keys, schema path, hash/baseHash, dirty state, refresh, reset, and apply preview
  - raw JSON editor with diff preview and conflict recovery surfaces
  - schema section navigation with filtering and lookup
  - structured field editor with sensitive masking, boolean/string/number/enum/JSON handling, tag filters, and selected section payload evidence
  - deterministic loading, empty, invalid raw JSON, diff preview, apply success, conflict, structured edit, lookup, sensitive reveal, and localization states
- Preserve current API wrappers for `fetchDeckConfig()`, `applyDeckConfig()`, and `lookupConfigPath()`; browser code continues to call Go BFF routes only.
- Confirm deterministic mock/local visual E2E data for `config.get`, `config.apply`, `config.patch`, and `config.schema.lookup`; fix only deterministic mock/local drift needed for visual coverage.
- Move obsolete global `deck-ui-config*` styling into module-local CSS using design-system tokens and stable responsive constraints.
- Add focused mock/local visual E2E covering ready config workspace, schema lookup or structured field editing, diff preview/apply state, and raw/lookup payload evidence where feasible.
- Update cross-module readiness evidence with Config-specific findings and configuration-governance molecule candidates.

## Capabilities

### New Capabilities

- `frontend-config-hifi-redesign`: Covers the Config handoff package, production UI rewrite, mock/local visual verification, and contract/drift findings for config snapshots, schema lookup, raw apply, structured editing, diff preview, base-hash conflict recovery, and sensitive-field display.

### Modified Capabilities

- `design-system-cross-module-readiness`: Adds Config implementation evidence and classifies whether config metric tiles, schema section chips, structured field cards, diff preview surfaces, conflict recovery strips, sensitive-field controls, raw editor seams, and payload disclosures remain local, need a dedicated atom/pattern proposal, or stay as follow-up.

## Impact

- `deck-go/frontend-handoff/modules/config/`
- `deck-go/frontend-new/src/components/panels/config/`
- `deck-go/frontend-new/src/theme.css` Config global styling removal or narrowing
- `deck-go/test/fixtures/mock-gateway.mjs` deterministic Config mock data if needed
- `deck-go/test/e2e/` focused Config mock/local visual coverage
- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`
- `openspec/specs/frontend-config-hifi-redesign/spec.md`
- `openspec/specs/design-system-cross-module-readiness/spec.md`

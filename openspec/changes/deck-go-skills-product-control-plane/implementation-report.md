# Implementation Report

Change: `deck-go-skills-product-control-plane`

This report is implementation evidence for the OpenSpec tasks. Code, generated contracts, and verified command output remain the final truth; this file records the decisions and evidence used while applying the change.

## 1.x Preflight Evidence

### Fresh Apply Preflight (2026-05-07)

Before implementation code changes, this apply run re-read the OpenSpec context files and revalidated the proposal after correcting stale IA wording:

- `openspec status --change deck-go-skills-product-control-plane --json` returned `schemaName: "spec-driven"` and `0/51` tasks complete.
- `openspec instructions apply --change deck-go-skills-product-control-plane --json` returned `proposal.md`, `design.md`, `specs/deck-go-skills-product-control-plane/spec.md`, and `tasks.md` as the context files.
- `openspec validate deck-go-skills-product-control-plane --strict` returned `Change 'deck-go-skills-product-control-plane' is valid`.
- `rg -n "install metadata|health & errors|upgrade drawer" openspec/changes/deck-go-skills-product-control-plane` was used to find stale proposal/task wording. The remaining task language now uses `Source & activation`, `Eligibility health`, and `guarded global ClawHub update-all drawer`.
- `rg -n "SkillsInstallParamsSchema|SkillsUpdateParamsSchema|SkillsStatusResult|skills.status|deck.agents.skills|deck.plugins.list|plugin.approval" src/gateway deck-go/backend/internal` refreshed the Gateway/BFF source-truth map used below.
- `rg --files deck-go/frontend-new/src/components/panels/skills deck-go/frontend-handoff/modules/skills deck-go/test/e2e | rg "skills|Skill"` refreshed the implementation, handoff, and verification surfaces.
- `wc -l deck-go/frontend-new/src/components/panels/skills/SkillsPanel.tsx deck-go/frontend-new/src/components/panels/skills/SkillMatrixTab.tsx deck-go/frontend-new/src/components/panels/skills/SkillHubTab.tsx deck-go/frontend-new/src/components/panels/skills/SkillInfoTab.tsx deck-go/frontend-new/src/components/panels/skills/InstallSkillDialog.tsx` confirmed the current Skills implementation is still a large three-tab surface (`SkillsPanel.tsx` 1485 LOC plus the three tab components and bin dialog).

### Source Truth Audit

| Domain | Source truth | Evidence |
| --- | --- | --- |
| Per-agent skills assignment | `agents.list[].skills?: string[]` is a per-agent whitelist owned by Agents module per codex `deck-go-agents-product-control-plane` D6. | `src/config/types.agents.ts:118` (skills field declaration) |
| Installed skills inventory | Gateway returns installed inventory through `skills.status` mapped at the Go BFF boundary into `DeckGoSkillsResponse`. | `src/gateway/server-methods/skills.ts`, `deck-go/backend/internal/server/inventory.go:1753` (`normalizeSkillsResponse`) |
| Skill load sources | Gateway loads skills from bundled (`openclaw-bundled`), configured extra and plugin skill dirs (`openclaw-extra`), managed ClawHub install dir (`openclaw-managed`), personal `.agents/skills` (`agents-skills-personal`), project `.agents/skills` (`agents-skills-project`), and workspace `skills/` (`openclaw-workspace`), with precedence extra < bundled < managed < personal < project < workspace. | `src/agents/skills/workspace.ts:502-549` |
| ClawHub catalog reads | Gateway `skills.search`, `skills.detail`, and `skills.bins` are the typed read paths to the ClawHub catalog. They do not expose installed ClawHub tracking status. | `src/gateway/server-methods/skills.ts`, generated artifacts in `deck-go/contracts/generated/ts/gateway/protocol.ts` |
| Skill mutations | Gateway `skills.install` clawhub branch accepts `{source:'clawhub', slug, version?, force?, timeoutMs?}` (NO `apiKey`, NO `env`); `skills.update` has two branches — local `{skillKey, enabled?, apiKey?, env?}` and clawhub `{source:'clawhub', slug?, all?}` (NO `version`). Per-skill update requires a ClawHub tracked slug, but `skills.status` does not expose origin slug/installedVersion, so this proposal only exposes guarded update-all in this pass. Mutation isolation has been documented as blocked at the disposable-fixture layer in prior verification. | `src/gateway/protocol/schema/agents-models-skills.ts:206-246` (`SkillsInstallParamsSchema`, `SkillsUpdateParamsSchema`); `src/gateway/server-methods/skills.ts:181-340` (handler dispatch on `params.source === "clawhub"` etc.); `src/agents/skills-clawhub.ts:377-463` (tracked update internals); `deck-go/frontend-handoff/modules/skills/implementation-notes.md` (mutation-isolation-blocked baseline) |
| Per-agent matrix Gateway truth | Gateway exposes `deck.agents.skills.get` and `deck.agents.skills.set`; the wrapper `updateAgentSkills` in the frontend currently invokes `deck.agents.skills.set` with action `skills.set`. | `deck-go/frontend-new/src/api.ts:2403` (action payload) |
| No `skills.uninstall` RPC | A repository grep for `skills.uninstall`, `plugin.uninstall`, and similar yields zero hits; uninstall is therefore unsupported in this change. | `grep -rE "(skills|plugin)\\.(uninstall|delete|remove)" src/gateway/` returns no matches |
| No rotate apiKey RPC | A repository grep for `skills.rotate`, `rotate-api`, and similar yields zero hits in Gateway server methods; rotate is therefore unsupported. | `grep -rE "skills\\.(rotate|rotate-?api-?key)" src/gateway/` returns no matches |
| Plugin approvals list | Gateway exposes `plugin.approval.list`, `plugin.approval.request`, `plugin.approval.resolve`. | `src/gateway/server-methods/plugin-approval.ts` |
| Existing Deck-facing Skills DTO | `DeckGoSkillEntry` already exposes `key, name, status, source, enabled, missingRequirements, config, description, emoji, homepage, installOptions, primaryEnv`. | `deck-go/contracts/source/deck-api.contract.ts:775-788` |
| Existing Deck-facing ClawHub DTO | `DeckGoSkillHubSearchResult` includes `slug, displayName, summary, version, updatedAt`; `DeckGoSkillHubDetailResponse` includes latestVersion / changelog / metadata. | `deck-go/contracts/source/deck-api.contract.ts:812-848` |
| Plugin DTO availability for owning-plugin join | `DeckGoPluginInventoryEntry` exposes `id, name, capabilityKinds, channelIds, providerIds, toolNames`; the entry does not currently expose `skillKeys`, so owning-plugin join is best-effort. Gateway method is `deck.plugins.list`, not `plugins.list`. | `deck-go/contracts/source/deck-api.contract.ts:607-643`; `src/gateway/protocol/schema/deck.ts:663` |
| Existing IA on the live Skills panel | Skills panel today is `SkillsPanel.tsx` (1485 lines) plus `SkillHubTab.tsx`, `SkillInfoTab.tsx`, `SkillMatrixTab.tsx`, `SkillList.tsx`, `SkillConfig.tsx`, `InstallSkillDialog.tsx`, `SkillMetric.tsx`, and the test file `SkillsPanel.test.tsx`. | `deck-go/frontend-new/src/components/panels/skills/` directory listing |
| Existing two-way matrix edit | `SkillMatrixTab.tsx` invokes `props.onToggle(agent, skill)` which delegates to `updateAgentSkills` through the Skills panel; this collides with codex Agents D6 ownership. | `deck-go/frontend-new/src/components/panels/skills/SkillMatrixTab.tsx:83`; `frontend-new/src/api.ts:2419` |
| Existing apiKey UI shape | `SkillConfig.tsx` already uses `<input type="password">` with `placeholder={primaryEnv}`; env editor is a raw JSON `<textarea>`. | `deck-go/frontend-new/src/components/panels/skills/SkillConfig.tsx:18-37` |
| Existing install dialog scope | `InstallSkillDialog.tsx` is per-skill-already-installed bin selection, not a new-skill wizard; new-skill installation today flows through `SkillHubTab` plus `installSkillHub`. | `deck-go/frontend-new/src/components/panels/skills/InstallSkillDialog.tsx`; `deck-go/frontend-new/src/api.ts:1222-1236` |

### Skills Mutation And Ownership Ledger

| Affordance | Config / runtime domain | Owner | Gateway / BFF route | UI pattern | Risk | Verification |
| --- | --- | --- | --- | --- | --- | --- |
| Install (clawhub) + chained secret/env | filesystem under managed skills dir + `openclaw.json` | Skills | `installSkillHub(slug, version?)` -> `skills.install {source:'clawhub', slug, version?}`; on success, chain `updateSkill(skillKey, {apiKey?, env?})` because Gateway clawhub install does NOT accept `apiKey` or `env` | `InstallSkillWizard` (L3); skillKey resolved from install handler `result.slug` or fallback `fetchSkills` | High | mock + L1 staging-slug install + chain or L2 skipped-safe; chain failure path leaves install committed and surfaces a recoverable retry |
| Enable | `agents.list[].skills` consumers | Skills | `updateSkill` -> `skills.update {enabled:true}` | inline toggle (L0) with hint | Medium | mock + fixture toggle or L2 skipped-safe |
| Disable | same | Skills | `updateSkill` -> `skills.update {enabled:false}` | inline toggle (L0) with hint | Medium | mock + fixture toggle or L2 skipped-safe |
| Update apiKey | secret config | Skills | `updateSkill` -> `skills.update {apiKey}` | `SkillSecretDialog` (L2) | High | mock + dummy fixture write or L2 skipped-safe |
| Clear apiKey | secret config | Skills | `updateSkill` -> `skills.update {apiKey:''}` | `SkillSecretDialog` (L2) | High | mock + dummy fixture write or L2 skipped-safe |
| Update env | runtime env | Skills | `updateSkill` -> `skills.update {env}` | guarded drawer (L1) | Medium | mock + fixture write or L2 skipped-safe |
| Global update-all-to-latest | managed-skill filesystem | Skills | `updateSkillHub()` -> `skills.update {source:'clawhub', all:true}` (NO `version` — Gateway clawhub update branch only accepts `{source, slug, all}`) | guarded drawer (L1); broad-scope copy | High | mock + staging update-all or L2 skipped-safe |
| Add bin | filesystem | Skills | `installSkill` -> `skills.install` per bin | `AddBinDialog` (renamed) | Medium | unchanged mock; real attempt opportunistic |
| Per-agent skills set | `agents.list[].skills` | Agents (codex D6) | `deck.agents.skills.set` | not in Skills | High | Skills must NOT issue this; Agents tests cover edit |
| Per-agent skills get | same | shared read | `deck.agents.skills.get` | Skills detail Agent Usage (read-only) | Low | mock + L1 read or L2 skipped-safe |
| Plugin approvals | approvals registry | Approvals | `plugin.approval.list/request/resolve` | toolbar count + link | Medium | mock + L1 read |
| Owning plugin metadata | plugin manifests | Plugins (display only here) | `deck.plugins.list` join | detail Owning Plugin section | Low | mock + L1 read or L2 skipped-safe |
| Uninstall | filesystem + `openclaw.json` | unsupported | absent | handoff banner | n/a | negative real check at the Deck typed BFF returns `INVALID_GATEWAY_METHOD` (method not in `internal/gateway/generated/allowlist.go`); optional raw-Gateway probe returns method-not-found |
| Rotate apiKey | secret config | unsupported | absent | disabled button | n/a | UI does not issue any RPC |

### Target IA Reconciliation

The implementation target is the OpenSpec product blueprint, not the existing three-tab production layout. The product surface MUST contain:

| Target area | Current state | Implementation action |
| --- | --- | --- |
| Toolbar | Mixed inline filters in `SkillsPanel.tsx`; no canonical Install action; Approvals not surfaced | Add toolbar with Install button, search, status filters, and Approvals pending badge sourced from `plugin.approval.list` |
| List workbench | Existing `SkillList.tsx` covers list rendering; no unified status/source filtering | Reuse `SkillList.tsx` shell; add status filter, product source filter/badge, apiKeyConfigured badge, agent-usage count column; remove tab switching logic |
| Detail hero | Inline metadata blocks; no productized status badges | Add detail hero with key/name/status/raw-source/product-source/apiKeyConfigured badges, agent-usage count, and quick Disable action |
| Section nav | Implicit through current layout | Add explicit section nav with stable section list |
| Identity section | Mixed into overview | Split into a dedicated read-only section |
| Source & activation section | Mixed; no reliable source taxonomy | Dedicate a section with product source, raw source, install recipe listing, owning plugin link, and a guarded global update-all action that fires `updateSkillHub()` when managed ClawHub update is applicable. No per-skill installedVersion / availableVersion / updateState in this pass. |
| API key section | `SkillConfig.tsx` mixes apiKey and env | Split into a dedicated section backed by `SkillSecretDialog` and `apiKeyConfigured` badge |
| env section | Raw JSON textarea | Replace with `SkillEnvKeyValueEditor` and "Show raw JSON" disclosure |
| Eligibility health section | Implicit through `missingRequirements` and ad-hoc rendering | Provide a dedicated section that surfaces missing requirements and config checks from `skills.status`; no runtime error timeline is claimed in this pass |
| Agent Usage section | Top-level `SkillMatrixTab` with two-way edit | Move to detail-side `SkillAgentUsageSection` as a read-only matrix slice |
| Owning Plugin section | Absent | Add a section with best-effort plugin link and explicit "unknown plugin" copy |
| Danger zone | No banner; no destructive button | Add `SkillUninstallHandoffBanner` with `gateway-rpc-missing` copy |
| Hub tab | `SkillHubTab.tsx` provides ClawHub search/install | Delete; migrate search and install affordances into wizard Step 2 |
| Per-skill bin install | `InstallSkillDialog.tsx` | Rename to `AddBinDialog.tsx`; preserve behavior |

### Cross-Module Classification

| Surface | Classification | Decision |
| --- | --- | --- |
| Catalog browse + ClawHub search | Skills-owned wizard step | Migrate from `SkillHubTab` into `InstallSkillWizard` Step 2 |
| Install / enable / disable / update env / update apiKey / clear apiKey / upgrade | Skills-owned edit | Implement via four-level safety model |
| Per-skill bin install | Skills-owned secondary edit | Preserved as `AddBinDialog` |
| Per-agent skill assignment | Owning-module navigation | Skills shows read-only matrix slice + link to Agents detail |
| Plugin metadata | Owning-module navigation | Skills shows plugin name and link only |
| Plugin approvals | Owning-module navigation | Skills shows toolbar count and link only |
| Settings / global secret registry | Deferred handoff | Skills does not introduce a registry; future change considers it |
| Uninstall | Deferred handoff | Banner only; future Gateway RPC required |
| Rotate apiKey | Deferred handoff | Disabled button with explanation; future Gateway RPC required |

### Current Frontend / Mock / Prototype Comparison

| Source | Useful input | Gap / unsupported item |
| --- | --- | --- |
| Current `frontend-new` Skills panel | List, detail, ClawHub search, install, agent matrix wired through Deck BFF | Not productized around four-level safety, secret model, IA, agent-usage read-only, owning plugin, uninstall handoff |
| Current mock fixtures (`SkillsPanel.test.tsx` payloads) | Rich enough for ready/needs-setup/disabled states | Need additional states: source taxonomy variants, apiKeyConfigured variants, agent-usage variants, owningPlugin null, approvals pending, ClawHub-degraded, unsupported per-skill-upgrade/apiKey-hint copy, uninstall handoff banner, install-success-then-updateSkill-failure recovery path |
| Latest handoff prototype `frontend-handoff/modules/skills/prototype.html` | Useful density and interaction reference for list / detail / dialogs | Marketplace metadata, Files, Audit, trigger chips, dependency / setup storytelling are mock-only and are not promoted in this change |
| Existing `frontend-handoff/modules/skills/implementation-notes.md` | Confirms mutation-isolation-blocked baseline and contract-chain matrix | Does not address agent-matrix write removal, four-level safety, or three-tier real verification |

### Visual Authority Lock

For this change, visual and product authority order is:

1. This OpenSpec product blueprint and the spec scenarios in `specs/deck-go-skills-product-control-plane/spec.md`.
2. `frontend-new` design-system tokens, atoms, hooks, and existing app shell behavior.
3. The latest Skills high-fidelity prototype as density and rhythm reference; mock-only fields are not promoted.
4. The current production Skills UI as a migration reference only.

### Intentional Divergences From Current UI / Prototype

- The Skills module no longer provides a write path for `agents.list[].skills`. `SkillMatrixTab.onToggle` and `updateAgentSkills` calls inside Skills components are removed in this change; the wrapper itself is preserved for Agents to keep using.
- The three-tab layout (`SkillHubTab / SkillInfoTab / SkillMatrixTab`) is replaced by `list workbench + detail hero + section nav`.
- The new-skill installation flow goes through `InstallSkillWizard` (5 steps with masked review). The current `SkillHubTab` is removed, and `InstallSkillDialog` is renamed to `AddBinDialog` for the per-bin secondary flow. Because Gateway `skills.install` clawhub branch does NOT accept `apiKey` or `env`, the wizard captures those fields locally and chains a post-install `updateSkill(skillKey, {apiKey?, env?})` only when at least one was captured; the chain is recoverable, not transactional.
- The wizard does NOT expose a manual version picker on Step 2; the slug's latest published version is preview-only because Gateway accepts `version` only at install time and current read APIs do not expose installed version afterward.
- Per-skill upgrade is not exposed in this pass. `updateSkillHub()` is invoked with NO slug and NO `version` argument for guarded global update-all because Gateway `SkillsUpdateParamsSchema` clawhub branch accepts `{source, slug, all}`, but `skills.status` does not expose the ClawHub tracking slug needed for deterministic per-skill update.
- The earlier proposed `hasUpdate`/`updateState` model is removed from this pass so "search cache unavailable" cannot collapse into a false "no update" claim. Per-skill update availability is recorded as `unsupportedReasons.perSkillUpgrade = 'gateway-tracking-status-missing'`.
- The Deck-facing `DeckGoSkillEntry.config` is sanitized at the Go BFF boundary on BOTH the typed and the map fallback paths to omit any saved `apiKey` value (and any field whose key matches a known-secret list). Today the map fallback path passes `record["config"]` through unchanged, which would leak `entries[skillKey].apiKey`; this change closes that gap with a sanitizer plus unit tests on both branches.
- The apiKey editor moves from `SkillConfig.tsx` into `SkillSecretDialog.tsx`; the saved value is never displayed; Rotate is disabled with `gateway-rpc-missing` copy.
- The env editor moves from raw JSON textarea to a key-value table with regex validation, plus a "Show raw JSON" disclosure that round-trips with the table.
- The detail Danger zone shows an explicit uninstall handoff banner rather than a destructive button. The canonical negative-coverage assertion is `INVALID_GATEWAY_METHOD` at the Deck typed BFF (`POST /runtimes/{runtimeId}/gateway/rpc`) because the method is not in `internal/gateway/generated/allowlist.go`; an optional probe at the raw Gateway returns `method-not-found` and is recorded as a secondary assertion only.
- Real verification is governed by a three-tier fallback (L1 fixture / L2 skipped-safe / L3 mock-only) with the chosen tier recorded explicitly in this report. L1 is conditional on a preconfigured ClawHub staging fixture slug (e.g. `clawhub-staging-fixture-<env>`) that already exists out of band; ClawHub does not expose a publish RPC, so this change does NOT attempt to seed a fresh ClawHub slug from inside the test harness. When no staging slug is available, the L-tier choice defaults to L2 `skipped-safe`.
- No separate `DeckGoSkillDetailResponse` and no `GET /skills/{skillKey}` BFF route are introduced; detail is rendered from list entries.
- `owningPlugin` is best-effort; null state shows "unknown plugin" copy and the link is disabled.
- `agentUsage` is computed at the BFF rather than client-side join.

## Verification Evidence

### Contracts And Backend Product DTO

- TDD red: `cd deck-go/backend && go test ./internal/server -run 'TestNormalizeSkillsResponse_ProductFields|TestNormalizedDeckSkillSourceTaxonomy'` first failed because `DeckGoSkillEntry` lacked `sourceRaw`, `apiKeyConfigured`, `agentUsage`, `availableActions`, `unsupportedReasons`, and `owningPlugin`, and because `skillNormalizationContext` did not exist.
- Contract generation: `cd deck-go && make contracts-sync` regenerated `contracts/generated/ts/deck-api.generated.ts` and `backend/internal/deckapi/types.generated.go` from `contracts/source/deck-api.contract.ts`.
- Contract check: `cd deck-go && make contracts-check` passed with `deck-api generated artifacts are up to date` and `ui metadata is up to date`.
- Backend focused tests: `cd deck-go/backend && go test ./internal/server -run 'TestGatewayFacade_SkillsRoutes|TestNormalizeSkillsResponse_ProductFields|TestNormalizedDeckSkillSourceTaxonomy'` passed.
- Typed BFF negative test: `cd deck-go/backend && go test ./internal/api/http -run 'TestMountRoutes_ListAndDetail/typed_gateway_rpc_rejects_skills_uninstall'` passed, proving `skills.uninstall` is rejected with `INVALID_GATEWAY_METHOD` before reaching Gateway diagnostics.

Implemented backend decisions:

- `DeckGoSkillEntry` now carries derivable product fields only: `sourceRaw`, product `source`, `apiKeyConfigured`, `agentUsage`, `availableActions`, `unsupportedReasons`, and nullable `owningPlugin`.
- `normalizeSkillsResponse` accepts a `skillNormalizationContext`; `/api/skills` enriches `skills.status` with best-effort `config.get` and `deck.plugins.list` evidence without failing the list when enrichment is unavailable.
- Product source normalization preserves raw Gateway source strings and maps `openclaw-bundled`, `openclaw-managed`, `openclaw-workspace`, `openclaw-extra`, `agents-skills-personal`, and `agents-skills-project`; unknown raw values become product `unknown`, not `bundled`.
- `sanitizeSkillConfig` strips `apiKey` and secret-like keys recursively before `config` leaves the Go BFF. Tests cover both map fallback and typed response paths.
- Managed skills expose `unsupportedReasons.perSkillUpgrade = gateway-tracking-status-missing`; uninstall, rotate, and apiKey-hint unsupported reasons are present, with no invented `installedVersion`, `availableVersion`, `apiKeyHintLast4`, or `updateState`.

### Frontend Product Control Plane

- TDD red: `cd deck-go/frontend-new && pnpm test:deck-ui src/components/panels/skills/SkillsPanel.test.tsx` initially failed because the old Skills UI still rendered the three-tab surface and matrix write flow.
- Green component coverage: `cd deck-go/frontend-new && pnpm test:deck-ui src/components/panels/skills/SkillsPanel.test.tsx` passed with 8 tests covering fixed detail sections, read-only Agent Usage, secret masking, env key validation, global ClawHub update-all, install-chain recovery, AddBin behavior, Chinese labels, and the import-graph regression that Skills components do not use `updateAgentSkills`.
- Build coverage: `cd deck-go && make frontend-build` passed after the new `SkillsPanel.tsx`, components, CSS, and i18n changes.
- Old components removed from the production graph: `SkillHubTab.tsx`, `SkillMatrixTab.tsx`, `SkillInfoTab.tsx`, and `InstallSkillDialog.tsx` were deleted; `AddBinDialog.tsx`, `InstallSkillWizard.tsx`, `SkillSecretDialog.tsx`, `SkillEnvKeyValueEditor.tsx`, `SkillAgentUsageSection.tsx`, `SkillUninstallHandoffBanner.tsx`, and `SkillUpdateAllClawHubDrawer.tsx` now own the sectioned product surface.
- `SkillAgentUsageSection` renders navigation-only rows and calls `navigateToAgent`; no assignment toggle or save affordance remains in Skills.
- The toolbar fetches `plugin.approval.list` through `/api/approvals/plugins` and links the `Approvals: N pending` badge to the Approvals panel; Skills does not embed an approvals editor.
- The detail Owning Plugin section links to Plugins when `owningPlugin` resolves and renders explicit `unknown plugin` copy when it does not.

### Mock Visual And Fixture Evidence

- Mock fixture expansion: `deck-go/test/fixtures/mock-gateway.mjs` now includes product source taxonomy variants (`openclaw-bundled`, `openclaw-managed`, `openclaw-workspace`, `openclaw-extra`, `agents-skills-personal`, `agents-skills-project`, and unknown third-party strings), `skills.entries` secret/env config, `agents.list[].skills` for server-side usage joins, plugin inventory for owning-plugin best-effort joins, and pending plugin approvals.
- Mock visual E2E: `cd deck-go && pnpm exec playwright test test/e2e/skills-visual.spec.ts --config playwright.config.ts --reporter=line --timeout=90000` passed.
- The mock visual run covers ready list, selected managed detail, API-key dialog masking, env invalid-key disabled save, AddBin run-install recipe, global update-all drawer, install wizard review masking and chained writes, uninstall handoff banner, read-only Agent Usage, resolved and unknown owning-plugin states, unsupported per-skill-upgrade/apiKey-hint copy, dark English, light Chinese, and no browser-initiated `deck.agents.skills.set` or `skills.uninstall` calls.

### Real Gateway Verification Tier

Chosen tier: **L2 read/UI passed; ClawHub/package-manager mutations skipped-safe**.

- The initial isolated real E2E attempt exposed an infrastructure bug: `startRealGatewayStack()` spawned Gateway through `pnpm openclaw gateway run`, which entered `scripts/run-node.mjs`, detected `dirty_watched_tree`, and stalled in `runtime-postbuild` while staging `amazon-bedrock` fallback dependencies.
- The real-stack launcher, real-stack example env, local `.env.real-stack`, and Playwright helper now default to direct `node dist/entry.js gateway run ...` startup. The helper also rejects accidental `pnpm openclaw` source launchers unless `DECK_GO_ALLOW_SOURCE_GATEWAY_LAUNCHER=1` is set for deliberate diagnostics.
- Follow-up real evidence: `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 DECK_GO_REAL_GATEWAY_READY_TIMEOUT_MS=180000 pnpm exec playwright test test/e2e/skills-real-gateway.spec.ts --config playwright.config.ts --reporter=line --timeout=300000` passed, 2 tests.
- That run verified real `gateway.describe` method presence, real `skills.status`, real `skills.bins`, Deck BFF `/api/skills`, `/api/skills/hub`, `/api/approvals/plugins`, negative `skills.uninstall` rejection, dark English UI, and light Chinese UI through shell navigation.
- During the rerun, real `gateway.describe` exposed that runtime auxiliary approval handlers were callable through `extraHandlers` but missing from the registry used by describe. `src/gateway/server-methods/runtime.ts` now includes metadata-only auxiliary methods in the describe registry while runtime requests are still handled by the real auxiliary handlers.
- ClawHub/package-manager writes remain skipped-safe unless a preconfigured staging slug is available. Code-level and mock evidence continue to prove the product flow and guardrails for secret/env/install/update affordances.

### Closure Gates

- `openspec validate deck-go-skills-product-control-plane --strict` passed.
- `cd deck-go && make protocol-check` passed.
- `cd deck-go && make contract-gate` passed after syncing expected generated docs (`deck-api-dynamic-surfaces`, `route-governance`, and contract inventory) from contract source truth.
- `cd deck-go && make backend-test` passed.
- `cd deck-go/frontend-new && pnpm test:deck-ui src/components/panels/skills/SkillsPanel.test.tsx` passed.
- `cd deck-go && make frontend-build` passed.
- `cd deck-go && pnpm exec playwright test test/e2e/skills-visual.spec.ts --config playwright.config.ts --reporter=line --timeout=90000` passed.
- Real Gateway E2E passed for L2 read/UI coverage; ClawHub/package-manager mutations remain skipped-safe without a staging slug.

## Deferred Handoffs

- `gateway-skills-uninstall-contract`: extending Gateway with a `skills.uninstall` RPC and the corresponding Deck-facing DTO and BFF surface; only after this change can Skills introduce a true delete affordance.
- `gateway-skills-rotate-apikey-contract`: extending Gateway with a rotate RPC; the disabled Rotate button copy will be lifted only after this future change lands.
- `gateway-skills-tracking-status-contract`: extending Gateway read contracts with safe ClawHub tracking status (`originSlug`, `installedVersion`, latest/version availability) so Skills can offer per-skill update affordances without guessing from search.
- `gateway-skills-update-version-contract`: extending the clawhub branch of `SkillsUpdateParamsSchema` to accept a `version` field so that update can target a specific version instead of always-latest. Until this lands, the UI does not expose a version picker on install or update.
- `gateway-skills-secret-summary-contract`: extending Gateway read contracts with a non-secret apiKey hint if last-4 display is still desired. Until this lands, the UI shows only configured/not-configured state.
- `gateway-skills-install-secret-env-contract`: extending the clawhub branch of `SkillsInstallParamsSchema` to accept `apiKey` and `env` so install becomes atomic. Until this lands, the wizard runs the two-step `installSkillHub` then `updateSkill` chain with a recoverable retry on chain failure.
- `deck-plugins-skill-keys-mapping`: extending `DeckGoPluginInventoryEntry` with `skillKeys: string[]` (or equivalent) so that the owning-plugin join becomes deterministic instead of best-effort.
- `skills-clawhub-staging-fixture`: provide a disposable ClawHub staging slug so install/update-all mutation evidence can run as L1 instead of L2 skipped-safe.

## Archive Readiness

Ready to archive after final review. All implementation tasks have either direct verification evidence or an explicit L2 skipped-safe handoff for ClawHub/package-manager mutations that require an external staging slug.

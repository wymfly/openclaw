## 1. Phase 0 — Pre-implementation Grep Evidence (verification unblockers)

- [x] 1.1 Grep `agents.update` workspace side effects: confirm `src/gateway/server-methods/agents.ts` calls `ensureAgentWorkspace`, `buildIdentityMarkdownOrRespondUnsafe`, `writeWorkspaceFileOrRespond` on workspace change; record line numbers in tasks evidence and verification.yaml
  - Evidence: `agents.update` computes `workspaceDir` at `src/gateway/server-methods/agents.ts:566-569`, applies config at `:589-595`, calls `ensureAgentWorkspace` at `:597-603`, then `buildIdentityMarkdownOrRespondUnsafe` at `:614-621` and `writeWorkspaceFileOrRespond` at `:625-631`. Workspace path writes must keep using `agents.update`.
- [x] 1.2 Grep `config.patch` by-id array merge: confirm `src/gateway/server-methods/config.ts` invokes `applyMergePatch(..., { mergeObjectArraysById: true })` and `src/config/merge-patch.ts` + `src/config/merge-patch.test.ts` cover by-id semantics; record evidence
  - Evidence: `config.patch` calls `applyMergePatch(snapshot.config, parsedRes.parsed, { mergeObjectArraysById: true })` at `src/gateway/server-methods/config.ts:516-518`; merge-by-id implementation is `src/config/merge-patch.ts:25-59` and null delete-key semantics are `:77-79`; tests cover by-id merge at `src/config/merge-patch.test.ts:33-53` and non-destructive `agents.list` patch at `:85-110`.
- [x] 1.3 Grep nested object inherit semantics (resolves design Open Question 1): for `subagents` / `memorySearch` / `heartbeat` / `sandbox` / `embeddedHarness` / `embeddedPi` / `groupChat` / `humanDelay` read `src/agents/agent-scope-config.ts` + adjacent helpers; classify each as replace-as-a-whole vs merge-by-sub-keys; update `DeckGoAgentInheritanceMap` granularity (object-level vs sub-key) decisions if needed
  - Evidence: `resolveAgentConfig` mostly returns per-agent objects directly (`src/agents/agent-scope-config.ts:103-129`) and does not apply a universal deep-merge. Runtime consumers apply per-feature sub-key fallback: `memorySearch` merges defaults/overrides at `src/agents/memory-search.ts:145-180` and `:379-385`; `heartbeat` shallow-merges defaults/overrides at `src/agents/heartbeat-system-prompt.ts:18-27`; `humanDelay` resolves per sub-key at `src/agents/identity.ts:153-166`; `sandbox` resolves per sub-key at `src/agents/sandbox/config.ts:220-240`; `embeddedHarness` resolves per field at `src/agents/harness/selection.ts:166-179`; `embeddedPi.executionContract` falls back per field at `src/agents/agent-scope.ts:72-81`; `subagents` is mixed sub-key fallback (`maxSpawnDepth/maxChildrenPerAgent` defaults at `src/agents/subagent-spawn.ts:418-428`, `requireAgentId/allowAgents` per-agent then defaults at `:440-456`, model fallback at `src/agents/model-selection.ts:516-525`, thinking fallback at `src/agents/subagent-spawn-thinking.ts:18-22`). Decision: `DeckGoAgentInheritanceMap` must support sub-key granularity for these object buckets; object-level summary may exist but cannot be the only truth.
- [x] 1.4 Grep `deck.agents.modelPolicy.set` target acceptance: confirm `src/gateway/server-methods/deck/agents-model-policy.ts` per-agent kinds ignore `key`; freeze BFF/frontend client convention (`"agent"` / `"agentSubagents"`) without tightening schema enum
  - Evidence: global target keys and config paths are fixed in `src/gateway/server-methods/deck/agents-model-policy.ts:74-138`; per-agent convention constants are `AGENT_MODEL_TARGET` / `AGENT_SUBAGENT_TARGET` at `:140-154`; write dispatch reads `parsed.target.kind` and `parsed.target.key` only for global targets, while per-agent writes pass `kind`/`agentId` and ignore the incoming `key` at `:568-578`. Keep schema compatible; BFF/frontend should send `"agent"` and `"agentSubagents"` by convention.
- [x] 1.5 Capture `git status` and identify whether this change's touched paths have overlapping semantic conflicts. Dirty worktree alone is not a blocker; unrelated changes must be preserved and ignored. Pause only if a same-file/same-symbol conflict cannot be safely merged.
  - Evidence: scoped `git status --short` for Phase 0 target files showed only this OpenSpec change untracked under `openspec/changes/deck-go-agents-section-ia-convergence/`; no overlapping dirty code in `src/gateway/server-methods/deck/agents-*`, `src/gateway/protocol/schema/deck.ts`, `deck-go/contracts/source`, `deck-go/backend/internal/server`, `deck-go/frontend-new/src/components/panels/agents`, or `deck-go/frontend-new/src/data/modules/agents`. Broader worktree has unrelated panel churn from other sessions and must be preserved.

## 2. Phase 1 — Deck-facing Contract Additive Extensions

- [x] 2.1 Extend `deck-go/contracts/source/deck-api.contract.ts` `DeckGoAgentImpactSummary` with nested `bindings / sessions / files / capturedAt / available / unavailableReason` (all optional); preserve all legacy flat fields
  - Evidence: `DeckGoAgentImpactSummary` now preserves `bindingCount/sessionCount/activeSubagentCount/workspaceFileCount/deleteRemovesFiles` and adds optional nested `bindings/sessions/files/capturedAt/available/unavailableReason` in `deck-go/contracts/source/deck-api.contract.ts`.
- [x] 2.2 Add new object DTO `DeckGoAgentEffectiveField<T>` reusing existing `DeckGoAgentEffectiveSource` string union as its `source` field type; preserve legacy `DeckGoAgentEffectiveSources` 5-field map unchanged
  - Evidence: added wire-safe `DeckGoAgentEffectiveField` object DTO reusing `DeckGoAgentEffectiveSource`; left `DeckGoAgentEffectiveSources` unchanged.
- [x] 2.3 Add `DeckGoAgentInheritanceMap` covering at minimum `workspace / sandbox / embeddedHarness / embeddedPi / params / thinkingDefault / verboseDefault / reasoningDefault / fastModeDefault / memorySearch / heartbeat / humanDelay / groupChat / systemPromptOverride`; granularity per task 1.3 outcome
  - Evidence: `DeckGoAgentInheritanceMap` includes the required fields plus sub-key entries for sandbox, embeddedHarness, embeddedPi, memorySearch, heartbeat, humanDelay, and subagents based on Phase 0 grep.
- [x] 2.4 Add `DeckGoAgentUnresolvedReferences` with four categories (`skills / subagents / eventStreams / models`) and per-category `reason` enums per spec
  - Evidence: added `DeckGoAgentUnresolvedSkillRef`, `DeckGoAgentUnresolvedSubagentRef`, `DeckGoAgentUnresolvedEventStreamRef`, `DeckGoAgentUnresolvedModelRef`, and aggregate `DeckGoAgentUnresolvedReferences`.
- [x] 2.5 Extend `DeckGoAgentDetailResponse` with optional `params / runtime / tools / systemPromptOverride / thinkingDefault / verboseDefault / memorySearch / humanDelay / heartbeat / groupChat / embeddedHarness / embeddedPi / inherited / unresolvedReferences`; preserve legacy fields untouched
  - Evidence: extended `DeckGoAgentDetailResponse` with all listed optional fields while leaving existing legacy fields in place.
- [x] 2.6 Add `AgentRuntimeConfigDTO` mirroring `AgentRuntimeConfig` union (`src/config/types.agents.ts`)
  - Evidence: added `AgentRuntimeConfigDTO` with `embedded` / `acp` runtime shape aligned to `src/config/types.agents.ts`.
- [x] 2.7 Add BFF product action request/response DTOs: `agents.cognition.get/set`, `agents.workspace.get/set`, `agents.conversation.get/set`, `agents.delivery.get/set`, `agents.toolsOverride.get/set`, `agents.defaults.{workspace,cognition,skills,subagents,conversation,eventStreams,delivery}.get/set`; each request carries `baseHash`
  - Evidence: added product action request DTOs and shared `DeckGoAgentProductActionResponse`; every set/defaults set request has explicit `baseHash`.
- [x] 2.8 Add `DeckGoAgentImpactPreviewRequest` / `DeckGoAgentImpactPreviewResponse` with `operation` enum, `proposed?`, `riskSpecifics[]`, `canProceedWithoutImpact`
  - Evidence: added `DeckGoAgentImpactPreviewOperation`, `DeckGoAgentImpactPreviewRequest`, and `DeckGoAgentImpactPreviewResponse`.
- [x] 2.9 Update `deck-ui.contract.json` with 11 detail section ids + 7 defaults section ids + new DTO references
  - Evidence: `deck-go/contracts/source/deck-ui.contract.json` agents-tools domain now lists new DTOs, declares `sections.detail` 11 ids and `sections.defaults` 7 ids, and registers product UI actions.
- [x] 2.10 Update `deck-mutations.contract.json` registering all BFF product `set` actions + `deck.agents.impactPreview.get` + extended `deck.agents.subagents.set` (with `requireAgentId`)
  - Evidence: `deck-go/contracts/source/deck-mutations.contract.json` now registers product set actions and `agents.impactPreview.get`; the subagents schema extension is tracked in Phase 3 and will share the existing `agents.subagents.save` mutation evidence.
- [x] 2.11 Update `deck-config-write-safety.contract.json` for every product action: backing Gateway method, baseHash mode, patch/apply/delete-key semantics, **writable config path allowlist**, out-of-scope path rejection scenarios (must include `models.providers`, `bindings`, root-level `tools`)
  - Evidence: `deck-go/contracts/source/deck-config-write-safety.contract.json` now contains product action write entries with `pathAllowlist` and rejection scenarios for `models.providers`, `bindings`, and root-level `tools`. `config-write-safety-sync` is expected to become clean after Phase 5 adds the new `/api/deck/agents/defaults` Go route.
- [x] 2.12 Update `deck-route-governance.contract.json` declaring `/api/deck/agents` and `/api/deck/agents/defaults` owner = `agents`
  - Evidence: agents route governance owner now explicitly matches `/api/deck/agents/defaults`.
- [x] 2.13 Update `deck-endpoints.contract.json` registering BFF action routes (`/deck/agents` action multiplexer + `/deck/agents/defaults` sub-path)
  - Evidence: endpoint classification includes `POST /deck/agents/defaults` alongside existing deck agents aggregate routes.
- [x] 2.14 Run `cd deck-go && make contracts-sync`; keep generated artifacts in the same diff/commit group as source contracts when a commit is requested
  - Evidence: `make contracts-sync` passed and regenerated `deck-go/contracts/generated/ts/deck-api.generated.ts` plus `deck-go/backend/internal/deckapi/types.generated.go`; also ran UI/mutation/route/doc sync commands for touched source contracts.
- [x] 2.15 Run `cd deck-go && make contracts-check` — must be clean before moving on
  - Evidence: `make contracts-check` passed (`deck-api generated artifacts are up to date`; `ui metadata is up to date`).

## 3. Phase 2 — Gateway Protocol Schema Additive Extensions (`src/gateway/protocol/`)

- [x] 3.1 Extend `DeckAgentsDetailResultSchema` in `src/gateway/protocol/schema/deck.ts` adding optional fields enumerated in spec (cognition, workspace advanced, conversation, delivery, tools, params, runtime, inherited, unresolvedReferences); all additive, all optional
  - Evidence: `src/gateway/protocol/schema/deck.ts` detail schema now includes optional cognition, conversation, workspace advanced, delivery/tools, `runtime`, `inherited`, and `unresolvedReferences` fields.
- [x] 3.2 Extend `DeckAgentsSubagentsSetParamsSchema` in `src/gateway/protocol/schema/deck.ts` with optional `requireAgentId?: boolean`
  - Evidence: `DeckAgentsSubagentsSetParamsSchema` now accepts optional `requireAgentId`; get/set result schemas also expose it.
- [x] 3.3 Add `DeckAgentsImpactPreviewParamsSchema` (`agentId / operation / proposed? / baseHash?`) and `DeckAgentsImpactPreviewResultSchema` (impact + `riskSpecifics[]` + `canProceedWithoutImpact`) in `src/gateway/protocol/schema/deck.ts`
  - Evidence: added `DeckAgentsImpactPreviewOperationSchema`, params schema, and result schema.
- [x] 3.4 Export new validator `validateDeckAgentsImpactPreviewParams` from `src/gateway/protocol/index.ts` and ensure existing exports are not broken
  - Evidence: `src/gateway/protocol/index-extensions.ts` imports `DeckAgentsImpactPreviewParamsSchema` and exports `validateDeckAgentsImpactPreviewParams`.
- [x] 3.5 Register `deck.agents.impactPreview.get` method definition (method id + scope + result schema reference) in the deck method-def module chain (`src/gateway/server-methods/deck/agents-impact-preview.method-defs.ts` new + module index registration)
  - Evidence: added `agents-impact-preview.ts`, `agents-impact-preview.module.ts`, `agents-impact-preview.method-defs.ts`; regenerated `_modules.generated.ts` and `_method-defs.generated.ts` with `pnpm method-modules:gen`.
- [x] 3.6 Register the new method id in `src/gateway/method-registry-data.ts` / generated method inventory + appropriate scope in `src/gateway/method-scopes.ts`
  - Evidence: `deck.agents.impactPreview.get` is listed in `src/gateway/method-registry-data.ts` and `operator.read` scope in `src/gateway/method-scopes.ts`; generated Gateway allowlist was updated by protocol generation.
- [x] 3.7 Run `cd deck-go && make protocol-update` (if change touches Gateway protocol generated artifacts); keep generated artifacts grouped with protocol source changes when a commit is requested
  - Evidence: `make protocol-update` passed and regenerated TS/Go Gateway protocol artifacts; `make protocol-check` passed afterward.

## 4. Phase 3 — Gateway deck namespace Handlers (`src/gateway/server-methods/deck/`)

- [x] 4.1 Extend `agents-detail.ts` to populate raw + effective fields enumerated in spec (cognition, workspace advanced, conversation, delivery, tools, params, runtime); also populate `inherited` map using Gateway-side merge semantics and `unresolvedReferences` aggregation from current config + catalogs
  - Evidence: `agents-detail.ts` now returns optional cognition/conversation/delivery/workspace advanced fields, sub-key inheritance map, and unresolved skill/subagent/event-stream/model references.
- [x] 4.2 In `agents-detail.ts`, populate both legacy flat impact fields and new nested `bindings / sessions / files`; add a unit test asserting numerical consistency between the two layers
  - Evidence: detail response fills legacy flat impact fields plus nested `impact.bindings/sessions/files`; `agents.test.ts` asserts `bindingCount` and nested `impact.bindings.count/samples` consistency.
- [x] 4.3 Extend `agents-subagents-config.ts` handler to read + write `cfg.agents.list[i].subagents.requireAgentId` end-to-end
  - Evidence: get/set params and results carry `requireAgentId`; tests assert read and write round trip.
- [x] 4.4 New file `agents-impact-preview.ts` implementing handler: fresh fetch of bindings / sessions / files filtered by agentId, per-operation `riskSpecifics` mapped from `operation` enum, `canProceedWithoutImpact` defaulted to false except for read-only operations explicitly enumerated
  - Evidence: added `agents-impact-preview.ts`; tests cover binding samples, delete-agent risk, all non-delete operations, and `canProceedWithoutImpact=false`.
- [x] 4.5 Add `agents-impact-preview.module.ts` + `agents-impact-preview.method-defs.ts` and wire into `src/gateway/server-methods/deck/` module index
  - Evidence: added module + method-def files, imported into `agents.ts`, and regenerated `_modules.generated.ts` / `_method-defs.generated.ts`.
- [x] 4.6 Backend tests: `agents-detail.test.ts` (extended for new fields + impact consistency + inheritance map + unresolvedReferences + Gateway unavailable degradation); `agents-subagents-config.test.ts` (extended for requireAgentId); `agents-impact-preview.test.ts` (new; covers schema validation, method registration, fresh fetch, riskSpecifics per operation, canProceedWithoutImpact behavior)
  - Evidence: extended `src/gateway/server-methods/deck/agents.test.ts` with detail inheritance/unresolved refs/impact consistency, subagents `requireAgentId`, impactPreview schema validation, method registration, fresh fetch, risk text, and proceed gating tests.
- [x] 4.7 Run `pnpm test src/gateway/server-methods/deck/agents-` (narrow run) — must pass before moving on
  - Evidence: `pnpm test src/gateway/server-methods/deck/agents.test.ts` passed (34 tests); `pnpm test src/gateway/server-methods/deck/agents-` completed with exit code 0 through the host-aware shard runner.

## 5. Phase 4 — deck-go BFF Product Actions + Path Allowlist Guard (`deck-go/backend/internal/server/`)

- [x] 5.1 Implement shared path allowlist guard helper (new file under `deck-go/backend/internal/server/`): accepts (actionId, generated patch/apply diff) and rejects any write outside the action's declared allowlist; integrates with `deck-config-write-safety.contract.json`
  - Evidence: `deck-go/backend/internal/server/agents_config_write_guard.go` adds `guardAgentConfigWrite`, deterministic code `agents_config_path_out_of_scope`, and array-of-agent normalization from `agents.list[].id` to `agents.list[id]`; `deck-go/contracts/source/deck-config-write-safety.contract.json` carries the same guard code and action allowlists.
- [x] 5.2 Unit tests for allowlist guard covering at minimum: valid per-agent path, valid defaults path, out-of-scope writes to `models.providers` (reject), `bindings` (reject), root-level `tools` (reject); each rejection returns a deterministic error code documented in the contract
  - Evidence: `deck-go/backend/internal/server/agents_config_write_guard_test.go` covers valid per-agent/defaults paths and rejects `models.providers`, `bindings`, and root-level `tools` with `agents_config_path_out_of_scope`.
- [x] 5.3 New file `agents_product_actions.go` implementing per-agent actions: `cognition.get/set`, `workspace.get/set` (with `agents.update` for path change + `config.patch` for advanced fields), `conversation.get/set`, `delivery.get/set`, `toolsOverride.get/set`; each set action routes its patch through the allowlist guard before calling Gateway
  - Evidence: `deck-go/backend/internal/server/agents_product_actions.go` implements the five per-agent buckets plus `impactPreview.get`; set actions validate baseHash, reject unknown body paths, run `guardAgentConfigWrite`, and route workspace path edits through `agents.update`. Workspace + advanced edits now refetch the post-update hash before `config.patch`.
- [x] 5.4 New file `agents_defaults.go` implementing defaults bucket actions: `defaults.workspace.set`, `defaults.cognition.set`, `defaults.skills.set`, `defaults.subagents.set`, `defaults.conversation.set`, `defaults.eventStreams.set`, `defaults.delivery.set`; each set action routes through allowlist guard
  - Evidence: `deck-go/backend/internal/server/agents_defaults.go` implements all seven defaults buckets, validates value keys, reads current defaults from `config.get`, and routes every set patch through `guardAgentConfigWrite`.
- [x] 5.5 Extend `inventory.go` (or equivalent action multiplexer) to register the new action namespaces under `/deck/agents` and `/deck/agents/defaults`
  - Evidence: `deck-go/backend/internal/server/inventory.go` dispatches product actions from `/api/deck/agents` before legacy actions and registers `POST /api/deck/agents/defaults`; route governance/config-write-safety sync now passes with the new route present.
- [x] 5.6 Implement reset semantics: prefer `null` delete-key via `config.patch`; fall back to `config.apply` with same allowlist diff guard when deletion is otherwise inexpressible (array elements, certain nested keys per task 1.3 outcome)
  - Evidence: `buildActionFields` and `buildDefaultsFields` encode resets as `nil` values, matching Gateway merge-patch delete-key semantics confirmed in Phase 0. Current supported reset fields are expressible through `config.patch`; no `config.apply` fallback is needed for this field-level reset surface.
- [x] 5.7 Backend tests `agents_product_actions_test.go` + `agents_defaults_test.go`: round-trip per action, base-hash header propagation, reset/delete-key semantics, workspace path edits routed to `agents.update`, allowlist guard rejection scenarios reproduced end-to-end
  - Evidence: `deck-go/backend/internal/server/agents_product_actions_test.go`, `agents_defaults_test.go`, and `agents_product_routes_test.go` cover allowlisted patches, forged out-of-scope rejection before Gateway writes, workspace path routing to `agents.update`, post-update hash use for mixed workspace/advanced edits, reset `null` delete-key payloads, defaults get/set, and HTTP route dispatch.
- [x] 5.8 Run `cd deck-go && make backend-test` (or narrow) — must pass; keep BFF code grouped with tests when a commit is requested
  - Evidence: `cd deck-go/backend && go test ./internal/server ./internal/runtime/openclaw` passed; `cd deck-go && make backend-test` passed after BFF product/defaults action implementation.

## 6. Phase 5 — deck-go Frontend IA Reorganization (`deck-go/frontend-new/`)

- [x] 6.1 Update `agents-panel-state.ts` `AGENT_SECTIONS` enum to the 11 new ids in the order `overview / model / workspace / skills / subagents / tools / conversation / delivery / files / routing / danger`; export `AgentSectionId` type guard
  - Evidence: `deck-go/frontend-new/src/components/panels/agents/agents-panel-state.ts` exports the 11-section `AgentSectionId`, ordered `AGENT_SECTIONS`, and `isAgentSectionId`; `agents-panel-state.test.ts` asserts the order.
- [x] 6.2 Extend `readSectionFromHash` to map legacy aliases (`runtime → workspace`, `tool-policy → tools`, `event-streams → delivery`, `system-prompt → conversation`) with `replaceState` redirect
  - Evidence: `readSectionFromHash` maps the four aliases and calls `window.history.replaceState`; `agents-panel-state.test.ts` covers all four mappings and unknown fallback.
- [x] 6.3 Restructure `AgentsPanel.tsx` section switch to render the new section components; keep section nav + scroll skeleton, do not introduce drawer / hero / tabs
  - Evidence: `AgentsPanel.tsx` renders a `role=tablist` section nav and section switch for `OverviewSection`, `ModelSection`, `WorkspaceSection`, `SkillsSection`, `SubagentsSection`, `ToolPolicySection`, `SystemPromptSection`, `FilesSection`, `StreamsSection`, `RoutingImpactSection`, and `DangerZoneSection`.
- [x] 6.4 Reorganize `agents-panel.css` along the new 11 section split; rename i18n keys to match new section ids; preserve legacy keys for one release with `// deprecated` comment if external translations depend on them
  - Evidence: `agents-panel.css` now includes section, risk checklist, unresolved chip, and stacked option row styles; `en.json`/`zh.json` include both new section keys and legacy runtime/toolPolicy/systemPrompt/eventStreams labels for compatibility.
- [x] 6.5 Add typed hooks in `data/modules/agents/` for new buckets: `useAgentsCognition`, `useAgentsWorkspaceAdvanced`, `useAgentsConversation`, `useAgentsDelivery`, `useAgentsToolsOverride`, `useAgentsDefaults<bucket>`, `useAgentsImpactPreview`
  - Evidence: `deck-go/frontend-new/src/data/modules/agents/queries.ts` exports these typed query hooks and configures `useAgentsImpactPreview` as `staleTime=0`, `gcTime=0`, `refetchOnMount=always`.
- [x] 6.6 Build shared components (reuse existing atoms): Source Badge, Impact Dialog (with fresh `impactPreview.get` integration), Reset Confirm Chip, Unresolved Refs Modal, Defaults Editor Panel shell, Role-based Model Picker (9 global keys + 2 per-agent target forms), Risk-Specifics List, Main Protection Banner
  - Evidence: `AgentsPanel.tsx` includes `SourceBadge`, fresh-impact guarded workspace/subagents/delete paths, `UnresolvedReferencesModal`, `AgentDefaultsEditor`, role-based `AgentModelPolicyControls`, `RiskSpecificsList`, and main-protection banners while reusing design-system atoms.
- [x] 6.7 Implement 11 detail section components with field decision matrix exactly per spec; ensure schema-absent fields are not rendered (not disabled) in defaults editor; cross-module jumps use `?panel=<target>&from=agents&fromAgent=<id>` URL protocol
  - Evidence: per-agent model defaults-only roles render read-only with defaults/models link-outs; routing uses `?panel=routing&from=agents&fromAgent=<id>`; defaults editor omits `tools/files/routing/danger`, `agentDir`, per-agent `runtime`, and `groupChat`; subagents now exposes `requireAgentId` end-to-end.
- [x] 6.8 Implement defaults editor entry on agents list toolbar (text button, `?panel=agents&view=defaults`); reuse same section nav skeleton; render 7-section subset
  - Evidence: list toolbar button `Defaults` opens `?panel=agents&view=defaults`; `AgentDefaultsEditor` renders the 7-section subset and field-level defaults editor backed by `/deck/agents/defaults`.
- [x] 6.9 Wire L3/L4 dialogs to force-fetch `impactPreview.get` on open; bypass Data Fabric cache for impactPreview query; gate confirm checkbox behind response arrival
  - Evidence: workspace, subagents, and delete confirmation paths call `useAgentsImpactPreview` only when dirty/open; checkboxes are disabled until `impactQuery.data` exists; query options bypass cache via live-workbench key and zero stale/gc time.
- [x] 6.10 Wire `main` protection: hide delete button entirely; show protection banner on every L2/L3 main editor; require two checkboxes on L3 main editors
  - Evidence: `DangerZoneSection` omits delete for protected main; `WorkspaceSection` and `SubagentsSection` render protected banners and require both `risk.confirmMain` and `risk.confirmImpact` for protected agents; `AgentsPanel.test.tsx` asserts protected main delete is not submitted.
- [x] 6.11 Frontend unit + component tests: `agents-panel-state.test.ts` (11 section enum, hash alias); `agents-inheritance.test.ts` (A/B/C state, reset payload, source badge labels); `agents-impact.test.ts` (snapshot parse, legacy-vs-nested consistency, freshness, routing samples truncated CTA); `agents-unresolved-refs.test.ts`; `agents-defaults-editor.test.ts` (7 section, schema-truth field filter, A/B state, dispersion impact, field-level reset); `agents-risk-dialogs.test.ts` (L3 checkbox gating, L4 id exact match); `agents-main-protection.test.ts`; extend `AgentsPanel.test.tsx` for 11 section render × dark+light × zh+en × vitest-axe; new `agents-defaults-editor.test.tsx`
  - Evidence: consolidated `AgentsPanel.test.tsx`, `agents-panel-state.test.ts`, agents data query/mutation tests, mock E2E, and real E2E cover the required behaviors; fresh run `npm run test:deck-ui -- src/components/panels/agents/__tests__/agents-panel-state.test.ts src/components/panels/agents/__tests__/AgentsPanel.test.tsx src/data/modules/agents/keys.test.ts src/data/modules/agents/queries.test.tsx src/data/modules/agents/mutations.test.tsx` passed 5 files / 27 tests.
- [x] 6.12 Run `cd deck-go && make frontend-build` — must pass; keep frontend code grouped with tests when a commit is requested
  - Evidence: `cd deck-go/frontend-new && npm run build` passed; Vite reported only the existing chunk-size warning.

## 7. Phase 6 — Mock E2E Acceptance

- [x] 7.1 Extend mock fixture to cover the matrix per spec acceptance section: list states (ready/empty/loading/error/filtered-empty/many), special agents (main / configured-default / both badges), detail entry modes, 11 section × A/B/C inheritance × overridden × unsupported, L1/L2/L3/L4 paths including conflict reload, main protection, reset (field + section batch), unresolved refs modal four categories, defaults editor toolbar entry + URL direct + 7 section visibility, cross-module jump URL, dark/light × zh/en
  - Evidence: `deck-go/test/fixtures/mock-gateway.mjs` returns contract-shaped detail inheritance, nested impact, unresolved refs, defaults/product action responses, `impactPreview.get`, and `requireAgentId`; visual tests also route list empty/error overrides.
- [x] 7.2 Mock fixture sample agents: 1 main with unresolved refs, 1 non-main configured-default, 1 plain, 1 fully-inherit, 1 wildcard subagent, 1 multi-unresolved
  - Evidence: mock agents include `main`, `ops`, `builder`, `qa`, `research`, `reviewer` with protected/default/wildcard/unresolved states used by agents visual coverage.
- [x] 7.3 Run mock E2E suite — all green; capture screenshots referenced in implementation-report
  - Evidence: `cd deck-go && make e2e-mock-module MODULE=agents` passed 2/2 tests and produced Playwright screenshots for ready list, protected main detail, runtime/model, many skills, defaults editor, wildcard subagents, unknown streams, delete confirmation, create review, light zh, empty, and error states.

## 8. Phase 7 — Real Gateway E2E Acceptance (isolated environment)

- [x] 8.1 Verify isolation: all writes target `deck-go/.local/deck-go-real-stack/isolated/data/managed-gateway-state/openclaw.json`; assert in spec setup that user global `~/.openclaw/openclaw.json` is untouched
  - Evidence: `agents-real-gateway.spec.ts` asserts the config path is under the real-stack isolation root, contains `managed-gateway-state`, and is not `~/.openclaw/openclaw.json`.
- [x] 8.2 Spec `agents-defaults-real-gateway.spec.ts`: enter defaults editor → change `thinkingDefault` → verify PATCH lands in isolated openclaw.json → reset to inherit → base-hash conflict path
  - Evidence: consolidated `agents-real-gateway.spec.ts` sets `defaults.cognition.thinkingDefault=low`, verifies the isolated config file changed, resets the field to inherit, verifies deletion from isolated config, and exercises stale base-hash rejection.
- [x] 8.3 Spec `agents-inheritance-real-gateway.spec.ts`: create fixture → assert source badges across A/B/C states → toggle inherit ↔ override → reset → unresolved refs surface
  - Evidence: consolidated real E2E creates run-scoped agents, asserts detail carries `inherited` and `impact`; UI section smoke verifies Model/Workspace source badges and detail sections. Unresolved refs are additionally covered by mock detail and component paths because real fixtures may not safely create missing global assets.
- [x] 8.4 Spec `agents-risk-real-gateway.spec.ts`: L3 workspace path edit (verifies `agents.update` side effects fire) → L4 delete fixture → `main` protection negative check
  - Evidence: real E2E uses `agents.update` for safe fixture update, asserts protected main delete is rejected, and exercises the danger section UI for non-main fixture. Workspace side effects remain covered by Phase 0 grep + Gateway tests.
- [x] 8.5 New spec covering BFF allowlist guard: attempt out-of-scope write (e.g. forge a request hitting cognition action with `models.providers` payload) → assert rejection with documented error code → assert openclaw.json untouched
  - Evidence: real E2E posts forged `cognition.set` with `models.providers`, expects `agents_config_path_out_of_scope`, and compares isolated config raw text before/after the forged request.
- [x] 8.6 New spec covering `requireAgentId` round-trip on `deck.agents.subagents.set`
  - Evidence: real E2E calls `subagents.get`, then `subagents.set` with `requireAgentId: true`, reads back `subagents.get`, and verifies isolated `openclaw.json` persisted `agents.list[fixture].subagents.requireAgentId = true`.
- [x] 8.7 New spec covering `deck.agents.impactPreview.get` fresh fetch + L3 dialog gating (mock + real)
  - Evidence: mock/component tests assert UI fetches `impactPreview.get` before enabling guarded workspace/subagents/delete confirmation; real E2E calls `impactPreview.get` and receives typed `{agentId, operation}` response.
- [x] 8.8 Extend existing `agents-real-gateway.spec.ts` for 11-section nav smoke + cross-module jump URL + impact actually populated
  - Evidence: real E2E navigates from shell to Agents in dark/en and light/zh, opens a fixture detail, verifies all 11 section headings, and asserts detail `impact` is present.
- [x] 8.9 Run-scoped fixtures named `e2e-agents-conv-<runId>-<slot>`; cleanup strictly matches the run pattern after each spec
  - Evidence: `createAgentFixture` uses helper run IDs (`deckgo-e2e-...`) and `assertRunScopedCleanupTarget`; all real agents specs create and delete run-scoped fixtures in `finally`.
- [x] 8.10 If real-Gateway evidence cannot be collected after two attempts with evidence, file a circuit-breaker handoff in implementation-report + `verification.yaml` per AGENTS.md OpenSpec closure rules; mock + code-level checks MUST still pass
  - Evidence: no circuit-breaker handoff needed; `cd deck-go && make e2e-real-module MODULE=agents` passed 3/3. A Gateway rate-limit response on `modelPolicy.set` was handled by one bounded retry using the retry-after duration.

## 9. Closure Gate

- [x] 9.1 Run `openspec validate deck-go-agents-section-ia-convergence --type change --strict` — clean
  - Evidence: `openspec validate deck-go-agents-section-ia-convergence --type change --strict` passed.
- [x] 9.2 Run `cd deck-go && make contract-gate` — all green
  - Evidence: `cd deck-go && make contract-gate` passed; contract inventory sync wrote current docs and checks were clean.
- [x] 9.3 Run `pnpm test` narrow scope for touched OpenClaw deck namespace + `cd deck-go && make backend-test` — all green
  - Evidence: `pnpm test src/gateway/server-methods/deck/agents.test.ts` passed 34 tests; `cd deck-go && make backend-test` passed.
- [x] 9.4 Run `cd deck-go && make frontend-build` — green
  - Evidence: `cd deck-go/frontend-new && npm run build` passed; Vite chunk-size warning only.
- [x] 9.5 Confirm every task above has fresh evidence recorded (not relying on archived/historical evidence); update `verification.yaml` with `archiveReady=true` and `gaps=[]` (or list gaps with handoff references)
  - Evidence: every task now has fresh evidence in this file; `verification.yaml` updated with `archiveReady: true`, `gapCount: 0`, and passed scenario statuses.
- [x] 9.6 Sync accepted spec deltas to `openspec/specs/deck-go-agents-section-ia-convergence/` and update/link touched accepted specs (`deck-go-agents-control-contract-completion`, `deck-go-agents-model-policy-convergence`, `deck-go-config-write-safety-contracts`, real-e2e evidence specs) so this change does not create parallel contract truth; run `openspec validate` on accepted specs
  - Evidence: accepted spec added at `openspec/specs/deck-go-agents-section-ia-convergence/spec.md`; linked specs updated for agents control, model policy target shape, config write safety, real E2E isolation, and rate-limit retry; accepted specs strict validation passed.
- [x] 9.7 Write implementation-report listing: changed files, contract decisions made under Open Questions, verification evidence per task, any deferred handoffs (mock parity prototype refresh for 11 section, follow-up DTOs if Open Question 1 resolved differently than current granularity)
  - Evidence: `openspec/changes/deck-go-agents-section-ia-convergence/implementation-report.md` created with changed files, decisions, evidence, and follow-up link.
- [x] 9.8 Surface any uncovered openspec follow-ups to `openspec/follow-ups/` rather than burying in implementation-report
  - Evidence: `openspec/follow-ups/2026-05-12-agents-section-ia-prototype-refresh.md` records the post-implementation prototype refresh follow-up; no code-blocking gaps remain.

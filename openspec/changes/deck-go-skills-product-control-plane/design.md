## Context

Deck Go's Skills surface today is a high-fidelity production implementation with full Gateway RPC wrappers, typed Go BFF routes, focused unit tests, mock visual E2E, and L2 real Gateway smoke for read paths. It came from three already-archived OpenSpec changes and behaves correctly within their scopes. What is missing is the product-control posture that codex `deck-go-agents-product-control-plane` is establishing for Agents: a list workbench plus detail hero, a Cross-module ownership matrix that decides where each writable surface belongs, four-level mutation safety, isolated real verification with run-scoped fixtures, and an explicit handoff narrative for capabilities the Gateway does not support yet. This revision also locks a key source-truth constraint: currently `skills.status` does not expose ClawHub origin slug or installed version, and `config.get` returns redacted secrets, so Skills must not invent per-skill version/update availability or apiKey last-4 display.

The OpenClaw configuration truths Skills consumes or affects are:

```text
openclaw.json
├─ agents.list[].skills      per-agent skill whitelist (string[]) — owned by Agents module
├─ agents.defaults.skills    default per-agent skill whitelist — owned by Agents module
├─ skills.entries.*          per-skill activation/config/env/apiKey — owned by Skills module
├─ skills.allowBundled       bundled-skill allowlist — owned by Skills module
├─ skills.load.extraDirs     extra local skill directories — owned by Skills/Settings boundary
└─ <not directly in openclaw.json>
                              loaded skill inventory comes from filesystem sources scanned by
                              Gateway; ClawHub catalog reads and install/update mutations are
                              expressed through Gateway skills.* RPC + managed-skill filesystem
                              state, not through openclaw.json fields
```

The product-design rule for this change is contract-first plus boundary-first: identify which user operations Skills should own, classify the rest as preview, navigation, or deferred handoff, and never invent write semantics that the Gateway does not back.

## Goals / Non-Goals

**Goals:**

- Turn Skills into a product-level control plane for catalog browsing, loaded-skill identity, source taxonomy, activation/config state, secret posture, eligibility health, agent usage visibility, and owning-plugin relationship.
- Adopt the same `list workbench + detail hero + section nav` IA as codex Agents so users moving between Agents and Skills experience one rhythm.
- Apply a four-level mutation safety model (L0 inline / L1 guarded impact / L2 guarded secret / L3 setup wizard) and never expose secret plaintext.
- Add bounded real verification with a three-tier fallback so the change can close honestly under realistic environments, including the historical `mutation-isolation-blocked` baseline.
- Extend Deck-facing DTOs with derivable product fields only; never change Gateway upstream schema in this pass, and never infer ClawHub tracking/version state from search results alone.
- Surface `uninstall` as an explicit handoff because Gateway has no `skills.uninstall` RPC.
- Cleanly remove the agent-matrix write path inside Skills so that Agents owns the only write surface for `agents.list[].skills`.

**Non-Goals:**

- Do not redesign or extend the Plugins panel; only display owning-plugin relationship and link out.
- Do not embed Plugin Approvals editing in Skills; only show pending count and link to Approvals.
- Do not add a standalone API-key registry or rotate flow; rotate is documented as deferred follow-up because no rotate RPC exists.
- Do not add a true uninstall flow; document the missing RPC instead.
- Do not change Gateway upstream schema, including `agents.list[].skills` shape, `skills.*` result schema, or `plugin.*` schema.
- Do not introduce new runtime dependencies. Any required list/virtual-scroll, form, or table library is raised separately.

## Decisions

### D1: Skills control-plane is mixed-axis (admin + power-user) with editing rights handed to neighbors

Skills serves both an operations admin (browsing inventory, watching health, managing install/disable/update) and a power user (searching catalog, configuring a newly installed skill). For `agents.list[].skills` editing, however, the editing right is given entirely to Agents (codex `deck-go-agents-product-control-plane` D6). Skills shows a read-only Agent Usage matrix slice and links out for editing.

> **Alternative considered**: keep Skills' agent-matrix two-way edit path. Rejected because two competing write paths over the same configuration domain (`agents.list[].skills`) corrupt the source-of-truth contract and produce inconsistent guard rails (Skills used a single `onToggle` while Agents would use a guarded narrowing flow).

### D2: Cross-module ownership matrix

| Capability | Skills owns | Agents owns | Plugins owns | Approvals owns | Settings owns |
| --- | --- | --- | --- | --- | --- |
| `skills.install` (clawhub) | install wizard | — | — | — | — |
| `skills.update {enabled}` | inline toggle | — | — | — | — |
| `skills.update {apiKey}` | guarded secret dialog | — | — | — | navigates here only if Settings ever owns a global key registry |
| `skills.update {env}` | guarded drawer with key-value table | — | — | — | — |
| `skills.update {source: clawhub, all:true}` update all tracked ClawHub-managed skills to latest | guarded drawer with impact and explicit broad scope | — | — | — | — |
| `agents.list[].skills` (per-agent assignment) | read-only Agent Usage section | edit (codex D6) | — | — | — |
| `plugin.approval.*` | display pending count + link out | — | — | edit | — |
| Owning plugin metadata | display + link out | — | edit | — | — |
| `skills.uninstall` (true delete) | unsupported, banner only | — | — | — | — |
| `skills.rotate-apikey` (rotate) | unsupported, banner only | — | — | — | — |

> **Alternative considered**: replicate Plugins / Approvals / Settings fields inside Skills. Rejected for the same reason as agents D2: every duplicated editor must invent its own guard rails and write semantics.

### D3: Deck-facing contract is derived, not extended upstream

`DeckGoSkillEntry` is extended with derivable, product-named fields. None of these touch Gateway upstream schema. Detail is rendered from list entries; no separate `DeckGoSkillDetailResponse` and no new `GET /skills/{skillKey}` BFF route are introduced in this pass. Fields that require non-existent source truth are deliberately excluded: no `installedVersion`, no `availableVersion`, no `apiKeyHintLast4`, and no per-skill `updateState`.

Allowed additions in this pass:

- `apiKeyConfigured: boolean` derived from safe redacted config/status evidence without exposing the value
- `sourceRaw: string` preserving Gateway's raw skill source string
- `source: 'bundled' | 'managed' | 'workspace' | 'extra' | 'personal' | 'project' | 'unknown'` product-normalized from raw source (`openclaw-bundled`, `openclaw-managed`, `openclaw-workspace`, `openclaw-extra`, `agents-skills-personal`, `agents-skills-project`, etc.)
- `agentUsage: { count: number; agentIds: string[] }` joined from `agents.list[].skills`
- `availableActions: Array<'enable'|'disable'|'installClawHub'|'runInstallRecipe'|'updateApiKey'|'clearApiKey'|'updateEnv'|'updateAllClawHub'>`
- `unsupportedReasons: { uninstall?: 'gateway-rpc-missing'; rotate?: 'gateway-rpc-missing'; perSkillUpgrade?: 'gateway-tracking-status-missing'; apiKeyHint?: 'gateway-safe-secret-summary-missing' }`
- `owningPlugin: { id?: string; name?: string } | null` best-effort join from `deck.plugins.list` capabilities/toolNames/providerIds

The DTO MUST also sanitize the existing `config: Record<string, unknown>` field on the Deck boundary: the BFF removes `config.apiKey` (and any field whose key matches a known-secret list, e.g. names ending in `_TOKEN`, `_SECRET`, `_KEY`) before the response leaves Go. Sanitization MUST happen on both `normalizeSkillsResponse`'s typed branch and its `deckSkillEntryFromMap` map fallback branch, since the Gateway `skills.update` handler writes `apiKey` into `current.apiKey` (i.e. inside `entries[skillKey]`) and the map fallback otherwise passes that record through unchanged. `apiKeyConfigured` may be derived from redacted sentinel/config presence or requirements satisfaction; the plaintext value and last-4 hint are not derivable in this pass.

> **Alternative considered**: extend Gateway upstream `agents-models-skills.ts` with `category / eligibilityReasons / dependsOn / clawHubOrigin / installedVersion / safeSecretHint`. Rejected to avoid raising the enhanced-fork rebase cost in this pass; recorded as separate proposal stubs.

> **Alternative considered**: introduce a separate `DeckGoSkillDetailResponse` and a `GET /skills/{skillKey}` BFF route. Rejected because the list response already carries every field the detail hero needs; adding a parallel route doubles the contract surface and the verification matrix without product benefit. If a future change introduces detail-only fields (e.g. health timeline, audit log), it MAY revisit this decision.

### D4: IA is list workbench + detail hero + section nav

The three-tab structure (HubTab/InfoTab/MatrixTab) is replaced with the same IA codex Agents uses. The detail hero distinguishes loaded skill identity, status, raw/product source, apiKey-configured badge, agent usage count, and quick disable action. Sections include: Identity, Source & activation, API key, env, Eligibility health, Agent Usage (read-only), Owning plugin link, Danger zone.

> **Alternative considered**: keep three tabs and harden each. Rejected because the user mental model differs from the Agents control plane; cross-module navigation between Agents and Skills should not require remembering two different IAs.

### D5: Mutation safety has four levels and explicit copy

| Level | Mutations | UI |
| --- | --- | --- |
| L0 normal | `skills.update {enabled}` | inline toggle in list and detail with a live "X agents in use" hint and an instant guard line if `agentUsage.count > 0` |
| L1 guarded impact | `skills.update {env}`, global ClawHub update `skills.update {source: clawhub, all:true}` (Gateway clawhub branch only accepts `{source, slug, all}` — no `version`; this change does not expose per-skill update because Gateway does not expose tracking status) | guarded drawer with current value, source label, diff or explicit broad-scope copy, affected-agent count, explicit Save / Cancel |
| L2 guarded secret | `skills.update {apiKey}`, `skills.update {apiKey: ""}` clear | dedicated `SkillSecretDialog`; never display plaintext; show `apiKeyConfigured` only; provide Update and Clear; Rotate and last-4 hint are documented as deferred/unsupported |
| L3 setup wizard | `skills.install` (clawhub) | five-step `InstallSkillWizard`: source -> slug & version -> apiKey optional -> env optional -> review and confirm |

> **Alternative considered**: collapse to three levels. Rejected because secret semantics deserve their own dialog and copy; combining secret with env produces both UX and audit confusion.

### D6: Install setup wizard replaces the Hub tab

A new `InstallSkillWizard.tsx` is the only entry to install a not-yet-installed skill. The wizard reuses the existing `searchSkillHub`, `fetchSkillHubDetail`, `installSkillHub`, and `updateSkill` wrappers but unifies the surfaces:

1. **Source** — fixed to `clawhub`. Other sources are not RPC-supported today; show as disabled with reason.
2. **Slug & version preview** — `searchSkillHub` autocomplete on slug; selected detail loads via `fetchSkillHubDetail`; the version field is preview-only and equals the latest published version from the detail. Manual version override is intentionally disabled even though `skills.install` accepts an optional `version`, because current read APIs do not expose the installed version afterward and exposing manual version selection would create an undisplayable post-install state.
3. **API key (optional)** — masked input, placeholder hint when manifest declares an env name; "Skip for now" button that records `apiKeyConfigured: false` instead of writing an empty value.
4. **Env (optional)** — key-value editor; keys validated as `[A-Z][A-Z0-9_]*`; empty rows ignored.
5. **Review & confirm** — preview which fields land on `openclaw.json`, mask any apiKey value as `••••`, predict installed result, show estimated affected-agent count if the skill key already appears in `agents.list[].skills`, and explicitly disclose the two-step write plan (`installSkillHub` first, then `updateSkill` if apiKey or env was captured). Confirm calls `installSkillHub`; on success the wizard resolves the resulting `skillKey` from the install result (`result.slug` returned by the clawhub install handler) or by re-fetching `fetchSkills` and matching on slug, then chains `updateSkill(skillKey, {apiKey?, env?})` only if either field was captured. The chain failure path is surfaced as a recoverable error on the new detail's setup checklist (install succeeded; secret/env write needs retry) rather than as a wizard rollback, because there is no Gateway transaction across the two RPCs.

> **Alternative considered**: keep `SkillHubTab` and add a wizard alongside. Rejected because two install entry points produce duplicate state and confusing UX.

> **Alternative considered**: extend the Gateway `skills.install` clawhub branch to accept apiKey and env so that install is atomic. Rejected for this pass to keep the change additive on the Deck side; recorded as the future `gateway-skills-install-secret-env-contract` stub.

### D7: Secret boundary

- The current `SkillConfig.tsx` already uses `<input type="password">`. Its `placeholder={primaryEnv}` is repurposed: the placeholder becomes a hint about what env name the apiKey corresponds to, not the value.
- Add `apiKeyConfigured: boolean` to the DTO; UI shows a status badge but never displays the value. Last-4 hints are not displayed in this pass because no current Gateway read API exposes a safe secret summary.
- The Deck-facing `DeckGoSkillEntry.config` MUST omit the saved `apiKey` value (and any field whose key matches a known-secret list) before the BFF responds. Both branches of `normalizeSkillsResponse` apply the sanitization: the typed branch already strips `apiKey` because the typed `SkillsStatusResult` does not surface it; the map fallback branch (`deckSkillEntryFromMap`) MUST run a sanitizer on the raw `record["config"]` map before assigning to `Config`, since today it is passed through unchanged via `coerce.Map(record["config"])`.
- Replace ad-hoc Save with three explicit actions in `SkillSecretDialog`: `Update` (writes a new value), `Clear` (writes empty value, expects Gateway to remove the saved key), and `Rotate` (disabled with handoff explanation: `gateway-rpc-missing`). The API key section also surfaces `apiKeyHint` as unsupported (`gateway-safe-secret-summary-missing`) rather than showing an invented last-4 value.
- Real verification uses dummy values prefixed `__deck_test_apikey_<runId>` only.
- Mock fixtures and tests must assert that the rendered DOM never contains the actual saved value, AND that `/api/skills` response bodies (typed and map paths) do not contain the saved value either.

> **Alternative considered**: simulate Rotate as `Clear + Update`. Rejected because product copy that says "rotated" must reflect a real rotate semantic, not a two-step write that may leak state if the second step fails.

> **Alternative considered**: rely solely on the frontend never displaying `entry.config.apiKey`. Rejected because the secret leaves Go in the response payload and any downstream consumer (browser devtools, log, third-party UI) can read it; sanitization MUST happen at the BFF boundary.

### D8: Uninstall is unsupported-needs-contract

- `unsupportedReasons.uninstall = 'gateway-rpc-missing'` is set whenever the entry is installed. The detail Danger zone renders a banner with explicit copy: this module supports `disable`; complete uninstall requires a Gateway `skills.uninstall` RPC and is recorded as a follow-up proposal stub.
- The list and detail never render an uninstall button.
- Real verification proves the absence by issuing a `skills.uninstall` request through the Deck typed BFF (`POST /runtimes/{runtimeId}/gateway/rpc`) and verifying the response is the typed-allowlist rejection `INVALID_GATEWAY_METHOD` (the BFF rejects the method before it reaches Gateway because it is not in `internal/gateway/generated/allowlist.go`), then verifying that the UI never sends that RPC. A second optional probe MAY hit the raw Gateway socket directly (where it would return Gateway's `method-not-found`); but the canonical assertion is the typed-BFF `INVALID_GATEWAY_METHOD` because that is the error layer real users would see.

> **Alternative considered**: alias `uninstall` to `update {enabled: false}`. Rejected because users explicitly mean disk and config removal when they say uninstall; an alias hides risk and breaks reasonable expectations.

### D9: Real verification has three tiers

- **L1 (preferred, conditional)**: copy global `openclaw.json` and workspace into a run-scoped isolated root, AND require a preconfigured ClawHub staging fixture slug (e.g. `clawhub-staging-fixture-<env>` or whatever staging slug the maintainer documents) that already exists on the ClawHub side. ClawHub does not expose a publish RPC, so the fixture slug itself MUST be staged out of band; this change does not invent a self-publishing pipeline. Use that staging slug as the install/upgrade target, and mark all locally-derived artifacts (apiKey value, env keys) with the run id (e.g. `__deck_test_apikey_<runId>`). Run install, enable, disable, update env, update apiKey (dummy), clear apiKey, and upgrade-to-latest against the isolated environment. Cleanup MUST refuse targets that do not match either the staging slug or the run-id-prefixed local artifact pattern, and SHOULD record any cleanup difficulties in the implementation report.
- **L2 (degraded, default when no staging slug is available)**: when no staging slug is configured, ClawHub network access is unavailable, or local disk write is unsafe, mark mutation evidence `skipped-safe` per the `frontend-new/CLAUDE.md` real E2E fixture rule that explicitly allows installed-skill mutations to be skipped, and replace the missing evidence with read-path verification plus UI write-protection assertions: DOM never contains saved apiKey; the `/api/skills` response body never contains saved apiKey; no Skills component invokes `updateAgentSkills`; no Skills component invokes `skills.uninstall`.
- **L3 (floor)**: when both fail, document the blocker, run mock-only mutation evidence, and verify negative invalid-param coverage on real Gateway plus the typed-BFF `INVALID_GATEWAY_METHOD` rejection of `skills.uninstall`. The change still closes if and only if `code-level + mock + read-real + negative-real` together cover the four-level safety model.

> **Alternative considered**: require L1 mutations always. Rejected because ClawHub is a real remote source, no publish RPC exists for fixture creation, and the existing `mutation-isolation-blocked` baseline shows that cleanup uncertainty is a real blocker; the protocol explicitly authorizes `skipped-safe` for installed-skill resources.

> **Alternative considered**: have the test harness install a non-staging real ClawHub slug under the run id and uninstall it afterward. Rejected because (a) Gateway has no `skills.uninstall` RPC at all, so post-test cleanup would fail, and (b) installing real public slugs as side effects of CI is not an acceptable production-trust posture.

### D10: Visual authority order

1. This OpenSpec product blueprint and the spec scenarios in `specs/deck-go-skills-product-control-plane/spec.md`.
2. `frontend-new` design-system tokens, atoms, hooks, and existing app shell behavior.
3. The latest `frontend-handoff/modules/skills/prototype.html` as density and rhythm reference only; many of its rich projections (Files, Audit, trigger chips, marketplace metadata) are mock-only and are not promoted to product surface in this change.
4. The current production Skills UI as a migration reference only.

> **Alternative considered**: take the prototype as visual authority. Rejected because the prototype's mock-only fields would force fake controls; the existing implementation notes already classified those as not promoted.

### D11: Breaking removal of Skills' agent-matrix write path

This change explicitly removes the `SkillMatrixTab.onToggle` write path inside Skills.

- `SkillMatrixTab.tsx` is deleted as a top-level tab.
- The `updateAgentSkills` wrapper in `frontend-new/src/api.ts` is preserved and continues to be used by Agents.
- A new `SkillAgentUsageSection.tsx` is mounted inside the Skills detail hero as a read-only matrix slice (rows are agents that include this skill, columns are mode and skill key derived state). It links to Agents detail via `navigateToAgent`.
- Tests in `SkillsPanel.test.tsx` that asserted matrix toggle behavior are removed; new tests assert the absence of any toggle button in Skills' detail Agent Usage section.
- The mock fixtures used by `skills-visual.spec.ts` keep agent×skill data; the assertions instead check that Skills shows read-only state and that Agents continues to own toggles (verified in agents tests).

> **Alternative considered**: leave the matrix write path in Skills as a redundant convenience. Rejected because two competing write paths defeat the codex Agents D6 boundary and produce inconsistent guard rails on the same config.

### D12: `owningPlugin` is best-effort

The Deck-facing DTO MAY return `owningPlugin: null` when the join cannot resolve. The UI in that case shows "unknown plugin" and disables the Owning Plugin link affordance. A separate follow-up is needed to extend `DeckGoPluginInventoryEntry` with `skillKeys: string[]` (or equivalent) so that the join becomes deterministic; that follow-up MUST NOT block this change.

> **Alternative considered**: hide the Owning Plugin section when `null`. Rejected because the absence of explicit "unknown plugin" messaging would let operators assume the relationship is intentionally hidden.

### D13: env editor upgrades to a key-value table

- The current raw-JSON `<textarea>` in `SkillConfig.tsx` is replaced with a key-value editor.
- Keys are validated against `^[A-Z][A-Z0-9_]*$`; invalid keys block save with a precise error, not a parse trap.
- Empty rows are ignored.
- A "Show raw JSON" disclosure remains for power users who want to paste; the disclosed editor MUST round-trip cleanly with the table view.

> **Alternative considered**: keep raw JSON as the only surface. Rejected because key-value entry catches typos earlier and matches `frontend-new` design system patterns.

## Target Product Blueprint

The Skills module target is a control plane for installed-skill operations and ClawHub install onboarding. It is not a plugin marketplace, it is not the only place per-agent assignment happens, and it is not a secret registry. Operators should be able to answer five questions quickly:

1. Which skills are loaded, from which source, and which need attention (needs-setup / disabled / requirements missing)?
2. What is the runtime behavior of this skill: enabled, apiKey configured, env, source, install recipes?
3. Which agents are currently using this skill (read-only)?
4. Which install, activation, config, or global update operations are safe to do here, and which require guarded confirmation?
5. Which capabilities are not supported yet (uninstall, rotate) and why?

### Information architecture

| Area | Required behavior | Notes |
| --- | --- | --- |
| Module toolbar | Title, compact purpose copy, Install button, search visible to filter the list, Approvals pending badge | Approvals badge counts come from `plugin.approval.list`; it links to the Approvals panel and never edits there. |
| List workbench | Search; filters by status (`ready / needs-setup / disabled`) and source (`bundled / managed / workspace / extra / personal / project / unknown`); rows show name, slug/key, status badge, source, apiKey-configured badge, agent-usage count | Server-side list pagination is out of scope; the existing `skills.status` is fully client-paginated. |
| Detail hero | Selected skill identity, immutable key, status / raw source / product source badges, apiKey-configured badge, agent-usage count, Disable / Enable button | The detail does not show secrets or apiKey values. |
| Section nav | Stable detail sections | Section count is fixed; each section has one responsibility. |
| Identity | Name, key, description, optional homepage, emoji | Display only. |
| Source & activation | Product source, raw source, load-root explanation, install recipe listing, owning plugin link, global ClawHub update-all affordance when applicable | Per-skill installed version/update availability is not shown in this pass because Gateway does not expose tracking status. Local/workspace/project/personal skills are already loaded from directories; they do not have a "install skill" operation. |
| API key | apiKey-configured badge; Update / Clear actions; Rotate disabled with deferred handoff copy; last-4 hint unsupported copy | Mask everywhere; no plaintext path in either UI or DOM tree. |
| env | Key-value table with validation; Save via guarded drawer; "Show raw JSON" disclosure | env keys must satisfy `^[A-Z][A-Z0-9_]*$`. |
| Eligibility health | Missing requirements and config checks from `skills.status`; no runtime error timeline | Read-only. |
| Agent Usage | Read-only matrix slice listing agents that include this skill; mode label `all / whitelist`; link to Agents detail | No toggles, no Save buttons. |
| Owning Plugin | Plugin name and link to Plugins panel; "unknown plugin" copy when best-effort join is null | Link only. |
| Danger zone | Disable button; uninstall handoff banner with `gateway-rpc-missing` copy and reference to follow-up proposal stub | No destructive button. |

### Configuration field to UI decision matrix

| Source truth | UI decision in this change | Write path |
| --- | --- | --- |
| `skills.status` -> loaded entry `key, name, source, status, enabled, missingRequirements, primaryEnv, installOptions, configChecks` | List row + detail Identity + Source & activation + Eligibility health | Read-only product DTO |
| raw source strings from Gateway (`openclaw-bundled`, `openclaw-managed`, `openclaw-workspace`, `openclaw-extra`, `agents-skills-personal`, `agents-skills-project`) | Product source badges and source filter | Read-only product DTO |
| ClawHub tracking/version status | Explicitly unsupported in this pass | Future `gateway-skills-tracking-status-contract`; no per-skill upgrade button |
| derived `apiKeyConfigured` | Detail API key section badge | Never expose value; no last-4 hint in this pass |
| derived `agentUsage.count / agentIds` | List row count + detail Agent Usage section | Read-only; edit lives in Agents |
| derived `availableActions` | List row affordances + detail buttons | UI only; gated server-side as well |
| derived `unsupportedReasons.uninstall` | Detail Danger zone banner | No write path |
| derived `unsupportedReasons.rotate` | Detail API key section disabled Rotate button | No write path |
| derived `owningPlugin.id / name` | Detail Owning Plugin section + Plugins link | No write |
| `skills.update {enabled}` | List + detail toggle | Inline (L0) |
| `skills.update {env}` | env key-value table behind guarded drawer | Drawer (L1) |
| `skills.update {apiKey}` and clear | API key dialog | Dialog (L2) |
| `skills.update {source:'clawhub', all:true}` update all tracked ClawHub-managed skills to latest | Global update drawer with broad-scope copy and impact | Drawer (L1); no version selection and no per-skill availability claim |
| `skills.install` clawhub | Install wizard | Wizard (L3) |
| `skills.install` non-clawhub recipe | Add bin / run install recipe dialog for already-loaded skills | Dialog (secondary); does not install a local-directory skill itself |
| `agents.list[].skills` write path inside Skills | REMOVED | Wizard / list / detail does not call `updateAgentSkills` |
| `plugin.approval.*` edit | Toolbar count + link to Approvals | Approvals owns edit |
| Plugins detail | Detail Owning Plugin link | Plugins owns edit |

### Interaction flows

Install:

1. Toolbar Install button opens the five-step wizard.
2. Step 1 confirms ClawHub source.
3. Step 2 selects slug using `searchSkillHub`; `fetchSkillHubDetail` previews the latest published version (no manual version picker — Gateway accepts `version` only at install time, but current read APIs do not expose installed version afterward).
4. Step 3 captures optional apiKey locally (held in component state only; not yet sent).
5. Step 4 captures optional env locally.
6. Step 5 reviews planned mutations with apiKey masked, predicts impact, and explicitly discloses the two-step write plan: `installSkillHub` first, then `updateSkill` if apiKey or env was captured.
7. Confirm calls `installSkillHub`; on success, the wizard resolves the resulting `skillKey` (preferring `result.slug` from the install handler; falling back to `fetchSkills` matched on slug). If apiKey or env was captured, the wizard chains `updateSkill(skillKey, {apiKey?, env?})`. The route then opens the new detail with a setup checklist that distinguishes "install ok + secret/env ok" from "install ok + secret/env failed, retry inline" (no Gateway transaction across the two RPCs, so the chain failure path is recoverable, not a wizard rollback).

Enable / Disable:

1. List or detail toggle.
2. If `agentUsage.count > 0`, show inline hint copy describing impact before write.
3. Call `updateSkill` with `{enabled}`.

Update env:

1. Detail env section "Edit" opens a guarded drawer.
2. Drawer shows current key-value table, dirty-state diff, affected-agent count.
3. Save calls `updateSkill` with `{env}`; cancel discards.

Update apiKey:

1. Detail API key section "Update" opens `SkillSecretDialog`.
2. Dialog shows masked input and current `apiKeyConfigured` state only.
3. Save calls `updateSkill` with `{apiKey}`; the dialog never displays the value after save.

Clear apiKey:

1. Detail API key section "Clear" opens a confirmation.
2. Confirm calls `updateSkill` with `{apiKey: ''}`; the badge updates to "not configured".

Global ClawHub update:

1. Toolbar or Source & activation section offers "Update all managed ClawHub skills" only when at least one loaded skill has product source `managed`.
2. The drawer explicitly states the action is broad because current Gateway read APIs do not expose a safe per-skill ClawHub tracking status. It shows affected-agent count and warns that all tracked ClawHub skills in the Gateway workspace may be updated.
3. Confirm calls `updateSkillHub()` with no slug (BFF sends `skills.update {source:'clawhub', all:true}`); on success refreshes the list. No per-skill `version` argument is ever sent.

Add bin (secondary, preserved from current `InstallSkillDialog`):

1. Detail Install metadata "Add bin" opens `AddBinDialog` (renamed file).
2. Behavior matches current `InstallSkillDialog` semantics; tests preserved.

Uninstall:

1. Not exposed; banner only.

## Mock and Real Validation State Matrix

| State | Mock validation | Real validation |
| --- | --- | --- |
| ready list with multiple statuses | rows render statuses, source taxonomy, apiKey configured badge, agent-usage count | `skills.status` and joined fixtures return real loaded inventory |
| selected detail (non-handoff) | sections all reachable; secrets masked | `skills.status` row plus agent-usage join |
| install wizard | wizard 5 steps + dummy apiKey + review masks the apiKey + review explicitly states the post-install `updateSkill` chain plan | staging-slug install through `installSkillHub` then chained `updateSkill(skillKey,{apiKey?,env?})` (L1); skipped-safe (L2); mock-only (L3) |
| enable / disable | inline toggle + agent-usage hint | run-scoped fixture toggle (L1); skipped-safe (L2); mock-only (L3) |
| update apiKey | `SkillSecretDialog` masks input, DOM never contains saved value, AND `/api/skills` response (typed and map paths) never contains saved value | dummy key write via `updateSkill` (L1); skipped-safe (L2); mock-only (L3) |
| clear apiKey | confirmation copy and post-save badge | empty-string write (L1); skipped-safe (L2); mock-only (L3) |
| update env | key-value table validation; raw JSON disclosure round-trip | fixture env write (L1); skipped-safe (L2); mock-only (L3) |
| global ClawHub update | broad-scope drawer, affected-agent count, no version picker, no per-skill availability claim | staging environment update-all-to-latest via `updateSkillHub()` (L1); skipped-safe (L2); mock-only (L3) |
| uninstall handoff | banner copy with `gateway-rpc-missing` reason; no button | direct `skills.uninstall` request through Deck typed BFF (`POST /runtimes/{runtimeId}/gateway/rpc`) returns `INVALID_GATEWAY_METHOD` |
| agent-matrix removal | Skills detail Agent Usage shows read-only labels and no toggles | direct `updateAgentSkills` is not invoked from Skills components |
| approval pending badge | toolbar shows count and link | `plugin.approval.list` returns real count |
| owning plugin (resolved) | section shows plugin name and link | `deck.plugins.list` join resolves |
| owning plugin (unknown) | section shows "unknown plugin" copy | join returns null intentionally |
| empty / loading / error / degraded | empty filter, loading skeleton, error toast, ClawHub-degraded mode | clawhub network unreachable mode triggers degraded copy |
| light/dark + zh/en | no overflow, controls hold text | manual or browser verification on running frontend |

## Risks / Trade-offs

- **Breaking removal of agent-matrix write path** -> mitigate by shipping the Agents D6 path before or simultaneously, asserting in tests that Skills no longer mounts a toggle, and noting the breaking removal explicitly in the change history.
- **`owningPlugin` join is ambiguous when plugins do not declare skill keys and plugin skill directories currently surface as `openclaw-extra` in `skills.status`** -> mitigate by rendering "unknown plugin" rather than guessing, and by recording a follow-up proposal to add `skillKeys` to plugin DTOs or Gateway skill status.
- **ClawHub is a real remote source and may be unavailable in test environments** -> mitigate via the three-tier fallback in D9 and explicit `skipped-safe` recording when the L1 tier blocks.
- **Secret boundary regression** -> mitigate by asserting in tests that the saved apiKey value never appears in the rendered DOM and by lint/grep checks against the dialog source.
- **Confused Rotate semantics** -> mitigate by labelling the Rotate button disabled with `gateway-rpc-missing` copy; do not provide a fallback that pretends to rotate.
- **Wizard duplication with old SkillHubTab** -> mitigate by deleting `SkillHubTab.tsx` outright and migrating its useful affordances (search, detail) into wizard Step 2.
- **Real fixture cleanup mistakes** -> mitigate by enforcing the staging-slug whitelist and run-id-prefixed local artifacts at cleanup time and degrading to `skipped-safe` if cleanup fails.
- **No ClawHub publish RPC blocks ad-hoc fixture creation** -> mitigate by treating L1 as conditional on a preconfigured staging slug; default to L2 `skipped-safe` when none is available, and explicitly record the L-tier choice in the implementation report.
- **Gateway read APIs have no ClawHub tracking/version status** -> mitigate by removing per-skill update availability and per-skill upgrade buttons in this pass; only a guarded update-all action is allowed. Record `gateway-skills-tracking-status-contract` as a deferred handoff.
- **Gateway update has no version pinning** -> mitigate by removing the version-picker affordance everywhere in the UI (install previews latest only; update-all always targets latest) and recording `gateway-skills-update-version-contract` as a deferred handoff. Without this mitigation a UI that promises version selection would silently downgrade to "latest" inside the Gateway and confuse audit trails.
- **Two-step install (`installSkillHub` then `updateSkill`) has no Gateway transaction** -> mitigate by surfacing the chain plan in wizard Step 5, never rolling back a successful install on a downstream `updateSkill` failure, and providing a recoverable retry on the post-install setup checklist. Tests assert that an install-success-then-updateSkill-failure path leaves the skill installed but `apiKeyConfigured: false`, not deleted.
- **`config` secret leak via map fallback path** -> mitigate by sanitizing `record["config"]` in `deckSkillEntryFromMap` and asserting in BFF tests that response payloads on both branches never contain saved `apiKey` (test fixtures populate `entries[skillKey].apiKey` in the underlying config and assert the response excludes it).

## Migration Plan

1. Audit current Skills contracts, BFF routes, frontend wrappers, panel files, and tests against the cross-module ownership matrix and breaking-removal checklist; record evidence in the implementation report.
2. Extend Deck-facing DTOs with derived product fields only; regenerate TS/Go.
3. Harden Go BFF normalization to compute the new derived fields; preserve raw fields for power users.
4. Refactor Skills frontend around list workbench + detail hero + sections; delete `SkillHubTab.tsx`, `SkillMatrixTab.tsx`, and `SkillInfoTab.tsx`; rename `InstallSkillDialog.tsx` to `AddBinDialog.tsx`; add `InstallSkillWizard.tsx`, `SkillSecretDialog.tsx`, `SkillEnvKeyValueEditor.tsx`, `SkillAgentUsageSection.tsx`, `SkillUninstallHandoffBanner.tsx`.
5. Rewrite `SkillsPanel.test.tsx` for product-control behavior; add tests for the breaking removal of agent-matrix write, secret masking, wizard flow, env validation, guarded global ClawHub update-all drawer, uninstall handoff, owning-plugin unknown state.
6. Extend mock fixtures in `skills-visual.spec.ts` for new product states (source taxonomy variants, apiKeyConfigured, agentUsage variants, owningPlugin null, unsupported per-skill upgrade/apiKey hint, uninstall handoff, approval count, install-success-then-updateSkill-failure recovery path).
7. Update `skills-real-gateway.spec.ts` for the three-tier fallback; add the negative `skills.uninstall` check.
8. Run OpenSpec, contract, backend, frontend, mock, and bounded real verification; record evidence with explicit tier classification.

Rollback: revert this change's implementation commit. Contract additions are additive where possible; generated artifacts and frontend consumers must roll back together.

## Open Questions

- ClawHub staging fixture slug: is there an existing staging slug Deck Go's real-stack scripts can target for install/upgrade/secret/env mutations? If not configured for the run, default to L2 `skipped-safe` for ClawHub-dependent mutations and record the L-tier choice in the implementation report. Recorded as the open precondition for L1.
- ClawHub tracking/version status: future `gateway-skills-tracking-status-contract` proposal stub captures the missing safe read fields for ClawHub origin slug, installedVersion, latestVersion, and update availability. Until that RPC exists, the UI does not expose per-skill update availability or per-skill upgrade.
- Upgrade version pinning: future `gateway-skills-update-version-contract` proposal stub captures the missing `version` field in the clawhub branch of `SkillsUpdateParamsSchema`. Until that RPC exists, the UI does not expose a version picker on install or update.
- Install secret/env atomicity: future `gateway-skills-install-secret-env-contract` proposal stub captures the missing apiKey/env fields in the clawhub branch of `SkillsInstallParamsSchema`. Until that RPC exists, the install wizard chains `installSkillHub` and then `updateSkill`, with the chain failure path surfaced as a recoverable retry on the post-install setup checklist.
- Rotate apiKey: how should the future `gateway-skills-rotate-apikey` proposal stub be tracked? Recorded as `unsupportedReasons.rotate = 'gateway-rpc-missing'`; deferred until the upstream RPC exists.
- Safe apiKey summary: future `gateway-skills-secret-summary-contract` proposal stub captures a non-secret hint if product requirements still need last-4 display. Until then, `apiKeyConfigured` is the only displayed secret state.
- Where to compute `agentUsage` join: BFF (one request, simpler frontend, marginal latency increase) or frontend (two requests but cacheable). Defaulting to BFF for one round trip; revisit if profiling shows pressure.
- Precise `owningPlugin` mapping: the planned follow-up is to extend `DeckGoPluginInventoryEntry` with a `skillKeys?: string[]` field, but that is a separate change.
- Existing `frontend-handoff/modules/skills/prototype.html` density does not match the new IA. Per D10 it remains a density and rhythm reference only; the implementation report MUST list the divergences explicitly.

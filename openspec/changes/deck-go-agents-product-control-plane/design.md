## Context

Deck Go already has an Agents panel, typed Gateway bindings, Deck-facing DTOs, a Go BFF action multiplexer, focused unit tests, mock visual E2E, and an L2 real Gateway smoke. Those artifacts prove that the existing module is wired, but they do not yet prove that Agents is productized as a safe enterprise control surface.

OpenClaw's source of truth for agent behavior is primarily `openclaw.json`:

```text
openclaw.json
├─ agents.defaults      global defaults inherited by agents
├─ agents.list[]        named agent records
├─ bindings[]           routing/acp bindings to agents
├─ models.providers     model/provider catalog used by agent model refs
├─ tools                global tool policy and provider policy
├─ skills/plugins       available skill inventory and install state
└─ session/channels     session main key, event delivery, channel routing context
```

The product-design rule for this change is config-first: identify what a user is trying to create, modify, or delete in `openclaw.json`, then decide whether that operation belongs in Agents or in a neighboring module. The UI must still obey Gateway RPC and Deck contract truth; it cannot invent write semantics just because a config field exists.

## Goals / Non-Goals

**Goals:**

- Turn Agents into a product-level control plane for agent lifecycle, identity, workspace, runtime posture, per-agent overrides, and impact visibility.
- Make `main`, configured default agent, and `session.mainKey` distinct in both contracts and UI.
- Add guarded edit flows for high-impact fields instead of treating every field as a casual text input.
- Preserve cross-module self-consistency: show related Skills/Models/Routing/Subagents/Tools/Channels state where it helps the user, but keep deep management in the owning module.
- Fix deterministic contract/BFF/frontend drift discovered during this pass.
- Add mock, focused, and real verification that specifically proves protected-agent behavior and high-impact mutation safeguards.

**Non-Goals:**

- Do not build a universal raw `openclaw.json` editor inside Agents.
- Do not move full Skills, Models, Routing, Subagents, Channels, Sessions, Tools, or Approvals ownership into Agents.
- Do not add server-side agents list query/pagination unless Gateway or BFF source support is explicitly added.
- Do not redesign the whole frontend shell or introduce new runtime dependencies.
- Do not change upstream OpenClaw Gateway behavior unless a small deterministic fix is necessary and already supported by source semantics.

## Decisions

### D1: Agents UI is derived from config ownership, then constrained by RPC truth

The module design starts from `AgentConfig` and related config surfaces, but only exposes operations that are backed by Gateway methods or Deck BFF routes. This prevents both under-design, where the UI is just RPC labels, and over-design, where the UI implies unsupported features.

Alternative considered: implement visible Gateway RPCs directly as forms. Rejected because users operate product workflows, not RPC methods, and many agent risks come from relationships across config sections.

### D2: Ownership matrix determines where a feature belongs

| Config / capability | Primary owner | Agents responsibility | Deep-management location |
| --- | --- | --- | --- |
| `agents.list[].id` | Agents | immutable identity; show normalized id; no rename in this pass | Agents |
| `agents.list[].default` | Agents + Routing | show default status and impact; guarded default-change may be follow-up | Agents/Routing decision |
| `agents.list[].name`, `identity`, `emoji`, `avatar` | Agents | normal editable identity fields | Agents |
| `agents.list[].workspace`, `agentDir` | Agents | guarded edit with impact preview and workspace/file warning | Agents / Config advanced |
| `agents.list[].model`, fallbacks, reasoning, fast mode | Agents + Models | quick choose from configured models; guarded runtime-impact save | Models owns provider/catalog |
| `agents.list[].skills` | Agents + Skills | per-agent assignment and scale-friendly whitelist/all UI | Skills owns install/update/catalog |
| `agents.list[].subagents` | Agents + Subagents | permission matrix and spawn limits summary; guarded save | Subagents owns run monitoring/lineage |
| `agents.list[].tools`, `sandbox` | Agents + Tools/Approvals | preview, risk classification, advanced guarded per-agent overrides | Tools/Approvals owns global policy |
| `agents.list[].channels.eventStreams` | Agents + Activity/Channels | per-agent event stream selection and explain default/inherited state | Channels/Activity owns delivery semantics |
| `agents.list[].systemPromptOverride`, workspace files | Agents | prompt/file preview, supported workspace file editor with save safeguards | Config/raw docs if broader editing is needed |
| `agents.list[].heartbeat`, `memorySearch`, `runtime`, `groupChat` | Mixed | show summary and safe links first; only expose deterministic narrow edits | Cron/Scheduler, Memory, Runtime/Config |
| `bindings[]` | Routing | impact preview and link to filtered routing rules; not full rule editor | Routing |
| sessions/transcripts | Chat/Sessions | counts and recent activity summary when real data exists | Chat/Sessions |

Alternative considered: duplicate every related module editor inside Agents. Rejected because it would create inconsistent logic and multiply write paths for the same config fields.

### D3: Protected system/default semantics are first-class product concepts

`main` is treated as a protected system/fallback agent because Gateway reserves it and rejects deletion. The configured default agent is the routing/default-resolution agent returned by `resolveDefaultAgentId()`. `session.mainKey` is a session-key alias and must not be displayed as if it were always the same thing as the agent id.

Product behavior:

- `main` delete is disabled in the UI and covered by tests.
- Gateway's delete rejection for `main` remains a backend safety net.
- Any future default-agent change must show routing and channel impact before save.
- If `main` is not the configured default, both badges must be visible and distinct.

Alternative considered: rely on Gateway error messages after the user clicks delete. Rejected because a control product should prevent obvious dangerous operations before submitting them.

### D4: High-impact edits use guarded flows

Identity edits can remain compact. Runtime-affecting edits use a guarded pattern:

1. Show current value, inherited/default source, and affected workflows.
2. Require an explicit edit action.
3. Validate using contract/BFF/Gateway capability.
4. Show a concise diff or impact summary before saving.
5. Preserve local edits on base-hash conflicts when the write path has config-hash semantics.

High-impact fields include workspace, agentDir, model, reasoning/fast mode, skills mode, subagents allowlist, tools/sandbox, eventStreams, systemPromptOverride, heartbeat, memorySearch, and runtime.

Alternative considered: keep all overview fields as inline inputs. Rejected because workspace/model/subagent/tools edits can change live agent behavior and external channel traffic.

### D5: BFF and contracts expose product DTOs, not raw config dumps

The frontend should consume product-shaped DTOs for the visible Agents workflows. Raw config fragments may still exist as advanced compatibility surfaces, but normal UI should prefer named fields such as protection flags, inherited source, available actions, impact counts, config hash, and unsupported/degraded reasons.

Potential DTO additions are allowed only when backed by real source truth, for example:

- `isMainProtected`
- `isConfiguredDefault`
- `defaultAgentId`
- `mainKey`
- `protectedReasons[]`
- `availableActions`
- `impact.bindings`
- `impact.workspaceFiles`
- `effectiveSource` for inherited values

Alternative considered: let each React section infer protection and inheritance from raw DTOs. Rejected because protection and product semantics must be consistent across frontend, tests, and BFF behavior.

### D6: Skills UI must scale beyond a toggle list

Per-agent skills belong in Agents because `agents.list[].skills` is a per-agent override. Skill installation, global skill health, and skill configuration remain in Skills.

Agents skills design:

- Support search and filters: assigned, unassigned, ineligible, source/category when available.
- Show mode semantics exactly as Gateway supports: current values are `all` and `whitelist`.
- Keep assigned skills easy to scan and bulk-manage.
- Show diff/save state before committing whitelist changes.
- Preserve ineligible skills as disabled rows with explanation.

Alternative considered: keep the existing linear toggle list. Rejected because it will fail once a workspace has many installed skills.

### D7: Subagent permission semantics must handle `*`

Gateway allows `subagents.allowAgents` to include `"*"`, meaning allow any agent. The product UI must represent this as a distinct "allow any" mode rather than treating `"*"` like a missing concrete agent id.

Alternative considered: keep row-level allowed booleans only. Rejected because row booleans cannot faithfully represent wildcard permission without additional mode state.

### D8: Real E2E uses isolated fixtures and negative safety checks

Real Gateway verification should use isolated test agent fixtures for safe create/delete. For protected system behavior, use negative checks:

- UI does not expose delete for `main`.
- Direct backend/Gateway delete attempt for `main` remains rejected.
- Disposable agent delete works and cleanup refuses non-fixture ids.

Alternative considered: skip real mutations entirely. Rejected because create/delete fixture safety already exists for run-id-scoped agents and is important evidence for the control plane.

### D9: OpenSpec product blueprint and design system are the visual authority

The implementation target is this OpenSpec product blueprint plus the current `frontend-new` design system. The existing handoff prototype remains useful for density, rhythm, and local interaction inspiration, but it is not a pixel-perfect authority for this productization pass.

Alternative considered: treat the existing prototype as the strict visual target. Rejected because the product goal has moved beyond prototype parity into a contract-backed enterprise control plane.

### D10: `main` is editable only through explicit protected-agent posture

`main` cannot be deleted. Identity fields may be editable because operators may need to name or brand the primary agent. Runtime-affecting fields for `main`, including workspace, model, skills, subagents, tools/sandbox, and event streams, must use guarded edit copy that explicitly says the change affects a protected system/fallback agent.

Alternative considered: make `main` completely read-only. Rejected because Gateway supports some updates and identity customization is useful. Alternative considered: treat `main` exactly like any other agent except delete. Rejected because it hides fallback-agent risk.

### D11: Model selection favors configured model choices

Create and runtime model edits should prefer configured model choices from Gateway/Deck model catalog surfaces, with an "inherit default" or blank state when no override is set. Freeform model input is a degraded fallback only when catalog data is unavailable, and it must be labeled as advanced/manual.

Alternative considered: use freeform model text by default. Rejected because it increases invalid model ids and undermines the control product's purpose.

### D12: Delete does not expose file/session deletion by default

This change does not expose a "delete workspace/session files" option in the normal delete confirmation. Delete should remove the agent config and bindings through the current safe path. File/session deletion can only be added if the implementation introduces an explicit Deck-facing `deleteFiles` contract, BFF support, focused tests, and fixture safety.

Alternative considered: expose Gateway `deleteFiles` immediately because the upstream delete params allow it. Rejected because this can damage real user workspaces and needs separate safety design.

## Target Product Blueprint

The Agents module target is an OpenClaw agent control plane. It is not a raw RPC demo and it is not a full replacement for Skills, Models, Routing, Subagents, Tools, Channels, Chat, or Sessions. The page should help an operator answer five questions quickly:

1. Which agents exist and which one is the configured operational default?
2. Which agent is protected system/fallback infrastructure (`main`)?
3. What behavior will this agent use at runtime: workspace, model, skills, subagents, tools/sandbox, prompt/files, event streams?
4. What else depends on this agent: bindings, sessions, active subagents, channel delivery?
5. Which changes are safe to make here, and which require guarded confirmation or a neighboring module?

### Information architecture

The product surface should use a dense operational structure rather than a marketing or card showcase layout.

| Area | Required behavior | Notes |
| --- | --- | --- |
| Module toolbar | Title, compact purpose copy, create action, search when list is visible, live connection/status affordance | Connection state must not conflict with global shell status; degraded status must be explainable. |
| List workbench | Search, client-side filter/sort, rows with name/id/model/workspace/status/binding/session hints, badges for configured default and protected `main` | Server-side list query/pagination stays out of scope until Gateway supports it. |
| Detail hero | Selected identity, immutable id, protected/default/session-main-key badges, model/workspace summary, counters, back action | `main`, configured default, and `session.mainKey` are separate concepts. |
| Section nav | Stable detail sections with keyboard support | Section count may change, but each section must have one responsibility. |
| Overview / identity | Normal edit for display name, emoji, avatar; immutable id; read-only protected/default explanation | Do not mix dangerous runtime fields into casual identity save. |
| Runtime / model | Model seed/override, fallbacks/reasoning/fast-mode summaries, inherited-source labels, guarded save | Models module owns provider/catalog management; Agents owns per-agent override selection. |
| Workspace | Workspace and agentDir summary, bootstrap/file impact, guarded edit | Workspace edit is visible but protected by explicit edit/impact confirmation. |
| Skills | Per-agent `all`/`whitelist` mode, searchable assigned/unassigned/ineligible inventory, diff-before-save | Skills module owns install/update/catalog. |
| Subagents | Allow-any vs explicit allowlist, model override, spawn-limit summary, narrowing-permission guard | Subagents module owns runtime monitoring and lineage. |
| Tools / sandbox | Resolved preview, risk explanation, global-vs-agent source labels | No edit controls unless a concrete Deck write contract exists. |
| Prompt / files | System prompt layer preview, supported workspace file list/get/set for allowed filenames | No arbitrary path editor. |
| Event streams / activity | Current event stream names, declared options plus unknown-preserved real names, save with base hash | Channels/Activity owns delivery semantics. |
| Routing impact | Binding count, affected route summaries when available, link/filter into Routing | Agents does not become the route editor. |
| Danger zone | Delete for non-main agents only, impact confirmation, fixture-safe cleanup rules for real E2E | `main` shows protected copy instead of a destructive button. Normal delete does not offer workspace/session file deletion. |

### Configuration field to UI decision matrix

Every visible control must map to this matrix or to a later handoff.

| Source truth | UI decision in this change | Write path / owner |
| --- | --- | --- |
| `agents.list[].id` | Show immutable id; no rename | Agents read-only identity |
| `agents.list[].name`, `identity.name`, `identity.emoji`, `identity.avatar` | Normal identity editor | `agents.update` via `PATCH /agents/{agentId}` |
| `agents.list[].default` | Show configured-default badge and impact; do not expose default switching in this pass | Follow-up with Routing/Channels impact design |
| reserved id `main` | Show protected-system badge; disable delete; allow identity edit; require protected-agent guarded copy for runtime fields | UI guard plus Gateway delete rejection |
| `session.mainKey` from `agents.list` result | Show as session routing metadata, not as agent identity | Read-only product DTO |
| `agents.list[].workspace` | Guarded edit with bootstrap/file/session impact copy | `agents.update` where supported |
| `agents.list[].agentDir` | Read-only or advanced guarded summary unless BFF exposes deterministic write | Agents / advanced config handoff |
| `agents.list[].model` | Optional model seed during create and guarded runtime edit after create; prefer configured model picker with inherited/default state | Gateway supports `agents.create/update` model; Deck contract must be fixed |
| model fallbacks / reasoning / fast mode | Show effective/inherited summary; edit only where current Deck/Gateway path is deterministic | Agents quick override; Models owns catalog/provider config |
| `agents.list[].skills` | Searchable assignment UI for `all`/`whitelist`; ineligible disabled | `deck.agents.skills.get/set` |
| `agents.list[].subagents.allowAgents` | Allow-any mode for `"*"`, explicit allowlist mode for ids | `deck.agents.subagents.get/set` |
| `agents.list[].subagents.model` | Guarded per-agent subagent model override | `deck.agents.subagents.set` |
| `agents.list[].subagents.requireAgentId` | Summary only unless write path is present | Subagents / future Agents advanced edit |
| `agents.list[].tools`, `agents.list[].sandbox` | Resolved preview and risk/source explanation | Tools/Approvals owns editing until write contract exists |
| `agents.list[].channels.eventStreams` | Editable declared + unknown-preserved stream list with base hash | `deck.agents.eventStreams.get/set` |
| `agents.list[].systemPromptOverride` | Resolved preview; direct edit only through supported workspace files or future contract | Prompt/files section |
| workspace files | List/get/set only Gateway-allowed filenames; not deleted by normal agent delete | `agents.files.list/get/set` |
| `heartbeat`, `memorySearch`, `runtime`, `groupChat`, `embeddedHarness`, `embeddedPi`, `params` | Summary/read-only/deferred unless deterministic product write exists | Owning module or future advanced config |
| `bindings[]` | Impact count and Routing link/filter | Routing owns edit |
| sessions/transcripts | Counts/activity summary only | Chat/Sessions owns deep management |

### Interaction flows

Create agent:

1. Step 1 captures name and visual identity (`name`, optional `emoji`, optional `avatar`).
2. Step 2 captures workspace with default-path explanation and optional model seed. Model seed should use configured choices when available and fall back to a clearly labeled advanced/manual input only when catalog data is unavailable.
3. Step 3 reviews the config mutation: new `agents.list[]` entry, workspace/bootstrap creation, optional model override.
4. Submit through `POST /agents` -> `agents.create`.
5. After create, route to the new detail page and present a setup checklist for skills, subagents, event streams, prompt/files, and routing. Skills/subagents/event streams are not bundled into the initial create payload.

Edit identity:

1. Normal save for name/emoji/avatar.
2. No impact dialog unless the edit changes a field with routing/runtime implications.

Edit runtime/workspace/model:

1. User opens an explicit edit affordance.
2. UI shows current value, inherited/default source, affected runtime behavior, and known risks.
3. Save through the contract-backed patch route.
4. Preserve dirty draft and show conflict state if the write path returns stale hash/conflict.

Edit skills:

1. User chooses `all` or `whitelist`.
2. Whitelist mode shows searchable assigned/unassigned/ineligible rows.
3. Save shows a concise diff and sends only Gateway-supported values.

Edit subagents:

1. User chooses allow-any or explicit allowlist.
2. Switching from allow-any to explicit list shows a narrowing-permission warning.
3. Save preserves base hash and wildcard semantics.

Delete agent:

1. `main` cannot enter delete confirmation.
2. Non-main delete confirmation shows bindings, configured-default/protected status, workspace/file/session impact, and removed-binding expectation.
3. Real E2E deletion uses only run-scoped fixture ids and cleanup refuses non-fixture ids.
4. Normal delete does not expose workspace/session file deletion. If file/session deletion is added later, it needs a separate contract-backed safety path.

### Mock and real validation state matrix

Mock visual validation proves layout, information architecture, interaction affordances, theme, i18n, and degraded data states. Real Gateway validation proves the contract chain and safe source behavior. They are both required and must be reported separately.

| State | Mock validation | Real validation |
| --- | --- | --- |
| ready list | selected/non-selected list, search/filter/sort, default and protected badges | `agents.list` returns real agents and default/mainKey metadata |
| protected `main` | delete absent/disabled, protected copy visible | direct delete attempt rejected through Gateway-backed path |
| non-main detail | every section reachable and interactive | `deck.agents.detail` and safe section reads succeed |
| create fixture | create wizard fields and review state | run-scoped disposable agent create succeeds |
| delete fixture | confirmation impact copy and fallback selection | run-scoped disposable agent delete succeeds |
| many skills | assigned-first/search/filter/ineligible UI | safe skills read succeeds; save may be fixture-only |
| wildcard subagents | allow-any mode visible and not rendered as zero allowed rows | safe subagents read preserves `"*"` / `allowAny` |
| unknown event streams | unknown real names displayed and preserved unless explicitly removed | event stream read preserves current names |
| tool/sandbox preview | preview-only copy, no fake editor | preview method returns or degrades with explainable error |
| prompt/files | supported filenames only, dirty/save/error states | list/get safe files; set only fixture-safe or manually approved |
| empty/error/degraded | empty, filtered-empty, request error, connection degraded | blocked environment captured with logs and circuit-breaker handoff |
| light/dark + zh/en | no layout overflow; text fits controls | manual/browser verification on running frontend |

## Risks / Trade-offs

- **Agents becomes too broad** -> Use the ownership matrix as a hard boundary; deep editors stay in owning modules.
- **DTO expansion duplicates config schema** -> Add only product DTOs needed by visible workflows; keep raw config advanced and documented as dynamic.
- **Protected/default semantics confuse users** -> Use distinct labels and helper copy: protected system agent, configured default agent, session main key.
- **Real Gateway fixtures mutate local state** -> Use isolated real-stack env and run-id-scoped fixtures; destructive cleanup must reject non-fixture ids.
- **Skills and subagents data lacks enough metadata** -> Implement search/filter around available fields first; record missing source/category metadata as follow-up.
- **Workspace edits can move or fork important files** -> Guard workspace edits and record any broad migration behavior as handoff if not already safely supported by Gateway.

## Migration Plan

1. Audit current Agents contracts, BFF routes, frontend wrappers, and UI sections against the ownership matrix.
2. Add product DTO/source fields only for deterministic protection, inheritance, action availability, and impact information.
3. Harden Go BFF/adapters where product DTOs require server-side normalization or safety checks.
4. Refactor Agents frontend around product sections and guarded flows without changing unrelated modules.
5. Add focused tests for protected `main`, wildcard subagents, model create drift, skills scaling behavior, and high-impact edit guards.
6. Add or update mock visual E2E states for protected/default agents, many skills, wildcard subagents, empty/error, dark/light, and English/Chinese.
7. Add real E2E for isolated fixture create/delete, direct `main` delete rejection, safe read sections, and navigation.
8. Run OpenSpec, contract, backend, frontend, mock, and bounded real verification before marking tasks complete.

Rollback: revert this change's implementation commit. Any contract changes must be additive where possible; generated artifacts and frontend consumers must roll back together.

## Open Questions

- Default-agent mutation is not part of this pass. This change shows configured default status and impact only; switching default requires a Routing/Channels impact design or a follow-up OpenSpec.
- Workspace path mutation is visible but guarded. If implementation cannot prove safe migration behavior from Gateway/BFF truth, it must remain guarded/read-only with a handoff rather than disappear silently.
- Per-agent tools/sandbox editing is preview-first in this pass. Edit controls are allowed only for a narrow field that has a concrete Deck write contract and focused tests.

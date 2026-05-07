## 1. Truth Mapping And Product Boundary

- [x] 1.1 Audit OpenClaw source truth for Agents: `AgentConfig`, default-agent resolution, `session.mainKey`, `bindings[]`, models, skills, subagents, tools/sandbox, workspace files, event streams, and Gateway methods; record source file evidence before code changes.
- [x] 1.2 Build an `openclaw.json` mutation and ownership ledger for the Agents page: each create/update/delete/preview/navigation affordance must map to a config domain, owning module, Gateway/BFF route, UI pattern, risk level, and verification check.
- [x] 1.3 Reconcile the implementation target with the design blueprint's information architecture: list workbench, detail hero, section nav, identity, runtime/model/workspace, skills, subagents, tools/sandbox, prompt/files, event streams/activity, routing impact, and danger zone.
- [x] 1.4 Classify cross-module surfaces as Agents-owned edit, guarded per-agent quick edit, read-only impact, owning-module navigation, or deferred handoff; remove or downgrade any UI concept that cannot be backed by Gateway/BFF truth.
- [x] 1.5 Compare the current frontend implementation, mock fixtures, latest Agents high-fidelity prototype, and enterprise-v2 exploration against the ownership ledger; document prototype-only or unsupported fields as handoff rather than implementing them as fake controls.
- [x] 1.6 Lock visual authority in the implementation note: this OpenSpec product blueprint plus `frontend-new` design system outrank prototype pixel parity; the prototype is density/rhythm/reference only.
- [x] 1.7 Produce a short implementation preflight note in the change evidence or implementation report that lists every intentional divergence from the current production UI and handoff prototype.

## 2. Contracts And Backend Control Surface

- [x] 2.1 Update Deck-facing Agents DTOs only for deterministic product semantics: protected `main`, configured default, `session.mainKey`, inherited/effective sources, available actions, impact counts, unsupported reasons, and guarded edit metadata.
- [x] 2.2 Fix known create-agent contract drift: optional `model` is supported by Gateway and BFF, so the Deck API contract, generated TS/Go DTOs, frontend request type, and create request builder must support it consistently before the create UI exposes a model seed.
- [x] 2.3 Normalize BFF/runtime adapters for `main` protection, configured-default status, routing binding impact, workspace/file impact, wildcard subagent permission, skills eligibility, and event-stream preservation.
- [x] 2.4 Add backend or adapter tests proving protected `main` deletion is rejected, non-main fixture deletion remains possible, product DTO fields are stable, and wildcard/event-stream semantics are not lost during normalization.
- [x] 2.5 Regenerate and verify generated contract artifacts after source DTO changes; do not hand-edit generated files.

## 3. Agents Frontend Product Implementation

- [x] 3.1 Refactor the Agents page around product sections derived from the ownership ledger: overview, identity/lifecycle, runtime/model posture, skills, subagents, tools/sandbox preview, prompt/files, routing impact, activity, and danger zone.
- [x] 3.2 Implement protected system-agent behavior: `main` shows protected copy, cannot trigger a delete API call, can edit identity normally, and uses protected-system-agent guarded copy for workspace/model/skills/subagents/tools/event-stream edits.
- [x] 3.3 Implement create flow as identity -> workspace/model seed -> review -> created detail: submit name, optional emoji/avatar, optional workspace, and optional model only after contract drift is fixed; model seed should prefer configured model choices with inherit/default state and use freeform only as an advanced fallback.
- [x] 3.4 Implement safe identity edit separately from guarded runtime edits so name/emoji/avatar can save normally while workspace/model/runtime-impact fields require explicit edit and impact review.
- [x] 3.5 Implement guarded edit flows for high-impact fields such as workspace, agent directory, model/runtime defaults, skills mode, subagent allowlist, tools/sandbox, event streams, system prompt, heartbeat, memory search, and runtime posture.
- [x] 3.6 Keep configured-default mutation read-only in this pass: show status and impact, but do not expose a default-switch save path.
- [x] 3.7 Implement delete confirmation for non-main agents with known impact: bindings, default/protected status, workspace/files/session impact, no normal workspace/session deletion option, and explicit fixture-safe cleanup assumptions for real E2E.
- [x] 3.8 Replace the raw skills toggle list with a scale-friendly per-agent assignment UI: search/filter, assigned-first scanning, ineligible disabled rows, exact `all`/`whitelist` Gateway value mapping, and diff-before-save behavior.
- [x] 3.9 Represent subagent `allowAgents: ["*"]` as an allow-any mode, and guard any switch from wildcard to explicit allowlist as a narrowing permission change.
- [x] 3.10 Ensure preview-only surfaces do not imply unsupported editing: tool policy, sandbox, resolved system prompt, workspace files, event streams, bindings, sessions, and activity must show editable controls only when a write path exists.
- [x] 3.11 Keep cross-module entry points self-consistent: related Skills, Models, Subagents, Routing, Tools/Approvals, Channels, Sessions, and Activity links must preserve ownership and avoid duplicate editors for the same config domain.
- [x] 3.12 Update i18n, theme behavior, responsive layout, empty/loading/error states, and design-system tokens so the Agents page remains usable in Chinese/English and light/dark modes.

## 4. Focused Frontend And Mock Verification

- [x] 4.1 Add or update focused frontend tests for `main` delete suppression, create payload shape, high-impact guarded save flows, ineligible skills, wildcard subagents, unknown event-stream preservation, and cross-module navigation affordances.
- [x] 4.2 Extend mock Agents fixtures to include protected `main`, non-main configured default, many skills, ineligible skills, wildcard subagents, routing bindings, unknown event streams, empty state, and error state.
- [x] 4.3 Run mock visual E2E for Agents in ready list, selected non-main detail, protected-main detail, create wizard review, many-skills, wildcard-subagents, delete-confirmation, unknown event streams, empty/error, light/dark, and Chinese/English states; capture evidence and label it as mock-only visual proof.
- [x] 4.4 Use Playwright against the hot-reload frontend to verify navigation into Agents, section interaction, dialogs, guarded saves, theme/language switching, and absence of obvious layout overflow.

## 5. Real Gateway Verification

- [x] 5.1 Prepare or reuse the isolated real E2E environment by copying global OpenClaw config and workspace into test-scoped paths; never mutate the user's global `openclaw.json` or workspace during verification.
- [x] 5.2 Seed run-scoped disposable agent fixtures through Gateway/BFF paths or isolated config edits; fixture names must be unique and cleanup must reject non-fixture ids.
- [x] 5.3 Run real Gateway read coverage for Agents list/detail, protected/default labels, skills/subagents/event-stream reads, routing impact summaries, and prompt/file previews where the current Gateway supports them.
- [x] 5.4 Run real Gateway mutation coverage for create, safe update, and delete using disposable non-main fixture agents only.
- [x] 5.5 Run negative real verification that direct delete of `main` is rejected by the Gateway-backed path and that the frontend never submits that request.
- [x] 5.6 If real verification is blocked by environment instability after two evidence-producing attempts, record the blocker, logs, attempted commands, and remaining risk in this change before proceeding; code-level and mock verification must still pass.

## 6. Closure Gates

- [x] 6.1 Run `openspec validate deck-go-agents-product-control-plane --strict` and fix every spec/task formatting issue before implementation is considered complete.
- [x] 6.2 Run relevant contract gates, including generated contract checks and protocol checks for any touched contract surface.
- [x] 6.3 Run relevant Go backend tests for touched BFF/runtime adapters.
- [x] 6.4 Run relevant frontend unit/component tests and the frontend build for `frontend-new`.
- [x] 6.5 Run Agents mock visual verification and bounded real Gateway verification, or record the approved circuit-breaker handoff with evidence.
- [x] 6.6 Update task checkboxes only after each task has implementation evidence, command output evidence, or an explicit handoff with reason.
- [x] 6.7 Produce an implementation report listing changed files, contract-chain decisions, product-design decisions, verification evidence, deferred handoffs, and archive readiness.

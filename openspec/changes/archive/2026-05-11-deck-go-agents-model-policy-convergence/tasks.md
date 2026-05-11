## 1. Truth Mapping And Proposal Preflight

- [x] 1.1 Re-read OpenClaw config/model truth before code changes: `AgentModelConfig`, `AgentDefaultsConfig`, `AgentConfig`, zod schemas, Gateway deck agents methods, Models usage-policy overview, and the Models handoff follow-up.
- [x] 1.2 Produce an implementation evidence note listing supported editable policy targets, unsupported/read-only model-like fields, current DTO gaps, and intended UI placement.
- [x] 1.3 Confirm no Models-page raw editor or Models-owned policy edit is reintroduced by this change.

## 2. Gateway Protocol And OpenClaw Deck Methods

- [x] 2.1 Add Gateway protocol schemas and method definitions for `deck.agents.modelPolicy.get` and `deck.agents.modelPolicy.set`, including normalized selection, supported target kind/key, config path, source, shape, unavailable refs, configured choices, and config hash.
- [x] 2.2 Implement Gateway deck model-policy read logic that normalizes string and object `AgentModelConfig`, preserves fallback ordering, resolves per-agent inheritance, identifies unavailable refs from configured model assets, and excludes unsupported fields from editable targets.
- [x] 2.3 Implement Gateway deck model-policy write logic with base-hash validation, bounded target validation, clear/inherit behavior, minimal config updates, string-only target handling, and unsupported-target rejection.
- [x] 2.4 Add focused Gateway tests for supported global defaults, per-agent inherit/override/clear, subagent default and per-agent policies, unavailable refs, string-only fields, base-hash conflicts, and unsupported target rejection.
- [x] 2.5 Regenerate Gateway protocol TS/Go artifacts and verify the protocol check for touched surfaces.

## 3. Deck-Go Contract And Go BFF Chain

- [x] 3.1 Update Deck-facing contract source, endpoint metadata, route governance, and mutation evidence for model-policy get/set actions.
- [x] 3.2 Regenerate Deck-facing TS and Go DTOs from contract sources and keep generated artifacts synchronized.
- [x] 3.3 Add Go BFF wrappers under `/deck/agents` for `modelPolicy.get` and `modelPolicy.set`, forwarding through generated typed Gateway bindings and preserving error/status behavior.
- [x] 3.4 Add or update Go backend tests proving BFF forwarding, invalid action/params handling, base-hash conflict propagation, and no raw config write path in the normal model-policy workflow.

## 4. Frontend Data And Product UI

- [x] 4.1 Add frontend API facades and Data Fabric query/mutation hooks for Agents model policy.
- [x] 4.2 Refactor Agents runtime/model UI to use model-policy DTOs instead of single-string `draft.model` as the only source of truth.
- [x] 4.3 Implement global role default policy UI for supported roles with configured-model picker, primary/fallback or primary-only controls according to target shape, unavailable refs, and owner links to Models.
- [x] 4.4 Implement per-agent model policy UI for inherit/default, explicit override, fallback ordering, unavailable refs, clear override, and guarded save.
- [x] 4.5 Implement per-agent subagent model policy UI that preserves inheritance from `agents.defaults.subagents.model` and does not conflict with the existing subagent allowlist editor.
- [x] 4.6 Add guarded copy and confirmation for `main` and other high-impact model policy saves, including conflict/degraded states that preserve local drafts.
- [x] 4.7 Update i18n, theme/responsive styling, empty/loading/error states, and related handoff docs.

## 5. Frontend And Mock Verification

- [x] 5.1 Add focused frontend tests for inherit/override/clear, fallback ordering, unavailable refs, string-only targets, empty configured choices, protected `main`, and conflict draft preservation.
- [x] 5.2 Update mock Gateway fixtures for model-policy get/set, including supported roles, per-agent overrides, unavailable refs, and base-hash conflict responses.
- [x] 5.3 Run Agents-focused frontend tests and frontend build.
- [x] 5.4 Run mock E2E for Agents model-policy states in light/dark and Chinese/English where practical, and record mock evidence as visual/product proof only.

## 6. Real Gateway Verification

- [x] 6.1 Verify the isolated real-stack config/workspace is used before real mutation tests; do not mutate the user's global config/workspace.
- [x] 6.2 Run bounded real Gateway read coverage for model-policy get on existing agents/defaults.
- [x] 6.3 Run bounded reversible real Gateway mutation coverage using fixture-safe policy targets and restore original values afterward.
- [x] 6.4 Run negative real verification for stale base-hash or unsupported target behavior.
- [x] 6.5 If real verification is blocked after evidence-producing attempts, record logs, attempted commands, affected scenarios, and remaining risk in the change.

## 7. Closure

- [x] 7.1 Update `openspec/follow-ups/2026-05-09-agents-model-policy-redesign-handoff.md` to promoted/resolved, or split remaining unsupported fields into dated follow-ups with fact evidence.
- [x] 7.2 Run `openspec validate deck-go-agents-model-policy-convergence --type change --strict` and fix every issue.
- [x] 7.3 Run relevant accepted spec validation after archive candidates are ready.
- [x] 7.4 Update tasks only after fresh evidence exists for each checkbox.
- [x] 7.5 Produce a final implementation report with changed files, contract-chain decisions, product-design decisions, verification evidence, deferred handoffs, and archive readiness.

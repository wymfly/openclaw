## Context

deck-go has completed a broad frontend-new module rewrite and real-contract verification pass. The resulting evidence is useful but dispersed across archived OpenSpec changes, module implementation notes, generated contracts, BFF routes, frontend facades, mock visual E2E tests, and real Gateway E2E tests. Many remaining items are not simple frontend defects; they are contract-chain questions about whether a capability is Gateway-backed, Deck-derived, Deck-local, or unsupported until a new contract exists.

This change is intentionally a head change. It creates the audit and real E2E foundation that later hardening/product proposals can depend on. It does not try to resolve every module gap in one pass.

## Goals / Non-Goals

**Goals:**

- Build a canonical, code-grounded contract-chain audit matrix for deck-go modules and capabilities.
- Establish a stable classification vocabulary for capability truth: `gateway-backed`, `deck-derived`, `deck-local`, and `unsupported-needs-contract`.
- Create an isolated real E2E environment strategy that copies OpenClaw configuration and workspace data into a temporary test root.
- Seed real E2E with the configured `cpa` channel and `main` agent so sessions, activity, logs, usage, docs, and related panels can verify real data instead of only route shape.
- Define disposable fixture lifecycle rules for safe write-path verification.
- Produce a follow-up decision index for P0 hardening, platform-control contracts, module-specific contracts, and deferred design-system/dependency work.
- Fix deterministic, low-risk drift found while creating the audit when the source of truth is clear.

**Non-Goals:**

- Do not implement every P0 hardening item in this head change.
- Do not add production-only test routes such as `/api/e2e/*`.
- Do not mutate the user's real OpenClaw configuration or workspace during real E2E.
- Do not extract or refactor design-system patterns unless required for the audit or test foundation.
- Do not add frontend dependencies such as CodeMirror, Recharts, virtualization, or form libraries.
- Do not turn prototype-only product ideas into active UI claims without a matching contract.

## Decisions

### Decision: Use a code-grounded audit matrix rather than a manually maintained state document

The audit matrix SHALL cite the code and generated artifacts that prove each capability path. It may live as a generated or refreshable project artifact, but it must state that code, contracts, and tests are the authority when the matrix drifts.

Alternative rejected: Maintain a narrative `current-state.md` as the main source of truth. That repeats the earlier drift problem and encourages humans to update prose instead of checking the contract chain.

### Decision: Classify capabilities by source of truth

Every capability row SHALL use one of four primary classes:

- `gateway-backed`: Gateway is the fact or execution source.
- `deck-derived`: Deck derives a control-plane view from Gateway/runtime/event data.
- `deck-local`: Deck owns the state locally.
- `unsupported-needs-contract`: The UI/prototype idea lacks a sufficient Deck/Gateway contract.

This avoids mixing "enterprise control product value" with "Gateway already supports this exact behavior."

### Decision: Use isolated real E2E roots instead of production test endpoints

Real E2E SHALL copy configuration and workspace state into a temporary run root. Tests exercise normal Deck/Gateway contracts against that isolated root. This protects operator state without adding product API surface solely for tests.

Alternative rejected: Add production `/api/e2e/*` routes. They would be convenient, but they pollute product boundaries and risk bypassing the same contract chain the UI must prove.

### Decision: Seed once, reuse across modules

The first real seed SHALL use the configured `cpa` channel and `main` agent to create a real chat/session. Module-specific fixtures can then derive from that run or create run-id-scoped resources. This is more useful than each module trying to fabricate data independently.

### Decision: Keep ambiguous product capabilities as follow-up index items

If a capability gap depends on product policy or Gateway evolution, this change records it in a decision index instead of forcing an implementation. Examples include audit history, live subscriptions, server-side pagination, webhook retry, budget forecast, node command schemas, and channel throughput.

### Decision: Treat this change as the OpenSpec proposal matrix head

The contract-chain guide clarified that deck-go needs multiple implementation changes, not one broad "make contracts better" change. This head change SHALL become the matrix/index for those future changes. The implementation sequence is:

1. Finish the audit matrix and real E2E foundation in this head change.
2. Use the matrix to open focused follow-up OpenSpec changes.
3. Let each follow-up change own one hardening lane, one platform-control contract lane, or one module/product lane.

Alternative rejected: create all follow-up changes immediately before the audit matrix exists. That would duplicate uncertain assumptions across many proposals and make it hard to keep Gateway truth, Deck BFF truth, and frontend truth aligned.

### Decision: Execute the matrix in dependency order after the head change is apply-ready

Goal-mode execution SHALL treat this head change as the root program plan. The expected execution order is:

1. Implement this head change first: audit matrix schema/artifacts, isolated real E2E seed foundation, evidence statuses, deterministic P0 repairs found during matrix construction, and refreshed proposal matrix.
2. Create follow-up OpenSpec changes only when the audit matrix has enough evidence to define their scope, acceptance criteria, and dependencies.
3. Implement follow-up changes in dependency order:
   - Wave 1 P0 contract hardening before broad module/product completion.
   - Wave 2 real E2E evidence infrastructure before requiring module-specific real evidence.
   - Wave 3 platform-control contracts before module features that depend on shared audit/history/live/list/mutation semantics.
   - Wave 4 module/product completion after relevant P0 and platform prerequisites are clear.
   - Wave 5 design-system/dependency extraction last unless a dependency is required for a preceding accepted contract.
4. Archive each follow-up change independently after its tasks, validation, and evidence are complete.
5. Keep the head matrix updated as child proposals are created, implemented, archived, or deferred.

The head change is complete only when it can hand off an evidence-backed matrix and proposal queue. The entire matrix program is complete only after the generated follow-up changes that remain in scope are implemented or explicitly deferred with reasons.

### Decision: Preserve head proposal rules across compaction and resume

During goal-mode execution, this head proposal and its implementation rules are persistent context. Every resumed or compacted session SHALL reload the head proposal artifacts before making implementation decisions:

- `proposal.md`
- `design.md`
- `tasks.md`
- `specs/**/*.md`
- `verification.yaml`
- the current audit matrix artifacts once they exist

The agent SHALL NOT rely on memory alone after compaction. If a future session is unsure about scope, order, or authority, it must re-read the head proposal and matrix before creating child proposals, implementing fixes, or marking tasks complete.

### Decision: Explore before deciding or implementing unclear contract-chain work

When implementation encounters unclear Gateway support, unclear Deck-facing product design, unclear source authority, stale generated artifacts, or ambiguous evidence, the agent SHALL explore first and only then decide or implement.

Required exploration can include:

- Gateway method/event/schema source and runtime `gateway.describe` evidence;
- Deck-facing contract source and generated TS/Go artifacts;
- Go adapter/BFF route ownership;
- frontend-new facade and panel consumption;
- mock/real E2E evidence;
- archived module implementation notes and OpenSpec history.

The agent may directly fix deterministic P0 drift after exploration proves code truth, source authority, and verification path. If exploration shows a product, UX, dependency, persistence, retention, or Gateway-evolution decision, the agent SHALL record it in the matrix and create or update the appropriate follow-up proposal instead of guessing.

### Decision: Store the canonical audit as JSON plus generated Markdown

The canonical audit matrix SHALL be machine-readable JSON with stable IDs and evidence fields. A generated Markdown report SHALL be produced for human review. Markdown-only is not enough because future gates need to validate stale route, DTO, method, and evidence references.

Minimum matrix fields:

- `id`
- `module`
- `capability`
- `productRole`
- `coreWorkflow`
- `classification`
- `gatewaySupportBasis`
- `gatewaySource`
- `deckSource`
- `goAdapter`
- `bffEndpoint`
- `contractSource`
- `generatedArtifacts`
- `frontendFacade`
- `panelSurface`
- `mockEvidence`
- `realEvidence`
- `status`
- `gap`
- `followUpChange`

The matrix must explain both sides of each capability: what Gateway already supports, and what product-level control experience deck-go exposes from that support.

### Decision: Deck-facing contracts are product-level adaptations, not Gateway migrations

The main purpose of contract-chain work is to make every deck-go control module implement concrete product functionality from a clear source of truth. The chain should prevent both missing core functions and unsupported over-design.

Gateway remains the capability authority, but Deck-facing contracts are not a mechanical migration of Gateway RPCs. deck-go SHALL design product-level contracts for frontend consumption by adapting Gateway-supported facts and actions into control-oriented DTOs, endpoints, streams, metadata, and workflows.

This is especially important for related modules such as chat, models, agents, sessions, and skills. Gateway contracts reveal what is possible, but they do not by themselves define the best product grouping, user workflow, empty states, cross-module relationships, or frontend data shape. The audit matrix and follow-up proposals SHALL therefore record:

- the existing Gateway support basis;
- the product role of the Deck-facing capability;
- the core workflow it enables;
- the Deck-facing contract that exposes it cleanly to `frontend-new`;
- any unsupported product idea that must be hidden, degraded, or indexed for later validation.

The goal of the proposal matrix is a full convergence from existing Gateway contracts to a clean, robust, product-designed deck-go control surface.

### Decision: Separate P0 contract hardening from product-control expansion

Contract hardening and product expansion are different risk classes:

- P0 hardening fixes contract truth, schema completeness, generated artifacts, route classification, dynamic exceptions, and write safety.
- Platform-control expansion adds enterprise control capabilities such as audit history, live subscriptions, list query contracts, and safe mutation evidence.
- Module/product changes complete specific control surfaces such as webhooks retry, budget forecast, node command schemas, and docs search.

The follow-up proposal matrix SHALL keep these lanes separate so a product feature cannot hide a contract-chain defect, and a contract hardening change does not accidentally redesign UI scope.

### Decision: Gateway truth first, without adding new Gateway APIs by default

When the audit matrix finds an incomplete contract for a control-side capability, the default decision rule is Gateway truth first:

1. If the capability maps to an existing Gateway fact, method, event, or behavior, deck-go SHALL first use the existing Gateway contract as the authority.
2. If the existing Gateway contract is incomplete, deck-go SHALL harden the contract chain around the existing surface: schema completeness checks, generated bindings, Deck-facing DTOs, BFF route governance, exception records, and real E2E evidence.
3. This head change and its immediate follow-ups SHALL NOT assume new Gateway API/method/event additions as the default solution.
4. Product ideas that cannot be backed by existing Gateway contracts or Deck-owned state SHALL be classified as `unsupported-needs-contract`, degraded, hidden, or recorded for later proposal instead of being presented as finished UI capability.

This does not forbid future Gateway evolution, but new Gateway API design is outside the default scope for this program unless the user explicitly approves a separate Gateway evolution proposal.

### Decision: Unsupported UI claims are hidden, degraded, or indexed until real validation

When the audit matrix finds a frontend or handoff prototype capability that is not supported by existing Gateway contracts or Deck-owned state, the default behavior is:

1. Do not present the capability as complete or operational in `frontend-new`.
2. Prefer hiding the capability or degrading it to the strongest behavior supported by current Gateway contracts.
3. If the capability is important for product comprehension, it may remain as an explicit disabled or unavailable state only when the contract metadata, implementation notes, or audit matrix marks it as `unsupported-needs-contract`.
4. Add valuable unsupported capabilities to the follow-up proposal matrix instead of implementing mock-backed UI.

After real E2E is available, the user will manually validate each module and decide whether handoff-derived product ideas should be iterated, deferred, removed, or promoted into a future Gateway-source evolution proposal. Gateway-source evolution decisions must consider future OpenClaw upstream merge cost, so this program does not promote unsupported UI claims into Gateway changes automatically.

### Decision: Deterministic P0 drift may be fixed directly during the head change

When the audit matrix finds a deterministic P0 contract-chain problem, Codex may fix it directly inside this head change instead of opening a follow-up proposal first.

Direct fixes are allowed when all of these are true:

- The code truth is clear and the fix follows existing Gateway or deck-go contracts.
- The change does not add new Gateway API/method/event surface.
- The change does not make a product policy decision on behalf of the user.
- The affected source authority is known, such as contract source, generator, adapter, BFF route governance, frontend facade, or test evidence.
- The fix can be verified with focused contract checks, tests, or real/mock E2E evidence.

If a finding requires a new product capability, a new Gateway API, a persistence/retention policy, a new dependency, or a materially different UX promise, it SHALL remain in the follow-up proposal matrix rather than being fixed opportunistically.

### Decision: Real E2E minimum gate is the `cpa` + `main` seed

The minimum real E2E gate for this head change is a successful isolated seed using the configured `cpa` channel and `main` agent. Code-level verification remains the primary proof for contract-chain correctness. The head change SHALL NOT require every module to pass a full real Gateway fixture flow before implementation can continue.

Module-specific real Gateway checks may be added when cheap and safe, but they are supporting evidence, not the universal completion gate. Final product confidence comes from:

- code-level contract, adapter, facade, and test verification;
- one successful isolated real seed proving deck-go can connect to the real Gateway path;
- the user's later manual module-by-module validation after services and E2E evidence are available.

Writable module fixture evidence remains useful for later follow-up changes, but it is not required as the minimum gate for this head change.

This accepts the risk that some module-level real Gateway defects may surface only during later manual validation. To keep that risk visible, the audit matrix SHALL record a `realEvidenceStatus` per module/capability using at least:

- `not-run`
- `seed-covered`
- `read-path-checked`
- `fixture-checked`
- `blocked`

The matrix must not treat `seed-covered` as equivalent to module-specific real verification.

## Brainstorm: Undecided Problem Areas

The contract-chain guide changes several former open questions into concrete decision spaces:

### 1. Gateway protocol truth

Problem: deck-go currently generates Gateway TS/Go clients from static Gateway metadata, while real E2E needs runtime `gateway.describe` evidence. These are related but not identical.

Decision direction:

- Static generated artifacts remain the compile-time contract.
- Runtime `gateway.describe` becomes the real-environment evidence contract.
- Follow-up hardening should compare static typed coverage and runtime describe coverage.
- Do not add new Gateway methods in this lane by default; first prove and harden what the current Gateway already exposes.

Open risk:

- Some methods can be "typed" because they have params or result, while still lacking a complete result schema. The matrix must track schema completeness, not just membership in `TypedMethodNames`.

### 2. Untyped Gateway methods

Problem: eight upstream Gateway methods are intentionally dynamic today.

Decision direction:

- Keep them usable through documented exceptions in the short term.
- Convert each one either to a schema/DTO over the existing Gateway surface or a Deck-facing DTO. New Gateway methods are not the default answer.
- Prioritize read-heavy UI surfaces first: tools, logs, commands, approvals, and node actions.

Open risk:

- For node dynamic actions, a single rigid schema may be wrong. A typed outer envelope with dynamic action-specific payloads may be the better first contract.

### 3. Deck-facing DTO boundary

Problem: frontend-new no longer has missing generated DTO aliases, but broad `Record<string, unknown>` / `unknown` leaves still exist in source DTOs and Go adapters.

Decision direction:

- Do not block UI on every dynamic leaf.
- Require every stable UI claim to map to a named DTO field or documented dynamic exception.
- For dashboard-critical data, prefer typed DTOs over frontend-local normalization.

Open risk:

- Some dynamic leaves are legitimate extension/plugin surfaces. The audit must distinguish "safe extension envelope" from "missing contract".

### 4. BFF route classification

Problem: endpoint classification exists and currently has no unclassified registrations, but classification alone does not prove the route is product-correct or real-E2E verified.

Decision direction:

- Keep endpoint classification as governance, not proof of correctness.
- Add audit rows linking BFF routes to source truth, DTOs, frontend facades, and E2E evidence.

Open risk:

- Legacy `/api/*` BFF routes and newer `/api/v1/runtimes/*` routes can overlap conceptually. The matrix must make ownership explicit.

### 5. Real E2E safety

Problem: the control product must validate against real Gateway, but tests must not mutate the user's real OpenClaw state.

Decision direction:

- Use an isolated copied config/workspace root.
- Seed with `cpa` + `main` only inside that root.
- Use run-id-scoped disposable fixtures and cleanup.
- Record `passed`, `degraded`, `empty-valid`, or `handoff-blocked` evidence.

Open risk:

- Some resources cannot be safely created/deleted even in copied state if they touch external accounts or devices. Those stay skipped-safe until explicitly contracted.

### 6. Platform-control product capabilities

Problem: enterprise control needs capabilities that are not necessarily native Gateway RPCs, such as audit history, safe mutation evidence, live projections, list querying, and operational history.

Decision direction:

- Treat them as deck-go platform-control contracts, not as proof that Gateway already supports the full product behavior.
- Build them on top of Gateway events/RPCs when available, but make deck-go ownership explicit.

Open risk:

- These capabilities can become too broad. Each proposal needs exact module consumers and storage/retention rules.

### 7. Module-specific product gaps

Problem: high-fidelity prototypes include product ideas whose backing contracts vary by module.

Decision direction:

- If Gateway already supports it, classify as `gateway-backed` and wire through typed contracts.
- If deck-go derives it, classify as `deck-derived` and define projection/storage semantics.
- If deck-go owns it, classify as `deck-local` and define persistence, mutation, and cleanup.
- If none of the above is true, classify as `unsupported-needs-contract` and create a follow-up proposal instead of pretending it works.

Open risk:

- UI can make unsupported ideas look finished. Mock E2E must not be accepted as real contract evidence.

## OpenSpec Proposal Matrix

This matrix is the proposed backlog for completing the contract chain and control-side product capability set. Names are intentionally specific so each change can be implemented, validated, and archived independently.

### Wave 0: Foundation

| Change                                                 | Priority | Purpose                                                                                                 | Depends On | Notes                                                         |
| ------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------- |
| `deck-go-contract-chain-audit-and-real-e2e-foundation` | P0       | Build audit matrix, isolated real E2E root, `cpa` + `main` seed, fixture lifecycle, and follow-up index | None       | Current head change. It should not implement every follow-up. |

### Wave 1: Contract Hardening

| Proposed Change                                    | Priority | Decision                                                                                                                                 | Scope                                                                                                                                                 | Exit Criteria                                                                                                           |
| -------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `deck-go-gateway-describe-and-schema-completeness` | P0       | Compare static generated method/event coverage with runtime `gateway.describe`; distinguish typed membership from complete result schema | Gateway metadata, generated allowlists, contract inventory, describe smoke                                                                            | Audit reports method/schema completeness; regressions fail contract gate or focused check                               |
| `deck-go-untyped-gateway-method-hardening`         | P0       | Resolve or narrow the eight untyped Gateway exceptions                                                                                   | `tools.catalog`, `tools.effective`, `exec.approval.list`, `plugin.approval.list`, `logs.tail`, `commands.list`, `node.invoke`, `node.pending.enqueue` | Each method has upstream schema, Deck-facing DTO, or a narrowed typed envelope with a documented remaining dynamic leaf |
| `deck-go-deck-api-dynamic-surface-hardening`       | P0       | Reduce broad `unknown` / `Record<string, unknown>` surfaces that feed stable UI claims                                                   | `deck-api.contract.ts`, Go generated DTOs, frontend facade normalization                                                                              | Stable displayed fields are typed or documented exceptions; generated TS/Go artifacts stay in sync                      |
| `deck-go-bff-route-contract-governance`            | P0       | Make BFF route ownership and endpoint classification enforceable beyond "registered or not"                                              | `/api/*`, `/api/v1/runtimes/*`, endpoint classification, frontend callers                                                                             | Route rows link to owner, DTO/stream/exception, facade, and evidence; stale or orphan rows fail checks                  |
| `deck-go-config-write-safety-contracts`            | P0       | Define safe mutation semantics for config-like writes                                                                                    | config, agents, models, routing, identity, skills, runtime settings                                                                                   | Writes have base-hash/idempotency/error contracts; conflict and rollback behavior are tested                            |

### Wave 2: Real E2E And Evidence

| Proposed Change                                   | Priority | Decision                                                                       | Scope                                                 | Exit Criteria                                                                                           |
| ------------------------------------------------- | -------- | ------------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `deck-go-real-e2e-seed-and-evidence`              | P0       | Turn isolated `cpa` + `main` seed into repeatable evidence used by modules     | chat/session/activity/logs/usage/gateway describe     | One seed run records machine-readable evidence without mutating real user state                         |
| `deck-go-real-e2e-fixture-library`                | P1       | Provide safe disposable fixture helpers for writable modules                   | agents, cron, budget, alerts, webhooks, routing, docs | Helpers create run-id-scoped resources and cleanup only those resources                                 |
| `deck-go-real-e2e-reporting-and-circuit-breakers` | P1       | Standardize `passed` / `degraded` / `empty-valid` / `handoff-blocked` evidence | Playwright, scripts, evidence artifacts               | Real E2E failures produce actionable handoff records instead of blocking unrelated modules indefinitely |

### Wave 3: Platform-Control Contracts

| Proposed Change                                 | Priority | Decision                                                             | Scope                                                           | Exit Criteria                                                                                     |
| ----------------------------------------------- | -------- | -------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `deck-go-control-audit-history-contract`        | P1       | Add an explicit audit/history model for control-side changes         | agents/config/models/routing/identity/budget/webhooks/alerts    | Mutations emit audit entries with actor, target, before/after summary, result, and retention rule |
| `deck-go-live-projection-subscription-contract` | P1       | Define live update semantics for control panels                      | SSE streams, projection gaps, refresh rules                     | Panels know when to subscribe, refresh, or show gap recovery                                      |
| `deck-go-list-query-contracts`                  | P1       | Standardize server-side list/search/filter/sort/pagination contracts | sessions, logs, usage, docs, webhooks, activity, plugins/skills | List endpoints share cursor/filter semantics and frontend facade helpers                          |
| `deck-go-safe-mutation-evidence-contract`       | P1       | Make write operations auditable and testable                         | create/update/delete actions across modules                     | Mutations return consistent requestId/result/error/conflict evidence                              |

### Wave 4: Module/Product Completion

| Proposed Change                                        | Priority | Classification Bias                                      | Scope                                                        | Exit Criteria                                                                                          |
| ------------------------------------------------------ | -------- | -------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `deck-go-agents-control-contract-completion`           | P1       | mixed: gateway-backed + deck-derived                     | agents, tools, skills, files, prompt/tool previews, health   | Agents panel claims map to typed Gateway/Deck DTOs and real evidence                                   |
| `deck-go-sessions-chat-contract-completion`            | P1       | gateway-backed + deck-derived                            | chat, sessions, compaction, timeline, live messages          | Chat/session data, actions, stream updates, and history have real E2E evidence                         |
| `deck-go-models-providers-contract-completion`         | P1       | gateway-backed + deck-derived                            | configured models, provider auth, catalog, probes            | Provider/model states are typed and real-Gateway verified                                              |
| `deck-go-channels-control-contract-completion`         | P1       | gateway-backed + unsupported-needs-contract              | status, logout, test, throughput, per-channel config         | Throughput/product-only claims are contracted or explicitly removed/deferred                           |
| `deck-go-approvals-permissions-contract-completion`    | P1       | gateway-backed + deck-derived                            | exec approvals, plugin approvals, policy defaults            | Approval queues and resolution flows are typed or exception-narrowed                                   |
| `deck-go-nodes-command-contract-completion`            | P1       | gateway-backed + dynamic envelope                        | nodes, pairing, command invoke, pending work                 | Node invoke/pending work get typed outer envelopes and safe action evidence                            |
| `deck-go-routing-identity-threads-contract-completion` | P1       | gateway-backed + deck-derived                            | routing, identity links, threads                             | Mutations and list views have typed contracts and real evidence                                        |
| `deck-go-usage-logs-observability-contract-completion` | P1       | gateway-backed + deck-derived                            | usage, logs, activity, monitor                               | Log/usage dynamic leaves are narrowed; list/query/stream evidence exists                               |
| `deck-go-budget-alerts-webhooks-contract-completion`   | P2       | deck-local + deck-derived                                | budget rules/evaluation, alert rules, webhook delivery/retry | Local policy storage, Gateway-derived evaluation, delivery history, and retry semantics are contracted |
| `deck-go-docs-memory-contract-completion`              | P2       | deck-local + gateway-backed + unsupported-needs-contract | docs registry/extraction/search, memory health/search/dreams | Search/extraction/memory actions are either typed or explicitly deferred                               |
| `deck-go-skills-plugins-contract-completion`           | P2       | gateway-backed + extension envelope                      | skills, hub, plugins inventory/approvals                     | Extension/plugin dynamic surfaces are intentional envelopes, not accidental `any`                      |
| `deck-go-cron-control-contract-completion`             | P2       | gateway-backed + deck-derived                            | cron jobs/runs/status/manual run                             | Schedules, runs, and mutation evidence are typed and real-E2E covered                                  |

### Wave 5: Design-System And Dependency Follow-ups

| Proposed Change                                    | Priority | Decision                                      | Scope                                                         | Exit Criteria                                                         |
| -------------------------------------------------- | -------- | --------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `deck-go-design-system-extraction-after-contracts` | P3       | Defer until contract/product truth stabilizes | shared panel primitives, tables, filters, forms, status chips | Extraction preserves current UI and does not change contract behavior |
| `deck-go-frontend-specialized-dependencies-review` | P3       | Decide only after module contracts demand it  | editor, charts, virtualization, forms                         | New dependency proposals cite exact module need and replacement cost  |

## Risks / Trade-offs

- Isolated config copying may accidentally copy secrets into temporary logs or artifacts -> redact known secret fields in logs, keep temp roots gitignored, and document cleanup behavior.
- Real LLM seeding can be slow or environment-sensitive -> keep bounded attempts, record degraded evidence, and avoid making seed quality a UI correctness gate.
- Disposable fixtures may still affect copied config state in surprising ways -> require run-id prefixes and cleanup scoped only to resources created by the current run.
- The audit matrix may become stale -> include a refresh command or verification task and clearly state code truth precedence.
- Contract-chain scope may expand too broadly -> make product-capability implementation separate follow-up changes; deterministic P0 contract drift may be fixed directly when source authority and verification are clear.
- Existing active historical OpenSpec changes may overlap conceptually -> this head change records relationships but does not archive or rewrite unrelated changes.

## Migration Plan

1. Create the audit matrix format and fill it from current module notes, contract sources, generated artifacts, BFF route truth, frontend facades, and E2E evidence.
2. Add isolated real E2E environment utilities for copying config/workspace and starting deck-go against the copied root.
3. Add `cpa`/`main` seed workflow as the minimum real E2E gate, with fixture lifecycle helpers prepared for follow-up module evidence where safe.
4. Use the audit to identify P0 hardening candidates and classify them as fixed-now or follow-up.
5. Update obvious stale module status notes without changing UI behavior.
6. Validate OpenSpec and relevant deck-go checks.

Rollback is straightforward for this head change: remove the audit artifacts and E2E foundation utilities. It does not migrate production data.

## Implementation Evidence

- The canonical audit is `deck-go/docs/contract-chain-audit.matrix.json`, with human-readable generated output in `deck-go/docs/contract-chain-audit.matrix.md`. The sync/check utility is `deck-go/scripts/sync-contract-chain-audit.mjs`, and `make contract-chain-audit-check` is part of the contract gate.
- The isolated real E2E root and fixture helpers live in `deck-go/test/e2e/helpers.ts`, with focused regression coverage in `deck-go/test/e2e/real-e2e-foundation.spec.ts`.
- Real seed debugging found that the initial health 502 was caused by copied operator config containing a channel/plugin entry that the current source tree cannot load: `channels.openclaw-weixin` plus `plugins.entries.openclaw-weixin`. Gateway exited during config validation before `cpa` + `main` could run.
- The deterministic fix is to sanitize the isolated copy by default: external `channels` and matching stale `plugins.entries` are removed from the copied config, workspace paths and Gateway auth token are rewritten into the run root, and the operator's original config is not changed. Set `DECK_GO_REAL_E2E_PRESERVE_CHANNELS=1` only when intentionally validating full channel config loading.
- After sanitization, the minimum `DECK_GO_REAL_GATEWAY_E2E=1` seed smoke succeeds through the normal deck-go BFF path using `cpa` + `main`.

## Open Questions

The contract-chain guide and brainstorm resolve the matrix shape and proposal-lane split. Remaining questions are implementation-specific and should be answered during this head change or by the follow-up changes:

- Which exact configuration fields should be copied, redacted, or overridden when creating the isolated OpenClaw test root?
- Which P0 hardening candidates are deterministic enough to fix inside this head change after the initial matrix is populated?
- What minimum real chat seed proves enough for sessions/activity/logs/usage/docs without depending on model output quality?
- Which untyped methods should become upstream Gateway schemas versus Deck-facing DTOs or typed dynamic envelopes?
- Which module/product gaps are still unsupported after audit and should remain out of UI claims until their follow-up proposal lands?

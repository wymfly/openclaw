## 1. Audit Inputs And Matrix Shape

- [x] 1.1 Read archived module real-contract changes, module implementation notes, current contract source, generated artifacts, Go BFF routes, frontend-new API facades, and mock/real E2E specs for the audited module set.
- [x] 1.2 Define the contract-chain audit matrix schema with fields for module, capability, product role, core workflow, classification, Gateway support basis, Gateway/Deck source, adapter/BFF route, contract source, generated artifact, frontend facade, panel surface, L1 evidence, L2 evidence, real evidence status, status, gap, and follow-up proposal.
- [x] 1.3 Decide whether the canonical matrix artifact is Markdown, JSON, or JSON plus generated Markdown, and record code-truth precedence in the artifact header.
- [x] 1.4 Populate the initial matrix for all frontend-handoff modules that have implementation notes, leaving chat explicitly marked as out-of-queue early pilot unless separately audited.

## 2. Real E2E Isolation Foundation

- [x] 2.1 Inspect existing deck-go real-stack scripts, Playwright helpers, auth/token handling, OpenClaw config loading, workspace resolution, and runtime-mode environment variables.
- [x] 2.2 Implement a run-id-scoped temporary real E2E root that copies required OpenClaw config and workspace inputs without writing to the operator's original config or workspace.
- [x] 2.3 Add secret redaction and gitignore-safe output handling for temporary config, logs, screenshots, and evidence artifacts.
- [x] 2.4 Wire the real-stack runner or test helper so deck-go starts against the copied config/workspace root.
- [x] 2.5 Add cleanup behavior that removes the temporary root and never deletes resources outside the current run-id scope.

## 3. Real Data Seeding And Fixtures

- [x] 3.1 Implement a bounded `cpa` + `main` agent seed flow that creates one real chat/session in the isolated environment when the configured channel is available.
- [x] 3.2 Record seed evidence for sessions, activity, logs, usage, and docs as `passed`, `degraded`, `empty-valid`, or `handoff-blocked`.
- [x] 3.3 Implement disposable fixture helpers for safe writable resources that can be created and cleaned up through existing contracts, such as agents, cron jobs, budget rules, alert rules, webhooks, routing bindings, and docs.
- [x] 3.4 Keep unsafe fixture classes skipped-safe when disposable state cannot be proven, including channel accounts, installed skills, device tokens, and user memory mutations.
- [x] 3.5 Add regression coverage for fixture cleanup so cleanup only targets resources with the current run id.

## 4. Decision Index And Hardening Candidates

- [x] 4.1 Classify every audited capability as `gateway-backed`, `deck-derived`, `deck-local`, or `unsupported-needs-contract`.
- [x] 4.1a Record each audited capability's product role and core workflow so Deck-facing contracts converge into product-level control design rather than mechanical Gateway RPC migration.
- [x] 4.2 Build a P0 hardening candidate list for describe visibility drift, upstream-schema-missing read paths, broad dynamic envelopes, and config write-safety blockers.
- [x] 4.3 Build a platform-control product contract index for cross-cutting audit/history, live subscription, server-side list/search/filter/pagination, and safe mutation evidence.
- [x] 4.4 Build a module-specific follow-up index for unsupported prototype/product capabilities such as webhook retry, budget forecast, channel throughput, node command schemas, docs search, sessions cursor/live refresh, and threads mutations.
- [x] 4.5 Mark design-system extraction and new dependency decisions as deferred unless they are required for the real E2E or audit foundation.
- [x] 4.6 Keep the OpenSpec proposal matrix in `design.md` synchronized with the populated audit matrix, including priority, lane, dependency, and exit-criteria updates.
- [x] 4.7 Create focused follow-up OpenSpec proposals only after matrix evidence is sufficient to define scope, dependencies, acceptance criteria, and validation; do not pre-create low-evidence child proposals.
- [x] 4.8 Record child proposal status in the head matrix as `proposed`, `implementing`, `archived`, or `deferred` so goal-mode execution can continue without losing the root program state.
- [x] 4.9 Record goal-mode continuation rules in the head matrix/artifacts so compacted or resumed sessions reload this head proposal, current matrix, and implementation order before acting.

## 5. Scoped Drift Fixes And Documentation Reconciliation

- [x] 5.1 Fix obvious stale module status notes discovered by the audit when archived OpenSpec evidence and current tests are unambiguous.
- [x] 5.2 Fix deterministic low-risk contract, wrapper, metadata, or test drift discovered during matrix construction when code truth is clear.
- [x] 5.3 Record ambiguous product or architecture questions in the decision index instead of implementing them in this head change.
- [x] 5.4 Ensure all new audit artifacts state that contracts, generated artifacts, code, and tests override hand-written summaries when drift is found.
- [x] 5.5 Explore unclear contract-chain findings before deciding or implementing; only directly fix deterministic P0 drift after source authority and verification path are clear.

## 6. Verification

- [x] 6.1 Validate the `deck-go-contract-chain-audit` change-scoped spec delta with strict change validation after confirming it is not a top-level archived spec item.
- [x] 6.2 Validate the `deck-go-real-e2e-foundation` change-scoped spec delta with strict change validation after confirming it is not a top-level archived spec item.
- [x] 6.3 Run `openspec change validate deck-go-contract-chain-audit-and-real-e2e-foundation --strict`.
- [x] 6.4 Run the focused deck-go tests for the real E2E foundation helpers and fixture cleanup.
- [x] 6.5 Run at least one isolated real-stack seed smoke with `DECK_GO_REAL_GATEWAY_E2E=1`, or record bounded handoff-blocked evidence if the environment blocks it.
- [x] 6.6 Run relevant deck-go contract/build checks for any touched source surfaces.
- [x] 6.7 Run `git diff --check`.

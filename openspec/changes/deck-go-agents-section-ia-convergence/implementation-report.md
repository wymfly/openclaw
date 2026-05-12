# Implementation Report: deck-go-agents-section-ia-convergence

## Status

Implementation is archive-ready. All OpenSpec tasks are checked with fresh evidence, `verification.yaml` has `archiveReady: true`, and no code-blocking gaps remain.

## Changed File Groups

- OpenClaw Gateway deck namespace: `src/gateway/protocol/schema/deck.ts`, `src/gateway/protocol/index-extensions.ts`, `src/gateway/server-methods/deck/agents-detail.ts`, `src/gateway/server-methods/deck/agents-subagents-config.ts`, `src/gateway/server-methods/deck/agents-impact-preview*.ts`, method registry/scope/generated module inventory.
- deck-go contracts/generated docs: `deck-go/contracts/source/*`, generated TS/Go DTOs, Gateway generated artifacts, dynamic surface docs, route governance docs, config write-safety docs, contract inventory docs.
- deck-go BFF: `deck-go/backend/internal/server/agents_config_write_guard.go`, `agents_product_actions.go`, `agents_defaults.go`, `inventory.go`, and related Go tests.
- Frontend Agents module: `deck-go/frontend-new/src/components/panels/agents/*`, `deck-go/frontend-new/src/data/modules/agents/*`, `deck-go/frontend-new/src/api.ts`, `api-types.ts`, and `i18n/en.json` / `zh.json`.
- E2E fixtures/tests: `deck-go/test/fixtures/mock-gateway.mjs`, `deck-go/test/e2e/agents-visual.spec.ts`, `deck-go/test/e2e/agents-real-gateway.spec.ts`.
- OpenSpec accepted truth: `openspec/specs/deck-go-agents-section-ia-convergence/spec.md` plus linked updates to agents control, model policy, config write-safety, and real-E2E specs.

## Decisions Resolved

- Nested inheritance is not uniform object replacement. Gateway-side detail now supports sub-key inheritance entries where OpenClaw runtime code resolves sub-keys.
- Workspace path writes keep using upstream `agents.update` because it performs workspace bootstrap and identity file side effects; advanced workspace fields use guarded config writes.
- Per-agent model-policy target keys remain frontend/BFF conventions (`agent`, `agentSubagents`) without tightening Gateway schema.
- BFF product actions are allowed to use `config.patch/apply` only behind per-action path allowlist guard; forged writes to other module paths are rejected before Gateway mutation.
- `impactPreview.get` remains a fresh read path separate from cached detail impact.
- Post-review: impact risk specifics preserve legacy strings and add `riskSpecificsI18n` keys; frontend prefers keys for zh/en rendering.
- Post-review: session impact is explicitly degraded when no Gateway truth source exists. Nested `impact.sessions` is omitted and `impact.available=false` / `unavailableReason=session-truth-unavailable` is returned instead of fabricated nested zero counts.
- Post-review: Go BFF uses raw Gateway passthrough for agents detail and impact preview because generated value-typed optional fields can otherwise turn absent/false Gateway JSON into misleading zero-value JSON.

## Verification

- `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/agents/__tests__/agents-panel-state.test.ts src/components/panels/agents/__tests__/AgentsPanel.test.tsx src/data/modules/agents/keys.test.ts src/data/modules/agents/queries.test.tsx src/data/modules/agents/mutations.test.tsx` passed 5 files / 27 tests.
- `cd deck-go/frontend-new && npm run build` passed; only the existing Vite chunk-size warning appeared.
- `cd deck-go && make e2e-mock-module MODULE=agents` passed 2/2.
- `cd deck-go && make e2e-real-module MODULE=agents` passed 3/3, including isolated config writes, defaults set/reset, allowlist rejection, `requireAgentId` round-trip, and UI dark/light zh/en coverage.
- `cd deck-go && make contract-gate` passed.
- `cd deck-go && make backend-test` passed.
- `pnpm test src/gateway/server-methods/deck/agents.test.ts` passed 34 tests.
- Post-review focused check: `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/agents/__tests__/AgentsPanel.test.tsx src/data/modules/agents/queries.test.tsx` passed 2 files / 16 tests.
- Post-review focused check: `cd deck-go/frontend-new && npm run build` passed.
- Post-review focused check: `openspec validate deck-go-agents-section-ia-convergence --type change --strict && openspec validate deck-go-agents-section-ia-convergence --type spec --strict` passed.
- Post-review real-stack probe: `GET /api/deck/agents?agentId=main` and `POST /api/deck/agents { action: "impactPreview.get" }` both returned `impact.available=false`, `unavailableReason=session-truth-unavailable`, omitted nested `impact.sessions`, and impact preview returned `riskSpecificsI18n`.
- `openspec validate deck-go-agents-section-ia-convergence --type change --strict` passed.
- Accepted specs strict validation passed for `deck-go-agents-section-ia-convergence`, `deck-go-agents-control-contract-completion`, `deck-go-agents-model-policy-convergence`, `deck-go-config-write-safety-contracts`, `deck-go-real-e2e-seed-and-evidence`, and `deck-go-real-e2e-reporting-and-circuit-breakers`.

## Follow-ups

- Prototype refresh is tracked in `openspec/follow-ups/2026-05-12-agents-section-ia-prototype-refresh.md`. It is not code-blocking because mock and real E2E now validate the implemented product surface, but the design handoff should be refreshed to the final 11-section IA before using it as a future visual reference.
- Risk-specifics i18n compatibility is recorded in `openspec/follow-ups/2026-05-12-agents-risk-specifics-i18n.md`; current code has already applied the additive fix.
- Real per-agent session impact truth remains deferred in `openspec/follow-ups/2026-05-12-agents-impact-session-truth.md`; current code exposes it as degraded/unavailable rather than pretending unknown values are zero.
- Generated Go optional JSON semantics are tracked in `openspec/follow-ups/2026-05-12-go-generated-optional-json-semantics.md`; current agents detail/impactPreview routes are protected by raw passthrough.

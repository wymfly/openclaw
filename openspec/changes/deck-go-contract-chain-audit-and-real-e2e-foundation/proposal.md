## Why

deck-go has now rebuilt and real-contract verified most frontend-new modules, but the hard part has moved from UI construction to proving the full OpenClaw Gateway -> Go BFF -> contract source -> generated artifacts -> frontend facade -> panel -> E2E chain. The archived module changes intentionally left disputed or unsafe scenarios as handoff items, so the project needs a single head change that turns those scattered findings into an auditable contract-chain source of truth and a safe real E2E foundation.

## What Changes

- Introduce a contract-chain audit matrix that classifies every module capability as `gateway-backed`, `deck-derived`, `deck-local`, or `unsupported-needs-contract`.
- Record the full source path for each capability: Gateway method or Deck source, Go adapter/BFF route, contract source/generated artifact, frontend facade, panel surface, mock E2E, real E2E, and remaining gap.
- Add an isolated real E2E environment model that copies OpenClaw configuration and workspace state into a temporary test root instead of mutating the operator's real state.
- Define a seeded real E2E flow using the configured `cpa` channel and `main` agent to create real chat/session/activity/log/usage evidence in the isolated environment.
- Define disposable fixture rules for writable modules so real E2E can safely exercise create/update/delete paths using run-id-scoped resources and cleanup.
- Establish a decision index for follow-up proposals, including P0 contract hardening, platform-control product capabilities, module-specific product contracts, and deferred design-system/dependency work.
- Allow low-risk, evidence-backed drift fixes discovered during the audit, but keep ambiguous product decisions as indexed follow-up proposals rather than forcing them into this head change.

## Capabilities

### New Capabilities

- `deck-go-contract-chain-audit`: Defines the canonical audit matrix, capability classification vocabulary, source-of-truth rules, and follow-up decision index for deck-go contract-chain work.
- `deck-go-real-e2e-foundation`: Defines isolated real E2E environment setup, `cpa` seeding, disposable fixture lifecycle, safety gates, evidence statuses, and circuit-breaker behavior.

### Modified Capabilities

- None.

## Impact

- Affected docs and audit artifacts under `deck-go/docs/`, `deck-go/frontend-handoff/modules/`, and OpenSpec specs.
- Affected real E2E scripts and Playwright helpers under `deck-go/scripts/` and `deck-go/test/e2e/`.
- Affected Go backend and frontend wrappers only when the audit exposes deterministic low-risk drift.
- No new production dependency is expected in this change.
- No destructive test is allowed against the user's real OpenClaw configuration or workspace.

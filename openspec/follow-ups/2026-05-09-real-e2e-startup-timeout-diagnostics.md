# Real E2E Startup Timeout Diagnostics

Status: deferred

Source: `deck-go-models-product-semantics-convergence` implementation verification on 2026-05-09.

## Facts

- The first `cd deck-go && make e2e-real-module MODULE=models` attempt timed out while waiting for `/api/runtime/gateway`.
- The failure did not include backend or Gateway process output because Playwright interrupted the test during startup polling.
- A second run of the same command passed and exercised the Models typed BFF real Gateway path end to end.
- No Models scenario code failure remained after the retry; the actionable gap is E2E startup diagnostics, not Models product behavior.
- During `deck-go-agents-model-policy-convergence` verification on 2026-05-11, a plain `cd deck-go && make e2e-real-module MODULE=agents` attempt again failed before test-body execution while waiting for real Gateway readiness.
- The fixed-port real stack reproduced a related startup issue when the direct-dist launcher saw missing prepared runtime artifacts: `dist/.buildstamp` and `dist/control-ui/index.html`.
- That direct-dist path triggered `pnpm build`, which entered long `runtime-postbuild` dependency staging and delayed or blocked Gateway readiness.
- A source-launch override using `pnpm exec tsx src/entry.ts gateway run --bind loopback --port ... --allow-unconfigured` avoided the prepared-runtime preflight build and let the same Agents real E2E pass.
- The source-launch path still used the isolated real-stack config/workspace, so it is a valid development verification workaround rather than a replacement for production prepared-runtime startup coverage.

## Classification

- Category: `real-e2e`, `dev-script`, `verification`
- Needs new OpenSpec: optional; a small hardening plan is enough unless real-stack diagnostics become a repeated blocker.

## Suggested Next Step

Persist backend/Gateway process output to the E2E `logs/` directory during startup, not only after selected successful checkpoints, so future startup timeouts can be diagnosed from the test artifact alone.

Also harden the real E2E launcher contract so source-launch development mode and direct-dist prepared-runtime mode are explicit choices. Direct-dist mode should fail fast with actionable diagnostics when prepared artifacts are missing instead of falling into expensive dependency staging during module E2E startup.

## Acceptance Hints

- A forced startup failure leaves backend output, Gateway launch command, selected ports, and isolation root in attached artifacts.
- The helper still removes run-scoped data and processes on successful runs.
- The logging change does not make mock E2E output noisy on success.

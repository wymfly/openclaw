## Why

The revised agents handoff in `deck-go/frontend-handoff/modules/agents/` gives us a better high-fidelity target, but the previous module workflow only proved mock visual convergence. Deck Go is an enterprise control surface for OpenClaw Gateway, so agents must now become the pilot for verifying product design against real Gateway capability, the deck-go contract chain, Go adapters, and the production frontend.

## What Changes

- Implement the revised agents handoff package as the active production target in `frontend-new`, preserving the current deck-go shell and design-system skeleton while treating the handoff as product input rather than an unquestioned API truth.
- Audit real Gateway agents capability from source contracts, generated Gateway artifacts, `gateway.describe`, and known exception records before changing UI behavior.
- Calibrate the agents product surface to supported Gateway capability: expose supported operations clearly, degrade unsupported or schema-missing behavior explicitly, and document product-contract gaps instead of hiding them behind mocks.
- Develop the agents control-plane backend and frontend as one module: real Gateway method/schema → generated Gateway artifacts → Go BFF DTO/adapters/routes → `frontend-new/src/api.ts` wrappers → production panel behavior.
- Tighten the agents Deck-facing contract chain wherever the real Gateway and product design prove deterministic drift, including backend adapter gaps and frontend assumptions.
- Add module-level real verification with a circuit breaker: attempt the real-stack checks up to a small bounded number of times, fix deterministic code/config defects, and hand off environment-sensitive blockers without stopping unrelated module rollout.
- Keep mock visual E2E as a required visual gate, but stop treating it as functional proof.
- Record the resulting real-verification playbook so later modules can copy the structure without blocking the full goal loop on one flaky or environment-dependent real E2E case.

## Capabilities

### New Capabilities

- `frontend-agents-real-contract-verification`: Covers the agents v2 handoff implementation, real Gateway capability calibration, front/back contract-chain development, real-stack circuit breaker, and module handoff evidence.

### Modified Capabilities

- `frontend-agents-hifi-redesign`: Adds the revised v2 agents prototype as the active visual target for this implementation pass and separates mock visual completion from real functional readiness.

## Impact

- **Handoff**: `deck-go/frontend-handoff/modules/agents/**`, especially the revised React/Babel high-fidelity prototype and any implementation notes produced during translation.
- **Contracts**: `deck-go/contracts/source/deck-api.contract.ts`, `deck-go/contracts/source/deck-endpoints.contract.json`, `deck-go/contracts/source/deck-exceptions.contract.json`, `deck-go/contracts/source/deck-ui.contract.json`, generated Deck/Gateway artifacts, and docs generated from contract checks only if deterministic drift is found.
- **Backend**: agents-related Go BFF handlers/adapters under `deck-go/backend/internal/**`, especially Gateway query wrappers, runtime/openclaw adapter code, HTTP route behavior, and contract adapter tests.
- **Frontend**: `deck-go/frontend-new/src/api.ts`, `deck-go/frontend-new/src/api-types.ts`, `deck-go/frontend-new/src/stores/agents*`, and `deck-go/frontend-new/src/components/panels/agents/**`.
- **Testing**: focused frontend unit/a11y tests, focused Go adapter/route tests, agents mock visual E2E, real-stack API/UI smoke for agents, and bounded live Gateway evidence using `deck-go/scripts/dev/run-stack-real.sh` or equivalent Playwright real-stack helpers.
- **Documentation**: agents implementation notes and OpenSpec task evidence must distinguish code defects, contract gaps, product follow-ups, and environment-blocked real verification.

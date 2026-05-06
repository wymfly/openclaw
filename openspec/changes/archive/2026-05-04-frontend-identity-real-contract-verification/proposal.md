## Why

The `identity` handoff now has a revised v2 high-fidelity prototype, but the production `frontend-new` panel is still a minimal registry view and has not gone through the real-contract verification loop used by the other completed modules. Identity is a routing-critical control surface: it must align the canonical-to-channel-peer product design with the actual OpenClaw Gateway methods and deck-go BFF contract before the UI can be trusted.

## What Changes

- Rebuild or tighten `frontend-new` identity UI around the v2 canonical registry model where the current contract supports it.
- Verify the full contract chain from OpenClaw Gateway methods (`deck.identity.list`, `deck.identity.link`, `deck.identity.unlink`, `agent.identity.get`) through Go BFF routes, Deck DTOs, frontend wrappers, UI metadata, mock fixtures, and E2E tests.
- Keep browser code BFF-only and preserve baseHash optimistic concurrency for link/unlink mutations.
- Treat rename/create/delete canonical, peer activity enrichment, and recent mutation audit as unsupported or projected unless implementation discovers current Gateway/BFF support.
- Add or update L1 mock visual evidence and bounded L2 real-stack evidence for list/link/unlink/read-only render behavior, with circuit-breaker handoff when real Gateway state is empty or environment-dependent.
- Update identity handoff notes, contract metadata, tests, and OpenSpec records with source-of-truth decisions and residual risks.

## Capabilities

### New Capabilities

- `frontend-identity-real-contract-verification`: Verifies and implements the identity module against the real Gateway/BFF/DTO/frontend contract chain, including bounded real-stack evidence.

### Modified Capabilities

- `frontend-identity-hifi-redesign`: Updates the identity high-fidelity UI contract to distinguish v2 product target from currently supported identity registry behavior.

## Impact

- `deck-go/frontend-new/src/components/panels/identity/**`
- `deck-go/frontend-new/src/api.ts`, `deck-go/frontend-new/src/api-types.ts`, and identity i18n keys as needed
- `deck-go/contracts/source/deck-ui.contract.json`, `deck-go/contracts/source/deck-endpoints.contract.json`, generated UI metadata/docs, and endpoint classification if drift is found
- `deck-go/backend/internal/server/inventory.go`, runtime facade/BFF route tests, and mock Gateway fixtures only for deterministic contract-backed drift
- `deck-go/frontend-handoff/modules/identity/**`
- `deck-go/test/e2e/*identity*` mock and real-stack coverage
- `openspec/specs/frontend-identity-hifi-redesign/spec.md` and new `openspec/specs/frontend-identity-real-contract-verification/spec.md`

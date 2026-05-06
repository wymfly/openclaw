## Why

The Settings module has a revised v2 high-fidelity handoff and a production `frontend-new` panel, but it has not gone through the real-contract verification loop used by completed modules. Settings is runtime-sensitive because it combines access-token provenance, bundled-vs-remote endpoint mutability, local preferences, device pairing, version diagnostics, and runtime bootstrap state.

## What Changes

- Verify the Settings contract chain from deck-go BFF routes and runtime-mode policy through Deck DTOs, frontend wrappers, UI metadata, mock fixtures, visual E2E, and bounded real-stack evidence.
- Tighten Settings implementation, handoff notes, and tests where deterministic drift is found, especially route truth (`PUT /settings`, runtime endpoint routes, bootstrap/runtime routes), bundled-mode read-only enforcement, token safety, and device action boundaries.
- Keep browser code BFF-only and preserve runtime-mode semantics: bundled runtime endpoint fields are read-only and remote endpoint writes go through `PUT /runtime/endpoint`.
- Treat token rotation endpoint, settings save audit, rich typed paired-device shape, keybindings, privacy, and bundled `.env` mutation as unsupported or projected unless current code support is verified.
- Add or update L1 mock visual evidence and bounded L2 real-stack evidence for settings read/save-safe paths, runtime endpoint read/test/update-safe paths, version, device shape, and BFF-only browser access.
- Update Settings handoff notes, OpenSpec records, tests, and generated artifacts only when source contract drift is confirmed.

## Capabilities

### New Capabilities

- `frontend-settings-real-contract-verification`: Verifies and completes the Settings module against the real BFF/runtime/DTO/frontend contract chain, including bounded real-stack evidence and deterministic drift fixes.

### Modified Capabilities

- `frontend-settings-hifi-redesign`: Updates the Settings high-fidelity UI contract to distinguish v2 product target from currently verified Settings/runtime/device behavior.

## Impact

- `deck-go/frontend-new/src/components/panels/settings/**`
- `deck-go/frontend-new/src/components/runtime/EndpointSection.tsx` and `ReadOnlyField.tsx` if deterministic endpoint UI drift is found
- `deck-go/frontend-new/src/api.ts`, Settings i18n keys, and related device/runtime wrappers as needed
- `deck-go/contracts/source/deck-ui.contract.json`, `deck-go/contracts/source/deck-endpoints.contract.json`, generated UI metadata/docs, and contract inventories if drift is found
- `deck-go/backend/internal/api/http/**`, `deck-go/backend/internal/server/**`, runtime facade/BFF route tests, and mock Gateway fixtures only for deterministic Settings-scoped drift
- `deck-go/frontend-handoff/modules/settings/**`
- `deck-go/test/e2e/*settings*` mock and real-stack coverage
- `openspec/specs/frontend-settings-hifi-redesign/spec.md` and new `openspec/specs/frontend-settings-real-contract-verification/spec.md`

## Why

The Models module already has a revised v2 high-fidelity handoff and a production rewrite, but it has not gone through the same real-contract verification loop as the completed modules. Models is a high-risk control surface because it spans raw `openclaw.json` config, runtime model inventory, auth overview/probe, catalog discovery, fallback chains, allowlists, usage pressure, and downstream agent default behavior.

## What Changes

- Verify the Models contract chain from OpenClaw Gateway methods (`models.configured`, `deck.auth.overview`, `models.catalog.providers`, `deck.auth.probe`) through Go BFF/runtime routes, Deck DTOs, frontend wrappers, UI metadata, mock fixtures, visual E2E, and bounded real-stack evidence.
- Tighten the production `frontend-new` Models panel where deterministic drift is found, while preserving the v2 workbench skeleton, raw config save authority, base hash semantics, schema lookup, provider config edits, catalog add workflows, fallback chain edits, allowlist edits, usage evidence, and probe behavior.
- Distinguish canonical usage routes (`/usage/cost`, `/usage/providers`) from legacy Models-compatible aliases (`/models/usage/cost`, `/models/usage/providers`) in implementation notes, metadata, and tests.
- Treat BFF-only pricing snapshots, PATCH audit history, force-probe caching, and unsupported real Gateway semantics as projected, degraded, or handoff-blocked unless current code support is verified.
- Add or update L1 mock visual evidence and bounded L2 real-stack evidence for read paths, config save safety, runtime model/auth/catalog/probe route shapes, usage routes, and BFF-only browser access.
- Update Models handoff notes, OpenSpec records, tests, and generated artifacts only when source contract drift is confirmed.

## Capabilities

### New Capabilities

- `frontend-models-real-contract-verification`: Verifies and completes the Models module against the real Gateway/BFF/DTO/frontend contract chain, including bounded real-stack evidence and deterministic drift fixes.

### Modified Capabilities

- `frontend-models-hifi-redesign`: Updates the Models high-fidelity UI contract to separate the v2 product target from currently verified Gateway/BFF behavior, especially for usage aliases, pricing/audit projections, and probe/cache assumptions.

## Impact

- `deck-go/frontend-new/src/components/panels/models/**`
- `deck-go/frontend-new/src/api.ts`, generated frontend API types, and Models i18n keys as needed
- `deck-go/contracts/source/deck-ui.contract.json`, `deck-go/contracts/source/deck-endpoints.contract.json`, generated UI metadata/docs, and contract inventories if drift is found
- `deck-go/backend/internal/server/inventory.go`, `deck-go/backend/internal/api/http/**`, `deck-go/backend/internal/runtime/openclaw/**`, and mock Gateway fixtures only for deterministic Models-scoped drift
- `deck-go/frontend-handoff/modules/models/**`
- `deck-go/test/e2e/*models*` mock and real-stack coverage
- `openspec/specs/frontend-models-hifi-redesign/spec.md` and new `openspec/specs/frontend-models-real-contract-verification/spec.md`

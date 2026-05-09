## Why

The deck-go Models module currently mixes runtime inventory, raw config editing, catalog data, usage, and provider probing in a large frontend-heavy surface, while OpenClaw model configuration truth lives in `openclaw.json` and Gateway `config.get` / `config.patch` semantics. This change turns Models into a product-level control plane that edits OpenClaw model provider configuration through a clear contract chain instead of requiring operators to hand-edit raw JSON or relying on frontend-only patch assembly.

This is needed now because the existing deck-go contracts and UI do not fully express the writable OpenClaw model config surface, especially provider/model lifecycle, base-hash conflict handling, SecretInput boundaries, delete/mode impact guardrails, and the distinction between runtime-visible inventory and product-owned config writes.

## What Changes

- Add a deck-go product contract for Models config detail, provider/model CRUD, mode switching, delete/mode impact previews, and reference indexing, with OpenClaw config and Gateway write semantics as the highest truth.
- Repair and extend deck-go contract sources, generated TypeScript/Go artifacts, mutation metadata, UI metadata, and Data Fabric hooks so ordinary Models UI writes use typed BFF routes rather than frontend raw-config patching.
- Implement typed Go BFF routes that read current config, build minimal `models` merge patches, forward them through Gateway `config.patch`, preserve base-hash conflict semantics, and never invent upstream Gateway methods that do not exist.
- Replace the raw-heavy frontend Models surface with a provider-grouped product UI: catalog header, provider sections, model rows, provider/model drawers, add-provider wizard, impact preview dialog, type-to-confirm guardrails, and advanced raw editor escape hatches.
- Keep `models.config.save` as an advanced fallback for `compat`, `request`, and other unproductized fields, but remove it from normal provider/model CRUD flows.
- Synchronize `frontend-handoff/modules/models` so the handoff prototype, component notes, interactions, states, and API usage match the OpenClaw config truth and the new deck-go contract chain.

## Capabilities

### New Capabilities

- `deck-go-models-config-control-plane`: Product-level Models configuration control plane for OpenClaw `models.mode` and `models.providers`, including typed deck-go BFF actions, frontend product UI behavior, reference-impact guardrails, and layered verification.

### Modified Capabilities

- `deck-go-models-providers-contract-completion`: Extend Models/Providers contract closure from evidence-known read/raw save/probe workflows to typed config detail and product-safe provider/model CRUD actions backed by Gateway config patching.
- `deck-go-config-write-safety-contracts`: Add Models-specific config-like write paths and evidence requirements for base-hash forwarding, conflict preservation, unsupported idempotency/audit claims, and raw-editor fallback boundaries.

## Impact

- OpenClaw truth sources referenced by this change: `src/config/types.models.ts`, `src/config/zod-schema.core.ts`, `src/config/schema.help.ts`, Gateway `config.get`, Gateway `config.patch`, runtime `models.configured`, runtime `models.catalog.providers`, and auth/probe read capabilities.
- deck-go contracts: `deck-go/contracts/source/deck-api.contract.ts`, `deck-go/contracts/source/deck-endpoints.contract.json`, `deck-go/contracts/source/deck-mutations.contract.json`, `deck-go/contracts/source/deck-ui.contract.json`, generated TS/Go artifacts, and contract governance reports.
- deck-go backend: Go BFF route mounting, runtime facade/adapters, Models config projection, typed mutation handlers, config patch adapter, impact/reference index helpers, and backend tests.
- deck-go frontend: `frontend-new/src/data/modules/models`, `frontend-new/src/api.ts`, generated API types, `frontend-new/src/components/panels/models`, design-system-aligned shared widgets/dialogs, i18n, component tests, and mock E2E fixtures.
- Handoff and verification: `deck-go/frontend-handoff/modules/models`, mock visual states, real safe-smoke fixture guidance, OpenSpec verification artifacts, and follow-up records for out-of-scope default-slot editing, OAuth flow, rate limits, or secret-store CRUD.
- No new npm/go dependency is expected. Any need for a dependency, upstream OpenClaw schema addition, or new Gateway model-specific RPC is out of scope unless separately proposed.

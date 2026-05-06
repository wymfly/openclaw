## Why

Deck Go already exposes several config-like writes across Config, Agents, Models, Routing, Identity, Skills, and runtime/settings flows, but they do not yet share one product-level safety contract for base-hash conflicts, idempotency, error envelopes, request evidence, and rollback/degraded behavior. This is now the next P0 hardening item because route ownership is governed, so write semantics are the remaining high-risk gap before module-level completion proposals can rely on the contract chain.

## What Changes

- Define a shared Deck-side safety contract for config-like writes without adding new Gateway APIs by default.
- Inventory all current config-backed or config-adjacent write paths and classify them as Gateway-backed, Deck-derived, Deck-local, or unsupported/deferred.
- Normalize Deck-facing DTOs and frontend facades where deterministic drift exists: baseHash/hash naming, requestId/result/error shape, conflict handling, and idempotency keys where supported.
- Add generated or source-owned governance evidence for config-like write paths so future writes cannot silently bypass the safety model.
- Add focused backend/frontend tests for conflict/degraded behavior and safe no-op write evidence where the Gateway supports it.
- Update the head matrix after implementation and archive this child proposal.

## Capabilities

### New Capabilities

- `deck-go-config-write-safety-contracts`: Governs Deck Go product-level semantics for config-like writes, including base-hash use, idempotency/de-duplication evidence, conflict/degraded responses, rollback availability, and verification requirements.

### Modified Capabilities

- None.

## Impact

- Affected source contracts: `deck-go/contracts/source/deck-api.contract.ts`, `deck-go/contracts/source/deck-ui.contract.json`, endpoint/route governance sources if write evidence needs owner metadata, and any new config-write governance source introduced by this change.
- Affected generated artifacts: Deck API TS/Go DTOs and generated governance reports.
- Affected backend surface: Go BFF handlers and runtime OpenClaw adapters for `config.apply`, `config.patch`, and module writes implemented through config patches.
- Affected frontend surface: `deck-go/frontend-new/src/api.ts`, config/agents/models/routing/identity/skills/settings panels, and focused tests that assert write safety UX.
- No new Gateway APIs are introduced; unsupported rollback/audit/history behavior must be recorded as unavailable or deferred unless existing Gateway/Deck code truth supports it.

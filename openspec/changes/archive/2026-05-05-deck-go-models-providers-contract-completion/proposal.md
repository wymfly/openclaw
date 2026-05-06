## Why

Models/providers already has real read-path and UI boundary evidence, but the
head matrix still records provider probes and config-write conflict evidence as
the remaining gap. Now that config-write safety and safe mutation evidence are
archived, the module needs a focused closure pass that makes model config saves
and provider probes contract-known without inventing new Gateway capabilities.

## What Changes

- Re-audit current Models workflows against Gateway generated methods, Deck BFF
  routes, config-write safety metadata, frontend facades, prior L2 evidence, and
  matrix gaps.
- Extend mutation evidence metadata for `models.config.save` and model provider
  auth probes, preserving config-write safety as the source for base-hash and
  conflict semantics.
- Route representative Models facades through shared mutation evidence helpers
  where response DTOs can be preserved.
- Keep real provider probes and config writes skipped-safe or handoff-blocked
  unless implementation can prove safe provider/config scope.
- Update Models implementation notes, the head contract-chain matrix, and head
  verification evidence so the module no longer waits on platform-control
  config-write or safe-mutation work.

## Capabilities

### New Capabilities

- `deck-go-models-providers-contract-completion`: Completes the models/providers
  module contract-chain by mapping configured model/provider workflows to typed
  Gateway DTOs, Deck config BFF contracts, config-write safety, mutation
  evidence metadata, and bounded real/mock evidence.

### Modified Capabilities

- None.

## Impact

- Affected contract metadata:
  `deck-go/contracts/source/deck-mutations.contract.json` and generated
  mutation evidence docs/TypeScript metadata.
- Affected frontend: `frontend-new/src/api.ts`, Models focused tests, and
  mutation evidence helper usage where applicable.
- Affected docs/evidence: Models implementation notes, contract-chain audit
  matrix, generated matrix Markdown, and head proposal verification evidence.
- Backend changes are only in scope if exploration finds deterministic
  models/provider route, adapter, or DTO drift. No new Gateway APIs are
  introduced.

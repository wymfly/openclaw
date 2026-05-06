## Why

`deck-go/frontend-handoff/modules/plugins/` contains a refreshed v2 high-fidelity prototype for the Plugins workbench and is still marked pending implementation. The existing production panel already consumes the plugin inventory BFF route, but it is simpler than the v2 handoff and still needs real-contract closeout: capability-scope inventory, selected plugin evidence, diagnostics, raw payloads, channel handoffs, unsupported lifecycle copy, and bounded real-stack proof that the browser stays BFF-only.

Plugins are read-only in the current contract chain. The implementation must not invent manifest/audit projection routes, install/enable/reload mutations, marketplace semantics, trust metadata, package signature verification, or production activation controls unless they are actually supported by the deck-go BFF and Gateway contract.

## What Changes

- Refactor `frontend-new` Plugins so production follows the v2 handoff where backed by the current Deck BFF plugin inventory contract.
- Re-audit the Plugins contract chain: `DeckGoPlugin*` DTOs, `/api/deck/plugins?capability=*` BFF endpoint, frontend wrappers, Go runtime route, Gateway `deck.plugins.list`, endpoint classification, mock gateway fixtures, and real-stack route behavior.
- Fix deterministic Plugins drift directly when evidence-backed, including stale handoff claims for manifest/audit routes, unsupported mutation affordances, stale tests, or copy that overstates backend capabilities.
- Keep unsupported prototype behavior inactive, degraded, or documented rather than adding speculative routes/dependencies.
- Add or refresh L1 mock visual E2E and bounded L2 real-stack API/UI evidence for inventory, scope switching, selected plugin detail, diagnostics/raw evidence, channel handoff copy, error/empty rendering, and BFF-only browser access.
- Archive only after tasks, OpenSpec validation, focused tests, relevant contract checks, frontend build, diff check, and final review evidence are complete.

## Capabilities

### New Capabilities

- `frontend-plugins-real-contract-verification`: Plugins-specific real-contract verification, Gateway/BFF inventory safety, evidence matrix, circuit breaker, and closeout discipline.

### Modified Capabilities

- `frontend-plugins-hifi-redesign`: update the Plugins hifi requirements from the earlier contract-backed panel to the refreshed v2 read-only inventory workbench where supported by the real BFF/Gateway contract.

## Impact

- `deck-go/frontend-handoff/modules/plugins/`
- `deck-go/frontend-new/src/components/panels/plugins/**`
- `deck-go/frontend-new/src/api.ts`, i18n, and focused frontend tests when wrapper/copy drift is found
- `deck-go/backend/internal/server/inventory.go`, runtime query paths, mock gateway fixtures, and related Go tests when BFF route behavior drift is found
- `deck-go/contracts/source/**` and generated artifacts only when source contract changes are necessary
- `deck-go/test/e2e/plugins-visual.spec.ts` and a real-gateway/BFF E2E spec for Plugins
- `openspec/specs/frontend-plugins-hifi-redesign/spec.md` and the new Plugins real-contract verification spec

# Memory Implementation Notes

Status: implemented - real-contract verified.

## Contract Matrix

| Workflow             | Frontend wrapper                          | BFF route                                      | Gateway / backend source                                                        | Classification                                                                       |
| -------------------- | ----------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Browse directory     | `browseMemory(agentId, path)`             | `GET /api/memory/browse?agentId=&path=`        | `agents.files.list` resolves workspace, then Go BFF reads the local memory tree | supported when workspace resolves; empty-valid when path is absent                   |
| Read file            | `readMemoryFile(agentId, path)`           | `GET /api/memory/browse?agentId=&path=&read=1` | Go BFF safe-path filesystem read under resolved workspace                       | supported when file exists; hard error on read failure                               |
| Semantic search      | `searchMemory({ query, scope, agentId })` | canonical `POST /api/memory/search`            | LanceDB adapter is not implemented in deck-go BFF yet                           | degraded 501 with normalized `lanceDbEnabled=false`                                  |
| Search compatibility | legacy callers only                       | `GET /api/memory/search?q=&scope=&agentId=`    | same BFF handler as canonical POST                                              | compatibility alias                                                                  |
| Health               | `fetchMemoryHealth()`                     | `GET /api/memory/health`                       | `doctor.memory.status`                                                          | supported, but current Gateway shape is single-agent fallback                        |
| Dreams read/actions  | `runMemoryDreams(action, agentId)`        | `POST /api/memory/dreams`                      | `doctor.memory.*` methods                                                       | safe read supported; mutating actions require operator intent and real-stack caution |

## Fixes Made

- Added canonical `POST /api/memory/search` to active and admin BFF route trees while preserving `GET /api/memory/search` for compatibility.
- Switched the production frontend wrapper to POST search and kept the 501 degraded response normalization.
- Refactored the production Memory panel to the v2 four-tab workspace: Browse, Search, Health, Dreams.
- Kept browse/read BFF-only with lazy directory expansion and safe file reads through `readMemoryFile`.
- Added inline confirmation for destructive dream actions instead of modal/global confirmation.
- Used the existing design-system `Markdown` atom instead of adding a markdown dependency.
- Updated endpoint classification so the canonical POST search route is governed with the rest of the deck-go BFF endpoints.

## Residual Risks

- OpenClaw Gateway `doctor.memory.*` currently resolves the default configured agent and has no per-agent params. deck-go sends `agentId` for contract/UI stability, but per-agent dreams are not truly supported until Gateway adds params.
- Semantic search remains degraded until the LanceDB-backed deck-go adapter exists. The UI renders the unavailable state rather than inventing keyword results.
- Destructive dreams actions are implemented in the UI with confirmation, but real E2E should avoid executing them against user memory unless a disposable fixture is prepared.
- Audit feed integration for mutating dream actions is not implemented.
- Search history, highlighting, direct memory editing, and streamed dream progress remain out of scope.

## Verification Evidence

- Prototype smoke: `deck-go/frontend-handoff/modules/memory/prototype.html` loaded via local static server; four tabs switched without browser errors.
- Focused frontend tests: `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/memory/MemoryPanel.test.tsx src/api.chat-helpers.test.ts` passed.
- Focused backend tests: `cd deck-go/backend && go test ./internal/server ./internal/api/http ./internal/runtime/openclaw -run 'TestGatewayFacade_MemoryRoutes|TestMountAdminRoutes|TestContractAdapters'` passed.
- Mock visual E2E: `cd deck-go && pnpm exec playwright test test/e2e/memory-visual.spec.ts --config playwright.config.ts` passed.
- Real Gateway E2E: `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/memory-real-gateway.spec.ts --config playwright.config.ts` passed for route shapes, real UI render, and BFF-only browser access.
- OpenSpec validation: `openspec validate frontend-memory-real-contract-verification --strict` passed.
- Endpoint classification: `cd deck-go && make endpoint-classification-check` passed.
- Frontend build: `cd deck-go && make frontend-build` passed.
- Diff hygiene: `git diff --check` passed.

## Review Result

No additional Memory-scoped defects were found in the final code review. The remaining items above are capability/product gaps rather than implementation regressions in this proposal.

## Contract-chain completion closeout — 2026-05-05

### Contract evidence update

- Reconfirmed `GET /api/memory/search` and canonical `POST /api/memory/search` both use a single shared degraded response path while LanceDB-backed semantic search is absent.
- Reconfirmed browse/read/health/dream read flows are represented by BFF routes and frontend facades, with search normalized to explicit degraded `501` semantics.
- Kept mutating dream actions confirmation-gated and skipped/deferred for real automation because current Gateway `doctor.memory.*` semantics do not provide disposable, per-agent-safe mutation fixtures.

### Current truth

- Memory browse/read/health and safe dream read are product-visible and contract-known.
- Semantic search is explicitly degraded until a LanceDB adapter exists.
- Backfill/reset/reset-short-term/repair/dedupe remain operator-sensitive; do not convert them into fixture-safe mutation evidence without disposable memory roots and cleanup proof.
- Code truth remains authoritative over this note; if Gateway memory semantics change, update the contract matrix and BFF/product contracts before widening UI claims.

### Additional verification

- `cd deck-go && make deck-api-check mutation-evidence-contract-test mutation-evidence-contract-check` passed.
- `cd deck-go/frontend-new && npm run test:deck-ui -- src/lib/mutation-evidence.test.ts src/api.chat-helpers.test.ts src/components/panels/docs/DocsPanel.test.tsx src/components/panels/memory/MemoryPanel.test.tsx` passed, 78 tests.
- `cd deck-go/backend && go test ./internal/server ./internal/api/http ./internal/runtime/openclaw -run 'TestGatewayFacade_DocsRoutes|TestGatewayFacade_MemoryRoutes|TestMountAdminRoutes|TestContractAdapters|TestMemory|TestDocs'` passed.

## Prototype parity remediation closeout - 2026-05-06

### Visual and product alignment

- Confirmed `frontend-handoff/modules/memory/prototype.html` is the active target: four-tab Browse/Search/Health/Dreams memory workbench with a selected file open on initial Browse state.
- Fixed the deterministic title drift from `Memory Browser` / `记忆浏览器` to `Memory` / `记忆`.
- Fixed the deterministic initial-state drift by auto-selecting the first root memory file after the root tree loads, matching the prototype's selected-document first screen while preserving manual file selection.
- Mock visual evidence now covers Chat -> Memory shell navigation, dark/en, dark/zh, light/en, light/zh, selected-file Browse state, explicit file-read screenshot, degraded Search, Health, Dreams, and destructive-action cancellation.

### Real Gateway evidence

- Real E2E created a run-scoped Markdown file under the isolated `main` workspace, verified `/api/memory/browse` listed it, and verified `/api/memory/browse?read=1` read back the run id.
- Real route evidence verified canonical `POST /api/memory/search` and compatibility `GET /api/memory/search` both return the explicit LanceDB-not-implemented `501` degraded shape.
- Real route evidence verified `/api/memory/health` and safe dreams `read`; destructive dream actions were not executed because they are not fixture-safe without disposable memory-root cleanup proof.
- Real UI evidence covered Chat -> Memory navigation, dark/en, dark/zh, light/en, light/zh, Browse/Search/Health/Dreams, selected fixture read, confirmation-gated dream action cancellation, BFF-only browser transport, and zero unexpected console/page/API errors.

### Accepted exceptions

- Deck shell chrome and runtime fixture content differ from the standalone static prototype.
- Semantic search remains explicitly degraded until a LanceDB-backed adapter exists.
- Mutating dreams actions remain skipped-safe in real automation until disposable memory-root cleanup proof exists.
- Per-agent dreams remain a Gateway capability gap because current `doctor.memory.*` methods resolve the default configured agent.

Code truth remains authoritative over this note. If Gateway memory contracts change, update the BFF route contracts, frontend API wrappers, and this matrix before widening Memory UI claims.

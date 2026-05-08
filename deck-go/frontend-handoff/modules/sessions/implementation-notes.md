# sessions implementation notes

Status: implemented - real-contract verified on 2026-05-04.

OpenSpec change: `frontend-sessions-real-contract-verification`.

Follow-up closure: `deck-go-sessions-chat-contract-completion` archived the
module-level contract gap from the head matrix by adding chat/session write
actions to the shared mutation evidence contract and routing the production
facades through the generated mutation metadata.

## Summary

- Preserved the existing production Sessions workbench. It already used the Deck
  BFF/API facade for inventory, preview, detail, history, usage, compaction,
  lineage, mutations, transcript cache, and local export.
- Fixed deterministic contract drift in `deck-ui.contract.json`: the
  `sessions-chat` domain now lists the Sessions DTOs, endpoints, actions, and
  key field metadata used by the production panel.
- Added `DeckGoChatCompactRequest` to the Deck DTO authority and changed
  `compactChatSession()` to use that DTO instead of an inline request object.
- Added L2 real-stack E2E coverage for safe read routes, empty/degraded optional
  routes, skipped-safe mutation boundaries, and browser BFF-only behavior.
- Added mutation evidence rows for chat/session create, send, abort, steer,
  reset, clear, delete, patch, compact, compaction branch/restore, and chat
  projection persistence.
- Refactored `frontend-new/src/api.ts` chat/session mutation facades through the
  shared mutation evidence helper without changing their response DTOs.
- No real reset, clear, delete, patch, compact, branch, or restore was executed
  against operator state. Real E2E validates missing-key rejection for those
  routes instead.

## Module convergence baseline - 2026-05-07

OpenSpec change: `deck-go-sessions-module-convergence`.

Fresh context read:

- OpenSpec artifacts:
  `openspec/changes/deck-go-sessions-module-convergence/{proposal.md,design.md,tasks.md,specs/**/spec.md}`.
- Gateway authority:
  `src/gateway/server-methods/sessions-method-defs.ts`,
  `src/gateway/protocol/schema/sessions.ts`.
- Deck BFF/runtime:
  `deck-go/backend/internal/server/chat.go`,
  `deck-go/backend/internal/runtime/openclaw/session_commands.go`,
  `deck-go/backend/internal/runtime/openclaw/gateway_queries.go`,
  `deck-go/backend/internal/runtime/projection/sessions.go`.
- Deck contracts:
  `deck-go/contracts/source/deck-api.contract.ts`,
  `deck-go/contracts/source/deck-ui.contract.json`,
  `deck-go/contracts/source/deck-list-queries.contract.json`,
  `deck-go/contracts/source/deck-mutations.contract.json`.
- Frontend implementation and tests:
  `deck-go/frontend-new/src/api.ts`,
  `deck-go/frontend-new/src/components/panels/sessions/`,
  `deck-go/test/e2e/sessions-visual.spec.ts`,
  `deck-go/test/e2e/sessions-real-gateway.spec.ts`.

Worktree baseline:

- Before implementation, local work was committed and pushed to
  `origin/enhanced` at `30b155e224`.
- `git status -sb` before this Sessions implementation showed
  `## enhanced...origin/enhanced`.

Accepted findings:

- Sessions is a selected-session operations workbench, not a second Chat
  composer. Its product responsibilities are browse/locate, inspect/understand,
  and guarded maintenance.
- `sessions.create`, `sessions.send`, `sessions.abort`, and `sessions.steer`
  are Gateway session methods but Deck product ownership is Chat/runtime
  execution. Sessions may show context or navigation only.
- Reset, clear, compact, delete, and compaction restore are
  confirmation-required in `deck-ui.contract.json`.
- Production currently confirms compact/delete only. Reset/clear in
  `SessionsPanel.tsx` and restore in `SessionCompactionHistory.tsx` execute on
  first click. This is deterministic safety drift for this convergence pass.
- Usage, compaction, and lineage should remain selected-session requests; the
  Inspector tabs only change hierarchy and visibility.

Corrected / narrowed findings:

- Gateway supports more parameters than Deck currently exposes. This is not
  automatically a bug: extra list filters, preview limits, compact `maxLines`,
  delete transcript/hook flags, create `key/task`, and advanced patch fields are
  Gateway-only or BFF/product-unsurfaced unless a product decision promotes
  them.
- The existing BFF route set is sufficient for the current Sessions product
  surface. No DTO or Go route expansion is required before the UI convergence
  unless implementation finds a deterministic forwarding bug.

Rejected for this change:

- Adding a Chat message composer, live send, abort, or steer control to
  Sessions.
- Adding server-side cursor pagination or live panel stream refresh.
- Building an exhaustive schema editor for every `sessions.patch` field.
- Adding new canonical design tokens or dependencies for tabs.

Deferred / residual decisions:

- Whether Deck should expose Gateway-only list filters such as
  `includeGlobal`, `includeUnknown`, `label`, or `spawnedBy`.
- Whether compact should expose `maxLines`.
- Whether delete should expose `deleteTranscript` and `emitLifecycleHooks`.
- Whether advanced patch fields need a separate guarded admin editor.
- Whether Sessions should add an "open in Chat" navigation affordance after
  shell route semantics for session deep links are settled.

## Contract Chain Matrix - refreshed 2026-05-07

| Workflow                         | Owner / product role                  | Frontend surface                                  | BFF route                                    | Gateway/BFF source                                    | Classification                                                                 |
| -------------------------------- | ------------------------------------- | ------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| Inventory                        | Sessions-owned browse                 | `fetchSessions()`                                 | `GET /api/sessions`                          | `sessions.list` via Go BFF                            | supported                                                                      |
| Chat sessions alias              | Sessions-owned compatibility          | `fetchSessions()` compatible alias                | `GET /api/chat/sessions`                     | `sessions.list` via Go BFF                            | supported                                                                      |
| Preview rows                     | Sessions-owned browse                 | `fetchSessionPreviews()`                          | `POST /api/chat/sessions/preview`            | `sessions.preview`                                    | supported; empty-valid when inventory is empty                                 |
| Selected detail                  | Sessions-owned inspect                | `fetchSessionDetail()`                            | `GET /api/sessions/{sessionKey}`             | `sessions.get` plus list projection                   | supported; real data variation may be degraded                                 |
| Transcript history               | Sessions-owned inspect                | `fetchChatHistory()` + transcript cache           | `GET /api/chat/history`                      | Gateway session history through BFF normalization     | supported; real data variation may be degraded                                 |
| Transcript cache                 | Product-local inspect                 | `getCachedTranscript()` / `setCachedTranscript()` | local memory only                            | frontend cache                                        | supported                                                                      |
| Transcript export                | Product-local inspect                 | JSON/Markdown export preview                      | local only                                   | loaded transcript messages                            | supported; no server export endpoint                                           |
| Usage/context                    | Sessions-owned inspect                | `fetchUsageSessions()`                            | `GET /api/usage/sessions`                    | `sessions.usage` aggregate                            | supported; empty-valid when no usage rows exist                                |
| Usage logs                       | Sessions-owned inspect                | `fetchUsageSessionLogs()`                         | `GET /api/usage/sessions/logs`               | `sessions.usage.logs`                                 | supported; empty-valid when no log rows exist                                  |
| Compaction list                  | Sessions-owned inspect                | `fetchCompactionCheckpoints()`                    | `POST /api/chat/compaction` action `list`    | `sessions.compaction.list`                            | supported; degraded when Gateway has no checkpoints/method support             |
| Compaction branch                | Sessions-owned maintenance            | `branchCompactionCheckpoint()`                    | `POST /api/chat/compaction` action `branch`  | `sessions.compaction.branch`                          | supported by code/mock; skipped-safe in L2 unless run-scoped checkpoint exists |
| Compaction restore               | Sessions-owned guarded maintenance    | `restoreCompactionCheckpoint()`                   | `POST /api/chat/compaction` action `restore` | `sessions.compaction.restore`                         | supported, destructive; requires confirmation gate in this change              |
| Subagent lineage                 | Sessions inspect / Subagents adjacent | `fetchSubagentLineage()`                          | `POST /api/deck/subagents` action `lineage`  | `deck.subagents.lineage`                              | supported for subagent-like sessions; degraded/empty-valid otherwise           |
| Parent/child navigation          | Sessions-owned relation navigation    | local selection + Subagents panel navigation      | local UI state                               | selected session relationships                        | supported                                                                      |
| Reset                            | Sessions-owned guarded maintenance    | `resetSession()`                                  | `POST /api/chat/sessions/reset`              | `sessions.reset`                                      | supported, destructive; current first-click behavior is safety drift           |
| Clear                            | Sessions-owned guarded maintenance    | `clearSession()`                                  | `POST /api/chat/sessions/clear`              | `sessions.clear`                                      | supported, destructive; current first-click behavior is safety drift           |
| Patch                            | Sessions-owned scoped maintenance     | `patchSession()`                                  | `POST /api/chat/sessions/patch`              | `sessions.patch`                                      | supported for safe scoped fields; exhaustive editor deferred                   |
| Compact                          | Sessions-owned guarded maintenance    | `compactChatSession()`                            | `POST /api/chat/compact`                     | `sessions.compact`                                    | supported, destructive; skipped-safe in L2                                     |
| Delete                           | Sessions-owned guarded maintenance    | `deleteSession()`                                 | `DELETE /api/chat/sessions`                  | `sessions.delete`                                     | supported, destructive; skipped-safe in L2                                     |
| Chat session create              | Chat/runtime adjacent-owned           | `createChatSession()`                             | `POST /api/chat/sessions/create`             | `sessions.create`                                     | fixture-safe under isolated cpa+main real seed; not Sessions UI control        |
| Chat send                        | Chat/runtime adjacent-owned           | `sendChatMessage()`                               | `POST /api/chat/send`                        | `sessions.send`                                       | fixture-safe under isolated cpa+main real seed; not Sessions UI control        |
| Chat abort                       | Chat/runtime adjacent-owned           | `abortChatRun()`                                  | `POST /api/chat/abort`                       | `sessions.abort`                                      | supported by code; active-run execution deferred; not Sessions UI control      |
| Chat steer                       | Chat/runtime adjacent-owned           | `steerChatSession()`                              | `POST /api/chat/steer`                       | `sessions.steer`                                      | supported by code; active-session execution deferred; not Sessions UI control  |
| Chat projection persist          | Product-local Chat adjacent           | `persistChatProjection()`                         | `POST /api/chat/projection`                  | deck-go local validation/no-op                        | fixture-safe product-local behavior; not Gateway-backed persistence            |
| BFF-only browser access          | Cross-cutting safety                  | `openDeck(..., "sessions")`                       | browser -> deck-go backend only              | runtime owns Gateway calls                            | supported; L2 verifies no direct Gateway HTTP/WebSocket                        |
| Extra list filters               | Gateway-only / product-deferred       | not exposed                                       | no Deck query metadata                       | `sessions.list` params                                | projected; classify before UI expansion                                        |
| Preview limits                   | Gateway-only / product-deferred       | not exposed                                       | BFF reads keys only                          | `sessions.preview.limit/maxChars`                     | projected; no current product need                                             |
| Create `key` / `task`            | Gateway-only / Chat fixture           | not exposed in Deck BFF create                    | BFF accepts agent/model/label/message/parent | `sessions.create.key/task`                            | projected; runtime test fixture uses Gateway RPC directly                      |
| Compact `maxLines`               | Gateway-only / product-deferred       | not exposed                                       | BFF sends key only                           | `sessions.compact.maxLines`                           | projected                                                                      |
| Delete transcript / hook flags   | Gateway-only / safety-deferred        | not exposed                                       | BFF sends key only                           | `sessions.delete.deleteTranscript/emitLifecycleHooks` | projected; real cleanup uses Gateway RPC only                                  |
| Advanced patch fields            | Gateway-only / product-deferred       | not exposed                                       | BFF forwards if caller supplies fields       | `sessions.patch` execution/spawn/subagent fields      | projected; not an exhaustive UI editor                                         |
| Server-side cursor pagination    | Unsupported/projected                 | not exposed                                       | none                                         | none                                                  | unsupported/projected                                                          |
| Real-time Sessions panel refresh | Unsupported/projected                 | manual refresh plus cache invalidation            | stream exists elsewhere                      | no panel-owned live refresh contract                  | unsupported/projected                                                          |

## Module convergence closeout - 2026-05-07

OpenSpec change: `deck-go-sessions-module-convergence`.

Active prototype:

- `frontend-handoff/modules/sessions/prototype.html` is now the active
  list/workbench/default-open Inspector target.
- `frontend-handoff/modules/sessions/prototype-v1-dense.html` preserves the
  previous dense target as a backup.

Deterministic fixes:

- Production `SessionsPanel` now uses inventory + selected workbench +
  default-open Inspector tabs (`Overview`, `Usage`, `Compaction`, `Lineage`,
  `Actions`) while preserving the existing selected-session data loads and
  transcript cache behavior.
- Inspector tab panels stay mounted so usage/context, compaction, and lineage
  contract paths remain exercised; inactive tabs are hidden with explicit CSS
  so visual density is actually reduced.
- Reset, clear, compact, delete, and compaction restore now follow
  confirmation-required UI metadata. Focused tests prove first click arms the
  action without invoking the mutation wrapper.
- `SessionUsageDetails` now narrows workspace file reductions with a typed
  accumulator so the production frontend build remains strict-type clean.
- Sessions real E2E now verifies shell navigation into Sessions, dark/en and
  light/zh variants, BFF-only browser transport, Inspector tab switching, and
  compact confirmation arming against run-scoped real fixture data.

Fresh evidence:

- Focused frontend:
  `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/sessions/SessionsPanel.test.tsx`
  -> 13 passed.
- Mock visual:
  `cd deck-go && pnpm exec playwright test test/e2e/sessions-visual.spec.ts --config playwright.config.ts --output .local/sessions-module-convergence-mock-visual --reporter=line`
  -> 1 passed.
- Prototype-current comparison:
  prototype screenshot
  `.local/sessions-module-convergence-prototype/sessions--prototype.png`,
  mock-current screenshot
  `.local/sessions-module-convergence-mock-visual/sessions-visual-sessions-m-ae8b9-h-contract-shaped-mock-data/sessions-workbench-ready.png`,
  side-by-side sheet
  `.local/sessions-module-convergence-parity-report/sheet-20.png`, and
  structured verdict
  `.omx/state/sessions-module-convergence/ralph-progress.json`.
- Visual verdict: `pass`, score `91`, accepted exceptions are production shell
  chrome, live fixture copy/timestamps, and tighter shell viewport columns.
- Real Gateway:
  `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/sessions-real-gateway.spec.ts --config playwright.config.ts --output .local/sessions-module-convergence-real-gateway --reporter=line`
  -> 2 passed.
- Build:
  `cd deck-go && make frontend-build` -> passed.
- OpenSpec:
  `openspec validate deck-go-sessions-module-convergence --strict` -> passed.

## Verification Evidence

- Handoff prototype smoke: `python3 -m http.server 8898` plus Playwright open of
  `prototype.html`; title `deck-go sessions prototype`, 19 buttons, no browser
  console/page errors.
- Focused frontend: `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/sessions/SessionsPanel.test.tsx` -> 11 passed.
- Focused Go packages: `cd deck-go/backend && GOCACHE=/tmp/deck-go-buildcache go test ./internal/server ./internal/api/http ./internal/runtime/openclaw` -> passed.
- L1 mock visual: `cd deck-go && pnpm exec playwright test test/e2e/sessions-visual.spec.ts --config playwright.config.ts` -> 1 passed.
- L2 real stack: `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/sessions-real-gateway.spec.ts --config playwright.config.ts` -> 2 passed.
- E2E compile/skip gate: `cd deck-go && pnpm exec playwright test test/e2e/sessions-real-gateway.spec.ts --config playwright.config.ts` -> 2 skipped.
- Contract checks: `make contracts-check`, `make ui-metadata-check`, and `make contract-gate` -> passed.
- Build: `make frontend-build` -> passed.
- Follow-up mutation closure:
  `cd deck-go && make mutation-evidence-contract-test && make mutation-evidence-contract-check` -> passed;
  `cd deck-go/frontend-new && npm run test:deck-ui -- src/lib/mutation-evidence.test.ts src/api.chat-helpers.test.ts` -> 58 passed.

## Prototype parity remediation - 2026-05-05

OpenSpec child change:
`deck-go-frontend-sessions-prototype-parity-remediation`.

Deterministic fixes:

- The Sessions usage/context panel now tolerates partial real
  `contextWeight` payloads where `tools.entries`, `skills.entries`, or
  `injectedWorkspaceFiles` are missing/null.
- The Go OpenClaw adapter now normalizes context-weight system prompt, tools,
  skills, and workspace-file arrays into stable Deck-facing DTO shape, and
  omits empty generated context-weight structs that contain no real signal.
- The Sessions header title and eyebrow now use i18n keys so real E2E can
  verify English and Chinese renders.
- The top metric row was realigned with the active prototype: selected session,
  context, usage, compactions, and lineage.

Prototype parity evidence:

- Mock visual:
  `cd deck-go && pnpm exec playwright test test/e2e/sessions-visual.spec.ts --config playwright.config.ts --output .local/sessions-remediation-mock-visual --reporter=line` -> passed.
- Contact sheet and verdict:
  `deck-go/.local/sessions-prototype-remediation-parity-report/sheet-20.png`
  and `deck-go/.local/sessions-prototype-remediation-parity-report/verdict.md`.
- Verdict: `pass-with-exceptions`.
- Strengthened real E2E:
  `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/sessions-real-gateway.spec.ts --config playwright.config.ts --output .local/sessions-remediation-real-e2e-strengthened --reporter=line` -> 2 passed. Evidence includes run-scoped `sessions.create` / `sessions.delete` fixture cleanup, detail readback, shell navigation from Chat to Sessions, dark/en and light/zh renders, session search/selection, transcript search, compact-confirm interaction, and BFF-only browser transport.

Accepted exceptions:

- The active Deck shell chrome appears in mock-current evidence and is absent
  from the standalone prototype.
- Production uses canonical deck-go atom/token chrome and the active shell
  viewport, so the action column is slightly tighter than the standalone
  1440px prototype.

## Residual Risks

- Real Gateway can expose zero sessions, usage rows, compaction checkpoints, or
  lineage nodes. Those are valid empty/degraded states when route shapes and UI
  rendering stay correct.
- Destructive real mutation proof remains intentionally skipped-safe until a
  disposable session fixture and cleanup policy are defined.
- Compaction action result schemas remain broad action envelopes.
- Server-side cursor pagination and live panel refresh need explicit Gateway/BFF
  contract work before the UI should claim those capabilities.
- `POST /chat/projection` currently validates `sessionKey` and returns `{ok:
true}`; it is contracted as product-local/no-op behavior until a future
  proposal implements real projection persistence.

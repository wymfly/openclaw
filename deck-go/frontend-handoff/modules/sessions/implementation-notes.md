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

## Contract Chain Matrix

| Workflow                         | Frontend surface                                  | BFF route                                    | Gateway/BFF source                                | Classification                                                       |
| -------------------------------- | ------------------------------------------------- | -------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| Inventory                        | `fetchSessions()`                                 | `GET /api/sessions`                          | `sessions.list` via Go BFF                        | supported                                                            |
| Chat sessions alias              | `fetchSessions()` compatible alias                | `GET /api/chat/sessions`                     | `sessions.list` via Go BFF                        | supported                                                            |
| Preview rows                     | `fetchSessionPreviews()`                          | `POST /api/chat/sessions/preview`            | `sessions.preview`                                | supported when keys exist; empty-valid when inventory is empty       |
| Selected detail                  | `fetchSessionDetail()`                            | `GET /api/sessions/{sessionKey}`             | `sessions.get` plus list projection               | supported; L2 accepts degraded route status for real data variation  |
| Transcript history               | `fetchChatHistory()` + transcript cache           | `GET /api/chat/history`                      | Gateway session history through BFF normalization | supported; L2 accepts degraded route status for real data variation  |
| Transcript cache                 | `getCachedTranscript()` / `setCachedTranscript()` | local memory only                            | frontend cache                                    | supported                                                            |
| Transcript export                | JSON/Markdown export preview                      | local only                                   | loaded transcript messages                        | supported; no server export endpoint                                 |
| Usage/context                    | `fetchUsageSessions()`                            | `GET /api/usage/sessions`                    | `sessions.usage` aggregate                        | supported; empty-valid when no usage rows exist                      |
| Usage logs                       | `fetchUsageSessionLogs()`                         | `GET /api/usage/sessions/logs`               | `sessions.usage.logs`                             | supported; empty-valid when no log rows exist                        |
| Compaction list                  | `fetchCompactionCheckpoints()`                    | `POST /api/chat/compaction` action `list`    | `sessions.compaction.list`                        | supported; degraded when Gateway has no checkpoints/method support   |
| Compaction branch                | `branchCompactionCheckpoint()`                    | `POST /api/chat/compaction` action `branch`  | `sessions.compaction.branch`                      | supported by code and mock tests; skipped-safe in L2                 |
| Compaction restore               | `restoreCompactionCheckpoint()`                   | `POST /api/chat/compaction` action `restore` | `sessions.compaction.restore`                     | supported by code and mock tests; skipped-safe in L2                 |
| Subagent lineage                 | `fetchSubagentLineage()`                          | `POST /api/deck/subagents` action `lineage`  | `deck.subagents.lineage`                          | supported for subagent-like sessions; degraded/empty-valid otherwise |
| Parent/child navigation          | local selection + Subagents panel navigation      | local UI state                               | selected session relationships                    | supported                                                            |
| Reset                            | `resetSession()`                                  | `POST /api/chat/sessions/reset`              | `sessions.reset`                                  | supported by code and backend tests; skipped-safe in L2              |
| Clear                            | `clearSession()`                                  | `POST /api/chat/sessions/clear`              | `sessions.clear`                                  | supported by code and backend tests; skipped-safe in L2              |
| Patch                            | `patchSession()`                                  | `POST /api/chat/sessions/patch`              | `sessions.patch`                                  | supported by code and backend tests; skipped-safe in L2              |
| Compact                          | `compactChatSession()`                            | `POST /api/chat/compact`                     | `sessions.compact`                                | supported by code and backend tests; skipped-safe in L2              |
| Delete                           | `deleteSession()`                                 | `DELETE /api/chat/sessions`                  | `sessions.delete`                                 | supported by code and backend tests; skipped-safe in L2              |
| Chat session create              | `createChatSession()`                             | `POST /api/chat/sessions/create`             | `sessions.create`                                 | fixture-safe under isolated cpa+main real seed                       |
| Chat send                        | `sendChatMessage()`                               | `POST /api/chat/send`                        | `sessions.send`                                   | fixture-safe under isolated cpa+main real seed                       |
| Chat abort                       | `abortChatRun()`                                  | `POST /api/chat/abort`                       | `sessions.abort`                                  | supported by code; real active-run execution deferred                |
| Chat steer                       | `steerChatSession()`                              | `POST /api/chat/steer`                       | `sessions.steer`                                  | supported by code; real active-session execution deferred            |
| Chat projection persist          | `persistChatProjection()`                         | `POST /api/chat/projection`                  | deck-go local validation/no-op                    | fixture-safe product-local behavior; not Gateway-backed persistence  |
| BFF-only browser access          | `openDeck(..., "sessions")`                       | browser -> deck-go backend only              | runtime owns Gateway calls                        | supported; L2 verified no direct Gateway HTTP/WebSocket              |
| Server-side cursor pagination    | not exposed                                       | none                                         | none                                              | unsupported/projected                                                |
| Real-time Sessions panel refresh | manual refresh plus cache invalidation            | stream exists elsewhere                      | no panel-owned live refresh contract              | unsupported/projected                                                |
| Exhaustive patch editor          | scoped model/label/thinking/fast controls         | `POST /api/chat/sessions/patch`              | open patch payload                                | degraded by design; no full schema editor                            |

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

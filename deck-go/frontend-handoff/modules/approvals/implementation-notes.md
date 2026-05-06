# Approvals Implementation Notes

## Production Migration

- Implemented the v2 security-operations workbench in `deck-go/frontend-new/src/components/panels/approvals/` while keeping the existing panel registry, BFF-only frontend API facade, shared deck navigation helpers, and approval SSE hook.
- Consolidated exec and plugin requests into one expiry-ordered queue with All/Exec/Plugin filters, live search, selected detail tabs, countdown evidence, a detail-side decision bar, raw payload evidence, and a modal policy editor.
- Kept decision reason capture visibly unsupported because current generated Gateway resolve params are only `{ id, decision }`.
- Kept recent decisions and summary KPIs as documented follow-up BFF projections rather than fabricating typed audit or summary data.
- Updated Approvals UI metadata source and regenerated generated UI metadata/docs so policy routes and `/api/stream` are part of the visible contract chain.

## Contract Drift Fixed

- Corrected handoff route truth from stale `GET /api/events/stream` to the actual Deck BFF `GET /api/stream`.
- Corrected decision envelope examples from underscore values and `reason?` to current Gateway-supported hyphenated values: `allow-once`, `allow-always`, `deny`.
- Corrected `DeckGoPluginApprovalEntry` documentation to the current Deck-facing DTO (`pluginId`, `command`, `description`, `createdAtMs`, `expiresAtMs`, `status`, `decision`) instead of prototype-only `capabilityKind` / `origin` / `sourceUrl` fields.
- Corrected `contracts/source/deck-ui.contract.json` to include approval policy DTOs, pending exec DTOs, server stream DTO, policy read/write routes, `/api/stream`, and `approvals.policy.save`.
- Corrected stale approval queue contract status: `exec.approval.list` and `plugin.approval.list` now have generated Gateway result schemas; the TypeScript protocol generator emits object-array results as array type aliases.
- Added the existing `plugin.approval.resolve` success result schema from shared Gateway handler truth (`{ ok: true }`).
- Added mutation evidence for `approvals.policy.save`, `approvals.exec.resolve`, and `approvals.plugin.resolve`, and corrected `updateApprovalsPolicy()` to return `DeckGoApprovalPolicyResponse`.

## Contract Matrix

| Workflow               | Frontend                                | Deck BFF                      | Gateway / source                                                                                         | Status                                                                                               |
| ---------------------- | --------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Policy read            | `fetchApprovalsPolicy()`                | `GET /api/approvals/policy`   | `exec.approvals.get` typed                                                                               | supported                                                                                            |
| Policy save            | `updateApprovalsPolicy(file, baseHash)` | `PUT /api/approvals/policy`   | `exec.approvals.set` typed; `approvals.policy.save` mutation evidence                                    | supported; real mutation deferred                                                                    |
| Pending exec queue     | `fetchPendingApprovals()`               | `GET /api/approvals/pending`  | `exec.approval.list` typed; BFF-normalized to `DeckGoPendingApprovalsResponse`                           | supported                                                                                            |
| Plugin queue           | `fetchPluginApprovals()`                | `GET /api/approvals/plugins`  | `plugin.approval.list` typed; Deck-facing response stays defensive for compatibility                     | supported                                                                                            |
| Exec decision          | `resolveApproval(id, decision)`         | `POST /api/approvals`         | `exec.approval.resolve` typed; `approvals.exec.resolve` mutation evidence                                | supported; run-scoped real fixture path implemented but full UI run blocked by real-stack cold start |
| Plugin decision        | `resolvePluginApproval(id, decision)`   | `POST /api/approvals/plugins` | `plugin.approval.resolve` typed with `{ ok: true }` result; `approvals.plugin.resolve` mutation evidence | supported; real mutation skipped-safe                                                                |
| Stream updates         | `useApprovalsStream()`                  | `GET /api/stream`             | Deck SSE stream, open event envelope                                                                     | supported/degraded if stream unavailable                                                             |
| Decision reason        | disabled UI affordance                  | none                          | generated resolve params do not include `reason`                                                         | unsupported                                                                                          |
| Recent decisions       | local raw action evidence only          | future activity projection    | no typed approval audit contract                                                                         | unsupported follow-up                                                                                |
| Summary KPIs           | local queue/policy counts               | future summary projection     | no `approvals.summary` RPC                                                                               | unsupported follow-up                                                                                |
| Browser Gateway access | none                                    | browser calls Deck BFF only   | no direct Gateway HTTP/WS                                                                                | supported; verified L1/L2                                                                            |

## Verification Evidence

- Focused frontend: `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/approvals/ApprovalsPanel.test.tsx` -> 7 tests passed.
- L1 mock visual: `cd deck-go && pnpm exec playwright test test/e2e/approvals-visual.spec.ts --config playwright.config.ts --output .local/approvals-remediation-mock-visual-final --reporter=line` -> 1 passed.
- Prototype-current comparison: `cd deck-go && node scripts/generate-prototype-parity-report.mjs --prototype-dir .local/prototype-gap-audit --mock-dir .local/approvals-remediation-mock-visual-final --out-dir .local/approvals-prototype-remediation-parity-report-final --sheet-size 1`; reviewed `sheet-5.png` as `pass-with-exceptions`.
- Build: `cd deck-go && make frontend-build` -> passed after narrowing local `DecisionEvidence.kind`.
- L2 real safe read: `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/approvals-real-gateway.spec.ts --config playwright.config.ts --output .local/approvals-remediation-real-e2e-beforeall-timeout --reporter=line` reached the real stack and passed the safe approval read route test before the product-surface fixture path failed.
- L2 real product-surface circuit breaker: subsequent attempts fixed two deterministic issues (`exec.approval.request` rejects unsupported `runId`; approval request fixture must use `twoPhase: true` after the Approvals page has connected), then stopped on real-stack cold-start evidence in `.local/approvals-remediation-real-e2e-two-phase-fixture`: the Gateway child process repeatedly rebuilt because `scripts/run-node.mjs` reported `dirty_watched_tree` and was still in `runtime-postbuild` dependency staging when RPC readiness timed out.

## Residual Risks

- Full real product-surface proof is not complete until the shared real-stack cold-start problem is fixed or the Gateway child can start from a trusted prebuilt runtime in dirty worktrees.
- Real policy save remains deferred because it mutates operator policy state. The run-scoped exec approval fixture is now implemented with supported Gateway fields, two-phase request semantics, and BFF cleanup, but it still needs a clean real-stack run to prove the full UI path.
- The v2 prototype's persisted recent-decision strip, 1h summary KPIs, plugin `capabilityKind`/`origin`/`sourceUrl`, and reason capture require future Gateway/BFF contract work.
- Countdown display is derived from `expiresAtMs` and local browser time; it is not server-authoritative timing.

## Design-System Feedback

- Kept `ApprovalMetric`, queue rows, decision bar, countdown chip, policy editor, and raw evidence as module-local molecules for now.
- Promotion candidates remain `CountdownTimer`, `DecisionActionGroup`, `SelectableQueueRow`, and a modal policy editor pattern, but any promotion should happen in a separate design-system proposal after at least two modules share the same shape.

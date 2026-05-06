## 1. Explore Config Write Truth

- [x] 1.1 Inventory config-like write routes/actions across Go BFF handlers, runtime adapters, generated Gateway methods, frontend facades, and module panels.
- [x] 1.2 Classify each write as Gateway-backed, Deck-derived, Deck-local, or unsupported/deferred.
- [x] 1.3 Identify deterministic drift in baseHash/hash naming, response DTOs, conflict behavior, idempotency claims, rollback/audit copy, and tests.

## 2. Write-Safety Governance

- [x] 2.1 Add a source-owned config-write governance contract with owner, route/action, Gateway basis, base-hash mode, response hash mode, conflict behavior, idempotency status, rollback/audit status, and evidence.
- [x] 2.2 Add a deterministic JSON/Markdown write-safety report and check.
- [x] 2.3 Wire the write-safety check into `contract-gate`.
- [x] 2.4 Ensure multiplexed routes such as `/api/deck/agents`, `/api/deck/routing`, and `/api/deck/identity` are governed at action level.

## 3. Contract And Code Alignment

- [x] 3.1 Normalize Deck-facing DTOs and generated TS/Go artifacts for config-like write responses where deterministic drift exists.
- [x] 3.2 Update backend BFF/runtime adapters to preserve baseHash forwarding and expose stable conflict/degraded evidence where code truth supports it.
- [x] 3.3 Update frontend facades and panels to consume contract-backed write fields and preserve local edits on conflict.
- [x] 3.4 Remove or defer unsupported rollback/audit/history/idempotency claims from frontend copy, mocks, docs, and handoff notes.

## 4. Regression Evidence

- [x] 4.1 Add or refresh backend tests for config.apply/config.patch, models config save, routing/identity/agents config mutations, and conflict/degraded behavior.
- [x] 4.2 Add or refresh frontend tests for current-baseHash forwarding, next-hash adoption, missing-baseHash blocking, and conflict preservation.
- [x] 4.3 Add or refresh mock E2E/fixture evidence only where it verifies contract-shaped safety behavior.
- [x] 4.4 Record safe real Gateway evidence or bounded blocker for no-op config write attempts without mutating operator state.

## 5. Synchronization And Verification

- [x] 5.1 Refresh generated Deck API artifacts, dynamic-surface reports, endpoint/route governance if affected, contract inventory, and head matrix evidence.
- [x] 5.2 Run `openspec validate --type change deck-go-config-write-safety-contracts --strict`.
- [x] 5.3 Run focused write-safety report/check verification.
- [x] 5.4 Run focused backend/frontend tests for changed write paths.
- [x] 5.5 Run `cd deck-go && make contract-gate`.
- [x] 5.6 Run `git diff --check`.
- [x] 5.7 Confirm archive readiness with verification evidence.

Verification evidence:

- `openspec validate --type change deck-go-config-write-safety-contracts --strict` passed.
- `cd deck-go && make config-write-safety-check` passed with 16 governed writes.
- `cd deck-go && make contract-inventory` passed.
- `cd deck-go/backend && go test ./internal/server ./internal/runtime/openclaw` passed.
- `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/config/ConfigPanel.test.tsx src/components/panels/channels/ChannelsPanel.test.tsx src/components/panels/approvals/ApprovalsPanel.test.tsx src/components/panels/routing/RoutingPanel.test.tsx src/components/panels/identity/IdentityPanel.test.tsx src/components/panels/agents/__tests__/AgentsPanel.test.tsx src/components/panels/skills/SkillsPanel.test.tsx src/components/panels/models/ModelsPanel.test.tsx src/components/panels/settings/SettingsPanel.test.tsx` passed with 9 files / 85 tests.
- `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/config-real-gateway.spec.ts --config playwright.config.ts` passed with 2 tests, using isolated OpenClaw state and bounded noop apply behavior.
- `cd deck-go/frontend-new && npm run build` passed.
- `cd deck-go && make contract-gate` passed.
- `git diff --check` passed.

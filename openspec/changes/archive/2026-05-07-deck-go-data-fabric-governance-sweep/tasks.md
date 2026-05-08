## 1. Contract Truth And Residual Inventory

- [x] 1.1 Re-read scoped contract sources, generated DTOs, `src/api.ts`, existing Data Fabric modules, and residual panels before production edits.
- [x] 1.2 Produce a code-truth residual inventory covering direct panel/hook fetch lifecycles, direct transport imports, and store-owned server fetch lifecycle methods.
- [x] 1.3 Confirm the proposal/design/spec deltas match the residual inventory; update artifacts before implementation if the scan changes the scope materially.

## 2. Remaining Data Fabric Coverage

- [x] 2.1 Add or reuse a Data Fabric capabilities query and migrate `useCapabilities()` consumers without changing their product behavior.
- [x] 2.2 Migrate `ApiExplorerPanel` Gateway describe loading to the existing Gateway Data Fabric describe query while keeping request builder and history state local.
- [x] 2.3 Add `data/modules/identity` with identity links query, link/unlink mutation wrappers, invalidation, keys, and focused tests.
- [x] 2.4 Migrate `IdentityPanel` to Identity and Agents Data Fabric hooks/mutations while preserving dialogs, selection, action banners, and local filters.
- [x] 2.5 Add `data/modules/subagents` for subagent runs and lineage query ownership, plus tests for keys/freshness/cache behavior.
- [x] 2.6 Migrate `SubagentsPanel` to Data Fabric for agents/config/subagent runs/lineage/config reads while preserving local filters, selection, permission drafts, and auto-refresh behavior.
- [x] 2.7 Migrate Chat secondary detail reads that are ordinary server-state reads (`SubagentTree`, `CompactionSummaryModal`) to existing or new Data Fabric query boundaries where practical.

## 3. Governance Registry And Exceptions

- [x] 3.1 Add a Data Fabric governance exception registry documenting approved residual patterns with file path, pattern, owner, reason, and follow-up status.
- [x] 3.2 Add focused governance tests that fail on new unapproved raw server-state lifecycle patterns in panel/shared-hook/store roots.
- [x] 3.3 Remove unused store-owned server fetch lifecycle methods where no production consumer remains; otherwise record them as explicit exceptions.
- [x] 3.4 Update `src/data/README.md` with the final Data Fabric governance rule, exception policy, and deferred hardening status.

## 4. Focused Tests

- [x] 4.1 Run focused data/governance tests for capabilities, identity, subagents, gateway describe reuse, and governance exception scanning.
- [x] 4.2 Run affected panel/hook tests for API Explorer, Identity, Subagents, capabilities consumers, and Chat secondary details.
- [x] 4.3 Run `openspec validate deck-go-data-fabric-governance-sweep --type change --strict`.

## 5. Project Verification

- [x] 5.1 Run `cd deck-go/frontend-new && npm run test:deck-ui`; fix failures related to this change and record exact unrelated baseline failures if any remain.
- [x] 5.2 Run `cd deck-go && make frontend-build`.
- [x] 5.3 Run `cd deck-go && make contract-gate`.
- [x] 5.4 Run L4 mock-functional browser evidence for touched residual panels where specs exist; record missing specs as explicit follow-up gaps.
- [x] 5.5 Run L5 real Gateway evidence for touched residual panels where specs exist or route-level substitutes are available; after two environment/startup failures without new narrowing evidence, record a circuit-breaker handoff.
- [x] 5.6 Create or update `verification.yaml` with command evidence, unrelated failures, missing-spec follow-ups, circuit-breaker handoffs if any, and archive readiness.
- [x] 5.7 Sync accepted spec deltas into main specs, rerun touched spec validation, confirm all tasks are checked only after fresh evidence, and archive the change when ready.

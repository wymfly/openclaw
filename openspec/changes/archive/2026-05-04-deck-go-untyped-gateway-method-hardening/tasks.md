## 1. Explore And Map Current Untyped Methods

- [x] 1.1 Confirm the documented P0 untyped method list from the completeness report and exception contract.
- [x] 1.2 Map each method to existing schema, missing schema, method module, handler shape, and generated artifact impact.

## 2. Schema And Metadata Hardening

- [x] 2.1 Add missing approval list result schemas and node invoke result envelope schema.
- [x] 2.2 Wire existing schemas for `logs.tail`, `commands.list`, `tools.catalog`, `tools.effective`, and `node.pending.enqueue`.
- [x] 2.3 Wire new schemas for `exec.approval.list`, `plugin.approval.list`, and `node.invoke`.
- [x] 2.4 Keep dynamic inner payloads documented as typed envelope leaves where required.

## 3. Contracts, Exceptions, And Reports

- [x] 3.1 Regenerate Gateway TS and Go protocol artifacts.
- [x] 3.2 Remove resolved P0 untyped exception records.
- [x] 3.3 Regenerate exception docs and Gateway describe completeness reports.
- [x] 3.4 Update the head matrix status and evidence for this child proposal.

## 4. Verification

- [x] 4.1 Run `openspec validate --type change deck-go-untyped-gateway-method-hardening --strict`.
- [x] 4.2 Run focused Gateway describe/schema tests.
- [x] 4.3 Run `cd deck-go && make contract-gate`.
- [x] 4.4 Run `git diff --check`.
- [x] 4.5 Confirm archive readiness with verification evidence.

## Verification Evidence

- `openspec validate --type change deck-go-untyped-gateway-method-hardening --strict` passed.
- `OPENCLAW_VITEST_MAX_WORKERS=1 pnpm test src/gateway/server-methods/describe.test.ts src/gateway/method-registry-data.test.ts` passed: 2 files, 15 tests.
- `cd deck-go/backend && go test ./internal/runtime/openclaw ./internal/gateway/generated` passed.
- `cd deck-go && make contract-gate` passed, including protocol check, gateway typecheck, describe completeness check, and contract-chain audit check.
- `git diff --check` passed.

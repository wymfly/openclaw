## 1. Explore Current Describe And Metadata Surfaces

- [x] 1.1 Inspect side-effect-free Gateway metadata, runtime registry/describe behavior, generated TS/Go Gateway artifacts, and deck-go exception records.
- [x] 1.2 Identify current missing method, params, result, event payload, and exception coverage without changing Gateway behavior.

## 2. Completeness Report And Gate

- [x] 2.1 Add a reusable Gateway describe/schema completeness report model that separates method names, typed membership, params schemas, result schemas, event payload schemas, and documented exceptions.
- [x] 2.2 Add a deck-go contract script that generates machine-readable JSON and Markdown report artifacts and supports check mode.
- [x] 2.3 Wire the completeness check into the relevant deck-go contract gate.
- [x] 2.4 Generate the synchronized report artifacts.

## 3. Runtime Describe Verification

- [x] 3.1 Add focused Gateway test coverage comparing runtime `gateway.describe` output with static metadata for method names, event names, typed membership, and untyped membership.
- [x] 3.2 Ensure methods with partial schema coverage are reported as incomplete rather than treated as complete response DTO coverage.

## 4. Head Matrix And Documentation

- [x] 4.1 Update `deck-go/docs/contract-chain-audit.matrix.json` so this child proposal status reflects implementation progress and evidence.
- [x] 4.2 Regenerate `deck-go/docs/contract-chain-audit.matrix.md`.
- [x] 4.3 Record any unresolved schema-hardening work as input to `deck-go-untyped-gateway-method-hardening` instead of resolving it here.

## 5. Verification

- [x] 5.1 Run `openspec validate --type change deck-go-gateway-describe-and-schema-completeness --strict`.
- [x] 5.2 Run focused Gateway describe/schema tests.
- [x] 5.3 Run the new deck-go completeness check and `make contract-gate`.
- [x] 5.4 Run `git diff --check`.
- [x] 5.5 Confirm the child change is archive-ready and update verification evidence.

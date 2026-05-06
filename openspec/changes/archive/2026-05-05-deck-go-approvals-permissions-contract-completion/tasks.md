## 1. Approvals Contract Audit

- [x] 1.1 Re-read the Approvals matrix row, prior real-contract evidence, Gateway schemas/methods, generated Gateway artifacts, Deck DTOs, endpoint classification, Go BFF routes, frontend facades, component tests, and implementation notes.
- [x] 1.2 Confirm visible Approvals workflows are supported, unsupported, skipped-safe, deferred, or stale with source evidence.

## 2. Gateway Protocol Closure

- [x] 2.1 Fix TypeScript Gateway protocol codegen so array-of-object schemas emit as array type aliases rather than object interfaces.
- [x] 2.2 Add regression coverage for array-of-object schema emission and approval list result output.
- [x] 2.3 Add the existing `plugin.approval.resolve` success result schema and wire it into method metadata.
- [x] 2.4 Regenerate and check Gateway protocol artifacts.

## 3. Approval Action Evidence Closure

- [x] 3.1 Add a Deck-facing approval resolution DTO if needed by mutation evidence.
- [x] 3.2 Add approval policy save, exec decision, and plugin decision action rows to the mutation evidence source contract.
- [x] 3.3 Regenerate Deck API and mutation evidence docs/TypeScript metadata.
- [x] 3.4 Refactor representative Approvals action facades through shared mutation evidence helpers and correct policy-save return typing.
- [x] 3.5 Add focused frontend tests for Approvals mutation evidence and facade behavior.

## 4. Evidence And Verification

- [x] 4.1 Update Approvals implementation notes, contract-chain audit matrix rows, generated matrix Markdown, and head verification evidence.
- [x] 4.2 Run focused protocol, mutation contract, frontend, build, contract-gate, OpenSpec, and diff checks.
- [x] 4.3 Archive the OpenSpec change and validate the archived spec.
